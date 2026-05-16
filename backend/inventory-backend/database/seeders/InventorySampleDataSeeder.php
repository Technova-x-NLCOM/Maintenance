<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class InventorySampleDataSeeder extends Seeder
{
    /**
     * Seed sample inventory data aligned with provided DML script.
     */
    public function run(): void
    {
        $now = now();

        $userIds = DB::table('users')
            ->whereIn('username', ['superadmin', 'inventory_manager'])
            ->pluck('user_id', 'username');

        $adminId = $userIds['superadmin'] ?? null;
        $inventoryManagerId = $userIds['inventory_manager'] ?? $adminId;

        $categories = DB::table('categories')->pluck('category_id', 'category_name');
        $itemTypes = DB::table('item_types')->pluck('item_type_id', 'type_name');
        $locations = DB::table('locations')->pluck('location_id', 'location_code');

        $items = [
            [
                'item_code' => 'MED-0001',
                'item_description' => 'Paracetamol 500mg Tablet',
                'type_name' => 'medicine',
                'category_name' => 'Medical Supplies',
                'measurement_unit' => 'box',
                'unit_value' => 120.00,
                'reorder_level' => 50,
                'created_at' => '2026-01-10 09:00:00',
            ],
            [
                'item_code' => 'SAF-0001',
                'item_description' => 'N95 Respirator Mask',
                'type_name' => 'emergency_safety',
                'category_name' => 'Emergency Equipment',
                'measurement_unit' => 'box',
                'unit_value' => 450.00,
                'reorder_level' => 100,
                'created_at' => '2026-01-11 10:30:00',
            ],
            [
                'item_code' => 'FOOD-0001',
                'item_description' => 'Rice 50kg Sack',
                'type_name' => 'consumable',
                'category_name' => 'Food Ingredients',
                'measurement_unit' => 'sack',
                'unit_value' => 1800.00,
                'reorder_level' => 20,
                'created_at' => '2026-01-11 11:00:00',
            ],
        ];

        foreach ($items as $item) {
            DB::table('items')->updateOrInsert(
                ['item_code' => $item['item_code']],
                [
                    'item_description' => $item['item_description'],
                    'item_type_id' => $itemTypes[$item['type_name']] ?? null,
                    'category_id' => $categories[$item['category_name']] ?? null,
                    'measurement_unit' => $item['measurement_unit'],
                    'unit_value' => $item['unit_value'],
                    'reorder_level' => $item['reorder_level'],
                    'is_active' => true,
                    'created_by' => $adminId,
                    'created_at' => $item['created_at'],
                    'updated_at' => $now,
                ]
            );
        }

        $itemIds = DB::table('items')
            ->whereIn('item_code', ['MED-0001', 'SAF-0001', 'FOOD-0001'])
            ->pluck('item_id', 'item_code');

        $batches = [
            [
                'item_code' => 'MED-0001',
                'batch_number' => 'MED-BATCH-2026-01',
                'quantity' => 500,
                'expiry_date' => '2026-06-30',
                'supplier_info' => 'ABC Pharma',
                'batch_value' => 60000.00,
                'status' => 'active',
                'location_code' => 'LOCATION-001',
                'created_at' => '2026-01-10 09:00:00',
            ],
            [
                'item_code' => 'SAF-0001',
                'batch_number' => 'SAF-BATCH-2026-02',
                'quantity' => 300,
                'expiry_date' => '2027-01-31',
                'supplier_info' => 'SafeCo Supplies',
                'batch_value' => 135000.00,
                'status' => 'active',
                'location_code' => 'LOCATION-002',
                'created_at' => '2026-01-11 10:30:00',
            ],
            [
                'item_code' => 'FOOD-0001',
                'batch_number' => 'FOOD-BATCH-2026-03',
                'quantity' => 40,
                'expiry_date' => '2026-02-15',
                'supplier_info' => 'AgriCorp',
                'batch_value' => 72000.00,
                'status' => 'active',
                'location_code' => 'LOCATION-003',
                'created_at' => '2026-01-11 11:00:00',
            ],
        ];

        foreach ($batches as $batch) {
            $itemId = $itemIds[$batch['item_code']] ?? null;
            if (!$itemId) {
                continue;
            }

            DB::table('inventory_batches')->updateOrInsert(
                [
                    'item_id' => $itemId,
                    'batch_number' => $batch['batch_number'],
                ],
                [
                    'location_id' => $locations[$batch['location_code']] ?? null,
                    'quantity' => $batch['quantity'],
                    'expiry_date' => $batch['expiry_date'],
                    'manufactured_date' => null,
                    'supplier_info' => $batch['supplier_info'],
                    'batch_value' => $batch['batch_value'],
                    'status' => $batch['status'],
                    'created_at' => $batch['created_at'],
                    'updated_at' => $now,
                ]
            );
        }

        $batchIds = DB::table('inventory_batches')
            ->whereIn('batch_number', ['MED-BATCH-2026-01', 'SAF-BATCH-2026-02', 'FOOD-BATCH-2026-03'])
            ->pluck('batch_id', 'batch_number');

        $transactions = [
            [
                'item_code' => 'MED-0001',
                'batch_number' => 'MED-BATCH-2026-01',
                'transaction_type' => 'IN',
                'quantity' => 500,
                'reference_number' => 'PO-2026-001',
                'transaction_date' => '2026-01-10 09:00:00',
                'reason' => 'Replenishment',
                'destination' => 'Central Warehouse',
                'to_location_code' => 'LOCATION-001',
                'performed_by' => $adminId,
                'approved_by' => $adminId,
            ],
            [
                'item_code' => 'SAF-0001',
                'batch_number' => 'SAF-BATCH-2026-02',
                'transaction_type' => 'OUT',
                'quantity' => 50,
                'reference_number' => 'REL-2026-015',
                'transaction_date' => '2026-01-11 10:30:00',
                'reason' => 'Distribution',
                'destination' => 'Typhoon Response Team',
                'from_location_code' => 'LOCATION-002',
                'performed_by' => $inventoryManagerId,
                'approved_by' => $adminId,
            ],
            [
                'item_code' => 'FOOD-0001',
                'batch_number' => 'FOOD-BATCH-2026-03',
                'transaction_type' => 'OUT',
                'quantity' => 5,
                'reference_number' => 'REL-2026-016',
                'transaction_date' => '2026-01-11 11:00:00',
                'reason' => 'Distribution',
                'destination' => 'Mobile Kitchen',
                'from_location_code' => 'LOCATION-003',
                'performed_by' => $inventoryManagerId,
                'approved_by' => $adminId,
            ],
        ];

        foreach ($transactions as $tx) {
            $itemId = $itemIds[$tx['item_code']] ?? null;
            $batchId = $batchIds[$tx['batch_number']] ?? null;
            if (!$itemId) {
                continue;
            }

            $fromLocationCode = $tx['from_location_code'] ?? null;
            $toLocationCode = $tx['to_location_code'] ?? null;

            DB::table('inventory_transactions')->updateOrInsert(
                [
                    'reference_number' => $tx['reference_number'],
                    'transaction_type' => $tx['transaction_type'],
                    'item_id' => $itemId,
                ],
                [
                    'batch_id' => $batchId,
                    'from_location_id' => $fromLocationCode ? ($locations[$fromLocationCode] ?? null) : null,
                    'to_location_id' => $toLocationCode ? ($locations[$toLocationCode] ?? null) : null,
                    'quantity' => $tx['quantity'],
                    'transaction_date' => $tx['transaction_date'],
                    'reason' => $tx['reason'],
                    'notes' => null,
                    'destination' => $tx['destination'],
                    'performed_by' => $tx['performed_by'],
                    'approved_by' => $tx['approved_by'],
                    'created_at' => $tx['transaction_date'],
                ]
            );
        }

        $snapshots = [
            [
                'item_code' => 'MED-0001',
                'batch_number' => 'MED-BATCH-2026-01',
                'snapshot_date' => '2026-01-10',
                'quantity' => 500,
                'total_value' => 60000.00,
                'notes' => 'Initial receipt',
                'created_by' => $adminId,
            ],
            [
                'item_code' => 'SAF-0001',
                'batch_number' => 'SAF-BATCH-2026-02',
                'snapshot_date' => '2026-01-11',
                'quantity' => 250,
                'total_value' => 112500.00,
                'notes' => 'Post distribution',
                'created_by' => $inventoryManagerId,
            ],
            [
                'item_code' => 'FOOD-0001',
                'batch_number' => 'FOOD-BATCH-2026-03',
                'snapshot_date' => '2026-01-11',
                'quantity' => 35,
                'total_value' => 63000.00,
                'notes' => 'Post distribution',
                'created_by' => $inventoryManagerId,
            ],
        ];

        foreach ($snapshots as $snap) {
            $itemId = $itemIds[$snap['item_code']] ?? null;
            $batchId = $batchIds[$snap['batch_number']] ?? null;
            if (!$itemId) {
                continue;
            }

            DB::table('inventory_snapshots')->updateOrInsert(
                [
                    'item_id' => $itemId,
                    'batch_id' => $batchId,
                    'snapshot_date' => $snap['snapshot_date'],
                ],
                [
                    'quantity' => $snap['quantity'],
                    'total_value' => $snap['total_value'],
                    'notes' => $snap['notes'],
                    'created_by' => $snap['created_by'],
                    'created_at' => $snap['snapshot_date'],
                ]
            );
        }

        $alertDate = now()->toDateString();
        $alerts = [
            [
                'batch_number' => 'FOOD-BATCH-2026-03',
                'alert_date' => $alertDate,
                'days_until_expiry' => 30,
                'status' => 'pending',
                'acknowledged_by' => null,
            ],
        ];

        foreach ($alerts as $alert) {
            $batchId = $batchIds[$alert['batch_number']] ?? null;
            if (!$batchId) {
                continue;
            }

            DB::table('expiry_alerts')->updateOrInsert(
                [
                    'batch_id' => $batchId,
                    'alert_date' => $alert['alert_date'],
                ],
                [
                    'days_until_expiry' => $alert['days_until_expiry'],
                    'status' => $alert['status'],
                    'acknowledged_by' => $alert['acknowledged_by'],
                    'acknowledged_at' => null,
                    'created_at' => $alert['alert_date'],
                ]
            );
        }

        $auditBatchId = $batchIds['FOOD-BATCH-2026-03'] ?? null;
        if ($auditBatchId) {
            DB::table('audit_log')->updateOrInsert(
                ['log_id' => 1],
                [
                    'table_name' => 'inventory_batches',
                    'record_id' => $auditBatchId,
                    'action' => 'UPDATE',
                    'old_values' => null,
                    'new_values' => json_encode(['quantity' => 35]),
                    'performed_by' => $inventoryManagerId,
                    'ip_address' => '192.168.1.10',
                    'created_at' => $now,
                ]
            );
        }
    }
}
