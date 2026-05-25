variable "environment" {
  description = "Environment name (dev, staging, prod)."
  type        = string
}

variable "private_subnet_ids" {
  description = "IDs of the private subnets to place the DB subnet group in."
  type        = list(string)
}

variable "rds_security_group_id" {
  description = "ID of the RDS security group created by the network module."
  type        = string
}

variable "eks_node_security_group_id" {
  description = "ID of the EKS node security group. Inbound port 5432 will be opened from this SG."
  type        = string
}

variable "instance_class" {
  description = "RDS instance class."
  type        = string
  default     = "db.t3.micro"
}

variable "engine_version" {
  description = "Postgres engine version."
  type        = string
  default     = "16"
}

variable "db_name" {
  description = "Name of the initial database created on the instance."
  type        = string
  default     = "routebox"
}

variable "db_username" {
  description = "Master DB username."
  type        = string
  default     = "routeboxapp"
}

variable "allocated_storage" {
  description = "Allocated storage in GiB."
  type        = number
  default     = 20
}

variable "backup_retention_period" {
  description = "Days to retain automated backups. 0 disables backups."
  type        = number
  default     = 7
}

variable "deletion_protection" {
  description = "Enable deletion protection. Recommended true for prod."
  type        = bool
  default     = false
}

variable "skip_final_snapshot" {
  description = "Skip the final snapshot on instance deletion. Recommended false for prod."
  type        = bool
  default     = true
}
