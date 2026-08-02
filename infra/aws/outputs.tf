output "backend_public_ip" {
  description = "Elastic IP address of the PlanTalk backend."
  value       = aws_eip.backend.public_ip
}

output "backend_http_url" {
  description = "Temporary HTTP URL. Add a domain and TLS before production release."
  value       = "http://${aws_eip.backend.public_ip}"
}

output "instance_id" {
  description = "EC2 instance ID used for SSM administration."
  value       = aws_instance.backend.id
}

output "artifact_bucket" {
  description = "Private S3 bucket used for backend artifacts."
  value       = aws_s3_bucket.artifacts.id
}
