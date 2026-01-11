# Backup & Restore Module

## Overview

The Backup & Restore module provides complete database backup and restoration functionality for the inventory system. It supports both MySQL and SQLite databases and includes features for creating backups, listing them, restoring from backups, and managing backup files.

## Features

- **Automatic Backup Creation**: Create full database backups with a single API call
- **Multiple Database Support**: Works with both MySQL and SQLite databases
- **Backup Management**: List, download, and delete backup files
- **Database Restoration**: Restore database from any previous backup
- **Permission-based Access Control**: All operations require the `manage_backups` permission
- **Safe Restoration**: Automatically backs up current database before restoration
- **Human-readable File Sizes**: Backup information includes formatted file sizes and timestamps

## Installation & Setup

### 1. Run Migrations

```bash
php artisan migrate
```

This will:
- Create the `permissions` table entry for `manage_backups`
- Ensure the backup logs table is created (if not already)

### 2. Assign Permission to Roles

You can assign the `manage_backups` permission to roles via the RBAC endpoints:

```bash
POST /api/rbac/give-permission
{
    "role_id": 1,
    "permission_name": "manage_backups"
}
```

Or create a seeder to automatically assign the permission to admin roles.

## API Endpoints

All endpoints require JWT authentication and the `manage_backups` permission.

### 1. Create Backup

**Endpoint**: `POST /api/backup/create`

**Description**: Creates a new backup of the entire database and returns it for download.

**Headers**:
```
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json
```

**Response** (Success):
- Returns the backup file as a downloadable attachment
- Filename format: `backup_{database_name}_{timestamp}.sql` (MySQL) or `.sqlite` (SQLite)

**Response** (Error):
```json
{
    "success": false,
    "message": "Error description"
}
```

**Example**:
```bash
curl -X POST http://localhost:8000/api/backup/create \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### 2. List Backups

**Endpoint**: `GET /api/backup/list`

**Description**: Returns a list of all available backup files.

**Headers**:
```
Authorization: Bearer {JWT_TOKEN}
```

**Response** (Success):
```json
{
    "success": true,
    "backups": [
        {
            "name": "backup_inventory_2026-01-11_14-30-45.sql",
            "size": 2048576,
            "size_readable": "2.0 MB",
            "created_at": 1673445045,
            "created_at_readable": "2026-01-11 14:30:45"
        },
        {
            "name": "backup_inventory_2026-01-10_10-15-30.sql",
            "size": 1024000,
            "size_readable": "1000 KB",
            "created_at": 1673358930,
            "created_at_readable": "2026-01-10 10:15:30"
        }
    ]
}
```

**Example**:
```bash
curl -X GET http://localhost:8000/api/backup/list \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### 3. Restore from Backup

**Endpoint**: `POST /api/backup/restore`

**Description**: Restores the database from a specified backup file. **WARNING: This will drop all current tables and replace them with backup data.**

**Headers**:
```
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json
```

**Request Body**:
```json
{
    "backup_file": "backup_inventory_2026-01-11_14-30-45.sql"
}
```

**Response** (Success):
```json
{
    "success": true,
    "message": "Database restored successfully from backup"
}
```

**Response** (Error):
```json
{
    "success": false,
    "message": "Error description"
}
```

**Safety Notes**:
- For SQLite: A backup of the current database is automatically created with suffix `.before_restore_{timestamp}`
- For MySQL: All foreign key checks are temporarily disabled during restoration
- The operation is wrapped in a transaction (MySQL only)

**Example**:
```bash
curl -X POST http://localhost:8000/api/backup/restore \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "backup_file": "backup_inventory_2026-01-11_14-30-45.sql"
  }'
```

---

### 4. Download Backup

**Endpoint**: `POST /api/backup/download`

**Description**: Downloads a specific backup file.

**Headers**:
```
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json
```

**Request Body**:
```json
{
    "backup_file": "backup_inventory_2026-01-11_14-30-45.sql"
}
```

**Response** (Success):
- Returns the backup file as a downloadable attachment

**Example**:
```bash
curl -X POST http://localhost:8000/api/backup/download \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "backup_file": "backup_inventory_2026-01-11_14-30-45.sql"
  }' \
  -o my_backup.sql
```

---

### 5. Delete Backup

**Endpoint**: `POST /api/backup/delete`

**Description**: Permanently deletes a backup file from the system.

**Headers**:
```
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json
```

**Request Body**:
```json
{
    "backup_file": "backup_inventory_2026-01-11_14-30-45.sql"
}
```

**Response** (Success):
```json
{
    "success": true,
    "message": "Backup file deleted successfully"
}
```

**Example**:
```bash
curl -X POST http://localhost:8000/api/backup/delete \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "backup_file": "backup_inventory_2026-01-11_14-30-45.sql"
  }'
```

---

## File Storage

Backup files are stored in the `storage/app/backups/` directory. This directory is created automatically on the first backup.

### Directory Structure
```
storage/
  app/
    backups/
      backup_inventory_2026-01-11_14-30-45.sql
      backup_inventory_2026-01-10_10-15-30.sql
      ...
```

## Database Support

### MySQL
- Uses `mysqldump` for backup creation
- Uses `mysql` client for restoration
- Requires `mysqldump` and `mysql` executables to be available in system PATH
- Automatically disables foreign key checks during restoration

### SQLite
- Uses direct file copying for backup
- Uses direct file replacement for restoration
- No external tools required
- Automatically creates a safety backup before restoration (with `.before_restore_` suffix)

## Security

1. **Permission-based Access Control**: All endpoints require the `manage_backups` permission
2. **Path Traversal Protection**: Backup file paths are validated to prevent directory traversal attacks
3. **Input Validation**: All user inputs are validated before processing
4. **CSRF Protection**: Disabled for backup endpoints but protected by JWT authentication

## Error Handling

The module includes comprehensive error handling:

- **Database connection errors**: Returns detailed error messages
- **File system errors**: Handles missing directories and files gracefully
- **Restoration errors**: Provides rollback capability for MySQL transactions
- **Path validation errors**: Prevents directory traversal attacks

## Troubleshooting

### MySQL Backup Issues
- **Error**: "Failed to create MySQL backup"
  - **Solution**: Ensure `mysqldump` is installed and in PATH
  - **Check**: Run `which mysqldump` (Linux/Mac) or `where mysqldump` (Windows)

- **Error**: "Failed to restore MySQL database"
  - **Solution**: Ensure `mysql` client is installed and credentials are correct
  - **Check**: Verify database credentials in `.env` file

### SQLite Issues
- **Error**: "SQLite database file not found"
  - **Solution**: Verify database path in `config/database.php`
  - **Check**: File should be at `database_path()` by default

### Permission Issues
- **Error**: "Unauthorized" (403)
  - **Solution**: Assign the `manage_backups` permission to the user's role
  - **Action**: Use the RBAC endpoints to grant the permission

## Example Frontend Integration

Here's how to integrate the backup module in Angular:

```typescript
// backup.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class BackupService {
  private apiUrl = '/api/backup';

  constructor(private http: HttpClient) {}

  createBackup(): Observable<Blob> {
    return this.http.post(this.apiUrl + '/create', {}, {
      responseType: 'blob'
    });
  }

  listBackups(): Observable<any> {
    return this.http.get(this.apiUrl + '/list');
  }

  restore(backupFile: string): Observable<any> {
    return this.http.post(this.apiUrl + '/restore', {
      backup_file: backupFile
    });
  }

  downloadBackup(backupFile: string): Observable<Blob> {
    return this.http.post(this.apiUrl + '/download', {
      backup_file: backupFile
    }, {
      responseType: 'blob'
    });
  }

  deleteBackup(backupFile: string): Observable<any> {
    return this.http.post(this.apiUrl + '/delete', {
      backup_file: backupFile
    });
  }
}
```

## Performance Considerations

- **Large Databases**: For very large databases, consider scheduling backups during low-traffic periods
- **Storage Space**: Monitor backup storage to prevent disk space issues
- **Backup Frequency**: Regular backups are recommended (daily or weekly depending on usage)
- **Retention Policy**: Consider implementing a retention policy to delete old backups

## Best Practices

1. **Regular Backups**: Schedule regular automated backups
2. **Test Restores**: Periodically test restoration to ensure backups are valid
3. **Off-site Storage**: Keep critical backups in off-site storage
4. **Retention Policy**: Implement a policy for deleting old backups
5. **Monitoring**: Monitor backup creation and restoration operations
6. **Documentation**: Document your backup and restoration procedures

## Limitations

- **Large Databases**: Very large databases may take time to backup
- **System Resources**: Backup creation uses system resources; schedule during off-peak hours
- **Concurrent Operations**: Multiple simultaneous backups/restores are not recommended
- **External Database Tools**: MySQL backups require mysqldump to be installed

## Planned Enhancements

Future versions may include:
- Scheduled automated backups
- Compression of backup files
- Backup encryption
- Incremental backups
- Cloud storage integration
- Backup verification and integrity checks
