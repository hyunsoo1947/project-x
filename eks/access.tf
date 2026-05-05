# ------------------------------------------------------------------
# Cluster admin access via EKS access entries.
#
# authentication_mode = "API" on the cluster means there's no
# aws-auth ConfigMap path; access entries are the only way in.
# bootstrap_cluster_creator_admin_permissions is also off, so the
# Terraform-apply role does NOT get implicit admin — every admin
# is wired explicitly here.
#
# AmazonEKSClusterAdminPolicy is the AWS-managed cluster-scope
# admin policy; scope = cluster gives full admin everywhere.
# ------------------------------------------------------------------

resource "aws_eks_access_entry" "admin" {
  for_each = toset(var.cluster_admin_role_arns)

  cluster_name  = aws_eks_cluster.main.name
  principal_arn = each.value
  type          = "STANDARD"

  tags = {
    Name = "routebox-${var.environment}-admin"
  }
}

resource "aws_eks_access_policy_association" "admin" {
  for_each = toset(var.cluster_admin_role_arns)

  cluster_name  = aws_eks_cluster.main.name
  principal_arn = each.value
  policy_arn    = "arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy"

  access_scope {
    type = "cluster"
  }

  depends_on = [aws_eks_access_entry.admin]
}
