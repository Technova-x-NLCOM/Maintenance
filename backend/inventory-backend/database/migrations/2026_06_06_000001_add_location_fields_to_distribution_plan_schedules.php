<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('distribution_plan_schedules', function (Blueprint $table) {
            // Optional preferred source location — system tries this first (FEFO within it),
            // then spills over to other locations automatically if stock is insufficient.
            if (!Schema::hasColumn('distribution_plan_schedules', 'preferred_location_id')) {
                $table->unsignedBigInteger('preferred_location_id')
                    ->nullable()
                    ->after('notes');

                $table->foreign('preferred_location_id')
                    ->references('location_id')
                    ->on('locations')
                    ->nullOnDelete();

                $table->index('preferred_location_id');
            }

            // Snapshot fields written when the batch is actually issued.
            if (!Schema::hasColumn('distribution_plan_schedules', 'completed_reference')) {
                $table->string('completed_reference', 100)->nullable()->after('completed_at');
            }

            if (!Schema::hasColumn('distribution_plan_schedules', 'completed_issued_qty')) {
                $table->unsignedInteger('completed_issued_qty')->nullable()->after('completed_reference');
            }

            if (!Schema::hasColumn('distribution_plan_schedules', 'completed_target_people')) {
                $table->unsignedInteger('completed_target_people')->nullable()->after('completed_issued_qty');
            }

            if (!Schema::hasColumn('distribution_plan_schedules', 'completed_notes')) {
                $table->text('completed_notes')->nullable()->after('completed_target_people');
            }
        });
    }

    public function down(): void
    {
        Schema::table('distribution_plan_schedules', function (Blueprint $table) {
            foreach (['preferred_location_id', 'completed_reference', 'completed_issued_qty', 'completed_target_people', 'completed_notes'] as $col) {
                if (Schema::hasColumn('distribution_plan_schedules', $col)) {
                    if ($col === 'preferred_location_id') {
                        $table->dropForeign(['preferred_location_id']);
                        $table->dropIndex(['preferred_location_id']);
                    }
                    $table->dropColumn($col);
                }
            }
        });
    }
};
