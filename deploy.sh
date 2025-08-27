#!/bin/bash
set -e

echo "🚀 Starting production deployment..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "Please copy .env.production to .env and fill in your values:"
    echo "cp .env.production .env"
    echo "nano .env"
    exit 1
fi

# Create SSL directory if it doesn't exist
mkdir -p nginx/ssl

# Check if SSL certificates exist
if [ ! -f nginx/ssl/fullchain.pem ] || [ ! -f nginx/ssl/privkey.pem ]; then
    echo "⚠️  SSL certificates not found in nginx/ssl/"
    echo "You'll need to set up SSL certificates. Options:"
    echo "1. Use Let's Encrypt (recommended)"
    echo "2. Use self-signed certificates for testing"
    echo ""
    read -p "Create self-signed certificates for testing? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Creating self-signed certificates..."
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout nginx/ssl/privkey.pem \
            -out nginx/ssl/fullchain.pem \
            -subj "/C=US/ST=State/L=City/O=Organization/CN=gabiosystems.com"
        echo "✅ Self-signed certificates created"
    else
        echo "Please add your SSL certificates to nginx/ssl/ before running:"
        echo "- nginx/ssl/fullchain.pem"
        echo "- nginx/ssl/privkey.pem"
        exit 1
    fi
fi

echo "🔧 Building and starting containers..."
docker compose down
docker compose up --build -d

echo "⏳ Waiting for services to be ready..."
sleep 10

echo "🔍 Checking service status..."
docker compose ps

echo "✅ Deployment complete!"
echo ""
echo "Your application should be available at:"
echo "- https://gabiosystems.com (production)"
echo "- http://gabiosystems.com (redirects to HTTPS)"
echo ""
echo "To check logs:"
echo "docker compose logs -f [service_name]"
echo ""
echo "To stop:"
echo "docker compose down"