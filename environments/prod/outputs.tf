output "vpc_id" {
  description = "VPC ID."
  value       = module.network.vpc_id
}

output "vpc_cidr_block" {
  description = "VPC CIDR block."
  value       = module.network.vpc_cidr_block
}

output "public_subnet_ids" {
  description = "All three public subnet IDs, [a, b, c] order."
  value       = module.network.public_subnet_ids
}

output "public_subnet_1_id" {
  description = "Public subnet in AZ a."
  value       = module.network.public_subnet_1_id
}

output "public_subnet_2_id" {
  description = "Public subnet in AZ b."
  value       = module.network.public_subnet_2_id
}

output "public_subnet_3_id" {
  description = "Public subnet in AZ c."
  value       = module.network.public_subnet_3_id
}

output "private_subnet_ids" {
  description = "All three private subnet IDs, [a, b, c] order."
  value       = module.network.private_subnet_ids
}

output "private_subnet_1_id" {
  description = "Private subnet in AZ a."
  value       = module.network.private_subnet_1_id
}

output "private_subnet_2_id" {
  description = "Private subnet in AZ b."
  value       = module.network.private_subnet_2_id
}

output "private_subnet_3_id" {
  description = "Private subnet in AZ c."
  value       = module.network.private_subnet_3_id
}

output "alb_security_group_id" {
  description = "Public ALB SG ID."
  value       = module.network.alb_security_group_id
}

output "ecs_service_security_group_id" {
  description = "ECS service tasks SG ID."
  value       = module.network.ecs_service_security_group_id
}

output "rds_security_group_id" {
  description = "RDS Postgres SG ID."
  value       = module.network.rds_security_group_id
}

output "jenkins_security_group_id" {
  description = "Jenkins EC2 SG ID."
  value       = module.network.jenkins_security_group_id
}
