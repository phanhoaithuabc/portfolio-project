variable "project_id" { type = string }
variable "region" { default = "asia-southeast1" }
variable "zone" { default = "asia-southeast1-b" }
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
    error_message = "Supply your trusted public IPv4 address with /32."
  }
}
variable "ssh_public_key" { type = string }
variable "web_cidr" {
  type    = string
  default = null
}
variable "machine_type" { default = "e2-standard-4" }
variable "disk_gb" { default = 80 }
variable "subnet_cidr" {
  type    = string
  default = "10.20.1.0/24"
}