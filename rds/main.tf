terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

resource "aws_db_subnet_group" "main" {
  name        = "routebox-${var.environment}-rds"
  description = "Private subnets for Routebox ${var.environment} RDS"
  subnet_ids  = var.private_subnet_ids

  tags = {
    Name = "routebox-${var.environment}-rds-subnet-group"
  }
}

resource "aws_db_parameter_group" "main" {
  name        = "routebox-${var.environment}-postgres16"
  family      = "postgres16"
  description = "Routebox ${var.environment} Postgres 16"

  tags = {
    Name = "routebox-${var.environment}-postgres16"
  }
}

resource "aws_db_instance" "main" {
  identifier = "routebox-${var.environment}"

  engine               = "postgres"
  engine_version       = var.engine_version
  instance_class       = var.instance_class
  parameter_group_name = aws_db_parameter_group.main.name

  db_name  = var.db_name
  username = var.db_username

  # AWS RDS manages the master password and stores it in Secrets Manager.
  # The actual credential never appears in Terraform state or plan output.
  # Retrieve it at runtime via the ARN in credentials_secret_arn output.
  manage_master_user_password = true

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [var.rds_security_group_id]

  allocated_storage = var.allocated_storage
  storage_type      = "gp3"
  storage_encrypted = true

  multi_az                   = false
  publicly_accessible        = false
  auto_minor_version_upgrade = true

  deletion_protection     = var.deletion_protection
  skip_final_snapshot     = var.skip_final_snapshot
  backup_retention_period = var.backup_retention_period

  tags = {
    Name = "routebox-${var.environment}-rds"
  }
}

# Allow EKS worker nodes to reach RDS on 5432.
# Defined here rather than in the network module to avoid coupling
# the network layer to EKS.
resource "aws_vpc_security_group_ingress_rule" "rds_from_eks_nodes" {
  security_group_id            = var.rds_security_group_id
  referenced_security_group_id = var.eks_node_security_group_id
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  description                  = "Postgres from EKS worker nodes"
}
