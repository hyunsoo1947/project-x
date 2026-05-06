environment = "prod"
cost_center = "platform-prod"

vpc_cidr = "10.30.0.0/16"

public_subnet_cidrs = [
  "10.30.0.0/22",
  "10.30.4.0/22",
  "10.30.8.0/22",
]

# Kept even though private subnets are currently egress-less. They
# stay reserved as a future option once we have something that needs
# isolation from the internet.
private_subnet_cidrs = [
  "10.30.16.0/20",
  "10.30.32.0/20",
  "10.30.48.0/20",
]

enable_nat_gateway = false

# ------------------------------------------------------------------
# EKS
# ------------------------------------------------------------------

eks_kubernetes_version           = "1.35"
eks_endpoint_public_access_cidrs = ["0.0.0.0/0"]
eks_node_instance_types          = ["t3.medium"]
# Recommended for prod workloads (not enabled — costs more):
# eks_node_instance_types        = ["m6i.large"]
eks_node_capacity_type = "ON_DEMAND"
eks_node_disk_size_gb  = 20
eks_node_min_size      = 3
eks_node_desired_size  = 3
eks_node_max_size      = 10

eks_cluster_admin_role_arns = [
  "arn:aws:iam::768485841146:role/aws-reserved/sso.amazonaws.com/us-east-2/AWSReservedSSO_Administrator_45719661edf466aa",
]
