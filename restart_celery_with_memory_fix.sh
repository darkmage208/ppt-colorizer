#!/bin/bash

# Script to restart Celery workers with improved memory configuration
# This fixes the SIGKILL issues when processing large TXT files

echo "🔄 Restarting Celery workers with improved memory configuration..."

# Check if we're in the right directory
if [ ! -f "docker-compose.prod.yml" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

echo "📋 New Celery Configuration:"
echo "   • Memory limit: 4GB (up from 2.5GB)"
echo "   • Concurrency: 2 workers (down from 4)"
echo "   • Tasks per worker: 10 (down from 50)"
echo "   • Added memory cleanup"
echo ""

# Stop current celery worker
echo "🛑 Stopping current Celery worker..."
docker-compose -f docker-compose.prod.yml stop celery

# Rebuild and start with new configuration
echo "🔨 Rebuilding backend with new configuration..."
docker-compose -f docker-compose.prod.yml build backend

echo "🚀 Starting Celery worker with new memory settings..."
docker-compose -f docker-compose.prod.yml up -d celery

# Wait a moment for startup
sleep 5

# Check if celery is running
if docker-compose -f docker-compose.prod.yml ps celery | grep -q "Up"; then
    echo "✅ Celery worker restarted successfully!"
    echo ""
    echo "📊 Worker Status:"
    docker-compose -f docker-compose.prod.yml exec celery celery -A app.tasks.celery_app status
    echo ""
    echo "🎉 Large TXT file processing should now work without memory issues!"
    echo ""
    echo "📝 To monitor:"
    echo "   docker-compose -f docker-compose.prod.yml logs celery -f"
else
    echo "❌ Celery worker failed to start"
    echo "Check logs with: docker-compose -f docker-compose.prod.yml logs celery"
    exit 1
fi