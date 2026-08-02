data "aws_caller_identity" "current" {}

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

data "aws_route53_zone" "public" {
  name         = var.hosted_zone_name
  private_zone = false
}

data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-x86_64"]
  }

  filter {
    name   = "architecture"
    values = ["x86_64"]
  }

  filter {
    name   = "root-device-type"
    values = ["ebs"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "random_id" "bucket_suffix" {
  byte_length = 4
}

resource "aws_s3_bucket" "artifacts" {
  bucket = "plantalk-${var.environment}-${data.aws_caller_identity.current.account_id}-${random_id.bucket_suffix.hex}"
}

resource "aws_s3_bucket_public_access_block" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id

  rule {
    id     = "expire-old-artifact-versions"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

resource "aws_s3_object" "backend" {
  bucket      = aws_s3_bucket.artifacts.id
  key         = "backend/plantalk-backend.jar"
  source      = var.artifact_path
  source_hash = filemd5(var.artifact_path)

  depends_on = [
    aws_s3_bucket_public_access_block.artifacts,
    aws_s3_bucket_server_side_encryption_configuration.artifacts,
  ]
}

resource "aws_iam_role" "backend" {
  name = "plantalk-${var.environment}-backend-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "ec2.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.backend.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy" "backend" {
  name = "plantalk-${var.environment}-backend-access"
  role = aws_iam_role.backend.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "ReadDeploymentArtifact"
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:GetObjectVersion"]
        Resource = "${aws_s3_bucket.artifacts.arn}/backend/*"
      },
      {
        Sid      = "ListDeploymentBucket"
        Effect   = "Allow"
        Action   = "s3:ListBucket"
        Resource = aws_s3_bucket.artifacts.arn
      },
      {
        Sid    = "ReadApplicationParameters"
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters",
          "ssm:GetParametersByPath",
        ]
        Resource = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/plantalk/${var.environment}/*"
      },
    ]
  })
}

resource "aws_iam_instance_profile" "backend" {
  name = "plantalk-${var.environment}-backend-profile"
  role = aws_iam_role.backend.name
}

resource "aws_security_group" "backend" {
  name        = "plantalk-${var.environment}-backend-sg"
  description = "Public HTTP access to the PlanTalk backend; administration uses SSM."
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "SSH from trusted administrator IP"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.ssh_allowed_cidr]
  }

  ingress {
    description      = "HTTP API"
    from_port        = 80
    to_port          = 80
    protocol         = "tcp"
    cidr_blocks      = ["0.0.0.0/0"]
    ipv6_cidr_blocks = ["::/0"]
  }

  ingress {
    description      = "HTTPS API"
    from_port        = 443
    to_port          = 443
    protocol         = "tcp"
    cidr_blocks      = ["0.0.0.0/0"]
    ipv6_cidr_blocks = ["::/0"]
  }

  egress {
    description      = "Outbound HTTPS, PostgreSQL, and package updates"
    from_port        = 0
    to_port          = 0
    protocol         = "-1"
    cidr_blocks      = ["0.0.0.0/0"]
    ipv6_cidr_blocks = ["::/0"]
  }
}

resource "aws_instance" "backend" {
  ami                    = data.aws_ami.amazon_linux.id
  instance_type          = var.instance_type
  subnet_id              = sort(data.aws_subnets.default.ids)[0]
  vpc_security_group_ids = [aws_security_group.backend.id]
  iam_instance_profile   = aws_iam_instance_profile.backend.name

  user_data = templatefile("${path.module}/templates/user-data.sh.tftpl", {
    aws_region      = var.aws_region
    artifact_bucket = aws_s3_bucket.artifacts.id
    parameter_path  = "/plantalk/${var.environment}"
    api_domain      = var.api_domain
  })

  user_data_replace_on_change = true

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
    instance_metadata_tags      = "disabled"
  }

  root_block_device {
    encrypted   = true
    volume_type = "gp3"
    volume_size = var.root_volume_size
  }

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name = "plantalk-${var.environment}-backend"
  }

  depends_on = [
    aws_iam_role_policy_attachment.ssm,
    aws_s3_object.backend,
  ]
}

resource "aws_eip" "backend" {
  domain = "vpc"

  tags = {
    Name = "plantalk-${var.environment}-backend-eip"
  }
}

resource "aws_eip_association" "backend" {
  allocation_id = aws_eip.backend.id
  instance_id   = aws_instance.backend.id
}

resource "aws_route53_record" "api" {
  zone_id = data.aws_route53_zone.public.zone_id
  name    = var.api_domain
  type    = "A"
  ttl     = 300
  records = [aws_eip.backend.public_ip]
}
