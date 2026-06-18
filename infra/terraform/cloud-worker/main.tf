terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region
}

# No inbound access; egress is restricted to Tailscale coordination, the signed
# webhook URL, and (optionally) the AWS S3 endpoint for AMI/package fetch.
resource "aws_security_group" "cloud_worker" {
  name        = "mimir-cloud-worker"
  description = "Air-gapped cloud worker security group"

  egress {
    description = "Tailscale coordination and HTTPS webhook return"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Tailscale wireguard (UDP)"
    from_port   = 41641
    to_port     = 41641
    protocol    = "udp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_iam_role" "cloud_worker" {
  name = "mimir-cloud-worker"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ec2.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy" "cloud_worker" {
  name = "mimir-cloud-worker-minimal"
  role = aws_iam_role.cloud_worker.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Deny"
      Action   = "*"
      Resource = "*"
    }]
  })
}

resource "aws_iam_instance_profile" "cloud_worker" {
  name = "mimir-cloud-worker"
  role = aws_iam_role.cloud_worker.name
}

resource "aws_launch_template" "cloud_worker" {
  name_prefix   = "mimir-cloud-worker-"
  image_id      = var.ami_id
  instance_type = var.instance_type

  iam {
    name = aws_iam_instance_profile.cloud_worker.name
  }

  network_interfaces {
    associate_public_ip_address = false
    security_groups             = [aws_security_group.cloud_worker.id]
  }

  metadata_options {
    http_tokens = "required"
  }

  user_data = base64encode(templatefile("${path.module}/user-data.sh", {
    tailscale_auth_key = var.tailscale_auth_key
    webhook_url        = var.webhook_url
    job_payload        = var.job_payload
  }))
}

resource "aws_instance" "cloud_worker" {
  launch_template {
    id      = aws_launch_template.cloud_worker.id
    version = "$Latest"
  }

  tags = {
    Name    = "mimir-cloud-worker"
    Managed = "terraform"
  }
}
