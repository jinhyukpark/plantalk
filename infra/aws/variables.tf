variable "aws_profile" {
  description = "Local AWS CLI SSO profile used by Terraform."
  type        = string
  default     = "plantalk-deployer"
}

variable "aws_region" {
  description = "AWS region for the PlanTalk backend."
  type        = string
  default     = "ap-northeast-2"
}

variable "environment" {
  description = "Deployment environment name."
  type        = string
  default     = "prod"
}

variable "instance_type" {
  description = "EC2 instance type for the Spring Boot API."
  type        = string
  default     = "t3.small"
}

variable "root_volume_size" {
  description = "Root gp3 volume size in GiB."
  type        = number
  default     = 30
}

variable "ssh_allowed_cidr" {
  description = "Single trusted public IPv4 CIDR allowed to connect to EC2 over SSH."
  type        = string

  validation {
    condition     = can(cidrhost(var.ssh_allowed_cidr, 0)) && endswith(var.ssh_allowed_cidr, "/32")
    error_message = "ssh_allowed_cidr must be a single trusted IPv4 address expressed as a /32 CIDR."
  }
}

variable "api_domain" {
  description = "Public HTTPS domain for the PlanTalk API."
  type        = string
  default     = "api.plantalk.io"
}

variable "hosted_zone_name" {
  description = "Route 53 public hosted zone that owns the API domain."
  type        = string
  default     = "plantalk.io"
}

variable "artifact_path" {
  description = "Path to the locally built Spring Boot executable JAR."
  type        = string
  default     = "../../backend/target/unb-backend-1.0.0.jar"
}
