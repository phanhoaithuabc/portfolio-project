moved {
  from = google_compute_network.main
  to   = module.network.google_compute_network.main
}

moved {
  from = google_compute_subnetwork.main
  to   = module.network.google_compute_subnetwork.main
}

moved {
  from = google_compute_firewall.ssh
  to   = module.network.google_compute_firewall.ssh
}

moved {
  from = google_compute_firewall.web
  to   = module.network.google_compute_firewall.web
}

moved {
  from = google_compute_address.main
  to   = module.network.google_compute_address.main
}

moved {
  from = google_service_account.node
  to   = module.compute.google_service_account.node
}

moved {
  from = google_compute_instance.main
  to   = module.compute.google_compute_instance.main
}