import { test } from "node:test";
import assert from "node:assert/strict";
import { validateInstance } from "../ops/aws/model.mjs";
test("AWS ops validates the requested account, tags and lifecycle target", () => {
  const instance = {
    RootDeviceType: "ebs",
    Tags: [
      { Key: "Project", Value: "portfolio" },
      { Key: "Environment", Value: "lab" },
    ],
  };
  const options = {
    account: "123456789012",
    project: "portfolio",
    environment: "lab",
  };
  assert.equal(validateInstance(instance, "123456789012", options), instance);
  assert.throws(() => validateInstance(instance, "999999999999", options));
  assert.throws(() =>
    validateInstance(instance, "123456789012", {
      ...options,
      environment: "production",
    }),
  );
  assert.throws(() =>
    validateInstance(
      { ...instance, InstanceLifecycle: "spot" },
      "123456789012",
      options,
    ),
  );
});
test("AWS stop preflight verifies permission without touching DNS", async () => {
  const { preflightStop } = await import("../ops/aws/clients.mjs");
  const allowed = {
    send: async (command) => {
      assert.equal(command.constructor.name, "StopInstancesCommand");
      assert.deepEqual(command.input, {
        InstanceIds: ["i-12345678"],
        DryRun: true,
        Force: false,
        SkipOsShutdown: false,
        Hibernate: false,
      });
      throw Object.assign(new Error("Allowed"), { name: "DryRunOperation" });
    },
  };
  await preflightStop(allowed, "i-12345678");
  const denied = {
    send: async () => {
      throw Object.assign(new Error("Denied"), {
        name: "UnauthorizedOperation",
      });
    },
  };
  await assert.rejects(() => preflightStop(denied, "i-12345678"), /Denied/);
  await assert.rejects(
    () => preflightStop({ send: async () => ({}) }, "i-12345678"),
    /did not confirm/,
  );
});
