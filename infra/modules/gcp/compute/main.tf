resource "google_service_account" "node" {
  account_id   = "${var.name}-node"
  display_name = "${var.project_name} node without project roles"
}

resource "google_compute_instance" "main" {
  name                      = var.name
  machine_type              = var.machine_type
  zone                      = var.zone
  tags                      = [var.name]
  labels                    = var.labels
  allow_stopping_for_update = true
  deletion_protection       = true

  shielded_instance_config {
    enable_secure_boot          = true
    enable_vtpm                 = true
    enable_integrity_monitoring = true
  }

  boot_disk {
    auto_delete = false

    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2404-lts-amd64"
      size  = var.disk_gb
      type  = "pd-balanced"
    }
  }

  network_interface {
    subnetwork = var.subnet_id

    access_config {
      nat_ip = var.public_ip
    }
  }

  service_account {
    email  = google_service_account.node.email
    scopes = []
  }

  metadata = {
    user-data              = var.cloud_init
    ssh-keys               = "ubuntu:${var.ssh_public_key}"
    block-project-ssh-keys = "TRUE"
    serial-port-enable     = "FALSE"
  }

  lifecycle {
    # The VM holds databases and local volumes; never replace it for a new image or cloud-init edit.
    prevent_destroy = true
    ignore_changes  = [boot_disk[0].initialize_params[0].image, metadata["user-data"]]
  }
}