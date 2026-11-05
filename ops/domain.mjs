import { resolve4 } from "node:dns/promises";
import { isIP } from "node:net";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

export function dnsRecords(ip) {
  if (isIP(ip) !== 4) throw new Error("Supply the EC2 public IPv4 address");
  const records = [
    { host: "@", type: "A", value: ip },
    { host: "www", type: "CNAME", value: "phanhoaithu.io.vn." },
  ];
  return records;
}

export async function verifyDomain(ip) {
  const records = dnsRecords(ip);
  const hosts = ["phanhoaithu.io.vn"];
  const resolved = await Promise.all(
    hosts.map(async (host) => ({ host, addresses: await resolve4(host) })),
  );
  const mismatches = resolved.filter(
    ({ addresses }) => !addresses.includes(ip),
  );
  if (mismatches.length)
    throw new Error(
      `DNS does not yet resolve to ${ip}: ${mismatches.map(({ host, addresses }) => `${host}=${addresses.join(",")}`).join("; ")}`,
    );
  return { records, resolved };
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      ip: { type: "string" },
      https: { type: "boolean", default: false },
    },
  });
  const [action] = positionals;
  if (!["plan", "verify"].includes(action) || !values.ip)
    throw new Error(
      "Usage: npm run ops:domain -- plan|verify --ip PUBLIC_IPV4 [--https]",
    );
  if (action === "plan") {
    console.log(
      JSON.stringify(
        {
          provider: "P.A Vietnam DNS management",
          note: "Create these records manually. This command does not log in to or modify the registrar account.",
          records: dnsRecords(values.ip),
        },
        null,
        2,
      ),
    );
    return;
  }
  const result = await verifyDomain(values.ip);
  if (values.https) {
    result.https = await Promise.all(
      result.resolved.map(async ({ host }) => {
        const response = await fetch(`https://${host}/`, {
          signal: AbortSignal.timeout(10000),
          redirect: "manual",
        });
        await response.body?.cancel();
        if (response.status < 200 || response.status >= 400)
          throw new Error(
            `HTTPS check failed for ${host}: HTTP ${response.status}`,
          );
        return { host, status: response.status };
      }),
    );
  }
  console.log(JSON.stringify(result, null, 2));
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
