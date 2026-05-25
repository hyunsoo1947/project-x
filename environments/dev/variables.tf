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

variable "enable_nat_gateway" {
  description = "Toggle the network module's NAT gateway on or off. Default off — private subnets have no internet egress when off."
  type        = bool
}

# ------------------------------------------------------------------
# EKS — surface mirrors the eks module's variables. Values come
# from <env>.tfvars; no defaults at this layer.
# ------------------------------------------------------------------

variable "eks_kubernetes_version" {
  description = "Kubernetes minor version pinned on the EKS cluster."
  type        = string
}

variable "eks_endpoint_public_access_cidrs" {
  description = "CIDRs allowed to reach the API server. Public + IAM-gated."
  type        = list(string)
}

variable "eks_node_instance_types" {
  description = "Allowed node instance types for the managed node group."
  type        = list(string)
}

variable "eks_node_capacity_type" {
  description = "Node capacity type: SPOT or ON_DEMAND."
  type        = string
}

variable "eks_node_disk_size_gb" {
  description = "Root EBS volume size per node, GiB."
  type        = number
}

variable "eks_node_min_size" {
  description = "Minimum node count."
  type        = number
}

variable "eks_node_desired_size" {
  description = "Desired node count at apply time. Subsequent changes are ignored so the cluster autoscaler can drift it."
  type        = number
}

variable "eks_node_max_size" {
  description = "Maximum node count."
  type        = number
}

variable "eks_cluster_admin_role_arns" {
  description = "IAM role ARNs to grant cluster-admin via EKS access entries (AmazonEKSClusterAdminPolicy, scope = cluster). Typically the SSO admin role for this account."
  type        = list(string)
}

# ------------------------------------------------------------------
# RDS
# ------------------------------------------------------------------

variable "rds_instance_class" {
  description = "RDS instance class."
  type        = string
  default     = "db.t3.micro"
}

variable "rds_db_name" {
  description = "Name of the initial database created on the RDS instance."
  type        = string
  default     = "routebox"
}

variable "rds_db_username" {
  description = "Master DB username."
  type        = string
  default     = "routeboxapp"
}
