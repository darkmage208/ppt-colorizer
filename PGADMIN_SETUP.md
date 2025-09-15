# pgAdmin Setup Guide

This guide explains how to use pgAdmin to manage your PostgreSQL database in the local development environment.

## 🚀 Quick Access

**pgAdmin URL**: http://localhost:5050

**Login Credentials:**
- **Email**: `admin@example.com`
- **Password**: `admin123`

## 🔧 First Time Setup

### 1. Access pgAdmin
1. Open http://localhost:5050 in your browser
2. Login with the credentials above

### 2. Add Database Server
1. **Right-click "Servers"** in the left panel
2. Select **"Register" > "Server..."**

### 3. Configure Server Connection
**General Tab:**
- **Name**: `PPT Colorizer Local`
- **Server Group**: `Servers` (default)

**Connection Tab:**
- **Host name/address**: `db`
- **Port**: `5432`
- **Maintenance database**: `ppt_colorizer`
- **Username**: `ppt_user`
- **Password**: `localdev123`

**Advanced Tab (Optional):**
- **DB restriction**: `ppt_colorizer` (to only show this database)

### 4. Save Connection
Click **"Save"** to connect to the database.

## 📊 Using pgAdmin

### View Tables
1. Expand **PPT Colorizer Local** > **Databases** > **ppt_colorizer** > **Schemas** > **public** > **Tables**
2. You'll see tables like:
   - `users` - Application users
   - `templates` - PowerPoint templates
   - `excel_data` - Excel file data
   - `jobs` - Background processing jobs
   - `alembic_version` - Database migration tracking

### Query Data
1. **Right-click on any table** > **"View/Edit Data"** > **"All Rows"**
2. Or use the **Query Tool** (Tools > Query Tool) for custom SQL

### Common Queries
```sql
-- View all users
SELECT id, email, username, role, is_active, created_at FROM users;

-- View recent jobs
SELECT id, filename, status, created_at, updated_at FROM jobs ORDER BY created_at DESC LIMIT 10;

-- View templates
SELECT id, filename, created_at FROM templates;

-- Check database size
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## 🛠️ Database Administration

### Create New Admin User
```sql
INSERT INTO users (email, username, hashed_password, role, is_active)
VALUES ('newadmin@example.com', 'newadmin', '[hashed_password]', 'ADMIN', true);
```

### Update User Role
```sql
UPDATE users SET role = 'ADMIN' WHERE email = 'user@example.com';
```

### View Job Status
```sql
SELECT
    id,
    filename,
    status,
    progress,
    created_at,
    updated_at
FROM jobs
ORDER BY created_at DESC;
```

## 🔄 Database Maintenance

### Backup Database
1. **Right-click database** > **"Backup..."**
2. Choose format (Custom recommended)
3. Select location and click **"Backup"**

### Restore Database
1. **Right-click database** > **"Restore..."**
2. Select backup file
3. Configure options and click **"Restore"**

### Monitor Connections
```sql
SELECT
    pid,
    usename,
    application_name,
    client_addr,
    state,
    query_start
FROM pg_stat_activity
WHERE datname = 'ppt_colorizer';
```

## 🎛️ pgAdmin Features

### Dashboard
- View server statistics
- Monitor active connections
- Check database size and performance

### Query Tool
- Execute custom SQL queries
- View query execution plans
- Export results to CSV, JSON, etc.

### Schema Browser
- Explore database structure
- View table definitions
- Check indexes and constraints

### Monitoring
- Real-time server stats
- Query performance analysis
- Connection monitoring

## 🚨 Troubleshooting

### Cannot Connect to Database
1. **Check if database container is running:**
   ```bash
   docker compose ps db
   ```

2. **Verify database credentials in .env.local:**
   - `POSTGRES_USER=ppt_user`
   - `POSTGRES_PASSWORD=localdev123`

3. **Check if database exists:**
   ```bash
   docker compose exec db psql -U ppt_user -c "\l"
   ```

### pgAdmin Won't Load
1. **Check pgAdmin container status:**
   ```bash
   docker compose ps pgadmin
   ```

2. **View pgAdmin logs:**
   ```bash
   docker compose logs pgadmin
   ```

3. **Restart pgAdmin:**
   ```bash
   docker compose restart pgadmin
   ```

### Permission Issues
1. **Reset pgAdmin data:**
   ```bash
   docker compose down
   docker volume rm ppt-excel-colorizer_pgadmin_data
   docker compose up -d pgadmin
   ```

## 📚 Additional Resources

- **pgAdmin Documentation**: https://www.pgadmin.org/docs/
- **PostgreSQL Documentation**: https://www.postgresql.org/docs/
- **SQL Tutorial**: https://www.w3schools.com/sql/

## 🔐 Security Notes

- **Development Only**: These credentials are for local development only
- **Production**: Never use these credentials in production
- **Network**: pgAdmin is only accessible on localhost in development
- **Data**: All data is stored in local Docker volumes

## 🎯 Next Steps

1. **Explore the database schema** to understand the application structure
2. **Run queries** to see how data is stored and relationships work
3. **Monitor job processing** to understand the background task workflow
4. **Create test data** for development and testing purposes