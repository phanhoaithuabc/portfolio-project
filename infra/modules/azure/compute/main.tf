resource "azurerm_linux_virtual_machine" "main" {
  name                            = var.name
  resource_group_name             = var.resource_group_name
  location                        = var.location
  size                            = var.vm_size
  admin_username                  = "ubuntu"
  disable_password_authentication = true
  network_interface_ids           = [var.network_interface_id]

  admin_ssh_key {
    username   = "ubuntu"
    public_key = var.ssh_public_key
  }

  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "StandardSSD_LRS"
    disk_size_gb         = var.disk_gb
  }

  source_image_reference {
    publisher = "Canonical"
    offer     = "ubuntu-24_04-lts"
    sku       = "server"
    version   = "latest"
  }

  custom_data = base64encode(var.cloud_init)
  tags        = var.tags

  lifecycle {
    # The VM holds databases and local volumes; never replace it for a new image or cloud-init edit.
    prevent_destroy = true
    ignore_changes  = [custom_data, source_image_reference]
  }
}