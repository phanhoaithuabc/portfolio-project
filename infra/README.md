# Portfolio Terraform Layout

Each provider directory (`aws`, `azure`, `gcp`) is an independent Terraform root with its own provider configuration, lockfile, backend/state, project defaults, and outputs. Select one provider root per deployment; do not combine providers into one state.

```text
infra/
  aws/        # AWS standalone VM root: inputs, locals, provider/backend, module composition
  aws-media/  # AWS media-only root for a shared host (bucket + policy on an existing node role)
  azure/      # Azure root
  gcp/        # GCP root
  modules/
    aws/{network,compute,media}/
    azure/{network,compute}/
    gcp/{network,compute}/
```

These modules are maintained inside Portfolio and do not reference a sibling directory. Network modules own VPC/VNet, subnets, ingress rules, public IPs, and interfaces. Compute modules own the VM, its node IAM role/profile (`node_role_name`), termination/deletion and `prevent_destroy` guards, root-disk preservation, and optional AWS DLM daily snapshots (`snapshot_retention_count`, default 7). When Portfolio shares an EC2 host provisioned by another root, apply `infra/aws-media` with `bucket_name` and the host's `node_role_name` output instead of creating a second VM; both `infra/aws` and `infra/aws-media` also support `external_secrets_enabled` for Secrets Manager reads. Roots own provider settings, project/environment naming, cost tags, cloud-init selection, and module wiring. Outputs expose the values required by operators. Shared cloud-init is passed from this project's `infra/cloud-init.yaml`.

The provider roots preserve their existing input names and defaults. Network ranges are explicit root inputs (`vpc_cidr`/`subnet_cidr`, `address_space`/`subnet_prefixes`, or `subnet_cidr`) for future topology changes. Keep provider-specific behavior in provider modules and pass new configuration explicitly from the root.

## State-safe migration

Each `moved.tf` maps all previous root resource addresses into its new child module address. Keep these declarations so an existing state records address moves rather than proposing replacement infrastructure. Review each plan for all environments and confirm no unintended create/destroy actions before applying. Do not remove moved blocks while a state may still contain legacy addresses.

Example checks from this project directory:

```sh
terraform -chdir=infra/aws init
terraform -chdir=infra/aws validate
terraform -chdir=infra/aws plan -var-file=lab.tfvars

terraform -chdir=infra/azure init
terraform -chdir=infra/azure validate

terraform -chdir=infra/gcp init
terraform -chdir=infra/gcp validate
```

AWS backend initialization requires its configured remote-state bucket and AWS credentials. `terraform init -backend=false` is for local syntax/provider validation only; it cannot confirm state moves. Never apply without a plan against the intended backend/workspace and review of all state moves.
