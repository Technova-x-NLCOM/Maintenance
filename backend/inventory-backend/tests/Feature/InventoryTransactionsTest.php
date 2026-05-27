<?php

use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

it('creates a receiving transaction for a privileged user', function () {
    if (!Schema::hasTable('items') || !Schema::hasTable('inventory_batches') || !Schema::hasTable('inventory_transactions')) {
        $this->markTestSkipped('Inventory tables are not available in this test schema.');
    }

    $user = User::create([
        'username' => 'recv_admin_' . uniqid(),
        'email' => uniqid('recv_') . '@example.com',
        'password_hash' => bcrypt('Password@123'),
        'first_name' => 'Recv',
        'last_name' => 'Admin',
        'is_active' => true,
    ]);

    $super = Role::firstOrCreate(
        ['role_name' => 'super_admin'],
        ['display_name' => 'Super Administrator']
    );
    $user->roles()->syncWithoutDetaching([$super->role_id => ['is_primary' => true]]);

    $locationId = null;
    if (Schema::hasColumn('inventory_batches', 'location_id')) {
        if (!Schema::hasTable('locations')) {
            $this->markTestSkipped('inventory_batches.location_id exists but locations table is missing in this test schema.');
        }

        $locationId = DB::table('locations')->insertGetId([
            'location_code' => 'LOC-REC-' . strtoupper(substr((string) uniqid(), -6)),
            'location_name' => 'Receiving Bay',
            'location_type' => 'warehouse',
            'description' => 'Receiving test location',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ], 'location_id');
    }

    $itemId = DB::table('items')->insertGetId([
        'item_code' => 'REC-' . strtoupper(substr((string) uniqid(), -6)),
        'item_description' => 'Receiving Test Item',
        'category_id' => null,
        'measurement_unit' => 'pcs',
        'is_active' => true,
        'created_at' => now(),
        'updated_at' => now(),
    ], 'item_id');

    $payload = [
        'item_id' => $itemId,
        'quantity' => 10,
        'batch_number' => 'BATCH-REC-' . strtoupper(substr((string) uniqid(), -5)),
        'purchase_date' => now()->toDateString(),
        'reason' => 'Feature test receiving',
        'notes' => 'Created by feature test',
    ];

    if ($locationId !== null) {
        $payload['location_id'] = $locationId;
    }

    $this->actingAs($user, 'api')
        ->postJson('/api/inventory/receiving/create', $payload)
        ->assertStatus(201)
        ->assertJsonPath('success', true);

    $this->assertDatabaseHas('inventory_batches', [
        'item_id' => $itemId,
        'batch_number' => $payload['batch_number'],
        'quantity' => 10,
        'status' => 'active',
    ]);

    $this->assertDatabaseHas('inventory_transactions', [
        'item_id' => $itemId,
        'transaction_type' => 'IN',
        'quantity' => 10,
        'performed_by' => $user->user_id,
    ]);
});

it('creates an issuance transaction for a privileged user when stock is available', function () {
    if (!Schema::hasTable('items') || !Schema::hasTable('inventory_batches') || !Schema::hasTable('inventory_transactions')) {
        $this->markTestSkipped('Inventory tables are not available in this test schema.');
    }

    $user = User::create([
        'username' => 'iss_admin_' . uniqid(),
        'email' => uniqid('iss_') . '@example.com',
        'password_hash' => bcrypt('Password@123'),
        'first_name' => 'Iss',
        'last_name' => 'Admin',
        'is_active' => true,
    ]);

    $super = Role::firstOrCreate(
        ['role_name' => 'super_admin'],
        ['display_name' => 'Super Administrator']
    );
    $user->roles()->syncWithoutDetaching([$super->role_id => ['is_primary' => true]]);

    $sourceLocationId = null;
    $destinationLocationId = null;
    $needsLocationTable = Schema::hasColumn('inventory_batches', 'location_id')
        || Schema::hasColumn('inventory_transactions', 'from_location_id')
        || Schema::hasColumn('inventory_transactions', 'to_location_id');

    if ($needsLocationTable) {
        if (!Schema::hasTable('locations')) {
            $this->markTestSkipped('Location columns exist but locations table is missing in this test schema.');
        }

        $sourceLocationId = DB::table('locations')->insertGetId([
            'location_code' => 'LOC-SRC-' . strtoupper(substr((string) uniqid(), -6)),
            'location_name' => 'Source Warehouse',
            'location_type' => 'warehouse',
            'description' => 'Source test location',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ], 'location_id');

        $destinationLocationId = DB::table('locations')->insertGetId([
            'location_code' => 'LOC-DST-' . strtoupper(substr((string) uniqid(), -6)),
            'location_name' => 'Destination Warehouse',
            'location_type' => 'warehouse',
            'description' => 'Destination test location',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ], 'location_id');
    }

    $itemId = DB::table('items')->insertGetId([
        'item_code' => 'ISS-' . strtoupper(substr((string) uniqid(), -6)),
        'item_description' => 'Issuance Test Item',
        'category_id' => null,
        'measurement_unit' => 'pcs',
        'is_active' => true,
        'created_at' => now(),
        'updated_at' => now(),
    ], 'item_id');

    $batchInsert = [
        'item_id' => $itemId,
        'batch_number' => 'BATCH-ISS-' . strtoupper(substr((string) uniqid(), -5)),
        'quantity' => 20,
        'status' => 'active',
        'created_at' => now(),
        'updated_at' => now(),
    ];

    if (Schema::hasColumn('inventory_batches', 'location_id') && $sourceLocationId !== null) {
        $batchInsert['location_id'] = $sourceLocationId;
    }

    $batchId = DB::table('inventory_batches')->insertGetId($batchInsert, 'batch_id');

    $payload = [
        'destination' => 'Community Center',
        'reason' => 'Feature test issuance',
        'notes' => 'Created by feature test',
        'items' => [
            [
                'item_id' => $itemId,
                'quantity' => 5,
            ],
        ],
    ];

    if ($sourceLocationId !== null) {
        $payload['from_location_id'] = $sourceLocationId;
    }
    if ($destinationLocationId !== null) {
        $payload['to_location_id'] = $destinationLocationId;
    }

    $this->actingAs($user, 'api')
        ->postJson('/api/inventory/issuance/create', $payload)
        ->assertStatus(201)
        ->assertJsonPath('success', true);

    $this->assertDatabaseHas('inventory_transactions', [
        'item_id' => $itemId,
        'batch_id' => $batchId,
        'transaction_type' => 'OUT',
        'quantity' => 5,
        'performed_by' => $user->user_id,
    ]);

    expect((int) DB::table('inventory_batches')->where('batch_id', $batchId)->value('quantity'))
        ->toBe(15);
});
