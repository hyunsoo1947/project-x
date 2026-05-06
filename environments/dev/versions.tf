terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    # tls is used by the eks module to read the cluster OIDC issuer's
    # cert chain so the IAM OIDC provider thumbprint isn't hardcoded.
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }
}
