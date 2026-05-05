variable "environment" {
  description = "Which environment this module instance is for. Drives Name tags. Three deployments: dev / staging / prod, all in the same AWS account."
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be one of: dev, staging, prod."
  }
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC. /16 in practice."
  type        = string

  validation {
    condition     = can(regex("^([0-9]{1,3}\\.){3}[0-9]{1,3}/[0-9]{1,2}$", var.vpc_cidr))
    error_message = "vpc_cidr must look like 10.0.0.0/16."
  }
}

variable "public_subnet_cidrs" {
  description = "Three public subnet CIDRs, one per AZ in the order [a, b, c]."
  type        = list(string)

  validation {
    condition     = length(var.public_subnet_cidrs) == 3
    error_message = "public_subnet_cidrs must have exactly 3 entries."
  }

  validation {
    condition     = alltrue([for c in var.public_subnet_cidrs : can(regex("^([0-9]{1,3}\\.){3}[0-9]{1,3}/[0-9]{1,2}$", c))])
    error_message = "Each public_subnet_cidrs entry must be a CIDR block."
  }
}

variable "private_subnet_cidrs" {
  description = "Three private subnet CIDRs, one per AZ in the order [a, b, c]."
  type        = list(string)

  validation {
    condition     = length(var.private_subnet_cidrs) == 3
    error_message = "private_subnet_cidrs must have exactly 3 entries."
  }

  validation {
    condition     = alltrue([for c in var.private_subnet_cidrs : can(regex("^([0-9]{1,3}\\.){3}[0-9]{1,3}/[0-9]{1,2}$", c))])
    error_message = "Each private_subnet_cidrs entry must be a CIDR block."
  }
}

variable "cost_center" {
  description = "Cost-allocation tag value. Also set on the caller's provider default_tags so every resource carries it; declared here so the module surface mirrors the CFN parameter set."
  type        = string
  default     = "platform"
}
