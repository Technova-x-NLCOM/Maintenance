<?php

use App\Services\DashboardTrendService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;

beforeEach(function () {
    Schema::dropIfExists('items');
    Schema::create('items', function (Blueprint $table) {
        $table->id('item_id');
        $table->timestamp('created_at')->nullable();
    });

    $previousMonth = now()->copy()->subMonth()->startOfMonth()->addDays(3);
    $currentMonth = now()->copy()->startOfMonth()->addDays(2);

    DB::table('items')->insert([
        ['created_at' => $previousMonth],
        ['created_at' => $previousMonth],
        ['created_at' => $currentMonth],
    ]);
});

it('counts current and previous month records', function () {
    $service = new DashboardTrendService();

    $result = $service->monthOverMonthCount('items', 'created_at');

    expect($result['previous'])->toBe(2);
    expect($result['current'])->toBe(1);
});
