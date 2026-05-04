terraform {
  backend "s3" {
    bucket       = "routebox-tfstate-dev"
    key          = "network/dev/terraform.tfstate"
    region       = "us-east-1"
    use_lockfile = true
    encrypt      = true
  }
}
