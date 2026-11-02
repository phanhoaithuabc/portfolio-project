variable "name" { type = string }
variable "location" { type = string }
variable "address_space" { type = list(string) }
variable "subnet_prefixes" { type = list(string) }
variable "admin_cidr" { type = string }
variable "web_cidr" {
  type    = string
  default = null
}
variable "tags" { type = map(string) }