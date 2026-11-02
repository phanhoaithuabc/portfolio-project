module "network" {
  source = "../modules/aws/network"

  name              = local.name
  vpc_cidr          = var.vpc_cidr
  subnet_cidr       = var.subnet_cidr
  availability_zone = data.aws_availability_zones.available.names[0]
  admin_cidr        = var.admin_cidr
  web_cidr          = var.web_cidr
  tags              = local.tags
}

module "compute" {
  source = "../modules/aws/compute"

  name                     = local.name
  ami_id                   = data.aws_ami.ubuntu.id
  instance_type            = var.instance_type
  subnet_id                = module.network.subnet_id
  security_group_id        = module.network.security_group_id
  ssh_public_key           = var.ssh_public_key
  cloud_init               = file("${path.module}/../cloud-init.yaml")
  disk_gb                  = var.disk_gb
  metadata_hop_limit       = var.pod_instance_credentials ? 2 : 1
  snapshot_retention_count = var.snapshot_retention_count
  tags                     = local.tags
}

resource "aws_iam_role_policy" "external_secrets" {
  count = var.external_secrets_enabled ? 1 : 0
  name  = "${local.name}-external-secrets"
  role  = module.compute.role_name
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"]
      Resource = "arn:aws:secretsmanager:${var.region}:${data.aws_caller_identity.current.account_id}:secret:${var.project_name}/${var.environment}/*"
    }]
  })
}

check "external_secrets_pod_credentials" {
  assert {
    condition     = !var.external_secrets_enabled || var.pod_instance_credentials
    error_message = "external_secrets_enabled is true but pod_instance_credentials is false, so the External Secrets Operator cannot obtain the node role."
  }
}