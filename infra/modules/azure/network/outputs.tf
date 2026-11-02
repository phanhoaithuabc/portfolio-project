output "resource_group_name" { value = azurerm_resource_group.main.name }
output "network_interface_id" { value = azurerm_network_interface.main.id }
output "public_ip" { value = azurerm_public_ip.main.ip_address }