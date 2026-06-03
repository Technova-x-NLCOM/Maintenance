<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('distribution_templates')) {
            Schema::table('distribution_templates', function (Blueprint $table) {
                if (!Schema::hasColumn('distribution_templates', 'recipe_type_id')) {
                    $table->unsignedBigInteger('recipe_type_id')->nullable()->after('distribution_type');
                    $table->foreign('recipe_type_id')
                          ->references('recipe_type_id')
                          ->on('recipe_types')
                          ->onDelete('set null');
                    $table->index('recipe_type_id');
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('distribution_templates')) {
            Schema::table('distribution_templates', function (Blueprint $table) {
                if (Schema::hasColumn('distribution_templates', 'recipe_type_id')) {
                    $table->dropForeign(['recipe_type_id']);
                    $table->dropIndex(['recipe_type_id']);
                    $table->dropColumn('recipe_type_id');
                }
            });
        }
    }
};
