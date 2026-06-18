variable "region" {
  description = "AWS region for the cloud worker"
  type        = string
  default     = "us-east-1"
}

variable "ami_id" {
  description = "Hardened AMI ID; must have cloud-init, Tailscale, and Docker installed"
  type        = string
}

variable "instance_type" {
  description = "EC2 instance type for the cloud worker"
  type        = string
  default     = "t3.micro"
}

variable "tailscale_auth_key" {
  description = "Tailscale auth key tagged with 'cloud'"
  type        = string
  sensitive   = true
}

variable "webhook_url" {
  description = "Short-lived signed webhook URL where the worker POSTs its result"
  type        = string
  sensitive   = true
}

variable "job_payload" {
  description = "Base64-encoded job payload passed to the worker via user-data"
  type        = string
  sensitive   = true
}
