#!/bin/bash

echo "🚀 DEPLOYING MEMORY-OPTIMIZED VERSION"
echo "====================================="

echo "📋 New Optimizations Applied:"
echo "   • Chunked TXT processing (5k lines at a time)"
echo "   • Direct cache building (no full DataFrame)"
echo "   • Forced garbage collection"
echo "   • Single worker with 4GB memory"
echo "   • Frequent worker restarts (every 5 tasks)"
echo ""

# Stop current services
echo "🛑 Stopping current services..."
docker compose -f docker-compose.prod.yml stop celery backend

# Clean build
echo "🧹 Clean rebuild..."
docker compose -f docker-compose.prod.yml build backend --no-cache

# Start services
echo "🚀 Starting optimized services..."
docker compose -f docker-compose.prod.yml up -d backend celery

# Wait for startup
echo "⏳ Waiting for services to start..."
sleep 15

# Check status
echo "📊 Service Status:"
docker compose -f docker-compose.prod.yml ps | grep -E "(celery|backend)"

echo ""
echo "🔍 Memory Configuration:"
docker compose -f docker-compose.prod.yml exec celery grep -i memory /proc/meminfo | head -3 || echo "Container not ready"

echo ""
echo "✅ DEPLOYMENT COMPLETE"
echo ""
echo "🎯 This version should handle your 200MB TXT files without SIGKILL"
echo ""
echo "📝 Monitor processing with:"
echo "   docker compose -f docker-compose.prod.yml logs celery -f"
echo ""
echo "🔍 Run diagnostics with:"
echo "   ./diagnose_memory.sh"