output "public_ip" { value = module.compute.public_ip }
output "ssh_command" { value = "ssh ubuntu@${module.compute.public_ip}" }
output "vpc_id" { value = module.network.vpc_id }
output "subnet_id" { value = module.network.subnet_id }
output "node_role_name" { value = module.compute.role_name }