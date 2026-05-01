environment = "staging"
cost_center = "platform-staging"

vpc_cidr = "10.20.0.0/16"

public_subnet_cidrs = [
  "10.20.0.0/22",
  "10.20.4.0/22",
  "10.20.8.0/22",
]

private_subnet_cidrs = [
  "10.20.16.0/20",
  "10.20.32.0/20",
  "10.20.48.0/20",
]
