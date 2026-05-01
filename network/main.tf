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

  tags = {
    Name = "routebox-${var.environment}-public-${each.key}"
    Tier = "public"
  }
}

resource "aws_subnet" "private" {
  for_each = local.private_subnets

  vpc_id                  = aws_vpc.main.id
  cidr_block              = each.value.cidr
  availability_zone       = each.value.az
  map_public_ip_on_launch = false

  tags = {
    Name = "routebox-${var.environment}-private-${each.key}"
    Tier = "private"
  }
}

# ------------------------------------------------------------------
# NAT — single gateway in public-a. Cheap, but a SPOF. There were
# originally three (one per AZ); collapsed to one a while back and
# never put back. See module README.
# ------------------------------------------------------------------

resource "aws_eip" "nat" {
  domain     = "vpc"
  depends_on = [aws_internet_gateway.main]

  tags = {
    Name = "routebox-${var.environment}-nat-eip"
  }
}

resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.allocation_id
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

resource "aws_route" "private_default" {
  route_table_id         = aws_route_table.private.id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.main.id
}

resource "aws_route_table_association" "private" {
  for_each = aws_subnet.private

  subnet_id      = each.value.id
  route_table_id = aws_route_table.private.id
}
