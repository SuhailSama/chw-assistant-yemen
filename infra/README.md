# Infrastructure Deployment

## Prerequisites
- Terraform installed
- AWS CLI configured with appropriate credentials

## Deployment Instructions

1. **Build Lambda:** Run the build script from the root:
   ```bash
   npm run build:lambda
   ```
2. **Initialize:** Navigate to `infra/` and run:
   ```bash
   terraform init
   ```
3. **Plan & Apply:**
   ```bash
   terraform plan
   terraform apply
   ```
4. **Post-Deployment:**
   - Go to **AWS Systems Manager (SSM) Parameter Store**.
   - Update `/chw-assistant/ANTHROPIC_API_KEY` with your actual Anthropic API Key.
   - Update `/chw-assistant/ALLOWED_ORIGIN` with your CloudFront distribution URL (output after `apply`).
   - The Lambda function needs to be configured to read these parameters (using AWS SDK v3) or you can manually update the Lambda Environment Variables with the key.
