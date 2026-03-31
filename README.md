# مساعد العاملين الصحيين — Community Health Worker Assistant

An Arabic-language clinical decision support tool for community health workers in Yemen. Provides AI-assisted diagnosis guidance and treatment recommendations for common conditions, with offline capability via a Progressive Web App.

## Features

- AI-powered differential diagnosis using Anthropic Claude and Google Gemini
- Arabic-language interface designed for CHW workflows
- Offline-capable PWA (works without internet after first load)
- Role-based access: CHW, Supervisor, and Admin roles via Cognito
- Admin panel for user management (create, assign roles, enable/disable)
- Supervisor dashboard for oversight
- JWT-authenticated API — all requests verified server-side

## Architecture

```
Browser (React PWA)
    │
    ▼
AWS API Gateway (eu-west-1)
    │
    ▼
AWS Lambda — chw-assistant-proxy (Node.js 22, eu-west-1)
    ├── AI Proxy → Anthropic API / Google Gemini API
    └── Admin Routes → AWS Cognito (me-south-1)
         └── API keys stored in SSM Parameter Store (me-south-1)

Auth: AWS Cognito User Pool (me-south-1)
CDN:  S3 + CloudFront
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 6, Tailwind CSS 4 |
| Auth | AWS Amplify v6, AWS Cognito |
| AI | Anthropic Claude, Google Gemini (via Lambda proxy) |
| Backend | AWS Lambda (Node.js 22), API Gateway HTTP API |
| Config | AWS SSM Parameter Store |
| Infrastructure | Terraform |
| CI/CD | GitHub Actions |
| Security | DOMPurify (XSS), aws-jwt-verify (JWT validation) |

## Project Structure

```
chw-assistant-yemen/
├── app/                    # React frontend (Vite + Tailwind)
│   ├── src/
│   │   ├── App.jsx         # Main application and AI interaction
│   │   ├── AdminPanel.jsx  # User management UI
│   │   ├── SupervisorView.jsx
│   │   ├── auth/           # Cognito auth (Amplify v6)
│   │   └── data/           # Conditions and medicines reference data
│   ├── .env.example
│   └── vite.config.js
├── lambda/                 # Lambda function code
│   ├── index.js            # AI proxy + admin API handler
│   └── package.json
├── infra/                  # Terraform infrastructure
│   └── main.tf
└── .github/workflows/
    └── deploy.yml          # CI/CD pipeline
```

## Local Development

**Prerequisites:** Node.js 20+, AWS CLI configured

1. Clone the repo and install frontend dependencies:
   ```bash
   cd app
   npm install
   ```

2. Copy the env example and fill in your values:
   ```bash
   cp .env.example .env
   ```

   | Variable | Description |
   |----------|-------------|
   | `VITE_LAMBDA_URL` | API Gateway endpoint URL |
   | `VITE_COGNITO_USER_POOL_ID` | Cognito User Pool ID |
   | `VITE_COGNITO_CLIENT_ID` | Cognito App Client ID |

3. Start the dev server:
   ```bash
   npm run dev
   ```

## Deployment

### Infrastructure (first time only)

```bash
cd infra
terraform init
terraform apply
```

### CI/CD (on push to `main`)

The GitHub Actions pipeline in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) automatically:
1. Builds the React app with production env vars
2. Syncs the build to S3 and invalidates CloudFront
3. Zips and deploys the Lambda function

**Required GitHub Secrets:**

| Secret | Description |
|--------|-------------|
| `AWS_ACCESS_KEY_ID` | AWS credentials |
| `AWS_SECRET_ACCESS_KEY` | AWS credentials |
| `AWS_REGION` | Deployment region (eu-west-1) |
| `S3_BUCKET_NAME` | Frontend hosting bucket |
| `CLOUDFRONT_DISTRIBUTION_ID` | CDN distribution |
| `LAMBDA_FUNCTION_NAME` | Lambda function name |
| `VITE_LAMBDA_URL` | API Gateway URL injected at build time |
| `VITE_COGNITO_USER_POOL_ID` | Cognito pool ID |
| `VITE_COGNITO_CLIENT_ID` | Cognito client ID |

### Manual Lambda deploy

```bash
cd lambda
npm install
zip -r ../lambda.zip .
aws lambda update-function-code \
  --function-name chw-assistant-proxy \
  --zip-file fileb://../lambda.zip \
  --region eu-west-1
```

## Lambda Environment Variables

| Variable | Description |
|----------|-------------|
| `COGNITO_USER_POOL_ID` | Cognito User Pool ID for auth verification |
| `COGNITO_CLIENT_ID` | Cognito App Client ID for JWT validation |
| `ANTHROPIC_KEY_PARAM` | SSM parameter path for Anthropic API key |
| `GEMINI_KEY_PARAM` | SSM parameter path for Gemini API key |

API keys are stored as SecureString parameters in SSM Parameter Store (me-south-1) and fetched at runtime.
