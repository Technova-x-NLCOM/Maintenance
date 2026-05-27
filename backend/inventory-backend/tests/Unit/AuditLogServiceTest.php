<?php

use App\Services\AuditLogService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AuditLogTableStub
{
    public array $inserted = [];

    public function insert(array $data): bool
    {
        $this->inserted[] = $data;

        return true;
    }
}

it('normalizes invalid audit actions before writing the log', function () {
    $table = new AuditLogTableStub();

    DB::shouldReceive('table')
        ->once()
        ->with('audit_log')
        ->andReturn($table);

    $request = Request::create('/audit-log', 'POST', [], [], [], [
        'REMOTE_ADDR' => '127.0.0.1',
    ]);

    AuditLogService::log(
        'users',
        15,
        'DROP',
        ['old' => 'value'],
        ['new' => 'value'],
        $request,
        99
    );

    expect($table->inserted)->toHaveCount(1)
        ->and($table->inserted[0]['table_name'])->toBe('users')
        ->and($table->inserted[0]['record_id'])->toBe(15)
        ->and($table->inserted[0]['action'])->toBe('UPDATE')
        ->and($table->inserted[0]['old_values'])->toBe(json_encode(['old' => 'value'], JSON_UNESCAPED_UNICODE))
        ->and($table->inserted[0]['new_values'])->toBe(json_encode(['new' => 'value'], JSON_UNESCAPED_UNICODE))
        ->and($table->inserted[0]['performed_by'])->toBe(99)
        ->and($table->inserted[0]['ip_address'])->toBe('127.0.0.1');
});

it('preserves valid audit actions when writing the log', function () {
    $table = new AuditLogTableStub();

    DB::shouldReceive('table')
        ->once()
        ->with('audit_log')
        ->andReturn($table);

    $request = Request::create('/audit-log', 'POST', [], [], [], [
        'REMOTE_ADDR' => '10.0.0.2',
    ]);

    AuditLogService::log(
        'items',
        42,
        'INSERT',
        null,
        ['sku' => 'X123'],
        $request,
        7
    );

    expect($table->inserted)->toHaveCount(1)
        ->and($table->inserted[0]['table_name'])->toBe('items')
        ->and($table->inserted[0]['record_id'])->toBe(42)
        ->and($table->inserted[0]['action'])->toBe('INSERT')
        ->and($table->inserted[0]['old_values'])->toBeNull()
        ->and($table->inserted[0]['new_values'])->toBe(json_encode(['sku' => 'X123'], JSON_UNESCAPED_UNICODE))
        ->and($table->inserted[0]['performed_by'])->toBe(7)
        ->and($table->inserted[0]['ip_address'])->toBe('10.0.0.2');
});