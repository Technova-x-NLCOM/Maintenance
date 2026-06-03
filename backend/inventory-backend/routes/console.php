<?php

use App\Mail\DistributionPlanAllocatedMail;
use App\Mail\DistributionPlanShortfallMail;
use App\Services\DistributionPlanService;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

$resolveExpiryAlertDays = function ($inputDays = null): int {
    $alertDaysFromSettings = DB::table('system_settings')
        ->where('setting_key', 'expiry_alert_days')
        ->value('setting_value');

    $days = (int) ($inputDays ?? $alertDaysFromSettings ?? 30);
    return $days > 0 ? $days : 30;
};

$fetchNearExpiryItems = function (int $days) {
    $today = now()->startOfDay();
    $lastDay = now()->copy()->addDays($days)->endOfDay();

    return DB::table('inventory_batches as ib')
        ->join('items as i', 'ib.item_id', '=', 'i.item_id')
        ->where('ib.status', 'active')
        ->where('i.is_active', true)
        ->where('ib.quantity', '>', 0)
        ->whereNotNull('ib.expiry_date')
        ->whereBetween('ib.expiry_date', [$today, $lastDay])
        ->orderBy('ib.expiry_date', 'asc')
        ->orderBy('i.item_description', 'asc')
        ->select(
            'ib.batch_id',
            'i.item_description',
            'ib.batch_number',
            'ib.expiry_date',
            DB::raw('DATEDIFF(ib.expiry_date, CURDATE()) as days_until_expiry')
        )
        ->get();
};

$fetchExpiredItems = function () {
    $today = now()->startOfDay();

    return DB::table('inventory_batches as ib')
        ->join('items as i', 'ib.item_id', '=', 'i.item_id')
        ->where('ib.status', 'active')
        ->where('i.is_active', true)
        ->where('ib.quantity', '>', 0)
        ->whereNotNull('ib.expiry_date')
        ->where('ib.expiry_date', '<', $today)
        ->orderBy('ib.expiry_date', 'asc')
        ->orderBy('i.item_description', 'asc')
        ->select(
            'ib.batch_id',
            'i.item_description',
            'ib.batch_number',
            'ib.expiry_date',
            DB::raw('DATEDIFF(ib.expiry_date, CURDATE()) as days_until_expiry')
        )
        ->get();
};

$resolveExpiryEmailRecipients = function ($cliRecipients = []) {
    $recipients = collect($cliRecipients ?? [])
        ->map(fn ($email) => trim((string) $email))
        ->filter()
        ->values();

    if ($recipients->isEmpty()) {
        $settingRecipients = DB::table('system_settings')
            ->where('setting_key', 'expiry_email_recipients')
            ->value('setting_value');

        if (is_string($settingRecipients) && trim($settingRecipients) !== '') {
            $recipients = collect(preg_split('/[;,]+/', $settingRecipients))
                ->map(fn ($email) => trim((string) $email))
                ->filter()
                ->values();
        }
    }

    if ($recipients->isEmpty()) {
        $recipients = DB::table('users as u')
            ->join('user_roles as ur', 'u.user_id', '=', 'ur.user_id')
            ->join('roles as r', 'ur.role_id', '=', 'r.role_id')
            ->where('u.is_active', true)
            ->whereIn('r.role_name', ['super_admin', 'inventory_manager'])
            ->distinct()
            ->pluck('u.email');
    }

    return $recipients;
};

Artisan::command('alerts:check-expiry {--days=} {--notify} {--to=*} {--dry-run}', function () use ($resolveExpiryAlertDays, $fetchNearExpiryItems, $fetchExpiredItems, $resolveExpiryEmailRecipients) {
    $days = $resolveExpiryAlertDays($this->option('days'));
    $nearExpiryItems = $fetchNearExpiryItems($days);
    $expiredItems = $fetchExpiredItems();
    $nearBatchIds = $nearExpiryItems->pluck('batch_id')->values();

    $pendingQuery = DB::table('expiry_alerts')->where('status', 'pending');

    if ($nearBatchIds->isEmpty()) {
        $resolvedCount = (clone $pendingQuery)->update(['status' => 'resolved']);
    } else {
        $resolvedCount = (clone $pendingQuery)
            ->whereNotIn('batch_id', $nearBatchIds->all())
            ->update(['status' => 'resolved']);
    }

    $existingPendingBatchIds = DB::table('expiry_alerts')
        ->where('status', 'pending')
        ->pluck('batch_id')
        ->map(fn ($id) => (int) $id)
        ->values();

    $rowsToInsert = [];
    $now = now();
    $todayDate = $now->toDateString();

    foreach ($nearExpiryItems as $item) {
        $batchId = (int) $item->batch_id;
        if (!$existingPendingBatchIds->contains($batchId)) {
            $rowsToInsert[] = [
                'batch_id' => $batchId,
                'alert_date' => $todayDate,
                'days_until_expiry' => (int) $item->days_until_expiry,
                'status' => 'pending',
                'created_at' => $now,
            ];
        }

        DB::table('expiry_alerts')
            ->where('batch_id', $batchId)
            ->where('status', 'pending')
            ->update([
                'days_until_expiry' => (int) $item->days_until_expiry,
                'alert_date' => $todayDate,
            ]);
    }

    $insertedCount = count($rowsToInsert);
    if ($insertedCount > 0 && !$this->option('dry-run')) {
        DB::table('expiry_alerts')->insert($rowsToInsert);
    }

    if ($this->option('dry-run')) {
        $this->info('Dry run complete. No database writes or emails sent.');
        $this->line('Near-expiry items found: ' . $nearExpiryItems->count());
        $this->line('Expired items found: ' . $expiredItems->count());
        $this->line('Would resolve alerts: ' . $resolvedCount);
        $this->line('Would insert alerts: ' . $insertedCount);
        return self::SUCCESS;
    }

    $this->info('Expiry checker completed.');
    $this->line('Near-expiry items found: ' . $nearExpiryItems->count());
    $this->line('Expired items found: ' . $expiredItems->count());
    $this->line('Resolved alerts: ' . $resolvedCount);
    $this->line('Inserted alerts: ' . $insertedCount);

    if ($this->option('notify') && ($nearExpiryItems->isNotEmpty() || $expiredItems->isNotEmpty())) {
        $recipients = $resolveExpiryEmailRecipients($this->option('to') ?? []);
        if ($recipients->isEmpty()) {
            $this->error('Checker ran, but no recipients were found for email notification.');
            return self::FAILURE;
        }

        Mail::to($recipients->all())->send(new \App\Mail\NearExpiryItemsMail(
            $nearExpiryItems,
            $expiredItems,
            $days,
            now()->format('Y-m-d H:i:s')
        ));

        $this->line('Notification email sent to: ' . $recipients->implode(', '));
    }

    return self::SUCCESS;
})
    ->purpose('Automated expiry checker that updates expiry_alerts and optionally notifies users')
    ->dailyAt('08:00');

Artisan::command('alerts:send-expiry-email {--days=} {--to=*} {--dry-run}', function () use ($resolveExpiryAlertDays, $fetchNearExpiryItems, $fetchExpiredItems, $resolveExpiryEmailRecipients) {
    $days = $resolveExpiryAlertDays($this->option('days'));
    $nearExpiryItems = $fetchNearExpiryItems($days);
    $expiredItems = $fetchExpiredItems();

    if ($nearExpiryItems->isEmpty() && $expiredItems->isEmpty()) {
        $this->info('No near-expiry or expired items found. No email sent.');
        return self::SUCCESS;
    }

    $recipients = $resolveExpiryEmailRecipients($this->option('to') ?? []);

    if ($recipients->isEmpty()) {
        $this->error('No recipients found for expiry alert email.');
        return self::FAILURE;
    }

    if ($this->option('dry-run')) {
        $this->info('Dry run complete. Email not sent.');
        $this->line('Recipients: ' . $recipients->implode(', '));
        $this->line('Near-expiry items found: ' . $nearExpiryItems->count());
        $this->line('Expired items found: ' . $expiredItems->count());
        return self::SUCCESS;
    }

    Mail::to($recipients->all())->send(new \App\Mail\NearExpiryItemsMail(
        $nearExpiryItems,
        $expiredItems,
        $days,
        now()->format('Y-m-d H:i:s')
    ));

    $this->info('Near-expiry email sent successfully.');
    $this->line('Recipients: ' . $recipients->implode(', '));
    $this->line('Near-expiry items included: ' . $nearExpiryItems->count());
    $this->line('Expired items included: ' . $expiredItems->count());

    return self::SUCCESS;
})
    ->purpose('Send an email list of active items that are near expiry, ordered by nearest expiry date first')
    ->dailyAt('08:00');

// ─────────────────────────────────────────────────────────────────────────────
// Auto-allocate scheduled distribution plans
// Runs daily at 00:01. For each plan where:
//   status = 'planned', planned_date = today
// → if all stock is sufficient: issue FEFO, set status = 'ready', email admin
// → if stock is short: leave status = 'planned', email admin with shortfall list
// ─────────────────────────────────────────────────────────────────────────────
Artisan::command('schedule:auto-allocate-plans {--dry-run}', function () {

    /** @var DistributionPlanService $planService */
    $planService = app(DistributionPlanService::class);
    $isDryRun    = (bool) $this->option('dry-run');
    $today       = now()->toDateString();

    // Resolve admin recipients from users table
    $recipients = DB::table('users as u')
        ->join('user_roles as ur', 'u.user_id', '=', 'ur.user_id')
        ->join('roles as r', 'ur.role_id', '=', 'r.role_id')
        ->where('u.is_active', true)
        ->whereIn('r.role_name', ['super_admin', 'inventory_manager'])
        ->distinct()
        ->pluck('u.email')
        ->filter()
        ->values()
        ->all();

    // Fallback to system setting if no users found
    if (empty($recipients)) {
        $settingRecipients = DB::table('system_settings')
            ->where('setting_key', 'expiry_email_recipients')
            ->value('setting_value');

        if (is_string($settingRecipients) && trim($settingRecipients) !== '') {
            $recipients = collect(preg_split('/[;,]+/', $settingRecipients))
                ->map(fn ($e) => trim((string) $e))
                ->filter()
                ->values()
                ->all();
        }
    }

    // Fetch all plans due today that are still in 'planned' status
    $query = DB::table('distribution_plan_schedules as dps')
        ->join('distribution_templates as dt', 'dps.template_id', '=', 'dt.template_id')
        ->leftJoin('locations as pl', 'dps.preferred_location_id', '=', 'pl.location_id')
        ->whereDate('dps.planned_date', $today)
        ->where('dps.status', 'planned')
        ->select(
            'dps.plan_id', 'dps.template_id', 'dps.week_label',
            'dps.planned_date', 'dps.target_unit_count', 'dps.status',
            'dps.notes', 'dps.precheck_at', 'dps.final_check_at',
            'dps.completed_at', 'dps.created_at', 'dps.updated_at',
            'dt.template_name', 'dt.distribution_type', 'dt.base_unit_count'
        );

    if (Schema::hasColumn('distribution_plan_schedules', 'preferred_location_id')) {
        $query->addSelect(
            'dps.preferred_location_id',
            'pl.location_name as preferred_location_name',
            'pl.location_code as preferred_location_code'
        );
    }

    if (Schema::hasColumn('distribution_plan_schedules', 'completed_reference')) {
        $query->addSelect(
            'dps.completed_reference', 'dps.completed_issued_qty',
            'dps.completed_target_people', 'dps.completed_notes'
        );
    }

    if (Schema::hasColumn('distribution_plan_schedules', 'is_deleted')) {
        $query->where('dps.is_deleted', false);
    }

    $plans = $query->get();

    if ($plans->isEmpty()) {
        $this->info("No plans due today ({$today}) with status 'planned'. Nothing to do.");
        return self::SUCCESS;
    }

    $this->info("Found {$plans->count()} plan(s) due today. Processing...");

    $allocated = 0;
    $shortfalls = 0;
    $generatedAt = now()->format('Y-m-d H:i:s');

    foreach ($plans as $plan) {
        $checkData = $planService->buildInventoryCheckData($plan);

        if ($checkData['summary']['can_proceed']) {
            // ── Sufficient stock — auto-allocate ──────────────────────────
            if ($isDryRun) {
                $this->line("[DRY RUN] Would auto-allocate: {$plan->week_label} (Plan #{$plan->plan_id})");
                $allocated++;
                continue;
            }

            try {
                $issuanceSummary = null;

                DB::transaction(function () use ($plan, $checkData, $planService, &$issuanceSummary) {
                    $issuanceSummary = $planService->issuePlanItems(
                        $plan,
                        $checkData,
                        0, // system user — 0 means automated
                        'Auto-allocated for ' . $plan->week_label,
                        'Auto-allocation',
                        null,
                        'AUTO'
                    );

                    $updateData = [
                        'status'     => 'ready',
                        'final_check_at' => now(),
                        'updated_at' => now(),
                    ];

                    if (Schema::hasColumn('distribution_plan_schedules', 'auto_allocated_at')) {
                        $updateData['auto_allocated_at']  = now();
                        $updateData['auto_allocation_ref'] = $issuanceSummary['reference_number'];
                    }

                    DB::table('distribution_plan_schedules')
                        ->where('plan_id', $plan->plan_id)
                        ->update($updateData);
                });

                $this->info("✓ Auto-allocated: {$plan->week_label} → Ref: {$issuanceSummary['reference_number']}");
                $allocated++;

                // Send success email
                if (!empty($recipients) && $issuanceSummary !== null) {
                    Mail::to($recipients)->send(
                        new DistributionPlanAllocatedMail($plan, $issuanceSummary, $generatedAt)
                    );
                }
            } catch (\Throwable $e) {
                $this->error("✗ Failed to auto-allocate plan #{$plan->plan_id} ({$plan->week_label}): " . $e->getMessage());
            }
        } else {
            // ── Insufficient stock — notify admin ────────────────────────
            $shortfallItems = collect($checkData['items'])
                ->filter(fn ($item) => $item['has_shortage'])
                ->values()
                ->all();

            if ($isDryRun) {
                $this->warn("[DRY RUN] Shortfall for: {$plan->week_label} (Plan #{$plan->plan_id}) — " . count($shortfallItems) . ' items short');
                $shortfalls++;
                continue;
            }

            $this->warn("⚠ Shortfall: {$plan->week_label} — " . count($shortfallItems) . ' ingredient(s) below required stock.');
            $shortfalls++;

            if (!empty($recipients)) {
                Mail::to($recipients)->send(
                    new DistributionPlanShortfallMail($plan, $checkData['items'], $generatedAt)
                );
            }
        }
    }

    $this->line('');
    $this->info("Done. Allocated: {$allocated} | Shortfalls notified: {$shortfalls}");

    return self::SUCCESS;
})
    ->purpose('Auto-allocate stock for scheduled distribution plans due today. Emails admin on success or shortfall.')
    ->dailyAt('00:01');
