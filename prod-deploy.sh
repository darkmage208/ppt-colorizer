#!/bin/bash

# Production Deployment Script for PPT Excel Colorizer

echo "🚀 Deploying PPT Excel Colorizer Production Environment..."

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

# Check for production environment file
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please ensure production .env file exists."
    exit 1
fi

# Validate required production environment variables
echo "🔍 Validating production environment variables..."
if ! grep -q "^POSTGRES_PASSWORD=" .env || ! grep -q "^SECRET_KEY=" .env; then
    echo "❌ Missing required production environment variables (POSTGRES_PASSWORD, SECRET_KEY)"
    exit 1
fi

# Stop any existing containers
echo "🛑 Stopping any existing containers..."
$COMPOSE_CMD -f docker-compose.prod.yml down

# Pull latest images if not building locally
if [[ "$1" == "--pull" ]]; then
    echo "📥 Pulling latest images..."
    $COMPOSE_CMD -f docker-compose.prod.yml pull
fi

# Remove old volumes if requested
if [[ "$1" == "--clean" ]]; then
    echo "🧹 Cleaning up old volumes..."
    $COMPOSE_CMD -f docker-compose.prod.yml down -v
    docker volume prune -f
fi

# Build and start services
echo "🏗️  Building and starting production services..."
if [[ "$1" == "--build" ]] || [[ "$2" == "--build" ]]; then
    $COMPOSE_CMD -f docker-compose.prod.yml up --build -d
else
    $COMPOSE_CMD -f docker-compose.prod.yml up -d
fi

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 20

# Check service health
echo "🏥 Checking service health..."

# Check database
if $COMPOSE_CMD -f docker-compose.prod.yml exec db pg_isready -U ppt_user -d ppt_colorizer > /dev/null 2>&1; then
    echo "✅ Database is ready"
else
    echo "❌ Database is not ready"
fi

# Check Redis
if $COMPOSE_CMD -f docker-compose.prod.yml exec redis redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis is ready"
else
    echo "❌ Redis is not ready"
fi

# Run database migrations
echo "🗃️  Running database migrations..."
$COMPOSE_CMD -f docker-compose.prod.yml exec backend alembic upgrade head

# Create admin user if it doesn't exist (only if explicitly requested)
if [[ "$1" == "--create-admin" ]] || [[ "$2" == "--create-admin" ]] || [[ "$3" == "--create-admin" ]]; then
    echo "👤 Creating admin user if needed..."
    $COMPOSE_CMD -f docker-compose.prod.yml exec backend python create_admin.py || echo "ℹ️  Admin user may already exist"
fi

echo ""
echo "🎉 Production environment is ready!"
echo ""
echo "📋 Available Services:"
echo "   🌐 Frontend: https://$(grep DOMAIN .env | cut -d '=' -f2)"
echo "   🔧 Backend API: https://$(grep DOMAIN .env | cut -d '=' -f2)/api"
echo "   📚 API Docs: https://$(grep DOMAIN .env | cut -d '=' -f2)/docs"
echo ""
echo "🔧 Useful Commands:"
echo "   View logs: $COMPOSE_CMD -f docker-compose.prod.yml logs -f"
echo "   Stop services: $COMPOSE_CMD -f docker-compose.prod.yml down"
echo "   Restart services: $COMPOSE_CMD -f docker-compose.prod.yml restart"
echo "   Shell into backend: $COMPOSE_CMD -f docker-compose.prod.yml exec backend bash"
echo ""

# Show running containers
echo "📦 Running containers:"
$COMPOSE_CMD -f docker-compose.prod.yml ps

echo ""
echo "⚠️  Production Notes:"
echo "   - Ensure SSL certificates are properly configured"
echo "   - Monitor logs regularly for any issues"
echo "   - Keep .env file secure and never commit to version control"
echo "   - Regular backups of database and uploaded files are recommended"