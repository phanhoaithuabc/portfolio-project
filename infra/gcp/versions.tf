terraform {
  required_version = ">= 1.9, < 2.0"
  required_providers {
    google = { source = "hashicorp/google", version = "~> 6.20" }
  }
}
provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}