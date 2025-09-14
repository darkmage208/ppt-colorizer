#!/bin/bash

# Local Development Startup Script for PPT Excel Colorizer

echo "🚀 Starting PPT Excel Colorizer Local Development Environment..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null 2>&1; then
    echo "❌ docker-compose is not available. Please install Docker Compose."
    exit 1
fi

# Use docker compose (newer) if available, otherwise fallback to docker-compose
if docker compose version &> /dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
else
    COMPOSE_CMD="docker-compose"
fi

# Copy local environment file if it doesn't exist
if [ ! -f .env.local ]; then
    echo "❌ .env.local file not found. Please ensure .env.local exists."
    exit 1
fi

# Stop any existing containers
echo "🛑 Stopping any existing containers..."
$COMPOSE_CMD --env-file .env.local down

# Remove old volumes if requested
if [[ "$1" == "--clean" ]]; then
    echo "🧹 Cleaning up old volumes..."
    $COMPOSE_CMD --env-file .env.local down -v
    docker volume prune -f
fi

# Build and start services
echo "🏗️  Building and starting services..."
$COMPOSE_CMD --env-file .env.local up --build -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check service health
echo "🏥 Checking service health..."

# Check database
if $COMPOSE_CMD --env-file .env.local exec db pg_isready -U ppt_user -d ppt_colorizer_local > /dev/null 2>&1; then
    echo "✅ Database is ready"
else
    echo "❌ Database is not ready"
fi

# Check Redis
if $COMPOSE_CMD --env-file .env.local exec redis redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis is ready"
else
    echo "❌ Redis is not ready"
fi

# Run database migrations
echo "🗃️  Running database migrations..."
$COMPOSE_CMD --env-file .env.local exec backend alembic upgrade head

# Create admin user if it doesn't exist
echo "👤 Creating admin user if needed..."
$COMPOSE_CMD --env-file .env.local exec backend python create_admin.py || echo "ℹ️  Admin user may already exist"

echo ""
echo "🎉 Local development environment is ready!"
echo ""
echo "📋 Available Services:"
echo "   🌐 Frontend: http://localhost:3000"
echo "   🔧 Backend API: http://localhost:8000"
echo "   📚 API Docs: http://localhost:8000/docs"
echo "   🗄️  pgAdmin: http://localhost:5050"
echo "   🐘 PostgreSQL: localhost:5432"
echo "   📦 Redis: localhost:6379"
echo ""
echo "🔧 Useful Commands:"
echo "   View logs: $COMPOSE_CMD logs -f"
echo "   Stop services: $COMPOSE_CMD down"
echo "   Restart services: $COMPOSE_CMD restart"
echo "   Shell into backend: $COMPOSE_CMD exec backend bash"
echo "   Shell into database: $COMPOSE_CMD exec db psql -U ppt_user -d ppt_colorizer_local"
echo ""
echo "🗂️  Local file storage directory: ./local_storage"
echo ""

# Show running containers
echo "📦 Running containers:"
$COMPOSE_CMD --env-file .env.local ps