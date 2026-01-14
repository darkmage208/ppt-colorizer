#!/bin/bash
set -e

# Check if domain is provided
DOMAIN=${1:-gabiosystems.com}

echo "🔐 Getting SSL certificates for $DOMAIN..."

# Install certbot if not installed
if ! command -v certbot &> /dev/null; then
    echo "Installing certbot..."
    sudo apt update
    sudo apt install -y certbot
fi

# Stop nginx to free port 80
echo "Stopping nginx container..."
docker compose stop nginx 2>/dev/null || true

# Get certificates
echo "Requesting certificates from Let's Encrypt..."
sudo certbot certonly --standalone \
    -d $DOMAIN \
    -d www.$DOMAIN \
    --non-interactive \
    --agree-tos \
    --email harukaleonhart@gmail.com \
    --no-eff-email

# Create SSL directory
mkdir -p nginx/ssl

# Copy certificates
echo "Copying certificates..."
sudo cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/$DOMAIN/privkey.pem nginx/ssl/

# Fix permissions
sudo chown $USER:$USER nginx/ssl/*
chmod 644 nginx/ssl/fullchain.pem
chmod 600 nginx/ssl/privkey.pem

echo "✅ SSL certificates installed successfully!"
echo ""
echo "🔄 Setting up automatic certificate renewal..."

# Enable and start certbot systemd timer for auto-renewal
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

echo "✅ Automatic renewal configured!"
echo "📋 Certificate will auto-renew every 12 hours"
echo ""
echo "To check renewal status: sudo systemctl status certbot.timer"
echo "To test renewal: sudo certbot renew --dry-run"
echo ""
echo "Now run: docker compose up -d"