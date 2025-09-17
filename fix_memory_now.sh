#!/bin/bash

echo "🚨 EMERGENCY MEMORY FIX - Restarting Celery with 4GB single-worker config"
echo "=================================================================="

# Stop the problematic celery worker immediately
echo "🛑 Stopping current Celery worker..."
docker compose -f docker-compose.prod.yml stop celery

# Build with new configuration
echo "🔨 Building backend with memory optimizations..."
docker compose -f docker-compose.prod.yml build backend --no-cache

# Start celery with new config
echo "🚀 Starting Celery with 4GB memory, 1 worker..."
docker compose -f docker-compose.prod.yml up -d celery

# Wait for startup
sleep 10

# Check status
echo "📊 Checking Celery status..."
docker compose -f docker-compose.prod.yml ps celery

echo ""
echo "✅ NEW CONFIGURATION APPLIED:"
echo "   • Memory Limit: 4GB (was 2.5GB)"
echo "   • Workers: 1 (was 4)"
echo "   • Tasks per worker: 5 (was 50)"
echo "   • Added memory cleanup"
echo ""
echo "🎯 This should handle your 200MB TXT files without SIGKILL"
echo ""
echo "Monitor with: docker-compose -f docker-compose.prod.yml logs celery -f"