variable "name" { type = string }
variable "vpc_cidr" { type = string }
variable "subnet_cidr" { type = string }
variable "availability_zone" { type = string }
variable "admin_cidr" { type = string }
variable "web_cidr" {
  type    = string
  default = null
}
variable "tags" { type = map(string) }