variable "name" { type = string }
variable "ami_id" { type = string }
variable "instance_type" { type = string }
variable "subnet_id" { type = string }
variable "security_group_id" { type = string }
variable "ssh_public_key" { type = string }
variable "cloud_init" { type = string }
variable "disk_gb" { type = number }
variable "metadata_hop_limit" {
  type    = number
  default = 1
  validation {
    condition     = contains([1, 2], var.metadata_hop_limit)
    error_message = "Use 1 to keep the node role away from pods, or 2 to let pods reach it."
  }
}
variable "snapshot_retention_count" {
  type    = number
  default = 7
  validation {
    condition     = var.snapshot_retention_count >= 0 && var.snapshot_retention_count <= 1000
    error_message = "Keep between 0 (disabled) and 1000 daily snapshots."
  }
}
variable "tags" { type = map(string) }