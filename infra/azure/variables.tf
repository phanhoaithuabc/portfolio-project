variable "location" { default = "southeastasia" }
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
variable "vm_size" { default = "Standard_D4as_v5" }
variable "disk_gb" { default = 80 }
variable "address_space" {
  type    = list(string)
  default = ["10.20.0.0/16"]
}
variable "subnet_prefixes" {
  type    = list(string)
  default = ["10.20.1.0/24"]
}