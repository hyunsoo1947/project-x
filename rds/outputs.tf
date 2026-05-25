output "db_instance_id" {
  description = "RDS instance identifier."
  value       = aws_db_instance.main.id
}

output "db_instance_address" {
  description = "DNS hostname of the RDS instance. Use this as the DB host in application config."
  value       = aws_db_instance.main.address
}

output "db_instance_port" {
  description = "Port the RDS instance listens on."
  value       = aws_db_instance.main.port
}

output "db_name" {
  description = "Database name on the instance."
  value       = aws_db_instance.main.db_name
}

output "db_username" {
  description = "Master database username."
  value       = aws_db_instance.main.username
}

output "credentials_secret_arn" {
  description = "ARN of the Secrets Manager secret holding the RDS master credentials (managed by AWS). Applications should resolve credentials from this ARN at runtime, not from Terraform outputs."
  value       = aws_db_instance.main.master_user_secret[0].secret_arn
}
