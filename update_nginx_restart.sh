#!/bin/bash

# Script to update nginx configuration and restart services
# This applies the nginx config changes for large file uploads

echo "🔄 Updating nginx configuration for large TXT file uploads..."

# Check if we're in the right directory
if [ ! -f "docker-compose.prod.yml" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Check if nginx container is running
if docker-compose -f docker-compose.prod.yml ps nginx | grep -q "Up"; then
    echo "📦 Restarting nginx container to apply new configuration..."

    # Test nginx configuration first
    echo "🧪 Testing nginx configuration..."
    if docker-compose -f docker-compose.prod.yml exec nginx nginx -t; then
        echo "✅ Nginx configuration is valid"

        # Reload nginx configuration
        echo "🔄 Reloading nginx configuration..."
        docker-compose -f docker-compose.prod.yml exec nginx nginx -s reload

        echo "✅ Nginx configuration updated successfully!"
        echo ""
        echo "📋 New upload limits:"
        echo "   • TXT files (jobs): 5GB max"
        echo "   • VCF files: 10GB max"
        echo "   • General API: 100MB max"
        echo ""
        echo "🎉 Large TXT file uploads should now work!"

    else
        echo "❌ Nginx configuration test failed"
        echo "Please check the nginx.conf file for syntax errors"
        exit 1
    fi
else
    echo "❌ Nginx container is not running"
    echo "Please start the services first with: docker-compose -f docker-compose.prod.yml up -d"
    exit 1
fi