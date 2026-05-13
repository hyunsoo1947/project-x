variable "environment" {
  description = "Which environment this module instance is for. Drives the cluster name and Name tags. Three deployments: dev / staging / prod, each in its own AWS account."
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be one of: dev, staging, prod."
  }
}

variable "vpc_id" {
  description = "ID of the VPC the cluster lives in. The network module's vpc_id."
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs the control plane ENIs and managed node group launch into. Three required, one per AZ. The network module's private_subnet_ids. Nodes require outbound internet access (for image pulls, AWS API calls) — enable NAT via enable_nat_gateway = true in the env, or provision VPC endpoints, before scheduling workloads."
  type        = list(string)

  validation {
    condition     = length(var.private_subnet_ids) == 3
    error_message = "private_subnet_ids must have exactly 3 entries."
  }
}

variable "public_subnet_ids" {
  description = "Public subnet IDs used only for per-cluster LBC subnet tagging (kubernetes.io/cluster/<name> = shared on the public subnets so the AWS Load Balancer Controller can discover them for internet-facing load balancers). Three required. The network module's public_subnet_ids."
  type        = list(string)

  validation {
    condition     = length(var.public_subnet_ids) == 3
    error_message = "public_subnet_ids must have exactly 3 entries."
  }
}

variable "kubernetes_version" {
  description = "Kubernetes minor version pinned on the EKS cluster. Bump in a separate, deliberate PR — addons follow this version via the aws_eks_addon_version data source."
  type        = string
  default     = "1.32"
}

variable "endpoint_public_access_cidrs" {
  description = "CIDRs allowed to reach the Kubernetes API server. Default 0.0.0.0/0 — auth is still IAM-gated, but anyone on the internet can reach the API. Lock this down once we have a stable egress IP for operators."
  type        = list(string)
  default     = ["0.0.0.0/0"]

  validation {
    condition     = length(var.endpoint_public_access_cidrs) > 0
    error_message = "endpoint_public_access_cidrs must contain at least one CIDR; an empty list disables public access entirely."
  }

  validation {
    condition     = alltrue([for c in var.endpoint_public_access_cidrs : can(regex("^([0-9]{1,3}\\.){3}[0-9]{1,3}/[0-9]{1,2}$", c))])
    error_message = "Each endpoint_public_access_cidrs entry must be a CIDR block."
  }
}

variable "node_instance_types" {
  description = "Instance types the managed node group is allowed to launch. Multiple entries are passed straight through to AWS so the ASG can substitute capacity (relevant for SPOT)."
  type        = list(string)
  default     = ["t3.medium"]

  validation {
    condition     = length(var.node_instance_types) > 0
    error_message = "node_instance_types must contain at least one instance type."
  }
}

variable "node_capacity_type" {
  description = "SPOT or ON_DEMAND. SPOT is cheaper and acceptable for dev/staging; prod stays ON_DEMAND."
  type        = string

  validation {
    condition     = contains(["SPOT", "ON_DEMAND"], var.node_capacity_type)
    error_message = "node_capacity_type must be one of: SPOT, ON_DEMAND."
  }
}

variable "node_disk_size_gb" {
  description = "Root EBS volume size on each node, in GiB."
  type        = number
  default     = 20
}

variable "node_min_size" {
  description = "Minimum node count for the managed node group."
  type        = number
}

variable "node_desired_size" {
  description = "Desired node count at module-apply time. The cluster autoscaler is allowed to drift this — Terraform ignores subsequent changes so it doesn't fight back."
  type        = number
}

variable "node_max_size" {
  description = "Maximum node count for the managed node group."
  type        = number
}

variable "cluster_admin_role_arns" {
  description = "IAM role ARNs that get cluster-admin via EKS access entries (AmazonEKSClusterAdminPolicy, scope = cluster). Typically the SSO admin role. Leave empty to bootstrap without admins, but you'll then have no kubectl path in — bootstrap_cluster_creator_admin_permissions is off."
  type        = list(string)
  default     = []
}

variable "cost_center" {
  description = "Cost-allocation tag value. The env-level provider's default_tags is what actually applies it; declared here to mirror the network module's surface."
  type        = string
  default     = "platform"
}
