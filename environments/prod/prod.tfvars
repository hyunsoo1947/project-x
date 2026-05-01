environment = "prod"
cost_center = "platform-prod"

vpc_cidr = "10.30.0.0/16"

public_subnet_cidrs = [
  "10.30.0.0/22",
  "10.30.4.0/22",
  "10.30.8.0/22",
]

private_subnet_cidrs = [
  "10.30.16.0/20",
  "10.30.32.0/20",
  "10.30.48.0/20",
]
