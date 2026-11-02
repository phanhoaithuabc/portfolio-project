output "public_ip" { value = module.network.public_ip }
output "ssh_command" { value = "ssh ubuntu@${module.network.public_ip}" }
output "network" { value = module.network.network_name }