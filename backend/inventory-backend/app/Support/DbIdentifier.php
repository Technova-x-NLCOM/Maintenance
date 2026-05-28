<?php

namespace App\Support;

/**
 * Helper for safely validating database identifiers (table/column names).
 *
 * Usage:
 *  if (DbIdentifier::isValid($table, $allowedTables)) {
 *      $safe = DbIdentifier::quote($table);
 *      // use $safe only when $table is whitelisted
 *  }
 */
class DbIdentifier
{
    public static function isValid(string $name, ?array $allowed = null): bool
    {
        // Basic identifier pattern: letters, numbers, underscore
        if (!preg_match('/^[A-Za-z0-9_]+$/', $name)) {
            return false;
        }

        if (is_array($allowed)) {
            return in_array($name, $allowed, true);
        }

        return true;
    }

    public static function quote(string $name): string
    {
        // Quote with backticks for MySQL identifiers
        return '\`' . str_replace('`', '``', $name) . '\`';
    }
}
