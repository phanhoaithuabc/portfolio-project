module "network" {
  source = "../modules/gcp/network"

  name         = local.name
  region       = var.region
  subnet_cidr  = var.subnet_cidr
  admin_cidr   = var.admin_cidr
  web_cidr     = var.web_cidr
  network_tags = [local.name]
}

module "compute" {
  source = "../modules/gcp/compute"

  name           = local.name
  project_name   = var.project_name
  machine_type   = var.machine_type
  zone           = var.zone
  subnet_id      = module.network.subnet_id
  public_ip      = module.network.public_ip
  ssh_public_key = var.ssh_public_key
  disk_gb        = var.disk_gb
  cloud_init     = file("${path.module}/../cloud-init.yaml")
  labels         = local.labels
}