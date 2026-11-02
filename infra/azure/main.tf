module "network" {
  source = "../modules/azure/network"

  name            = local.name
  location        = var.location
  address_space   = var.address_space
  subnet_prefixes = var.subnet_prefixes
  admin_cidr      = var.admin_cidr
  web_cidr        = var.web_cidr
  tags            = local.tags
}

module "compute" {
  source = "../modules/azure/compute"

  name                 = local.name
  location             = var.location
  resource_group_name  = module.network.resource_group_name
  network_interface_id = module.network.network_interface_id
  vm_size              = var.vm_size
  disk_gb              = var.disk_gb
  ssh_public_key       = var.ssh_public_key
  cloud_init           = file("${path.module}/../cloud-init.yaml")
  tags                 = local.tags
}