#!/bin/bash

echo "🚀 Setting up PPT Excel Colorizer..."

# Create .env file from template
if [ ! -f backend/.env ]; then
    echo "📝 Creating environment file..."
    cp backend/.env.example backend/.env
    echo "✅ Created backend/.env - please update with your settings"
else
    echo "✅ Environment file already exists"
fi

# Build and start services
echo "🐳 Building and starting Docker containers..."
docker-compose up --build -d

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 10

# Run database migrations
echo "🔄 Running database migrations..."
docker-compose exec backend alembic upgrade head

# Create admin user
echo "👤 Creating admin user..."
docker-compose exec backend python create_admin.py

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Access your application:"
echo "  Frontend: http://localhost:3000"
echo "  Backend API: http://localhost:8000"
echo "  API Docs: http://localhost:8000/docs"
echo ""
echo "Default admin credentials:"
echo "  Username: admin"
echo "  Password: admin123"
echo ""
echo "⚠️  Remember to:"
echo "  1. Update backend/.env with your Cloudflare R2 credentials"
echo "  2. Change the default admin password"
echo "  3. Update SECRET_KEY for production"