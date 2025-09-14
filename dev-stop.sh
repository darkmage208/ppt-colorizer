#!/bin/bash

# Local Development Stop Script for PPT Excel Colorizer

echo "🛑 Stopping PPT Excel Colorizer Local Development Environment..."

# Use docker compose (newer) if available, otherwise fallback to docker-compose
if docker compose version &> /dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
else
    COMPOSE_CMD="docker-compose"
fi

# Stop all services
$COMPOSE_CMD --env-file .env.local down

# Clean up if requested
if [[ "$1" == "--clean" ]]; then
    echo "🧹 Cleaning up volumes and networks..."
    $COMPOSE_CMD --env-file .env.local down -v --remove-orphans
    docker system prune -f
fi

echo "✅ Local development environment stopped."