variable "name" { type = string }
variable "region" { type = string }
variable "subnet_cidr" { type = string }
variable "admin_cidr" { type = string }
variable "web_cidr" {
  type    = string
  default = null
}
variable "network_tags" { type = list(string) }