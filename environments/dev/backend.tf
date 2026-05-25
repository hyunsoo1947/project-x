terraform {
  backend "s3" {
    bucket       = "routebox-tfstate-1947"
    key          = "terraform.tfstate"
    region       = "us-east-1"
    use_lockfile = true
    encrypt      = true
  }
}
