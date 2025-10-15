#!/bin/bash

# Script to initialize LocalStack S3 bucket for local development

echo "🚀 Initializing LocalStack S3..."

# Wait for LocalStack to be ready (with timeout)
echo "⏳ Waiting for LocalStack to start..."
TIMEOUT=30
COUNTER=0
until curl -s http://localhost:4566/_localstack/health | grep -q '"s3": "available"'; do
  if [ $COUNTER -ge $TIMEOUT ]; then
    echo ""
    echo "❌ LocalStack didn't start within ${TIMEOUT} seconds"
    echo ""
    echo "This might mean:"
    echo "  1. LocalStack container isn't running"
    echo "  2. LocalStack is taking longer than usual to start"
    echo ""
    echo "Try these fixes:"
    echo "  1. Restart LocalStack: docker-compose restart localstack"
    echo "  2. Or restart all services: docker-compose down && docker-compose up -d"
    echo "  3. Check logs: docker logs carecompanion-localstack"
    echo ""
    echo "You can continue without LocalStack for now (uploads won't work)"
    exit 1
  fi
  echo "   Waiting for S3 service... (${COUNTER}s)"
  sleep 2
  COUNTER=$((COUNTER + 2))
done

echo "✅ LocalStack is ready!"

# Install AWS CLI if not present (needed for bucket creation)
if ! command -v aws &> /dev/null; then
    echo "⚠️  AWS CLI not found. Installing..."
    # On macOS: brew install awscli
    # On Linux: apt-get install awscli or yum install awscli
    echo "Please install AWS CLI: https://aws.amazon.com/cli/"
    exit 1
fi

# Configure AWS CLI for LocalStack (temporary, just for this script)
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1

BUCKET_NAME="carecompanion-documents"
ENDPOINT_URL="http://localhost:4566"

# Check if bucket exists
if aws s3 ls s3://$BUCKET_NAME --endpoint-url=$ENDPOINT_URL 2>/dev/null; then
    echo "✅ Bucket '$BUCKET_NAME' already exists"
else
    echo "📦 Creating bucket '$BUCKET_NAME'..."
    aws s3 mb s3://$BUCKET_NAME --endpoint-url=$ENDPOINT_URL

    # Configure bucket for public read (optional, for development)
    aws s3api put-bucket-cors \
        --bucket $BUCKET_NAME \
        --cors-configuration '{
            "CORSRules": [{
                "AllowedOrigins": ["*"],
                "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
                "AllowedHeaders": ["*"],
                "MaxAgeSeconds": 3000
            }]
        }' \
        --endpoint-url=$ENDPOINT_URL

    echo "✅ Bucket created and configured!"
fi

echo ""
echo "🎉 LocalStack S3 is ready for development!"
echo "   Bucket: s3://$BUCKET_NAME"
echo "   Endpoint: $ENDPOINT_URL"
echo ""
echo "Test with: aws s3 ls s3://$BUCKET_NAME --endpoint-url=$ENDPOINT_URL"
