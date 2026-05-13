# ------------------------------------------------------------------
# Managed addon versions resolved per cluster K8s version, so a
# version bump on the cluster pulls the matching addons. Hardcoded
# addon versions go stale fast; don't.
# ------------------------------------------------------------------

data "aws_eks_addon_version" "vpc_cni" {
  addon_name         = "vpc-cni"
  kubernetes_version = aws_eks_cluster.main.version
  most_recent        = true
}

data "aws_eks_addon_version" "coredns" {
  addon_name         = "coredns"
  kubernetes_version = aws_eks_cluster.main.version
  most_recent        = true
}

data "aws_eks_addon_version" "kube_proxy" {
  addon_name         = "kube-proxy"
  kubernetes_version = aws_eks_cluster.main.version
  most_recent        = true
}

data "aws_eks_addon_version" "ebs_csi" {
  addon_name         = "aws-ebs-csi-driver"
  kubernetes_version = aws_eks_cluster.main.version
  most_recent        = true
}

data "aws_eks_addon_version" "pod_identity" {
  addon_name         = "eks-pod-identity-agent"
  kubernetes_version = aws_eks_cluster.main.version
  most_recent        = true
}

# ------------------------------------------------------------------
# vpc-cni — prefix delegation enabled so a single ENI hands out /28
# slabs of IPs. Without this, pod density per node is bounded by ENI
# count × IPs/ENI, which is brutally low on small instance types.
# ------------------------------------------------------------------

resource "aws_eks_addon" "vpc_cni" {
  cluster_name  = aws_eks_cluster.main.name
  addon_name    = "vpc-cni"
  addon_version = data.aws_eks_addon_version.vpc_cni.version

  resolve_conflicts_on_create = "OVERWRITE"
  resolve_conflicts_on_update = "OVERWRITE"

  configuration_values = jsonencode({
    env = {
      ENABLE_PREFIX_DELEGATION = "true"
      WARM_PREFIX_TARGET       = "1"
    }
  })

  tags = {
    Name = "routebox-${var.environment}-vpc-cni"
  }
}

# coredns needs nodes to schedule on — depend on the node group.
resource "aws_eks_addon" "coredns" {
  cluster_name  = aws_eks_cluster.main.name
  addon_name    = "coredns"
  addon_version = data.aws_eks_addon_version.coredns.version

  resolve_conflicts_on_create = "OVERWRITE"
  resolve_conflicts_on_update = "OVERWRITE"

  tags = {
    Name = "routebox-${var.environment}-coredns"
  }

  depends_on = [aws_eks_node_group.main]
}

resource "aws_eks_addon" "kube_proxy" {
  cluster_name  = aws_eks_cluster.main.name
  addon_name    = "kube-proxy"
  addon_version = data.aws_eks_addon_version.kube_proxy.version

  resolve_conflicts_on_create = "OVERWRITE"
  resolve_conflicts_on_update = "OVERWRITE"

  tags = {
    Name = "routebox-${var.environment}-kube-proxy"
  }
}

resource "aws_eks_addon" "ebs_csi" {
  cluster_name             = aws_eks_cluster.main.name
  addon_name               = "aws-ebs-csi-driver"
  addon_version            = data.aws_eks_addon_version.ebs_csi.version
  service_account_role_arn = aws_iam_role.ebs_csi.arn

  resolve_conflicts_on_create = "OVERWRITE"
  resolve_conflicts_on_update = "OVERWRITE"

  tags = {
    Name = "routebox-${var.environment}-ebs-csi"
  }
}

resource "aws_eks_addon" "pod_identity" {
  cluster_name  = aws_eks_cluster.main.name
  addon_name    = "eks-pod-identity-agent"
  addon_version = data.aws_eks_addon_version.pod_identity.version

  resolve_conflicts_on_create = "OVERWRITE"
  resolve_conflicts_on_update = "OVERWRITE"

  tags = {
    Name = "routebox-${var.environment}-pod-identity"
  }
}

# ------------------------------------------------------------------
# Per-cluster subnet tags for the AWS Load Balancer Controller.
#
# kubernetes.io/role/elb = "1" (public) and
# kubernetes.io/role/internal-elb = "1" (private) are set on the
# subnets in the network module — they're a VPC-level property that
# applies regardless of cluster state.
#
# kubernetes.io/cluster/<cluster-name> = "shared" is cluster-scoped,
# so its lifecycle tracks the cluster and is owned here via
# aws_ec2_tag. Both subnet tiers are tagged: public for internet-
# facing LBs, private for internal LBs.
#
# Modern AWS Load Balancer Controller doesn't strictly require the
# cluster tag, but older controllers and a few third-party tools
# still look for it.
#
# count, not for_each — subnet IDs come from the network module and
# are unknown at plan time, so they can't be used as for_each map
# keys. Length is statically 3 (validated on the input variable), so
# count works.
# ------------------------------------------------------------------

resource "aws_ec2_tag" "private_subnet_cluster" {
  count = length(var.private_subnet_ids)

  resource_id = var.private_subnet_ids[count.index]
  key         = "kubernetes.io/cluster/${local.cluster_name}"
  value       = "shared"
}

resource "aws_ec2_tag" "public_subnet_cluster" {
  count = length(var.public_subnet_ids)

  resource_id = var.public_subnet_ids[count.index]
  key         = "kubernetes.io/cluster/${local.cluster_name}"
  value       = "shared"
}
