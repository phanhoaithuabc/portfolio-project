locals {
  name = "${var.project_name}-${var.environment}"
  tags = {
    Project     = var.project_name
    ManagedBy   = "terraform"
    team        = var.cost_team
    service     = "shared"
    environment = var.environment
  }
}