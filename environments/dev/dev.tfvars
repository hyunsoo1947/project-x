#just a comment
environment = "dev"
cost_center = "platform-dev"

vpc_cidr = "10.10.0.0/16"

public_subnet_cidrs = [
  "10.10.0.0/22",
  "10.10.4.0/22",
  "10.10.8.0/22",
]

# Kept even though private subnets are currently egress-less. They
# stay reserved as a future option once we have something that needs
# isolation from the internet.
private_subnet_cidrs = [
  "10.10.16.0/20",
  "10.10.32.0/20",
  "10.10.48.0/20",
]

enable_nat_gateway = true

# ------------------------------------------------------------------
# EKS
# ------------------------------------------------------------------

eks_kubernetes_version           = "1.32"
eks_endpoint_public_access_cidrs = ["0.0.0.0/0"]
# t3.medium: 2 vCPU / 4 GiB — fine for dev. Upgrade options:
#   t3.large  (2 vCPU /  8 GiB) — memory-constrained workloads
#   m6i.large (2 vCPU /  8 GiB) — consistent baseline, good perf/cost
eks_node_instance_types = ["t3.medium"]
eks_node_capacity_type  = "SPOT"
eks_node_disk_size_gb   = 20
eks_node_min_size       = 2
eks_node_desired_size   = 2
eks_node_max_size       = 4

eks_cluster_admin_role_arns = [
  "arn:aws:iam::109259679822:role/aws-reserved/sso.amazonaws.com/AWSReservedSSO_AdministratorAccess_c3eed6e6b9b65e63",
]
