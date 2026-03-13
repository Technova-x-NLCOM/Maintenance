<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        // Add user-defined reorder levels per category
        Schema::table('categories', function (Blueprint $table) {
            $table->integer('default_reorder_level')->default(10)->after('description');
            $table->integer('default_expiry_warning_days')->default(30)->after('default_reorder_level');
        });

        // Add customizable alert settings per user
        Schema::create('user_alert_settings', function (Blueprint $table) {
            $table->id('setting_id');
            $table->unsignedBigInteger('user_id');
            $table->enum('alert_frequency', ['immediate', 'daily', 'weekly'])->default('immediate');
            $table->integer('expiry_warning_days')->default(30);
            $table->integer('critical_expiry_days')->default(7);
            $table->integer('warning_expiry_days')->default(14);
            $table->boolean('email_notifications')->default(true);
            $table->boolean('push_notifications')->default(true);
            $table->timestamps();
            
            $table->foreign('user_id')->references('user_id')->on('users')->onDelete('cascade');
            $table->unique('user_id');
        });

        // Enhance expiry_alerts table for better management
        Schema::table('expiry_alerts', function (Blueprint $table) {
            $table->timestamp('escalated_at')->nullable()->after('acknowledged_at');
            $table->integer('escalation_level')->default(0)->after('escalated_at');
            $table->text('escalation_notes')->nullable()->after('escalation_level');
        });

        // Create alert history table
        Schema::create('alert_history', function (Blueprint $table) {
            $table->id('history_id');
            $table->string('alert_type', 50); // 'expiry', 'low_stock', 'system'
            $table->string('alert_reference')->nullable(); // reference to original alert
            $table->text('message');
            $table->enum('severity', ['critical', 'warning', 'info']);
            $table->enum('status', ['pending', 'acknowledged', 'resolved', 'escalated']);
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('acknowledged_by')->nullable();
            $table->unsignedBigInteger('resolved_by')->nullable();
            $table->timestamp('acknowledged_at')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->json('metadata')->nullable(); // store additional data
            $table->timestamps();
            
            $table->index(['alert_type', 'status']);
            $table->index(['severity', 'created_at']);
            $table->foreign('created_by')->references('user_id')->on('users')->onDelete('set null');
            $table->foreign('acknowledged_by')->references('user_id')->on('users')->onDelete('set null');
            $table->foreign('resolved_by')->references('user_id')->on('users')->onDelete('set null');
        });

        // Create alert escalation rules
        Schema::create('alert_escalation_rules', function (Blueprint $table) {
            $table->id('rule_id');
            $table->string('alert_type', 50);
            $table->enum('severity', ['critical', 'warning', 'info']);
            $table->integer('escalation_minutes'); // minutes before escalation
            $table->json('escalation_roles'); // roles to escalate to
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            
            $table->index(['alert_type', 'severity']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('alert_escalation_rules');
        Schema::dropIfExists('alert_history');
        Schema::dropIfExists('user_alert_settings');
        
        Schema::table('expiry_alerts', function (Blueprint $table) {
            $table->dropColumn(['escalated_at', 'escalation_level', 'escalation_notes']);
        });
        
        Schema::table('categories', function (Blueprint $table) {
            $table->dropColumn(['default_reorder_level', 'default_expiry_warning_days']);
        });
    }
};