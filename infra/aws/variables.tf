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

variable "artifact_path" {
  description = "Path to the locally built Spring Boot executable JAR."
  type        = string
  default     = "../../backend/target/unb-backend-1.0.0.jar"
}
