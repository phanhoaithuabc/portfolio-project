import { test } from "node:test";
import assert from "node:assert/strict";
import { dnsRecords } from "../ops/domain.mjs";
test("portfolio emits only its own registrar records", () => {
  assert.deepEqual(dnsRecords("203.0.113.10"), [
    { host: "@", type: "A", value: "203.0.113.10" },
    { host: "www", type: "CNAME", value: "phanhoaithu.io.vn." },
  ]);
  assert.throws(() => dnsRecords("not-an-ip"), /public IPv4/);
});
