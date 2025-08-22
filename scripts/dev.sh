#!/bin/bash

echo "🛠️  Starting development environment..."

# Check if .env exists
if [ ! -f backend/.env ]; then
    echo "❌ backend/.env not found. Please run setup.sh first"
    exit 1
fi

# Start development services
echo "🐳 Starting Docker containers in development mode..."
docker-compose up --build

echo ""
echo "Development environment is running:"
echo "  Frontend: http://localhost:3000"
echo "  Backend: http://localhost:8000"
echo "  API Docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop all services"