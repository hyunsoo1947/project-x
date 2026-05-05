terraform {
  backend "s3" {
    bucket       = "routebox-tfstate-prod"
    key          = "terraform.tfstate"
    region       = "us-east-1"
    use_lockfile = true
    encrypt      = true
  }
}
