terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Pick the first three AZs in the caller's region, deterministically.
# Mirrors !Select [0|1|2, !GetAZs ''] in the original CFN template.
data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  az_letters = ["a", "b", "c"]
  azs        = slice(data.aws_availability_zones.available.names, 0, 3)

  public_subnets = {
    for i, cidr in var.public_subnet_cidrs :
    local.az_letters[i] => {
      cidr = cidr
      az   = local.azs[i]
    }
  }

  private_subnets = {
    for i, cidr in var.private_subnet_cidrs :
    local.az_letters[i] => {
      cidr = cidr
      az   = local.azs[i]
    }
  }
}

# ------------------------------------------------------------------
# VPC
# ------------------------------------------------------------------

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name       = "routebox-${var.environment}-vpc"
    CostCenter = var.cost_center
  }
}

# ------------------------------------------------------------------
# Internet gateway (attachment is a property of the resource in TF,
# not a separate aws_internet_gateway_attachment).
# ------------------------------------------------------------------

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "routebox-${var.environment}-igw"
  }
}

# ------------------------------------------------------------------
# Subnets — keyed by AZ letter (a/b/c) so the mapping back to the
# original CFN logical IDs (PublicSubnet1/2/3 == a/b/c) is inspectable.
# ------------------------------------------------------------------

resource "aws_subnet" "public" {
  for_each = local.public_subnets

  vpc_id                  = aws_vpc.main.id
  cidr_block              = each.value.cidr
  availability_zone       = each.value.az
  map_public_ip_on_launch = true

  # kubernetes.io/role/elb tags let the AWS Load Balancer Controller
  # auto-discover subnets for internet-facing LBs. They're a network
  # property and apply regardless of whether an EKS cluster is up.
  # Per-cluster kubernetes.io/cluster/<name> tags are managed by the
  # eks module via aws_ec2_tag, not here.
  tags = {
    Name                     = "routebox-${var.environment}-public-${each.key}"
    Tier                     = "public"
    "kubernetes.io/role/elb" = "1"
  }
}

resource "aws_subnet" "private" {
  for_each = local.private_subnets

  vpc_id                  = aws_vpc.main.id
  cidr_block              = each.value.cidr
  availability_zone       = each.value.az
  map_public_ip_on_launch = false

  tags = {
    Name                              = "routebox-${var.environment}-private-${each.key}"
    Tier                              = "private"
    "kubernetes.io/role/internal-elb" = "1"
  }
}

# ------------------------------------------------------------------
# NAT — single gateway in public-a. Cheap, but a SPOF. There were
# originally three (one per AZ); collapsed to one a while back and
# never put back. See module README.
#
# Optional via enable_nat_gateway. Default off: private subnets have
# no default route and no internet egress.
# ------------------------------------------------------------------

resource "aws_eip" "nat" {
  count = var.enable_nat_gateway ? 1 : 0

  domain     = "vpc"
  depends_on = [aws_internet_gateway.main]

  tags = {
    Name = "routebox-${var.environment}-nat-eip"
  }
}

resource "aws_nat_gateway" "main" {
  count = var.enable_nat_gateway ? 1 : 0

  allocation_id = aws_eip.nat[0].allocation_id
  subnet_id     = aws_subnet.public["a"].id

  tags = {
    Name = "routebox-${var.environment}-nat"
  }

  depends_on = [aws_internet_gateway.main]
}

# ------------------------------------------------------------------
# Route tables — one public, one private. Public default route via
# IGW; private default route via the single NAT.
# ------------------------------------------------------------------

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "routebox-${var.environment}-public-rt"
  }
}

resource "aws_route" "public_default" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.main.id
}

resource "aws_route_table_association" "public" {
  for_each = aws_subnet.public

  subnet_id      = each.value.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "routebox-${var.environment}-private-rt"
  }
}

# Conditional default route through NAT. The route table itself and
# its associations always exist — only the route through NAT is
# gated. With enable_nat_gateway = false the private route table has
# no default route, which is the explicit egress-less posture.
resource "aws_route" "private_default" {
  count = var.enable_nat_gateway ? 1 : 0

  route_table_id         = aws_route_table.private.id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.main[0].id
}

resource "aws_route_table_association" "private" {
  for_each = aws_subnet.private

  subnet_id      = each.value.id
  route_table_id = aws_route_table.private.id
}

# ------------------------------------------------------------------
# Security groups. CIDR-based ingress is inline; cross-SG ingress is
# split into separate aws_vpc_security_group_ingress_rule resources
# to avoid TF dependency cycles.
# ------------------------------------------------------------------

resource "aws_security_group" "alb" {
  name        = "routebox-${var.environment}-alb-sg"
  description = "Routebox public ALB. Open 80/443 from the internet."
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP from the internet (redirected to HTTPS at the listener)"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS from the internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "routebox-${var.environment}-alb-sg"
  }
}

resource "aws_security_group" "ecs" {
  name        = "routebox-${var.environment}-ecs-sg"
  description = "Routebox ECS service tasks. Inbound from the ALB only."
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "routebox-${var.environment}-ecs-sg"
  }
}

# Cross-SG ingress: ECS tasks accept all TCP ports from the ALB.
# Ported verbatim from the CFN template (FromPort 0, ToPort 65535) —
# wide open from the ALB; tightening per-service belongs in a follow-up.
resource "aws_vpc_security_group_ingress_rule" "ecs_from_alb" {
  security_group_id            = aws_security_group.ecs.id
  referenced_security_group_id = aws_security_group.alb.id
  ip_protocol                  = "tcp"
  from_port                    = 0
  to_port                      = 65535
  description                  = "All ports from ALB. Tightened per-service in the task SG would be better."
}

resource "aws_security_group" "rds" {
  name        = "routebox-${var.environment}-rds-sg"
  description = "Routebox RDS Postgres. 5432 from ECS tasks and Jenkins."
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "routebox-${var.environment}-rds-sg"
  }
}

resource "aws_vpc_security_group_ingress_rule" "rds_from_ecs" {
  security_group_id            = aws_security_group.rds.id
  referenced_security_group_id = aws_security_group.ecs.id
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  description                  = "Postgres from ECS tasks"
}

resource "aws_security_group" "jenkins" {
  name        = "routebox-${var.environment}-jenkins-sg"
  description = "Jenkins EC2. 8080 from VPC, 22 from bastion CIDR (TODO)."
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "Jenkins UI inside the VPC"
    from_port   = 8080
    to_port     = 8080
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  # TODO: SSH (22) from a bastion CIDR. Carried over from the CFN template;
  # the bastion CIDR was never decided on, so the rule was never added.
  # Don't open 22 to the world to "fix" this.

  tags = {
    Name = "routebox-${var.environment}-jenkins-sg"
  }
}

# Jenkins runs migrations and the rotate-keys job hits the API, so it
# also needs to reach RDS.
resource "aws_vpc_security_group_ingress_rule" "rds_from_jenkins" {
  security_group_id            = aws_security_group.rds.id
  referenced_security_group_id = aws_security_group.jenkins.id
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  description                  = "Postgres from Jenkins (migrations + ad-hoc)"
}
