moved {
  from = azurerm_resource_group.main
  to   = module.network.azurerm_resource_group.main
}

moved {
  from = azurerm_virtual_network.main
  to   = module.network.azurerm_virtual_network.main
}

moved {
  from = azurerm_subnet.main
  to   = module.network.azurerm_subnet.main
}

moved {
  from = azurerm_network_security_group.main
  to   = module.network.azurerm_network_security_group.main
}

moved {
  from = azurerm_public_ip.main
  to   = module.network.azurerm_public_ip.main
}

moved {
  from = azurerm_network_interface.main
  to   = module.network.azurerm_network_interface.main
}

moved {
  from = azurerm_network_interface_security_group_association.main
  to   = module.network.azurerm_network_interface_security_group_association.main
}

moved {
  from = azurerm_linux_virtual_machine.main
  to   = module.compute.azurerm_linux_virtual_machine.main
}