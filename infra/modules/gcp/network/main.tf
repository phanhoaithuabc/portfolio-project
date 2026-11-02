resource "google_compute_network" "main" {
  name                    = "${var.name}-vpc"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "main" {
  name                     = "${var.name}-subnet"
  ip_cidr_range            = var.subnet_cidr
  network                  = google_compute_network.main.id
  region                   = var.region
  private_ip_google_access = true
}

resource "google_compute_firewall" "ssh" {
  name          = "${var.name}-ssh"
  network       = google_compute_network.main.name
  source_ranges = [var.admin_cidr]
  target_tags   = var.network_tags

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }
}

resource "google_compute_firewall" "web" {
  name          = "${var.name}-web"
  network       = google_compute_network.main.name
  source_ranges = [coalesce(var.web_cidr, var.admin_cidr)]
  target_tags   = var.network_tags

  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }
}

resource "google_compute_address" "main" {
  name   = "${var.name}-ip"
  region = var.region
}