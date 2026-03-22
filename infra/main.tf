variable "aws_region" {
  description = "AWS region"
  default     = "me-south-1"
}

variable "project_name" {
  description = "Project name"
  default     = "chw-assistant"
}

provider "aws" {
  region = var.aws_region
}

# ── Lambda & API Gateway ──────────────────────────────────────

resource "aws_iam_role" "lambda_exec" {
  name = "${var.project_name}-lambda-exec"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{ Action = "sts:AssumeRole", Effect = "Allow", Principal = { Service = "lambda.amazonaws.com" } }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_policy" "lambda_ssm" {
  name = "${var.project_name}-lambda-ssm"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "ssm:GetParameters"
      Resource = [
        aws_ssm_parameter.anthropic_key.arn,
        aws_ssm_parameter.gemini_key.arn,
      ]
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_ssm" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = aws_iam_policy.lambda_ssm.arn
}

resource "aws_lambda_function" "proxy" {
  filename      = "../lambda.zip"
  function_name = "${var.project_name}-proxy"
  role          = aws_iam_role.lambda_exec.arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  memory_size   = 128
  timeout       = 10

  environment {
    variables = {
      ANTHROPIC_KEY_PARAM = aws_ssm_parameter.anthropic_key.name
      GEMINI_KEY_PARAM    = aws_ssm_parameter.gemini_key.name
    }
  }
}

resource "aws_apigatewayv2_api" "api" {
  name          = "${var.project_name}-api"
  protocol_type = "HTTP"
  cors_configuration {
    allow_origins = ["*"] # Updated post-deployment to CloudFront domain
    allow_methods = ["POST", "OPTIONS"]
    allow_headers = ["content-type"]
  }
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id           = aws_apigatewayv2_api.api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.proxy.invoke_arn
}

resource "aws_apigatewayv2_route" "messages" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "POST /v1/messages"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_stage" "prod" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = "prod"
  auto_deploy = true
}

resource "aws_lambda_permission" "apigw" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.proxy.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}

# ── Frontend (S3 + CloudFront) ───────────────────────────────

resource "aws_s3_bucket" "frontend" {
  bucket = "${var.project_name}-frontend-${random_id.bucket_suffix.hex}"
}

resource "random_id" "bucket_suffix" {
  byte_length = 4
}

resource "aws_s3_bucket_versioning" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_cloudfront_origin_access_control" "oac" {
  name                              = "${var.project_name}-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "cf" {
  enabled             = true
  default_root_object = "index.html"
  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = "s3-frontend"
    origin_access_control_id = aws_cloudfront_origin_access_control.oac.id
  }
  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "s3-frontend"
    viewer_protocol_policy = "redirect-to-https"
    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }
  }
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
  viewer_certificate { cloudfront_default_certificate = true }
}

# ── SSM Parameters ──────────────────────────────────────────

resource "aws_ssm_parameter" "anthropic_key" {
  name  = "/${var.project_name}/ANTHROPIC_API_KEY"
  type  = "SecureString"
  value = "changeme" # Manually update in AWS Console
  lifecycle { ignore_changes = [value] }
}

resource "aws_ssm_parameter" "gemini_key" {
  name  = "/${var.project_name}/GEMINI_API_KEY"
  type  = "SecureString"
  value = "changeme" # Manually update in AWS Console
  lifecycle { ignore_changes = [value] }
}

resource "aws_ssm_parameter" "allowed_origin" {
  name  = "/${var.project_name}/ALLOWED_ORIGIN"
  type  = "SecureString"
  value = "changeme" # Manually update in AWS Console
}

# ── Outputs ────────────────────────────────────────────────

output "cloudfront_domain" { value = aws_cloudfront_distribution.cf.domain_name }
output "api_gateway_url" { value = "${aws_apigatewayv2_stage.prod.invoke_url}/v1/messages" }
