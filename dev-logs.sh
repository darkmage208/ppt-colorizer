#!/bin/bash

# Local Development Logs Script for PPT Excel Colorizer

# Use docker compose (newer) if available, otherwise fallback to docker-compose
if docker compose version &> /dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
else
    COMPOSE_CMD="docker-compose"
fi

# Default to following all logs
SERVICE=""
FOLLOW_FLAG="-f"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --service)
            SERVICE="$2"
            shift 2
            ;;
        --no-follow)
            FOLLOW_FLAG=""
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  --service SERVICE    Show logs for specific service (backend, frontend, db, redis, celery)"
            echo "  --no-follow          Don't follow logs (show existing and exit)"
            echo "  -h, --help          Show this help"
            echo ""
            echo "Examples:"
            echo "  $0                          # Show all logs and follow"
            echo "  $0 --service backend        # Show only backend logs and follow"
            echo "  $0 --no-follow              # Show all logs without following"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

echo "📋 Showing logs for PPT Excel Colorizer Local Development..."

if [ -n "$SERVICE" ]; then
    echo "🔍 Filtering logs for service: $SERVICE"
    $COMPOSE_CMD --env-file .env.local logs $FOLLOW_FLAG $SERVICE
else
    echo "🔍 Showing all service logs"
    $COMPOSE_CMD --env-file .env.local logs $FOLLOW_FLAG
fi