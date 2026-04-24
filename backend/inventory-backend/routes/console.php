<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;

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
