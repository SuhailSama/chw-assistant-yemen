# Lambda Proxy Function

## Overview
This AWS Lambda function acts as a proxy to the Anthropic API to keep your API keys secure.

## Environment Variables
- `ANTHROPIC_API_KEY`: Your Anthropic API key.
- `ALLOWED_ORIGIN`: Your CloudFront or Amplify domain to restrict CORS access.

## Deployment
1. Create a Lambda function with the **Node.js 20.x** runtime.
2. Set Memory to **128MB**.
3. Set Timeout to **10s**.
4. Zip the contents of this directory (`index.js` and `package.json`).
5. Upload the ZIP file to your Lambda function via the AWS Console or CLI.
6. Expose via an HTTP API (API Gateway).
