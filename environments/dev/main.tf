module "routebox_dev_vpc" {
    source = "../../network"

    cidr_block = var.root_cidr_block
    tag_name   = var.root_tag_name
}