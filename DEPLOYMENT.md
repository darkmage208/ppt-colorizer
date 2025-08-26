# Deployment Guide for GABO - Genetics Analysis and Biosystems Optimization

## VPS Deployment Instructions

### Prerequisites
- Ubuntu 20.04+ or similar Linux distribution
- Docker and Docker Compose installed
- Domain name (optional, for production)
- SSL certificate (optional, for HTTPS)

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/gabo.git
cd gabo
```

### 2. Configure Environment Variables

```bash
cp .env.example .env
nano .env
```

Update the following variables:
- `DATABASE_URL` - PostgreSQL connection string
- `SECRET_KEY` - Generate a secure random key
- `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` - For Cloudflare R2 storage
- `R2_BUCKET_NAME` - Your R2 bucket name
- `R2_PUBLIC_URL` - Your R2 public URL
- `CLOUDCONVERT_API_KEY` - For PDF conversion (optional)

### 3. Build and Start Services

```bash
# Build all services
docker compose build

# Start services in detached mode
docker compose up -d

# Check services status
docker compose ps
```

### 4. Create Admin User

There are **5 different methods** to create an admin user:

#### Method 1: Using the Shell Script (Easiest)
```bash
# Default admin (admin@example.com / admin123)
./scripts/create_admin.sh

# Custom credentials
./scripts/create_admin.sh your@email.com yourpassword
```

#### Method 2: Using Docker Exec
```bash
# With default credentials
docker exec -it ppt-excel-colorizer-backend-1 python create_admin.py

# With custom credentials
docker exec -it ppt-excel-colorizer-backend-1 python create_admin.py \
  --email admin@yourdomain.com \
  --password SecurePassword123
```

#### Method 3: Using Docker Compose
```bash
# With default credentials
docker compose exec backend python create_admin.py

# With custom credentials
docker compose exec backend python create_admin.py \
  --email admin@yourdomain.com \
  --password SecurePassword123
```

#### Method 4: Using Environment Variables
```bash
# Set environment variables
export ADMIN_EMAIL=admin@yourdomain.com
export ADMIN_PASSWORD=SecurePassword123
export ADMIN_USERNAME=admin  # Optional

# Run the script
docker compose exec backend python create_admin.py
```

#### Method 5: One-liner Docker Command
```bash
docker compose run --rm backend python create_admin.py \
  --email admin@yourdomain.com \
  --password SecurePassword123
```

### 5. Setup Nginx (Optional - for Production)

Create Nginx configuration:

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name yourdomain.com;
    
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # Backend API
    location /api/ {
        rewrite ^/api/(.*) /$1 break;
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 6. Database Migrations

Run database migrations:

```bash
docker compose exec backend alembic upgrade head
```

### 7. Service Management

```bash
# View logs
docker compose logs -f backend
docker compose logs -f frontend

# Restart services
docker compose restart

# Stop services
docker compose down

# Start services
docker compose up -d

# Update and redeploy
git pull
docker compose build
docker compose up -d
```

### 8. Backup & Restore

#### Backup Database
```bash
# Backup PostgreSQL database
docker compose exec db pg_dump -U postgres ppt_colorizer > backup_$(date +%Y%m%d).sql
```

#### Restore Database
```bash
# Restore from backup
docker compose exec -T db psql -U postgres ppt_colorizer < backup_20240101.sql
```

### 9. Security Recommendations

1. **Change default passwords immediately**
2. **Use strong SECRET_KEY** - Generate with: `openssl rand -hex 32`
3. **Enable HTTPS** with Let's Encrypt
4. **Configure firewall** - Only expose necessary ports
5. **Regular updates** - Keep Docker images and system packages updated
6. **Monitor logs** - Set up log rotation and monitoring

### 10. Troubleshooting

#### Check Service Health
```bash
# Check all services
docker compose ps

# Check backend health
curl http://localhost:8000/health

# Check database connection
docker compose exec backend python -c "from app.database import engine; print(engine.connect())"
```

#### Common Issues

1. **Port already in use**
   ```bash
   # Find process using port
   sudo lsof -i :8000
   # Kill process if needed
   sudo kill -9 <PID>
   ```

2. **Database connection issues**
   ```bash
   # Check database logs
   docker compose logs db
   # Restart database
   docker compose restart db
   ```

3. **Permission issues**
   ```bash
   # Fix file permissions
   sudo chown -R $USER:$USER .
   ```

### 11. Production Checklist

- [ ] Strong admin password set
- [ ] Environment variables configured
- [ ] SSL certificate installed
- [ ] Firewall configured
- [ ] Backup strategy in place
- [ ] Monitoring setup
- [ ] Log rotation configured
- [ ] Resource limits set in docker-compose.yml
- [ ] Health checks configured
- [ ] Auto-restart policy enabled

## Quick Start Commands

```bash
# Complete deployment in one go
git clone <repository>
cd ppt-excel-colorizer
cp .env.example .env
# Edit .env with your settings
docker compose up -d
./scripts/create_admin.sh admin@yourdomain.com YourSecurePassword
```

## Support

For issues or questions, please open an issue on GitHub or contact the development team.