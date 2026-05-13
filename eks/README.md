# eks

Builds one EKS cluster per Routebox environment: cluster + a single managed node group, the IAM roles and KMS key the cluster needs, the OIDC provider for IRSA, the standard managed addons (vpc-cni, coredns, kube-proxy, aws-ebs-csi-driver, eks-pod-identity-agent), and access entries that wire SSO admin in.

There is no CFN equivalent to port — this is a new stack. Workload-layer pieces (AWS Load Balancer Controller, External-DNS, Cert-Manager, Metrics Server, Karpenter) are deliberately out of scope; they belong in app deploy tooling.

## Usage

```hcl
module "eks" {
  source = "../../eks"

  environment                  = var.environment
  vpc_id                       = module.network.vpc_id
  private_subnet_ids           = module.network.private_subnet_ids
  public_subnet_ids            = module.network.public_subnet_ids
  kubernetes_version           = var.eks_kubernetes_version
  endpoint_public_access_cidrs = var.eks_endpoint_public_access_cidrs
  node_instance_types          = var.eks_node_instance_types
  node_capacity_type           = var.eks_node_capacity_type
  node_disk_size_gb            = var.eks_node_disk_size_gb
  node_min_size                = var.eks_node_min_size
  node_desired_size            = var.eks_node_desired_size
  node_max_size                = var.eks_node_max_size
  cluster_admin_role_arns      = var.eks_cluster_admin_role_arns
  cost_center                  = var.cost_center
}
```

## Inputs

| Name                            | Type           | Default            | Description |
|---------------------------------|----------------|--------------------|-------------|
| `environment`                   | `string`       | _(required)_       | One of `dev`, `staging`, `prod`. Drives the cluster name and Name tags. |
| `vpc_id`                        | `string`       | _(required)_       | VPC ID. Pass `module.network.vpc_id`. |
| `private_subnet_ids`            | `list(string)` | _(required)_       | Three private subnet IDs. Control plane ENIs and node group launch here. Pass `module.network.private_subnet_ids`. |
| `public_subnet_ids`             | `list(string)` | _(required)_       | Three public subnet IDs. Used only for LBC cluster subnet tagging. Pass `module.network.public_subnet_ids`. |
| `kubernetes_version`            | `string`       | `"1.32"`           | EKS Kubernetes minor version. Bump deliberately. |
| `endpoint_public_access_cidrs`  | `list(string)` | `["0.0.0.0/0"]`    | CIDRs allowed to reach the API. Public + IAM-gated. |
| `node_instance_types`           | `list(string)` | `["t3.medium"]`    | Allowed node instance types. |
| `node_capacity_type`            | `string`       | _(required)_       | `SPOT` or `ON_DEMAND`. |
| `node_disk_size_gb`             | `number`       | `20`               | Root EBS size per node. |
| `node_min_size`                 | `number`       | _(required)_       | ASG min. |
| `node_desired_size`             | `number`       | _(required)_       | ASG desired at apply time; ignored on subsequent runs. |
| `node_max_size`                 | `number`       | _(required)_       | ASG max. |
| `cluster_admin_role_arns`       | `list(string)` | `[]`               | IAM role ARNs to grant cluster-admin via access entries. |
| `cost_center`                   | `string`       | `"platform"`       | Mirrors the network module surface; `default_tags` is what actually applies it. |

## Outputs

| Name                                  | Description |
|---------------------------------------|-------------|
| `cluster_name`                        | Cluster name (`routebox-<env>`). |
| `cluster_endpoint`                    | API server URL. |
| `cluster_certificate_authority_data`  | Base64 CA cert. Sensitive. |
| `cluster_oidc_issuer_url`             | OIDC issuer URL for IRSA. |
| `cluster_security_group_id`           | EKS-managed cluster SG. |
| `node_security_group_id`              | Same as the cluster SG in this configuration — see notes in `outputs.tf`. |
| `oidc_provider_arn`                   | IRSA OIDC provider ARN. |
| `kms_key_arn`                         | K8s secrets KMS key ARN. |
| `kms_key_alias`                       | Alias name (`alias/eks/routebox-<env>`). |

## Resources created

- `aws_eks_cluster.main`
- `aws_eks_node_group.main` — single managed node group, `<cluster>-default`
- `aws_cloudwatch_log_group.eks_cluster` — `/aws/eks/<cluster>/cluster`, 30-day retention
- `aws_iam_role.cluster` + `AmazonEKSClusterPolicy` attachment
- `aws_iam_role.node` + worker-node / CNI / ECR / SSM policy attachments
- `aws_kms_key.eks_secrets` (rotation on) + `aws_kms_alias.eks_secrets`
- `aws_iam_openid_connect_provider.eks` (thumbprint via the live cert chain)
- `aws_iam_role.ebs_csi` — IRSA role for the EBS CSI addon
- `aws_eks_addon` — `vpc-cni` (prefix delegation on), `coredns`, `kube-proxy`, `aws-ebs-csi-driver`, `eks-pod-identity-agent`
- `aws_ec2_tag` — per-cluster `kubernetes.io/cluster/<name> = shared` on all six subnets (private for internal LBs, public for internet-facing LBs)
- `aws_eks_access_entry` + `aws_eks_access_policy_association` — one pair per ARN in `cluster_admin_role_arns`

## Operational notes

- **Nodes run in private subnets.** Control plane ENIs and the managed node group both land in `private_subnet_ids`. With `enable_nat_gateway = false` (the network module default), private subnets have no default route — nodes cannot pull container images or reach AWS APIs over the public internet until you either flip `enable_nat_gateway = true` in the env tfvars, or provision VPC endpoints for ECR, S3, and `ec2.` / `eks.` APIs.
- **API endpoint open to `0.0.0.0/0`.** Auth is still IAM, but anyone on the internet can reach the API. Tighten `endpoint_public_access_cidrs` once we have a stable operator egress IP.
- **Control plane log retention is 30 days.** Set up front via `aws_cloudwatch_log_group` declared *before* the cluster — otherwise EKS auto-creates the group on first apply with "Never expire", and the explicit `depends_on` ordering matters.
- **K8s secrets are encrypted** with a customer-managed KMS key (envelope encryption). Rotation is on, deletion window 30 days.
- **Authentication mode is `API` only.** No aws-auth ConfigMap path. `bootstrap_cluster_creator_admin_permissions` is also `false`, so the apply role does NOT get implicit cluster-admin — every admin must be wired explicitly via `cluster_admin_role_arns`. If that list is empty on first apply, you'll have a cluster with no kubectl path in.
- **Node SG is the cluster's primary SG.** Without `remote_access` or a launch template, EKS reuses the cluster SG for nodes. `node_security_group_id` and `cluster_security_group_id` therefore point to the same SG.
- **`scaling_config.desired_size` is ignored after create.** When the cluster autoscaler ships, it'll drift this; Terraform won't fight back.
- **kubectl access:** `aws eks update-kubeconfig --name routebox-<env> --region us-east-1`. The caller must already be assuming an ARN that's in `cluster_admin_role_arns`.
- **Deferred to follow-ups.** AWS Load Balancer Controller, External-DNS, Cert-Manager, Metrics Server, and Karpenter are workload-shaped — they belong in app deploy tooling, not this module. Same for namespace bootstrapping and the cluster autoscaler itself.
