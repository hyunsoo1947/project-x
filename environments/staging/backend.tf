terraform {
  backend "s3" {
    bucket       = "routebox-tfstate-staging"
    key          = "terraform.tfstate"
    region       = "us-east-1"
    use_lockfile = true
    encrypt      = true
  }
}
