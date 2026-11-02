output "public_ip" { value = module.network.public_ip }
output "ssh_command" { value = "ssh ubuntu@${module.network.public_ip}" }
output "resource_group" { value = module.network.resource_group_name }