provider "aws" {
  region = var.aws_region

  # Replaces the per-resource Tags: blocks in the CFN template. Note
  # ManagedBy = "terraform" (was "cloudformation"). Resource-level Name
  # tags are still set inside the network module.
  default_tags {
    tags = {
      Environment = var.environment
      ManagedBy   = "terraform"
      CostCenter  = var.cost_center
    }
  }
}

module "network" {
  source = "../../network"

  environment          = var.environment
  vpc_cidr             = var.vpc_cidr
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
  cost_center          = var.cost_center
}
