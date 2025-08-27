#!/bin/bash
# Auto-renewal script for SSL certificates
# Add to crontab: 0 12 * * * /path/to/renew-ssl.sh

echo "🔄 Checking SSL certificate renewal..."

# Renew certificates
sudo certbot renew --quiet

# Copy renewed certificates if they exist
if [ -f /etc/letsencrypt/live/gabiosystems.com/fullchain.pem ]; then
    sudo cp /etc/letsencrypt/live/gabiosystems.com/fullchain.pem nginx/ssl/
    sudo cp /etc/letsencrypt/live/gabiosystems.com/privkey.pem nginx/ssl/
    sudo chown $USER:$USER nginx/ssl/*
    chmod 644 nginx/ssl/fullchain.pem
    chmod 600 nginx/ssl/privkey.pem
    
    # Restart nginx to load new certificates
    docker compose restart nginx
    echo "✅ SSL certificates renewed and nginx restarted"
else
    echo "ℹ️  No renewal needed"
fi