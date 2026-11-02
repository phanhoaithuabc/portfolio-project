resource "aws_key_pair" "admin" {
  key_name   = var.name
  public_key = var.ssh_public_key
  tags       = var.tags
}

resource "aws_iam_role" "node" {
  name = "${var.name}-node"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
  tags = var.tags
}

resource "aws_iam_instance_profile" "node" {
  name = "${var.name}-node"
  role = aws_iam_role.node.name
  tags = var.tags
}

resource "aws_instance" "node" {
  ami                                  = var.ami_id
  instance_type                        = var.instance_type
  subnet_id                            = var.subnet_id
  associate_public_ip_address          = true
  vpc_security_group_ids               = [var.security_group_id]
  key_name                             = aws_key_pair.admin.key_name
  iam_instance_profile                 = aws_iam_instance_profile.node.name
  user_data                            = var.cloud_init
  disable_api_termination              = true
  instance_initiated_shutdown_behavior = "stop"

  metadata_options {
    http_tokens                 = "required"
    http_put_response_hop_limit = var.metadata_hop_limit
  }

  root_block_device {
    volume_type           = "gp3"
    volume_size           = var.disk_gb
    encrypted             = true
    delete_on_termination = false
  }

  tags = merge(var.tags, { Name = var.name })

  lifecycle {
    # The node holds databases and local volumes; never replace it for a new AMI or cloud-init edit.
    prevent_destroy = true
    ignore_changes  = [ami, user_data]
  }
}

resource "aws_iam_role" "snapshots" {
  count = var.snapshot_retention_count > 0 ? 1 : 0
  name  = "${var.name}-snapshots"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "dlm.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "snapshots" {
  count      = var.snapshot_retention_count > 0 ? 1 : 0
  role       = aws_iam_role.snapshots[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSDataLifecycleManagerServiceRole"
}

resource "aws_dlm_lifecycle_policy" "node" {
  count              = var.snapshot_retention_count > 0 ? 1 : 0
  description        = "${var.name} daily node snapshots"
  execution_role_arn = aws_iam_role.snapshots[0].arn
  state              = "ENABLED"

  policy_details {
    resource_types = ["INSTANCE"]
    target_tags    = { Name = var.name }

    schedule {
      name      = "daily"
      copy_tags = true

      create_rule {
        interval      = 24
        interval_unit = "HOURS"
        times         = ["03:00"]
      }

      retain_rule {
        count = var.snapshot_retention_count
      }
    }
  }

  tags = var.tags
}