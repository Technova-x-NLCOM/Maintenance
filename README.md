# Inventory Management System

A full-stack inventory management system built with Laravel (Backend) and Angular (Frontend), using MySQL as the database.

## � Documentation

**New to this project?** Start here:

- **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** - Quick overview and common queries
- **[DATABASE_DOCUMENTATION.md](DATABASE_DOCUMENTATION.md)** - Complete database technical documentation
- **[database_schema.txt](database_schema.txt)** - Visual database structure diagram
- **[IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md)** - Step-by-step guide for RBAC and Backup/Restore

## �📋 Prerequisites

Before you begin, ensure you have the following installed:

- **PHP** >= 8.2
- **Composer** (https://getcomposer.org/)
- **Node.js** >= 18.x and npm (https://nodejs.org/)
- **MySQL** (via XAMPP or standalone)
- **Git**
- **Angular CLI**: `npm install -g @angular/cli`

## ⚡ Quick Start

**Already have prerequisites?** Run these commands:

```bash
# Backend
cd backend/inventory-backend
composer install
cp .env.example .env
php artisan key:generate
# Configure DB in .env (DB_DATABASE=inventory_backend, DB_USERNAME=root, DB_PASSWORD=)
php artisan migrate --seed
php artisan jwt:secret
php artisan serve

# Frontend (new terminal)
cd frontend/inventory-frontend
npm install
ng serve
```

**Demo accounts:**
- Super Admin: `superadmin@nlcom.org` / `SuperAdmin123!`
- Inventory Manager: `inventory@nlcom.org` / `InventoryManager123!`

Access: Backend `http://127.0.0.1:8000` | Frontend `http://localhost:4200`

## 🚀 Setup Instructions

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/Technova-x-NLCOM/Maintenance.git
cd Maintenance
```

### 2️⃣ Backend Setup (Laravel)

```bash
# Navigate to backend directory
cd backend/inventory-backend

# Install PHP dependencies
composer install

# Copy environment file
cp .env.example .env

# Generate application key
php artisan key:generate

# Configure your .env file with database credentials:
# DB_CONNECTION=mysql
# DB_HOST=127.0.0.1
# DB_PORT=3306
# DB_DATABASE=inventory_backend
# DB_USERNAME=root
# DB_PASSWORD=

# Create the database (using MySQL client or phpMyAdmin)
# Database name: inventory_backend

# Run migrations
php artisan migrate

# (Optional) Seed database with sample data
php artisan db:seed

# Start Laravel development server
php artisan serve
```

Backend will run at: `http://localhost:8000`

### 3️⃣ Frontend Setup (Angular)

Open a new terminal:

```bash
# Navigate to frontend directory
cd frontend/inventory-frontend

# Install Node dependencies
npm install

# Start Angular development server
ng serve
```

Frontend will run at: `http://localhost:4200`

### 4️⃣ JWT Authentication Setup (Required)

JWT is already integrated in the backend. After cloning and installing dependencies, each teammate must generate a local JWT secret:

```bash
# In backend/inventory-backend
php artisan jwt:secret
```

This writes `JWT_SECRET=...` to your `.env`. Do not commit your `.env`.

What’s already configured:
- Package installed: `tymon/jwt-auth`
- Config published: `config/jwt.php`
- Guard added in `config/auth.php`:
  - Guard `api` uses driver `jwt`
- Protected routes: `GET /api/auth/me`, `POST /api/auth/logout`

Optional JWT settings in `.env`:
```env
JWT_TTL=60        # Token lifetime in minutes (default 60)
JWT_BLACKLIST_ENABLED=true
```

Quick test:
```bash
# Login (username or email in "identifier")
curl -X POST http://127.0.0.1:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"inventory@nlcom.org","password":"InventoryManager123!"}'

# Then call /me with the returned token
curl http://127.0.0.1:8000/api/auth/me \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

### 4️⃣ Database Setup

**Option 1: Using XAMPP**
1. Start XAMPP Control Panel
2. Start Apache and MySQL services
3. Open phpMyAdmin: `http://localhost/phpmyadmin`
4. Create new database: `inventory_database`

**Option 2: MySQL Command Line**
```bash
mysql -u root -p
CREATE DATABASE inventory_database;
exit;
```

**Option 3: Import Complete Database (Recommended)**
```bash
# Import the pre-configured database with all tables and sample data
mysql -u root -p inventory_database.sql
```

> **Note:** `inventory_database.sql` contains a complete database schema with 10 tables, 3 views, and sample data. See [DATABASE_DOCUMENTATION.md](DATABASE_DOCUMENTATION.md) for details.

## 🏗️ Project Structure

```
Maintenance/
├── backend/
│   └── inventory-backend/    # Laravel API
│       ├── app/              # Application logic
│       ├── routes/           # API routes
│       ├── database/         # Migrations & seeders
│       └── config/           # Configuration files
├── frontend/
│   └── inventory-frontend/   # Angular Application
│       ├── src/
│       │   ├── app/          # Components & services
│       │   └── assets/       # Static files
│       └── angular.json      # Angular configuration
└── README.md
```

## 🔧 Configuration

### MySQL client tools (Windows / XAMPP)

If you're running the backend on Windows (for example with XAMPP) the `mysqldump` and `mysql` CLI tools may not be on your system `PATH`. The backup/restore code looks for these binaries and will return a clear error if they're not found.

Add the following to your backend `.env` if you need to point to the executables explicitly:

```env
MYSQLDUMP_PATH=C:\\xampp\\mysql\\bin\\mysqldump.exe
MYSQL_CLIENT_PATH=C:\\xampp\\mysql\\bin\\mysql.exe
```

After updating `.env` reload Laravel config and restart the dev server:

```bash
cd backend/inventory-backend
php artisan config:clear
php artisan serve
```

Alternatively add the MySQL `bin` folder to your Windows PATH so `mysqldump` and `mysql` are available globally:

1. Open System Properties → Environment Variables → Path → Edit
2. Add `C:\\xampp\\mysql\\bin` (or your MySQL bin folder)
3. Restart your terminal / editor

To verify in a terminal:

```powershell
where mysqldump
where mysql
```

If those commands return a path, the backup endpoints should work without further configuration.


## Timezone Setup (Windows + XAMPP)

Ensure MariaDB, PHP, and Laravel use the same timezone so timestamps (created_at/updated_at) are correct.

### 1) Laravel timezone
- We read timezone from `.env` using `APP_TIMEZONE`.
- Set it and clear config cache:

```bash
php artisan config:clear
```

Add or update in `.env`:

```env
APP_TIMEZONE=Asia/Manila
```

Verify in tinker:

```bash
php artisan tinker
>>> config('app.timezone')
>>> now()
```

### 2) PHP timezone (XAMPP)
- Edit `C:/xampp/php/php.ini`
- Set: `date.timezone = Asia/Manila`
- Restart Apache in XAMPP Control Panel.

Verify with a phpinfo() page or:

```bash
php -i | findstr /I timezone
```

### 3) MariaDB timezone
Check current DB time and settings in your SQL client (phpMyAdmin or mysql CLI):

```sql
SELECT NOW() AS db_now, UTC_TIMESTAMP() AS utc_now, TIMEDIFF(NOW(), UTC_TIMESTAMP()) AS db_offset;
SHOW VARIABLES LIKE 'time_zone';
SHOW VARIABLES LIKE 'system_time_zone';
SELECT @@global.time_zone AS global_tz, @@session.time_zone AS session_tz;
```

Set timezone (Windows best: use offset):

- Permanent (edit `C:/xampp/mysql/bin/my.ini`, section `[mysqld]`):

```
default-time-zone = '+08:00'
```

Then restart MySQL in XAMPP Control Panel.

- Temporary (until restart), run:

```sql
SET GLOBAL time_zone = '+08:00';
SET time_zone = '+08:00';
```

Re-verify:

```sql
SELECT NOW(), @@global.time_zone, @@session.time_zone, @@system.time_zone;
```

Notes:
- Using a named timezone like `Asia/Manila` requires loaded timezone tables; on Windows, the offset string is simpler.
- Keep DB, PHP, and Laravel on the same timezone to avoid mixed timestamps.

### JWT + CORS Notes
- With JWT, no cookies are used; Angular sends an `Authorization: Bearer <token>` header.
- Ensure Angular points to the same host as Laravel (use `127.0.0.1` consistently to avoid CORS/cache mismatches).
- Allowed origins are configured in `backend/inventory-backend/config/cors.php`.

### CORS Setup
To allow Angular to communicate with Laravel:

Edit `backend/inventory-backend/config/cors.php`:
```php
'allowed_origins' => ['http://localhost:4200'],
```

### API URL Configuration
In Angular, configure the API base URL in your environment files:
```typescript
// frontend/inventory-frontend/src/environments/environment.ts
export const environment = {
  production: false,
  apiUrl: 'http://127.0.0.1:8000/api'
};
```

## 📦 Common Commands

### Backend (Laravel)
```bash
php artisan serve              # Start server
php artisan migrate           # Run migrations
php artisan migrate:fresh     # Fresh migration
php artisan db:seed           # Seed database
php artisan make:model Model  # Create model
php artisan make:controller Controller  # Create controller
```

### Frontend (Angular)
```bash
ng serve                      # Start dev server
ng build                      # Build for production
ng generate component name    # Generate component
ng test                       # Run tests
```

## 🐛 Troubleshooting

**Port already in use:**
- Laravel: `php artisan serve --port=8001`
- Angular: `ng serve --port=4201`

**Database connection error:**
- Verify MySQL is running
- Check .env credentials
- Ensure database `inventory_backend` exists

**Composer dependencies error:**
- Run: `composer update`
- Clear cache: `php artisan cache:clear`

**Node modules error:**
- Delete `node_modules` and `package-lock.json`
- Run: `npm install`

## 👥 Team Collaboration

**For teammates pulling the repo:**
1. Follow the setup instructions above
2. Pull latest changes: `git pull origin main`
3. Update dependencies:
   - Backend: `composer install`
   - Frontend: `npm install`
4. Run migrations: `php artisan migrate`

## 📝 License

This project is proprietary software.

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Commit changes: `git commit -m 'Add some feature'`
3. Push to branch: `git push origin feature/your-feature`
4. Open a Pull Request
