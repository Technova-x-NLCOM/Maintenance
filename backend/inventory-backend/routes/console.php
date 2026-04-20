<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('alerts:send-expiry-email {--days=} {--to=*} {--dry-run}', function () {
    $alertDaysFromSettings = DB::table('system_settings')
        ->where('setting_key', 'expiry_alert_days')
        ->value('setting_value');

    $days = (int) ($this->option('days') ?? $alertDaysFromSettings ?? 30);
    if ($days <= 0) {
        $days = 30;
    }

    $today = now()->startOfDay();
    $lastDay = now()->addDays($days)->endOfDay();

    $nearExpiryItems = DB::table('inventory_batches as ib')
        ->join('items as i', 'ib.item_id', '=', 'i.item_id')
        ->where('ib.status', 'active')
        ->where('i.is_active', true)
        ->where('ib.quantity', '>', 0)
        ->whereNotNull('ib.expiry_date')
        ->whereBetween('ib.expiry_date', [$today, $lastDay])
        ->orderBy('ib.expiry_date', 'asc')
        ->orderBy('i.item_description', 'asc')
        ->select(
            'i.item_description',
            'ib.batch_number',
            'ib.expiry_date',
            DB::raw('DATEDIFF(ib.expiry_date, CURDATE()) as days_until_expiry')
        )
        ->get();

    if ($nearExpiryItems->isEmpty()) {
        $this->info('No near-expiry items found. No email sent.');
        return self::SUCCESS;
    }

    $cliRecipients = collect($this->option('to') ?? [])
        ->map(fn ($email) => trim((string) $email))
        ->filter()
        ->values();

    $recipients = $cliRecipients;

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

    if ($recipients->isEmpty()) {
        $this->error('No recipients found for expiry alert email.');
        return self::FAILURE;
    }

    if ($this->option('dry-run')) {
        $this->info('Dry run complete. Email not sent.');
        $this->line('Recipients: ' . $recipients->implode(', '));
        $this->line('Items found: ' . $nearExpiryItems->count());
        return self::SUCCESS;
    }

    Mail::to($recipients->all())->send(new \App\Mail\NearExpiryItemsMail(
        $nearExpiryItems,
        $days,
        now()->format('Y-m-d H:i:s')
    ));

    $this->info('Near-expiry email sent successfully.');
    $this->line('Recipients: ' . $recipients->implode(', '));
    $this->line('Items included: ' . $nearExpiryItems->count());

    return self::SUCCESS;
})
    ->purpose('Send an email list of active items that are near expiry, ordered by nearest expiry date first')
    ->dailyAt('08:00');
