# routebox-infra-tf

Terraform replacement for [`routebox-infra`](https://github.com/312school/routebox-infra). **Migration in progress** — the CloudFormation repo is still authoritative for everything that hasn't been ported yet.

## Layout

```
.
├── network/                # Reusable module — VPC, subnets, NAT, route tables, default SGs
│   ├── main.tf
│   ├── variables.tf
│   ├── outputs.tf
│   └── README.md
└── environments/
    ├── dev/                # Per-env wiring: provider, backend, tfvars, module call
    ├── staging/
    └── prod/
```

The convention is: **one module at the repo root per logical stack, one directory per environment under `environments/`** that consumes it. State lives per-env in S3 (see backend caveat below).

## Migration status

Six CloudFormation stacks live in `routebox-infra/`:

| Stack                | Status               |
|----------------------|----------------------|
| `network`            | **Ported (this repo)** — not yet cut over |
| `iam`                | CFN — not ported     |
| `ecs-cluster`        | CFN — not ported     |
| `rds`                | CFN — not ported     |
| `ecr`                | CFN — not ported     |
| `secrets-bootstrap`  | CFN — not ported     |

**Ported does not mean cut over.** Applying the `network` module against an account where `routebox-network-<env>` already exists will create parallel VPC / subnets / SGs. The cutover plan — `terraform import` blocks, or re-pointing consumer stacks, or running both side-by-side during a window — has not been decided yet.

In particular:

- The CFN `network` template publishes its outputs as **CloudFormation Exports** (`!ImportValue`), and the other five stacks consume those exports by name (`routebox-<env>-vpc-id` etc., plus two grandfathered legacy names). Terraform does not produce CloudFormation exports; the consumer stacks need a coordinated migration before the TF module can replace the CFN one.
- Until then, this repo is read-only documentation of what the TF version *would* look like.

## Working in here

```
cd environments/dev
terraform init -backend-config=...   # backend values are TODO placeholders, see backend.tf
terraform plan -var-file=dev.tfvars
terraform apply -var-file=dev.tfvars
```

`backend.tf` in each env intentionally contains TODO placeholders for the S3 bucket / lock table — operators must fill these before the first `init`.

## Conventions

- **Tags.** `Environment`, `ManagedBy = "terraform"` (was `cloudformation`), `CostCenter` are applied via the env-level provider's `default_tags` so every resource carries them. Per-resource `Name` tags match the CFN values exactly.
- **Lock file** (`.terraform.lock.hcl`) is gitignored in this repo — see the comment in `.gitignore`.
- **Provider pin.** `hashicorp/aws ~> 5.0`, `terraform >= 1.6`.

## Why a separate repo

Same reason multi-account is a long-term roadmap item rather than a short-term fix: blast radius. Porting in a separate repo lets us land the TF version, review it, and decide on cutover without disrupting `routebox-infra`'s deploy flow.
