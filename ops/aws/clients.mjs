import {
  EC2Client,
  DescribeInstancesCommand,
  StopInstancesCommand,
} from "@aws-sdk/client-ec2";
import { validateInstance } from "./model.mjs";
export const ec2 = (region) => new EC2Client({ region, maxAttempts: 3 });
export async function preflightStop(client, id) {
  try {
    await client.send(
      new StopInstancesCommand({
        InstanceIds: [id],
        DryRun: true,
        Force: false,
        SkipOsShutdown: false,
        Hibernate: false,
      }),
    );
    throw new Error("EC2 did not confirm stop permission");
  } catch (error) {
    if (error.name !== "DryRunOperation") throw error;
  }
}
export async function instanceInfo(client, id, options) {
  if (!/^i-(?:[0-9a-f]{8}|[0-9a-f]{17})$/.test(id ?? ""))
    throw new Error("Supply a valid --instance-id");
  const result = await client.send(
    new DescribeInstancesCommand({ InstanceIds: [id] }),
  );
  const reservation = result.Reservations?.find((item) =>
    item.Instances?.some((instance) => instance.InstanceId === id),
  );
  const instance = reservation?.Instances?.find(
    (item) => item.InstanceId === id,
  );
  if (!instance) throw new Error("Instance not found");
  return validateInstance(instance, reservation.OwnerId, options);
}
