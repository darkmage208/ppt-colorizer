# Local Development Environment Setup

This document explains how to set up and run the PPT Excel Colorizer application locally for development purposes.

## Prerequisites

- Docker and Docker Compose installed
- Git (for version control)
- A text editor or IDE

## Quick Start

1. **Clone and navigate to the repository** (if not already done):
   ```bash
   cd /path/to/ppt-excel-colorizer
   ```

2. **Make scripts executable**:
   ```bash
   chmod +x dev-start.sh dev-stop.sh dev-logs.sh
   ```

3. **Start the local development environment**:
   ```bash
   ./dev-start.sh
   # OR use Docker Compose directly:
   docker compose up -d
   ```

4. **Access the application**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

## Development Scripts

### `./dev-start.sh`
Starts the entire local development environment.

**Options:**
- `--clean` - Remove old volumes before starting (fresh database)

**Usage:**
```bash
./dev-start.sh           # Normal start
./dev-start.sh --clean   # Clean start (removes all data)
```

### `./dev-stop.sh`
Stops the local development environment.

**Options:**
- `--clean` - Remove volumes and clean up Docker resources

**Usage:**
```bash
./dev-stop.sh           # Normal stop
./dev-stop.sh --clean   # Stop and cleanup
```

### `./dev-logs.sh`
View logs from the running services.

**Options:**
- `--service SERVICE` - Show logs for specific service
- `--no-follow` - Show existing logs without following

**Usage:**
```bash
./dev-logs.sh                        # Show all logs
./dev-logs.sh --service backend      # Show backend logs only
./dev-logs.sh --no-follow            # Show logs without following
```

## Architecture Overview

The local development environment consists of:

- **Frontend** (React + Vite): Port 3000
- **Backend** (FastAPI): Port 8000
- **PostgreSQL Database**: Port 5432
- **Redis**: Port 6379
- **Celery Worker**: Background task processing

## Configuration Files

### Environment Files
- `.env.local` - Main environment variables for local development
- `frontend/.env.local` - Frontend-specific environment variables

### Docker Configuration
- `docker-compose.yml` - Default local development Docker Compose configuration
- `docker-compose.prod.yml` - Production Docker Compose configuration
- `backend/Dockerfile.local` - Backend development Dockerfile
- `frontend/Dockerfile.local` - Frontend development Dockerfile

## Key Differences from Production

1. **Storage**: Uses local filesystem instead of Cloudflare R2
2. **Database**: Local PostgreSQL instead of managed database
3. **Debug Mode**: Enabled for better development experience
4. **Hot Reload**: Both frontend and backend support hot reloading
5. **CORS**: Configured to allow localhost origins

## Local Storage

Files are stored in the `./local_storage` directory instead of cloud storage. This directory structure mirrors the production storage:

```
local_storage/
├── templates/          # PowerPoint templates
├── excel_uploads/      # Uploaded Excel files
├── txt_uploads/        # Uploaded text files
└── processed_presentations/  # Generated presentations
```

## Database Management

### Access Database
```bash
docker compose exec db psql -U ppt_user -d ppt_colorizer_local
```

### Run Migrations
```bash
docker compose exec backend alembic upgrade head
```

### Create New Migration
```bash
docker compose exec backend alembic revision --autogenerate -m "description"
```

## Useful Commands

### Service Management
```bash
# Start all services
docker compose up -d

# Stop all services
docker compose down

# Restart specific service
docker compose restart backend

# Rebuild and restart service
docker compose up --build -d backend

# Execute command in service
docker compose exec backend python -c "print('Hello')"
```

### Development Tools
```bash
# Install new Python package
docker compose exec backend pip install package_name

# Install new Node package
docker compose exec frontend npm install package_name

# Shell access
docker compose exec backend bash
docker compose exec frontend sh
```

## Default Admin User

The development environment creates a default admin user:
- **Email**: admin@example.com
- **Password**: admin123

⚠️ **This is only for local development. Never use these credentials in production.**

## Troubleshooting

### Services Won't Start
1. Check if Docker is running: `docker info`
2. Check if ports are already in use: `lsof -i :3000,8000,5432,6379`
3. Clean start: `./dev-start.sh --clean`

### Database Connection Issues
1. Wait for database to be ready (check logs)
2. Ensure migrations are run
3. Check database health: `docker compose exec db pg_isready`

### File Upload/Download Issues
1. Check `local_storage` directory permissions
2. Ensure the directory exists and is writable
3. Check backend logs for storage errors

### Performance Issues
1. Increase Docker resource limits
2. Check available disk space
3. Clean up unused Docker resources: `docker system prune`

## Development Workflow

1. **Start environment**: `./dev-start.sh`
2. **Make code changes** (hot reload is enabled)
3. **View logs**: `./dev-logs.sh`
4. **Test changes** at http://localhost:3000
5. **Stop environment**: `./dev-stop.sh`

## Production vs Development

| Feature | Development | Production |
|---------|------------|------------|
| Storage | Local filesystem | Cloudflare R2 |
| Database | Local PostgreSQL | Managed PostgreSQL |
| CORS | Localhost allowed | Specific domains |
| Debug | Enabled | Disabled |
| SSL | Not required | Required |
| Hot Reload | Enabled | Disabled |

## Environment Variables Reference

### Backend (.env.local)
- `POSTGRES_DB` - Database name
- `POSTGRES_USER` - Database user
- `POSTGRES_PASSWORD` - Database password
- `SECRET_KEY` - JWT secret key
- `DEBUG` - Enable debug mode
- `R2_*` - Storage configuration (local-dev for development)

### Frontend (frontend/.env.local)
- `VITE_API_URL` - Backend API URL
- `VITE_APP_NAME` - Application name
- `VITE_DEBUG` - Frontend debug mode