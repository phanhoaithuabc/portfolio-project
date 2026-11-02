variable "region" { default = "us-east-1" }
variable "environment" {
  default = "lab"
  validation {
    condition     = contains(["lab", "staging", "production"], var.environment)
    error_message = "Use lab, staging, or production."
  }
}
variable "project_name" { default = "portfolio" }
variable "admin_cidr" {
  type = string
  validation {
    condition     = can(cidrnetmask(var.admin_cidr)) && endswith(var.admin_cidr, "/32")
    error_message = "Supply your trusted public IPv4 address with /32; SSH must not be public."
  }
}
variable "ssh_public_key" { type = string }
variable "web_cidr" {
  type        = string
  default     = null
  description = "Defaults to admin_cidr. Use public ingress only after authentication and TLS are configured."
}
variable "instance_type" { default = "t3a.xlarge" }
variable "disk_gb" { default = 80 }
variable "vpc_cidr" {
  type    = string
  default = "10.20.0.0/16"
}
variable "subnet_cidr" {
  type    = string
  default = "10.20.1.0/24"
}
variable "pod_instance_credentials" {
  type        = bool
  default     = false
  description = "Raise the IMDSv2 hop limit to 2 so pods can use the node IAM role. Pods still need an egress NetworkPolicy that allows 169.254.169.254."
}
variable "snapshot_retention_count" {
  type        = number
  default     = 7
  description = "Daily EBS snapshots of the node to keep; 0 disables the snapshot policy."
}
variable "external_secrets_enabled" {
  type        = bool
  default     = false
  description = "Allow the node role to read Secrets Manager values under <project_name>/<environment>/*."
}