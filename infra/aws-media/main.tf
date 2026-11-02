data "aws_caller_identity" "current" {}

module "media" {
  source = "../modules/aws/media"

  name          = "${var.project_name}-${var.environment}"
  bucket_name   = var.bucket_name
  object_prefix = var.object_prefix
  role_name     = var.node_role_name
  tags = {
    Project     = var.project_name
    ManagedBy   = "terraform"
    service     = "media"
    environment = var.environment
  }
}

resource "aws_iam_role_policy" "external_secrets" {
  count = var.external_secrets_enabled ? 1 : 0
  name  = "${var.project_name}-${var.environment}-external-secrets"
  role  = var.node_role_name
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"]
      Resource = "arn:aws:secretsmanager:${var.region}:${data.aws_caller_identity.current.account_id}:secret:${var.project_name}/${var.environment}/*"
    }]
  })
}
