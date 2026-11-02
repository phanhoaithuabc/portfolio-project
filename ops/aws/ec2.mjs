import { parseArgs } from "node:util";
import {
  StartInstancesCommand,
  StopInstancesCommand,
  DescribeAddressesCommand,
  waitUntilInstanceRunning,
  waitUntilInstanceStatusOk,
  waitUntilInstanceStopped,
} from "@aws-sdk/client-ec2";
import { ec2, instanceInfo, preflightStop } from "./clients.mjs";
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    "instance-id": { type: "string" },
    account: { type: "string" },
    project: { type: "string", default: "portfolio" },
    environment: { type: "string", default: "lab" },
    region: { type: "string", default: "us-east-1" },
    "acknowledge-downtime": { type: "boolean", default: false },
    "acknowledge-dns-manual": { type: "boolean", default: false },
    apply: { type: "boolean", default: false },
  },
});
const [action] = positionals;
if (!["status", "start", "stop"].includes(action))
  throw new Error(
    "Usage: ec2.mjs status|start|stop --instance-id i-... --account 123456789012 [--acknowledge-downtime] [--acknowledge-dns-manual] [--apply]",
  );
const client = ec2(values.region);
let instance = await instanceInfo(client, values["instance-id"], values);
const addresses = await client.send(
  new DescribeAddressesCommand({
    Filters: [{ Name: "instance-id", Values: [instance.InstanceId] }],
  }),
);
const elasticIp = addresses.Addresses?.find(
  (address) => address.AssociationId,
)?.PublicIp;
console.log(
  JSON.stringify(
    {
      action,
      apply: values.apply,
      instanceId: instance.InstanceId,
      state: instance.State?.Name,
      instanceType: instance.InstanceType,
      privateIp: instance.PrivateIpAddress,
      publicIp: instance.PublicIpAddress,
      elasticIp: elasticIp ?? null,
      warning:
        "Both websites and native databases are offline while stopped. DNS is not managed here. Without an Elastic IP, the public IPv4 changes after stop/start; update the P.A Vietnam A record manually. EBS, snapshots and an allocated Elastic IP remain billable.",
    },
    null,
    2,
  ),
);
if (action === "stop") {
  if (!values["acknowledge-downtime"])
    throw new Error(
      "Stopping both sites requires --acknowledge-downtime; finish deployments/writes and take a backup first",
    );
  if (instance.State?.Name === "stopped") {
    console.log("Already stopped.");
    process.exit(0);
  }
  if (instance.State?.Name !== "running")
    throw new Error("Stop requires a running instance");
  if (!elasticIp && !values["acknowledge-dns-manual"])
    throw new Error(
      "Without an Elastic IP, remove the domain A records in P.A Vietnam before stopping to avoid leaving DNS pointed at a released address, then pass --acknowledge-dns-manual",
    );
  if (values.apply) await preflightStop(client, instance.InstanceId);
  if (!values.apply) {
    console.log(
      elasticIp
        ? "Dry-run: would gracefully stop EC2. Its Elastic IP and DNS mapping remain; both sites will be offline until EC2 starts. No AWS write was made."
        : "Dry-run: would gracefully stop EC2. DNS is manually managed; remove the A records in P.A Vietnam before applying. No AWS write was made.",
    );
    process.exit(0);
  }
  try {
    await client.send(
      new StopInstancesCommand({
        InstanceIds: [instance.InstanceId],
        Force: false,
        SkipOsShutdown: false,
        Hibernate: false,
      }),
    );
  } catch (error) {
    console.error(
      "EC2 stop failed. Inspect the instance state before retrying.",
    );
    throw error;
  }
  await waitUntilInstanceStopped(
    { client, maxWaitTime: 600 },
    { InstanceIds: [instance.InstanceId] },
  );
  console.log(
    "EC2 stopped, not terminated. Start it using the same instance ID; EBS volumes remain.",
  );
} else if (action === "start") {
  if (!["stopped", "running"].includes(instance.State?.Name))
    throw new Error(
      "Wait until the instance is fully stopped/running before starting",
    );
  if (!values.apply) {
    console.log(
      "Dry-run: would start (if stopped), wait for EC2 status checks, and report its public IPv4. No DNS records are changed.",
    );
    process.exit(0);
  }
  if (instance.State?.Name === "stopped")
    await client.send(
      new StartInstancesCommand({ InstanceIds: [instance.InstanceId] }),
    );
  await waitUntilInstanceRunning(
    { client, maxWaitTime: 600 },
    { InstanceIds: [instance.InstanceId] },
  );
  await waitUntilInstanceStatusOk(
    { client, maxWaitTime: 600 },
    { InstanceIds: [instance.InstanceId] },
  );
  instance = await instanceInfo(client, values["instance-id"], values);
  if (!instance.PublicIpAddress)
    throw new Error("EC2 has no public IPv4 address");
  console.log(
    `${elasticIp ? "Elastic IP remains stable." : `Update the A records manually to ${instance.PublicIpAddress}.`} Check native PostgreSQL, k3s pods and HTTPS before declaring the site ready.`,
  );
}
