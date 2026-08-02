output "backend_public_ip" {
  description = "Elastic IP address of the PlanTalk backend."
  value       = aws_eip.backend.public_ip
}

output "backend_http_url" {
  description = "Temporary HTTP URL. Add a domain and TLS before production release."
  value       = "http://${aws_eip.backend.public_ip}"
}

output "backend_https_url" {
  description = "Public HTTPS URL after the TLS certificate has been installed."
  value       = "https://${var.api_domain}"
}

output "api_domain" {
  description = "Route 53 domain assigned to the PlanTalk API."
  value       = aws_route53_record.api.fqdn
}

output "instance_id" {
  description = "EC2 instance ID used for SSM administration."
  value       = aws_instance.backend.id
}

output "ssh_command" {
  description = "SSH command after the administrator public key has been installed through SSM."
  value       = "ssh -i ~/.ssh/plantalk-ec2 ec2-user@${aws_eip.backend.public_ip}"
}

output "artifact_bucket" {
  description = "Private S3 bucket used for backend artifacts."
  value       = aws_s3_bucket.artifacts.id
}
