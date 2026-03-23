<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Carbon\Carbon;
use Exception;
use ZipArchive;

class BackupController extends Controller
{
    /**
     * Resolve a backup file under storage/app/backups and verify it stays inside that directory.
     */
    private function resolveSafeBackupPath(string $relativeFilename): ?string
    {
        $backupPath = storage_path('app/backups/' . basename($relativeFilename));
        if (!is_file($backupPath)) {
            return null;
        }
        $resolvedFile = realpath($backupPath);
        $resolvedDir = realpath(storage_path('app/backups'));
        if ($resolvedFile === false || $resolvedDir === false) {
            return null;
        }
        if (!str_starts_with($resolvedFile, $resolvedDir)) {
            return null;
        }

        return $resolvedFile;
    }

    /**
     * Create a database backup and download it
     */
    public function backup(Request $request)
    {
        try {
            $database = config('database.connections.' . config('database.default'));
            
            // Determine database type
            $dbDriver = config('database.default');
            
            if ($dbDriver === 'mysql') {
                return $this->backupMySQL($database);
            } elseif ($dbDriver === 'sqlite') {
                return $this->backupSQLite($database);
            } else {
                return response()->json([
                    'success' => false,
                    'message' => 'Unsupported database driver: ' . $dbDriver
                ], 400);
            }
        } catch (Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Backup failed: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Backup MySQL database using mysqldump
     */
    private function backupMySQL($database)
    {
        try {
            $host = $database['host'];
            $user = $database['username'];
            $password = $database['password'];
            $dbName = $database['database'];
            $dumpBin = $this->getMySqlDumpBin();
            if (!$dumpBin) {
                return response()->json([
                    'success' => false,
                    'message' => 'mysqldump not found. Install MySQL client tools or set MYSQLDUMP_PATH in .env (e.g., C:\\xampp\\mysql\\bin\\mysqldump.exe).'
                ], 500);
            }
            
            // Create backups directory if it doesn't exist
            $backupDir = storage_path('app/backups');
            if (!is_dir($backupDir)) {
                mkdir($backupDir, 0755, true);
            }
            
            $timestamp = Carbon::now()->format('Y-m-d_H-i-s');
            $backupFile = $backupDir . '/backup_' . $dbName . '_' . $timestamp . '.sql';
            
            // Pipe mysqldump stdout to file (works on Windows + Linux; shell ">" redirect often fails under PHP exec on Windows)
            $cmd = sprintf(
                '%s --host=%s --user=%s --password=%s --single-transaction --routines %s',
                escapeshellarg($dumpBin),
                escapeshellarg($host),
                escapeshellarg($user),
                escapeshellarg($password),
                escapeshellarg($dbName)
            );

            $descriptorspec = [
                0 => ['pipe', 'r'],
                1 => ['file', $backupFile, 'w'],
                2 => ['pipe', 'w'],
            ];

            $process = proc_open($cmd, $descriptorspec, $pipes);
            if (!is_resource($process)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Failed to start mysqldump process.'
                ], 500);
            }
            if (isset($pipes[0]) && is_resource($pipes[0])) {
                fclose($pipes[0]);
            }
            $stderr = isset($pipes[2]) && is_resource($pipes[2]) ? stream_get_contents($pipes[2]) : '';
            if (isset($pipes[2]) && is_resource($pipes[2])) {
                fclose($pipes[2]);
            }
            $returnVar = proc_close($process);

            if ($returnVar !== 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'Failed to create MySQL backup. Ensure mysqldump is installed and accessible. ' . trim($stderr)
                ], 500);
            }
            
            if (!file_exists($backupFile)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Backup file was not created'
                ], 500);
            }
            
            // Return file for download
            return response()->download($backupFile, 'backup_' . $dbName . '_' . $timestamp . '.sql')->deleteFileAfterSend(false);
            
        } catch (Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'MySQL backup error: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Backup SQLite database
     */
    private function backupSQLite($database)
    {
        try {
            $sourceDb = $database['database'];
            
            if (!file_exists($sourceDb)) {
                return response()->json([
                    'success' => false,
                    'message' => 'SQLite database file not found'
                ], 404);
            }
            
            $backupDir = storage_path('app/backups');
            if (!is_dir($backupDir)) {
                mkdir($backupDir, 0755, true);
            }
            
            $timestamp = Carbon::now()->format('Y-m-d_H-i-s');
            $dbName = basename($sourceDb, '.sqlite');
            $backupFile = $backupDir . '/backup_' . $dbName . '_' . $timestamp . '.sqlite';
            
            // Copy SQLite database file
            if (!copy($sourceDb, $backupFile)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Failed to create SQLite backup'
                ], 500);
            }
            
            // Return file for download
            return response()->download($backupFile, 'backup_' . $dbName . '_' . $timestamp . '.sqlite')->deleteFileAfterSend(false);
            
        } catch (Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'SQLite backup error: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * List all available backups
     */
    public function listBackups()
    {
        try {
            $backupDir = storage_path('app/backups');
            
            if (!is_dir($backupDir)) {
                return response()->json([
                    'success' => true,
                    'backups' => []
                ]);
            }
            
            $backups = [];
            $files = scandir($backupDir);
            
            foreach ($files as $file) {
                if ($file !== '.' && $file !== '..') {
                    $filePath = $backupDir . '/' . $file;
                    if (is_file($filePath)) {
                        $backups[] = [
                            'name' => $file,
                            'size' => filesize($filePath),
                            'size_readable' => $this->formatBytes(filesize($filePath)),
                            'created_at' => filemtime($filePath),
                            'created_at_readable' => Carbon::createFromTimestamp(filemtime($filePath))->format('Y-m-d H:i:s')
                        ];
                    }
                }
            }
            
            // Sort by creation date (newest first)
            usort($backups, function($a, $b) {
                return $b['created_at'] - $a['created_at'];
            });
            
            return response()->json([
                'success' => true,
                'backups' => $backups
            ]);
        } catch (Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to list backups: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Restore database from backup
     */
    public function restore(Request $request)
    {
        try {
            $request->validate([
                'backup_file' => 'required|string'
            ]);
            
            $backupFile = $request->input('backup_file');
            $backupPath = $this->resolveSafeBackupPath($backupFile);
            if ($backupPath === null) {
                return response()->json([
                    'success' => false,
                    'message' => 'Backup file not found or invalid path'
                ], 404);
            }

            $dbDriver = config('database.default');
            
            if ($dbDriver === 'mysql') {
                return $this->restoreMySQL($backupPath);
            } elseif ($dbDriver === 'sqlite') {
                return $this->restoreSQLite($backupPath);
            } else {
                return response()->json([
                    'success' => false,
                    'message' => 'Unsupported database driver: ' . $dbDriver
                ], 400);
            }
        } catch (Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Restore failed: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Restore MySQL database from backup
     */
    private function restoreMySQL($backupPath)
    {
        try {
            $database = config('database.connections.mysql');
            $host = $database['host'];
            $user = $database['username'];
            $password = $database['password'];
            $dbName = $database['database'];
            $mysqlBin = $this->getMySqlClientBin();
            if (!$mysqlBin) {
                return response()->json([
                    'success' => false,
                    'message' => 'mysql client not found. Install MySQL client tools or set MYSQL_CLIENT_PATH in .env (e.g., C:\\xampp\\mysql\\bin\\mysql.exe).'
                ], 500);
            }
            
            // Drop all tables first (without transaction since exec() operates outside Laravel's connection)
            try {
                $tables = DB::select('SELECT table_name FROM information_schema.tables WHERE table_schema = ?', [$dbName]);
                
                DB::statement('SET FOREIGN_KEY_CHECKS=0');
                
                foreach ($tables as $table) {
                    DB::statement('DROP TABLE IF EXISTS `' . $table->table_name . '`');
                }
                
                DB::statement('SET FOREIGN_KEY_CHECKS=1');
            } catch (Exception $e) {
                return response()->json([
                    'success' => false,
                    'message' => 'Failed to drop existing tables: ' . $e->getMessage()
                ], 500);
            }
            
            // Pipe SQL file into mysql stdin (reliable on Windows; "< file" redirect often fails under PHP exec)
            $cmd = sprintf(
                '%s --host=%s --user=%s --password=%s %s',
                escapeshellarg($mysqlBin),
                escapeshellarg($host),
                escapeshellarg($user),
                escapeshellarg($password),
                escapeshellarg($dbName)
            );

            $descriptorspec = [
                0 => ['file', $backupPath, 'r'],
                1 => ['pipe', 'w'],
                2 => ['pipe', 'w'],
            ];

            $process = proc_open($cmd, $descriptorspec, $pipes);
            if (!is_resource($process)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Failed to start mysql client process.'
                ], 500);
            }
            if (isset($pipes[1]) && is_resource($pipes[1])) {
                fclose($pipes[1]);
            }
            $stderr = isset($pipes[2]) && is_resource($pipes[2]) ? stream_get_contents($pipes[2]) : '';
            if (isset($pipes[2]) && is_resource($pipes[2])) {
                fclose($pipes[2]);
            }
            $returnVar = proc_close($process);

            if ($returnVar !== 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'Failed to restore MySQL database. Ensure mysql client is installed and accessible. ' . trim($stderr ?: ('Exit code: ' . $returnVar))
                ], 500);
            }
            
            // Reconnect to reload schema cache after restore
            DB::purge('mysql');
            DB::reconnect('mysql');
            
            return response()->json([
                'success' => true,
                'message' => 'Database restored successfully from backup'
            ]);
            
        } catch (Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'MySQL restore error: ' . $e->getMessage()
            ], 500);
        }
    }

    private function getMySqlDumpBin()
    {
        $envPath = env('MYSQLDUMP_PATH');
        if ($envPath && file_exists($envPath)) {
            return $envPath;
        }
        $candidates = [
            'mysqldump',
            'C:\\xampp\\mysql\\bin\\mysqldump.exe',
            'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe',
            '/usr/bin/mysqldump',
            '/usr/local/bin/mysqldump'
        ];
        foreach ($candidates as $path) {
            if ($path === 'mysqldump') {
                return $path;
            }
            if (file_exists($path)) {
                return $path;
            }
        }
        return null;
    }

    private function getMySqlClientBin()
    {
        $envPath = env('MYSQL_CLIENT_PATH');
        if ($envPath && file_exists($envPath)) {
            return $envPath;
        }
        $candidates = [
            'mysql',
            'C:\\xampp\\mysql\\bin\\mysql.exe',
            'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysql.exe',
            '/usr/bin/mysql',
            '/usr/local/bin/mysql'
        ];
        foreach ($candidates as $path) {
            if ($path === 'mysql') {
                return $path;
            }
            if (file_exists($path)) {
                return $path;
            }
        }
        return null;
    }

    /**
     * Restore SQLite database from backup
     */
    private function restoreSQLite($backupPath)
    {
        try {
            $database = config('database.connections.sqlite');
            $originalDb = $database['database'];
            
            // Create backup of current database before restoring
            $currentBackup = $originalDb . '.before_restore_' . Carbon::now()->format('Y-m-d_H-i-s');
            if (file_exists($originalDb)) {
                copy($originalDb, $currentBackup);
            }
            
            // Copy backup to original location
            if (!copy($backupPath, $originalDb)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Failed to restore SQLite database'
                ], 500);
            }
            
            // Clear any cached connections
            DB::purge('sqlite');
            DB::reconnect('sqlite');
            
            return response()->json([
                'success' => true,
                'message' => 'Database restored successfully from backup'
            ]);
            
        } catch (Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'SQLite restore error: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Download a specific backup file
     */
    public function downloadBackup(Request $request)
    {
        try {
            $request->validate([
                'backup_file' => 'required|string'
            ]);
            
            $backupFile = $request->input('backup_file');
            $backupPath = $this->resolveSafeBackupPath($backupFile);
            if ($backupPath === null) {
                return response()->json([
                    'success' => false,
                    'message' => 'Backup file not found or invalid path'
                ], 404);
            }

            return response()->download($backupPath, basename($backupFile));
            
        } catch (Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Download failed: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Delete a backup file
     */
    public function deleteBackup(Request $request)
    {
        try {
            $request->validate([
                'backup_file' => 'required|string'
            ]);
            
            $backupFile = $request->input('backup_file');
            $backupPath = $this->resolveSafeBackupPath($backupFile);
            if ($backupPath === null) {
                return response()->json([
                    'success' => false,
                    'message' => 'Backup file not found or invalid path'
                ], 404);
            }

            if (!unlink($backupPath)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Failed to delete backup file'
                ], 500);
            }
            
            return response()->json([
                'success' => true,
                'message' => 'Backup file deleted successfully'
            ]);
            
        } catch (Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Delete failed: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Format bytes to human readable format
     */
    private function formatBytes($bytes, $precision = 2)
    {
        $units = ['B', 'KB', 'MB', 'GB'];
        $bytes = max($bytes, 0);
        $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
        $pow = min($pow, count($units) - 1);
        $bytes /= (1 << (10 * $pow));
        
        return round($bytes, $precision) . ' ' . $units[$pow];
    }

    /**
     * Restore database from uploaded backup file
     */
    public function restoreFromUpload(Request $request)
    {
        try {
            $request->validate([
                // max:102400 = 100 MB (kilobytes). Extension checked below — MIME is unreliable on Windows.
                'backup_file' => 'required|file|max:102400',
            ]);

            $uploadedFile = $request->file('backup_file');
            $extension = strtolower($uploadedFile->getClientOriginalExtension());
            if (!in_array($extension, ['sql', 'sqlite'], true)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Invalid file type. Only .sql and .sqlite files are accepted.',
                ], 422);
            }

            // Create temp directory if not exists
            $tempDir = storage_path('app/temp');
            if (!is_dir($tempDir)) {
                mkdir($tempDir, 0755, true);
            }

            // Save uploaded file temporarily
            $safeName = uniqid('restore_', true) . '_' . preg_replace('/[^a-zA-Z0-9._-]/', '_', $uploadedFile->getClientOriginalName());
            $uploadedFile->move($tempDir, $safeName);
            $tempPath = $tempDir . DIRECTORY_SEPARATOR . $safeName;

            $dbDriver = config('database.default');
            
            try {
                if ($dbDriver === 'mysql') {
                    $result = $this->restoreMySQL($tempPath);
                } elseif ($dbDriver === 'sqlite') {
                    $result = $this->restoreSQLite($tempPath);
                } else {
                    return response()->json([
                        'success' => false,
                        'message' => 'Unsupported database driver: ' . $dbDriver
                    ], 400);
                }

                // Clean up temp file after restore
                if (file_exists($tempPath)) {
                    unlink($tempPath);
                }

                return $result;
            } catch (Exception $e) {
                // Clean up temp file on error
                if (file_exists($tempPath)) {
                    unlink($tempPath);
                }
                throw $e;
            }
        } catch (Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Restore from upload failed: ' . $e->getMessage()
            ], 500);
        }
    }
}
