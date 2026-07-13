<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Adds 'reserved' as a valid status for distribution_plan_schedules.
 *
 * Status lifecycle after this migration:
 *   planned → checked_pre → reserved → ready → completed | cancelled
 *
 * 'reserved'  = stock has been earmarked (OUT transactions written) before the
 *               planned date. The cron promotes reserved → ready on the day.
 * 'ready'     = planned date has arrived and stock was reserved; the manager
 *               can now run (complete) the batch.
 *
 * MySQL ENUM columns require an explicit ALTER TABLE to add new values.
 * The migration is safe to re-run (checks existence first).
 */
return new class extends Migration
{
    public function up(): void
    {
        // MySQL: modify the ENUM to include 'reserved'
        // We check if the column is an ENUM first; if it's a VARCHAR or similar
        // (used in some setups for flexibility) we skip the ALTER.
        $columnType = DB::selectOne("
            SELECT COLUMN_TYPE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME   = 'distribution_plan_schedules'
              AND COLUMN_NAME  = 'status'
        ");

        if (!$columnType) {
            return; // table not yet created
        }

        $type = strtolower((string) ($columnType->COLUMN_TYPE ?? ''));

        // Only alter if it's an ENUM and 'reserved' isn't already in it
        if (str_starts_with($type, 'enum') && !str_contains($type, "'reserved'")) {
            DB::statement("
                ALTER TABLE distribution_plan_schedules
                MODIFY COLUMN status
                    ENUM('planned','checked_pre','reserved','ready','completed','cancelled')
                    NOT NULL
                    DEFAULT 'planned'
            ");
        }
        // If the column is VARCHAR/TEXT it already accepts any string — no change needed.
    }

    public function down(): void
    {
        $columnType = DB::selectOne("
            SELECT COLUMN_TYPE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME   = 'distribution_plan_schedules'
              AND COLUMN_NAME  = 'status'
        ");

        $type = strtolower((string) ($columnType->COLUMN_TYPE ?? ''));

        if (str_starts_with($type, 'enum') && str_contains($type, "'reserved'")) {
            // Revert any 'reserved' rows to 'planned' before removing the value
            DB::table('distribution_plan_schedules')
                ->where('status', 'reserved')
                ->update(['status' => 'planned']);

            DB::statement("
                ALTER TABLE distribution_plan_schedules
                MODIFY COLUMN status
                    ENUM('planned','checked_pre','ready','completed','cancelled')
                    NOT NULL
                    DEFAULT 'planned'
            ");
        }
    }
};
