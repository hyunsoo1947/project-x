environment = "staging"
cost_center = "platform-staging"

vpc_cidr = "10.20.0.0/16"

public_subnet_cidrs = [
  "10.20.0.0/22",
  "10.20.4.0/22",
  "10.20.8.0/22",
]

# Kept even though private subnets are currently egress-less. They
# stay reserved as a future option once we have something that needs
# isolation from the internet.
private_subnet_cidrs = [
  "10.20.16.0/20",
  "10.20.32.0/20",
  "10.20.48.0/20",
]

enable_nat_gateway = false

# ------------------------------------------------------------------
# EKS
# ------------------------------------------------------------------

eks_kubernetes_version           = "1.32"
eks_endpoint_public_access_cidrs = ["0.0.0.0/0"]
# t3.medium: 2 vCPU / 4 GiB — fine for staging. Upgrade options:
#   t3.large  (2 vCPU /  8 GiB) — memory-constrained workloads
#   m6i.large (2 vCPU /  8 GiB) — consistent baseline, good perf/cost
eks_node_instance_types = ["t3.medium"]
eks_node_capacity_type  = "SPOT"
eks_node_disk_size_gb   = 20
eks_node_min_size       = 2
eks_node_desired_size   = 2
eks_node_max_size       = 6

eks_cluster_admin_role_arns = [
  "arn:aws:iam::951395863261:role/aws-reserved/sso.amazonaws.com/AWSReservedSSO_AdministratorAccess_bcb796c018f40778",
]
