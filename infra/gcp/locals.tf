locals {
  name = "${var.project_name}-${var.environment}"
  labels = {
    project     = var.project_name
    environment = var.environment
    managed_by  = "terraform"
    team        = var.cost_team
    service     = "shared"
  }
}