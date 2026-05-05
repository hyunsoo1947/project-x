environment = "dev"
cost_center = "platform-dev"

vpc_cidr = "10.10.0.0/16"

public_subnet_cidrs = [
  "10.10.0.0/22",
  "10.10.4.0/22",
  "10.10.8.0/22",
]

private_subnet_cidrs = [
  "10.10.16.0/20",
  "10.10.32.0/20",
  "10.10.48.0/20",
]
