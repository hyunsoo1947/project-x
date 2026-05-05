variable "environment" {
  description = "Which environment this stack instance is for. Drives tags and resource names."
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be one of: dev, staging, prod."
  }
}

variable "aws_region" {
  description = "AWS region. Defaults to us-east-1 to match deploy.sh."
  type        = string
  default     = "us-east-1"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC. /16 in practice."
  type        = string
}

variable "public_subnet_cidrs" {
  description = "Three public subnet CIDRs, ordered [a, b, c]."
  type        = list(string)
}

variable "private_subnet_cidrs" {
  description = "Three private subnet CIDRs, ordered [a, b, c]."
  type        = list(string)
}

variable "cost_center" {
  description = "Cost-allocation tag value applied via provider default_tags and re-used inside the network module."
  type        = string
  default     = "platform"
}
