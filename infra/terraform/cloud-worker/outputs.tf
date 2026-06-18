output "instance_id" {
  description = "ID of the provisioned cloud worker instance"
  value       = aws_instance.cloud_worker.id
}

output "private_ip" {
  description = "Private IP of the cloud worker (no public IP)"
  value       = aws_instance.cloud_worker.private_ip
}
