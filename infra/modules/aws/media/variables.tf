variable "name" { type = string }
variable "bucket_name" { type = string }
variable "object_prefix" {
  type = string
  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]*(/[a-z0-9-]+)*$", var.object_prefix))
    error_message = "Use a lowercase object prefix without leading or trailing slashes."
  }
}
variable "role_name" { type = string }
variable "noncurrent_version_days" {
  type    = number
  default = 30
}
variable "tags" { type = map(string) }
