variable "region" { default = "us-east-1" }
variable "environment" {
  default = "lab"
  validation {
    condition     = contains(["lab", "staging", "production"], var.environment)
    error_message = "Use lab, staging, or production."
  }
}
variable "project_name" { default = "portfolio" }
variable "bucket_name" {
  type        = string
  description = "Globally unique private bucket for Portfolio media."
  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$", var.bucket_name))
    error_message = "Use a valid 3-63 character lowercase S3 bucket name."
  }
}
variable "node_role_name" {
  type        = string
  description = "IAM role of the node that runs the Portfolio API, such as the shared host's node_role_name output."
}
variable "object_prefix" {
  type    = string
  default = "portfolio-media"
}
variable "external_secrets_enabled" {
  type        = bool
  default     = false
  description = "Allow node_role_name to read Secrets Manager values under <project_name>/<environment>/*."
}
