#!/bin/bash

# Script to create admin user on VPS deployment
# Usage: ./create_admin.sh [email] [password]

EMAIL=${1:-admin@example.com}
PASSWORD=${2:-admin123}

echo "Creating admin user..."
echo "Email: $EMAIL"

# Method 1: Using docker exec (if using Docker)
if command -v docker &> /dev/null; then
    echo "Using Docker to create admin..."
    docker exec -it ppt-excel-colorizer-backend-1 python create_admin.py --email "$EMAIL" --password "$PASSWORD"
    
# Method 2: Using docker-compose exec
elif command -v docker-compose &> /dev/null; then
    echo "Using Docker Compose to create admin..."
    docker-compose exec backend python create_admin.py --email "$EMAIL" --password "$PASSWORD"
    
# Method 3: Direct Python execution (if running without Docker)
else
    echo "Running directly with Python..."
    cd backend
    python create_admin.py --email "$EMAIL" --password "$PASSWORD"
fi

echo "Admin creation complete!"