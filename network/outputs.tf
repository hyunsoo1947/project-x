output "vpc_id" {
  description = "VPC ID."
  value       = aws_vpc.main.id
}

output "vpc_cidr_block" {
  description = "VPC CIDR block."
  value       = aws_vpc.main.cidr_block
}

# Public subnet IDs — list form for convenience, plus individuals for
# parity with the original CFN exports (PublicSubnet1Id / 2 / 3).
output "public_subnet_ids" {
  description = "All three public subnet IDs, in [a, b, c] order."
  value       = [for k in ["a", "b", "c"] : aws_subnet.public[k].id]
}

output "public_subnet_1_id" {
  description = "Public subnet in AZ a (was PublicSubnet1Id in CFN)."
  value       = aws_subnet.public["a"].id
}

output "public_subnet_2_id" {
  description = "Public subnet in AZ b (was PublicSubnet2Id in CFN)."
  value       = aws_subnet.public["b"].id
}

output "public_subnet_3_id" {
  description = "Public subnet in AZ c (was PublicSubnet3Id in CFN)."
  value       = aws_subnet.public["c"].id
}

output "private_subnet_ids" {
  description = "All three private subnet IDs, in [a, b, c] order."
  value       = [for k in ["a", "b", "c"] : aws_subnet.private[k].id]
}

output "private_subnet_1_id" {
  description = "Private subnet in AZ a (was PrivateSubnet1Id in CFN)."
  value       = aws_subnet.private["a"].id
}

output "private_subnet_2_id" {
  description = "Private subnet in AZ b (was PrivateSubnet2Id in CFN)."
  value       = aws_subnet.private["b"].id
}

output "private_subnet_3_id" {
  description = "Private subnet in AZ c (was PrivateSubnet3Id in CFN)."
  value       = aws_subnet.private["c"].id
}

output "alb_security_group_id" {
  description = "ID of the public ALB security group."
  value       = aws_security_group.alb.id
}

output "ecs_service_security_group_id" {
  description = "ID of the ECS service tasks security group."
  value       = aws_security_group.ecs.id
}

output "rds_security_group_id" {
  description = "ID of the RDS Postgres security group."
  value       = aws_security_group.rds.id
}

output "jenkins_security_group_id" {
  description = "ID of the Jenkins EC2 security group."
  value       = aws_security_group.jenkins.id
}
