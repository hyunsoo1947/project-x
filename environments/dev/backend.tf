terraform {
  # TODO: operators must fill these placeholders before the first
  # `terraform init`. Concrete bucket / lock-table names have not been
  # decided yet; see the migration PR description for follow-ups.
  #
  # The recommended invocation once the values are settled:
  #
  #   terraform init \
  #     -backend-config="bucket=<TODO>" \
  #     -backend-config="key=network/dev/terraform.tfstate" \
  #     -backend-config="region=<TODO>" \
  #     -backend-config="dynamodb_table=<TODO>"
  #
  # Do not commit real bucket / table names here.
  backend "s3" {
    bucket         = "TODO-routebox-tfstate-bucket"
    key            = "network/dev/terraform.tfstate"
    region         = "TODO-region"
    dynamodb_table = "TODO-routebox-tfstate-lock"
    encrypt        = true
  }
}
