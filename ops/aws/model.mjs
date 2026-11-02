export function validateInstance(
  instance,
  ownerId,
  { account, project, environment },
) {
  if (!/^\d{12}$/.test(account ?? "") || ownerId !== account)
    throw new Error("Instance account does not match --account");
  if (!["lab", "staging"].includes(environment))
    throw new Error("Only lab/staging lifecycle operations are allowed");
  const tags = Object.fromEntries(
    (instance.Tags ?? []).map((tag) => [tag.Key, tag.Value]),
  );
  if (!project || tags.Project !== project || tags.Environment !== environment)
    throw new Error(
      "Instance Project/Environment tags do not match the requested target",
    );
  if (tags.CostControl === "deny")
    throw new Error("Instance has CostControl=deny");
  if (
    instance.RootDeviceType !== "ebs" ||
    instance.InstanceLifecycle === "spot"
  )
    throw new Error(
      "Only ordinary EBS-backed On-Demand instances are supported",
    );
  return instance;
}
