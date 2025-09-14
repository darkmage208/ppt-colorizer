# PPT Excel Colorizer - Environment Setup Guide

This guide explains how to set up both local development and production environments for the PPT Excel Colorizer application.

## Overview

The application now supports two distinct environments:

- **Local Development (Default)**: `docker compose up`
- **Production**: `docker compose -f docker-compose.prod.yml up`

## 🔧 Local Development Environment

The local development environment is now the **default** configuration and is designed for development work.

### Quick Start

```bash
# Clone repository
git clone <repository-url>
cd ppt-excel-colorizer

# Make scripts executable
chmod +x *.sh

# Start development environment (uses docker-compose.yml by default)
docker compose up -d
# OR use the convenience script
./dev-start.sh
```

### Available Services
- **Frontend**: http://localhost:3000 (React + Vite with hot reload)
- **Backend**: http://localhost:8000 (FastAPI with auto-reload)
- **API Docs**: http://localhost:8000/docs
- **pgAdmin**: http://localhost:5050 (Database management)
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

### Key Features
- ✅ Hot reload for both frontend and backend
- ✅ Local file storage (no cloud dependencies)
- ✅ Debug mode enabled
- ✅ Separate local database
- ✅ CORS configured for localhost
- ✅ Default admin user created

### Development Scripts
- `./dev-start.sh` - Start with health checks and setup
- `./dev-stop.sh` - Stop services
- `./dev-logs.sh` - View logs with filtering options

### Configuration Files
- `.env.local` - Local environment variables
- `docker-compose.yml` - **Default** Docker Compose configuration
- `frontend/.env.local` - Frontend environment variables

## 🚀 Production Environment

The production environment is configured for live deployment with security and performance optimizations.

### Quick Start

```bash
# Ensure production .env file exists with proper values
cp .env.example .env
# Edit .env with production values

# Deploy production environment
docker compose -f docker-compose.prod.yml up -d
# OR use the convenience script
./prod-deploy.sh
```

### Available Services
- **Frontend**: https://yourdomain.com
- **Backend**: https://yourdomain.com/api
- **API Docs**: https://yourdomain.com/docs
- **Note**: pgAdmin is not included in production (use direct database access)

### Key Features
- ✅ SSL/HTTPS enabled
- ✅ Cloudflare R2 storage
- ✅ Production database
- ✅ Nginx reverse proxy
- ✅ Security optimizations
- ✅ Resource limits

### Configuration Files
- `.env` - Production environment variables (keep secure!)
- `docker-compose.prod.yml` - Production Docker Compose configuration

## 📁 Project Structure

```
ppt-excel-colorizer/
├── docker-compose.yml              # 🔧 DEFAULT - Local development
├── docker-compose.prod.yml         # 🚀 Production environment
├── .env.local                      # 🔧 Local development variables
├── .env                           # 🚀 Production variables (secure!)
├── dev-start.sh                   # 🔧 Local development startup
├── dev-stop.sh                    # 🔧 Local development stop
├── dev-logs.sh                    # 🔧 View development logs
├── prod-deploy.sh                 # 🚀 Production deployment
├── backend/
│   ├── Dockerfile                 # 🚀 Production Dockerfile
│   ├── Dockerfile.local           # 🔧 Development Dockerfile
│   └── app/
│       ├── storage.py             # Auto-switching storage
│       └── storage_local.py       # Local file storage
├── frontend/
│   ├── Dockerfile                 # 🚀 Production Dockerfile
│   ├── Dockerfile.local           # 🔧 Development Dockerfile
│   └── .env.local                 # 🔧 Frontend dev variables
└── LOCAL_DEVELOPMENT.md           # 🔧 Detailed dev documentation
```

## 🔄 Switching Between Environments

### Start Local Development (Default)
```bash
# Method 1: Direct Docker Compose (recommended)
docker compose up -d

# Method 2: Using convenience script
./dev-start.sh

# Method 3: With custom environment file
docker compose --env-file .env.local up -d
```

### Start Production
```bash
# Method 1: Direct Docker Compose
docker compose -f docker-compose.prod.yml up -d

# Method 2: Using convenience script
./prod-deploy.sh

# Method 3: With build
docker compose -f docker-compose.prod.yml up --build -d
```

### Stop Services
```bash
# Stop local development
docker compose down
# OR
./dev-stop.sh

# Stop production
docker compose -f docker-compose.prod.yml down
```

## 🔐 Environment Variables

### Local Development (.env.local)
```env
# Database
POSTGRES_DB=ppt_colorizer_local
POSTGRES_USER=ppt_user
POSTGRES_PASSWORD=localdev123

# Security (development only)
SECRET_KEY=local-dev-secret-key

# Storage (local filesystem)
R2_ACCOUNT_ID=local-dev
R2_ACCESS_KEY_ID=local-dev
R2_SECRET_ACCESS_KEY=local-dev

# Debug
DEBUG=true
```

### Production (.env)
```env
# Database (use strong passwords!)
POSTGRES_DB=ppt_colorizer
POSTGRES_USER=ppt_user
POSTGRES_PASSWORD=YOUR_STRONG_PASSWORD

# Security (use strong secret!)
SECRET_KEY=YOUR_VERY_SECURE_SECRET_KEY_32_CHARS_MIN

# Cloudflare R2 Storage
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=your_bucket
R2_PUBLIC_URL=your_public_url

# Domain
DOMAIN=yourdomain.com

# Production settings
DEBUG=false
```

## 🛠️ Common Commands

### Development
```bash
# Start development environment
docker compose up -d

# View logs
docker compose logs -f

# Restart a service
docker compose restart backend

# Shell into backend
docker compose exec backend bash

# Run database migrations
docker compose exec backend alembic upgrade head
```

### Production
```bash
# Deploy production
docker compose -f docker-compose.prod.yml up -d

# View production logs
docker compose -f docker-compose.prod.yml logs -f

# Production shell access
docker compose -f docker-compose.prod.yml exec backend bash
```

## 🔍 Verification

### Local Development Health Check
```bash
# Check all services
docker compose ps

# Test frontend
curl http://localhost:3000

# Test backend
curl http://localhost:8000/health

# Test database
docker compose exec db pg_isready
```

### Production Health Check
```bash
# Check all services
docker compose -f docker-compose.prod.yml ps

# Test frontend (replace with your domain)
curl https://yourdomain.com

# Test backend
curl https://yourdomain.com/api/health
```

## 🚨 Important Notes

### Security
- **Never commit `.env` (production) to version control**
- `.env.local` is safe to commit (development only)
- Use strong passwords and secrets in production
- Regularly rotate secrets and passwords

### Data Storage
- **Local Development**: Files stored in `./local_storage/`
- **Production**: Files stored in Cloudflare R2
- Local and production data are completely separate

### Database
- **Local**: `ppt_colorizer_local` database
- **Production**: `ppt_colorizer` database
- Completely separate databases and data

### Ports
- **Local Development**: 3000 (frontend), 8000 (backend), 5432 (db), 6379 (redis)
- **Production**: 80/443 (nginx), internal networking for services

## 📚 Additional Documentation

- [`LOCAL_DEVELOPMENT.md`](./LOCAL_DEVELOPMENT.md) - Detailed local development guide
- [`DEPLOYMENT.md`](./DEPLOYMENT.md) - Production deployment guide
- [`CLOUDFLARE_R2_SETUP.md`](./CLOUDFLARE_R2_SETUP.md) - Storage configuration

## 🤝 Contributing

When developing:
1. Always work in the local development environment
2. Use `docker compose up -d` (default local setup)
3. Never test directly in production
4. Ensure changes work in both environments before deploying