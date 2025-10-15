# LocalStack S3 Setup Guide

This guide will help you set up LocalStack for local S3 testing without needing an AWS account.

## Prerequisites

1. **Docker** - [Install Docker Desktop](https://www.docker.com/products/docker-desktop/)
2. **AWS CLI** - [Install AWS CLI](https://aws.amazon.com/cli/)

### Install AWS CLI (Quick)

**macOS:**
```bash
brew install awscli
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get update && sudo apt-get install -y awscli
```

**Windows:**
```powershell
choco install awscli
```

Or download from: https://aws.amazon.com/cli/

## Setup Steps

### 1. Start Services

Start all services including LocalStack:

```bash
docker-compose up -d
```

This will start:
- PostgreSQL (port 5432)
- Redis (port 6379)
- LocalStack S3 (port 4566)

### 2. Initialize S3 Bucket

Run the initialization script:

```bash
./scripts/init-localstack.sh
```

This script will:
- Wait for LocalStack to be ready
- Create the `carecompanion-documents` bucket
- Configure CORS for browser uploads

### 3. Verify Setup

Check that LocalStack is running:

```bash
curl http://localhost:4566/_localstack/health
```

Check that the bucket exists:

```bash
aws s3 ls --endpoint-url=http://localhost:4566
```

You should see: `carecompanion-documents`

### 4. Start Your Application

```bash
# Start API
cd apps/api
npm run dev

# In another terminal, start frontend
cd apps/web
npm run dev
```

## Testing Document Upload

1. Open http://localhost:5173
2. Log in to your account
3. Click "Upload Document" on the Dashboard
4. Upload a test file (PDF or image)
5. The file will be stored in LocalStack!

## Viewing Uploaded Files

List all files in the bucket:

```bash
aws s3 ls s3://carecompanion-documents --endpoint-url=http://localhost:4566 --recursive
```

Download a file:

```bash
aws s3 cp s3://carecompanion-documents/FAMILY_ID/FILE_NAME /tmp/test.pdf --endpoint-url=http://localhost:4566
```

## Troubleshooting

### LocalStack not starting?

Check Docker logs:
```bash
docker logs carecompanion-localstack
```

### Bucket creation fails?

Manually create the bucket:
```bash
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
aws s3 mb s3://carecompanion-documents --endpoint-url=http://localhost:4566
```

### Upload fails with CORS error?

Set CORS policy:
```bash
aws s3api put-bucket-cors \
    --bucket carecompanion-documents \
    --cors-configuration '{
        "CORSRules": [{
            "AllowedOrigins": ["*"],
            "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
            "AllowedHeaders": ["*"],
            "MaxAgeSeconds": 3000
        }]
    }' \
    --endpoint-url=http://localhost:4566
```

### Can't connect to LocalStack from API?

Make sure `AWS_ENDPOINT_URL` is set in your `.env`:
```env
AWS_ENDPOINT_URL="http://localhost:4566"
```

## Switching to Real AWS S3 (Later)

When ready for production:

1. Create an AWS account
2. Create an S3 bucket
3. Create IAM user with S3 permissions
4. Update `.env`:
   ```env
   AWS_ACCESS_KEY_ID="your-real-key"
   AWS_SECRET_ACCESS_KEY="your-real-secret"
   AWS_REGION="us-east-1"
   S3_BUCKET_NAME="your-bucket-name"
   # Comment out or remove:
   # AWS_ENDPOINT_URL="http://localhost:4566"
   ```

## Useful Commands

**Stop all services:**
```bash
docker-compose down
```

**Stop and remove all data:**
```bash
docker-compose down -v
```

**Restart LocalStack only:**
```bash
docker-compose restart localstack
```

**View LocalStack logs:**
```bash
docker-compose logs -f localstack
```

## LocalStack Web UI (Optional)

LocalStack Pro has a web UI, but the free version works perfectly for our needs.

If you want the UI:
1. Sign up at https://localstack.cloud
2. Get your auth token
3. Add to docker-compose.yml:
   ```yaml
   environment:
     - LOCALSTACK_AUTH_TOKEN=your-token
   ```

## Resources

- [LocalStack Docs](https://docs.localstack.cloud/)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/)
- [AWS CLI Reference](https://awscli.amazonaws.com/v2/documentation/api/latest/reference/s3/index.html)
