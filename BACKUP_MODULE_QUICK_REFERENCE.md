# Backup Module - Quick Reference

## Files Created/Modified

### New Files:
1. `backend/inventory-backend/app/Http/Controllers/BackupController.php` - Main backup controller
2. `backend/inventory-backend/database/migrations/2026_01_11_000002_add_manage_backups_permission.php` - Migration for permission
3. `BACKUP_MODULE_DOCUMENTATION.md` - Full documentation

### Modified Files:
1. `backend/inventory-backend/routes/web.php` - Added backup routes

## Quick Setup

1. Run migration:
   ```bash
   cd backend/inventory-backend
   php artisan migrate
   ```

2. Assign permission to admin role (optional, add to seeder):
   ```php
   Route::post('give-permission', [\App\Http\Controllers\RBACController::class, 'givePermission']);
   // POST /api/rbac/give-permission
   // {"role_id": 1, "permission_name": "manage_backups"}
   ```

## Available Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/backup/create` | Create and download backup |
| GET | `/api/backup/list` | List all backups |
| POST | `/api/backup/restore` | Restore from backup |
| POST | `/api/backup/download` | Download a backup file |
| POST | `/api/backup/delete` | Delete a backup file |

## Example Usage

### Create Backup
```bash
curl -X POST http://localhost:8000/api/backup/create \
  -H "Authorization: Bearer JWT_TOKEN"
```

### List Backups
```bash
curl -X GET http://localhost:8000/api/backup/list \
  -H "Authorization: Bearer JWT_TOKEN"
```

### Restore from Backup
```bash
curl -X POST http://localhost:8000/api/backup/restore \
  -H "Authorization: Bearer JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"backup_file": "backup_inventory_2026-01-11_14-30-45.sql"}'
```

## Features

✅ Create full database backups  
✅ List all available backups with file info  
✅ Restore database from any backup  
✅ Download backup files  
✅ Delete old backups  
✅ Support for MySQL and SQLite  
✅ Permission-based access control  
✅ Automatic safety backups before restore  
✅ Safe restoration with transaction rollback (MySQL)  
✅ Path traversal attack prevention  

## Storage Location

Backups are stored in: `storage/app/backups/`

## Requirements

### MySQL:
- `mysqldump` command available in PATH
- `mysql` command available in PATH

### SQLite:
- No external requirements

## Security Notes

- All endpoints require `manage_backups` permission
- JWT authentication required
- File path validation prevents directory traversal
- Input validation on all parameters

## Support for Database Drivers

- ✅ MySQL
- ✅ SQLite
- ❌ PostgreSQL (can be added if needed)
- ❌ SQL Server (can be added if needed)
