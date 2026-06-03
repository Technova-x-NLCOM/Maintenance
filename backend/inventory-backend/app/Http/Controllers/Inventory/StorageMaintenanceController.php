<?php

namespace App\Http\Controllers\Inventory;

use App\Http\Controllers\Controller;
use App\Services\AuditLogService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class StorageMaintenanceController extends Controller
{
    // ─────────────────────────────────────────────────────────────────────────
    // LIST
    // ─────────────────────────────────────────────────────────────────────────
    public function index(Request $request)
    {
        $perPage = min((int) $request->input('per_page', 20), 100);

        $query = DB::table('storage_maintenance as sm')
            ->join('locations as l',  'sm.location_id',      '=', 'l.location_id')
            ->join('locations as tl', 'sm.temp_location_id', '=', 'tl.location_id')
            ->leftJoin('users as u',  'sm.performed_by',     '=', 'u.user_id')
            ->select(
                'sm.maintenance_id',
                'sm.title',
                'sm.reason',
                'sm.status',
                'sm.scheduled_start',
                'sm.scheduled_end',
                'sm.actual_start',
                'sm.actual_end',
                'sm.moved_out_quantity',
                'sm.moved_back_quantity',
                'sm.notes',
                'sm.created_at',
                'l.location_id',
                'l.location_name',
                'l.location_code',
                'tl.location_id   as temp_location_id',
                'tl.location_name as temp_location_name',
                'tl.location_code as temp_location_code',
                DB::raw("CONCAT(u.first_name,' ',u.last_name) as performed_by_name")
            )
            ->orderByDesc('sm.created_at');

        if ($request->filled('status')) {
            $query->where('sm.status', $request->input('status'));
        }

        if ($request->filled('location_id')) {
            $query->where('sm.location_id', (int) $request->input('location_id'));
        }

        if ($request->filled('search')) {
            $s = trim($request->input('search'));
            $query->where(function ($q) use ($s) {
                $q->where('sm.title', 'like', "%{$s}%")
                  ->orWhere('l.location_name', 'like', "%{$s}%")
                  ->orWhere('tl.location_name', 'like', "%{$s}%");
            });
        }

        return response()->json([
            'success' => true,
            'message' => 'Maintenance records retrieved.',
            'data'    => $query->paginate($perPage),
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SHOW — includes item preview of what would be moved
    // ─────────────────────────────────────────────────────────────────────────
    public function show(int $id)
    {
        $record = $this->findOrFail($id);

        // Items currently at the location
        $items = $this->itemsAtLocation((int) $record->location_id);

        // If already started, show tracked batches + how much is still there
        $trackedBatches = [];
        if (in_array($record->status, ['active', 'restoring', 'completed'])) {
            $trackedBatches = DB::table('storage_maintenance_batches as smb')
                ->join('inventory_batches as b', 'smb.batch_id', '=', 'b.batch_id')
                ->join('items as i', 'smb.item_id', '=', 'i.item_id')
                ->where('smb.maintenance_id', $id)
                ->select(
                    'smb.item_id',
                    'i.item_code',
                    'i.item_description',
                    'i.measurement_unit',
                    'smb.original_quantity',
                    'b.quantity as current_quantity',
                    'b.batch_id',
                    'b.status as batch_status'
                )
                ->get()
                ->map(fn ($r) => [
                    'item_id'           => (int) $r->item_id,
                    'item_code'         => $r->item_code,
                    'item_description'  => $r->item_description,
                    'measurement_unit'  => $r->measurement_unit,
                    'original_quantity' => (int) $r->original_quantity,
                    'current_quantity'  => (int) $r->current_quantity,
                    'consumed'          => (int) $r->original_quantity - (int) $r->current_quantity,
                    'batch_status'      => $r->batch_status,
                ])
                ->values();
        }

        return response()->json([
            'success' => true,
            'message' => 'Maintenance record retrieved.',
            'data'    => array_merge((array) $record, [
                'preview_items'   => $items,
                'tracked_batches' => $trackedBatches,
            ]),
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CREATE
    // ─────────────────────────────────────────────────────────────────────────
    public function store(Request $request)
    {
        $validated = $request->validate([
            'location_id'      => ['required', 'integer', 'exists:locations,location_id'],
            'temp_location_id' => ['required', 'integer', 'exists:locations,location_id', 'different:location_id'],
            'title'            => ['required', 'string', 'max:255'],
            'reason'           => ['nullable', 'string', 'max:255'],
            'scheduled_start'  => ['nullable', 'date'],
            'scheduled_end'    => ['nullable', 'date'],
            'notes'            => ['nullable', 'string', 'max:1000'],
        ]);

        $user        = auth('api')->user();
        $performedBy = $user?->user_id ?? auth()->id() ?? 1;

        $id = DB::table('storage_maintenance')->insertGetId([
            'location_id'      => (int) $validated['location_id'],
            'temp_location_id' => (int) $validated['temp_location_id'],
            'title'            => $validated['title'],
            'reason'           => $validated['reason'] ?? null,
            'status'           => 'pending',
            'scheduled_start'  => $validated['scheduled_start'] ?? null,
            'scheduled_end'    => $validated['scheduled_end'] ?? null,
            'notes'            => $validated['notes'] ?? null,
            'performed_by'     => $performedBy,
            'created_at'       => now(),
            'updated_at'       => now(),
        ]);

        AuditLogService::log('storage_maintenance', $id, 'INSERT', null, $validated, $request, $performedBy);

        return response()->json([
            'success' => true,
            'message' => 'Maintenance scheduled.',
            'data'    => ['maintenance_id' => $id],
        ], 201);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // UPDATE (title / dates / notes — only while pending)
    // ─────────────────────────────────────────────────────────────────────────
    public function update(Request $request, int $id)
    {
        $record = $this->findOrFail($id);

        if ($record->status !== 'pending') {
            return response()->json(['success' => false, 'message' => 'Only pending maintenance can be edited.'], 422);
        }

        $validated = $request->validate([
            'title'            => ['sometimes', 'string', 'max:255'],
            'reason'           => ['nullable', 'string', 'max:255'],
            'temp_location_id' => ['sometimes', 'integer', 'exists:locations,location_id'],
            'scheduled_start'  => ['nullable', 'date'],
            'scheduled_end'    => ['nullable', 'date'],
            'notes'            => ['nullable', 'string', 'max:1000'],
        ]);

        DB::table('storage_maintenance')
            ->where('maintenance_id', $id)
            ->update(array_merge($validated, ['updated_at' => now()]));

        return response()->json(['success' => true, 'message' => 'Maintenance updated.']);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // START — move all items from location → temp_location
    // ─────────────────────────────────────────────────────────────────────────
    public function start(Request $request, int $id)
    {
        $record = $this->findOrFail($id);

        if ($record->status !== 'pending') {
            return response()->json(['success' => false, 'message' => 'Only pending maintenance can be started.'], 422);
        }

        $locationId     = (int) $record->location_id;
        $tempLocationId = (int) $record->temp_location_id;

        $items = $this->itemsAtLocation($locationId);

        if ($items->isEmpty()) {
            // No stock to move — start anyway, mark as active with nothing to restore
            DB::table('storage_maintenance')
                ->where('maintenance_id', $id)
                ->update([
                    'status'       => 'active',
                    'actual_start' => now(),
                    'updated_at'   => now(),
                ]);

            return response()->json([
                'success' => true,
                'message' => 'Maintenance started. No stock was at this location.',
                'data'    => ['maintenance_id' => $id, 'items_moved' => 0],
            ]);
        }

        $user        = auth('api')->user();
        $performedBy = $user?->user_id ?? auth()->id() ?? 1;
        $reference   = 'MAINT-START-' . $id . '-' . now()->format('YmdHis');
        $totalMoved  = 0;

        try {
            DB::transaction(function () use (
                $id, $locationId, $tempLocationId, $items,
                $performedBy, $reference, &$totalMoved
            ) {
                foreach ($items as $item) {
                    $itemId    = (int) $item->item_id;
                    $remaining = (int) $item->stock;

                    $sourceBatches = DB::table('inventory_batches')
                        ->select('batch_id', 'quantity', 'expiry_date', 'manufactured_date', 'batch_number', 'batch_value')
                        ->where('item_id', $itemId)
                        ->where('location_id', $locationId)
                        ->where('status', 'active')
                        ->where('quantity', '>', 0)
                        ->orderByRaw('expiry_date IS NULL, expiry_date ASC')
                        ->orderBy('created_at')
                        ->lockForUpdate()
                        ->get();

                    foreach ($sourceBatches as $batch) {
                        if ($remaining <= 0) break;

                        $take   = min($remaining, (int) $batch->quantity);
                        $newQty = (int) $batch->quantity - $take;

                        // Deplete source batch
                        DB::table('inventory_batches')
                            ->where('batch_id', $batch->batch_id)
                            ->update([
                                'quantity'   => $newQty,
                                'status'     => $newQty <= 0 ? 'depleted' : 'active',
                                'updated_at' => now(),
                            ]);

                        // Create batch at temp location
                        $newBatchId = DB::table('inventory_batches')->insertGetId([
                            'item_id'          => $itemId,
                            'location_id'      => $tempLocationId,
                            'batch_number'     => 'MAINT-' . $id . '-' . now()->format('YmdHis'),
                            'quantity'         => $take,
                            'expiry_date'      => $batch->expiry_date,
                            'manufactured_date'=> $batch->manufactured_date,
                            'batch_value'      => $batch->batch_value,
                            'status'           => 'active',
                            'created_at'       => now(),
                            'updated_at'       => now(),
                        ]);

                        // Track this batch so restore knows what belongs to this job
                        DB::table('storage_maintenance_batches')->insert([
                            'maintenance_id'    => $id,
                            'batch_id'          => $newBatchId,
                            'item_id'           => $itemId,
                            'original_quantity' => $take,
                            'created_at'        => now(),
                        ]);

                        // OUT transaction at source
                        DB::table('inventory_transactions')->insert([
                            'item_id'          => $itemId,
                            'batch_id'         => (int) $batch->batch_id,
                            'transaction_type' => 'TRANSFER',
                            'quantity'         => -$take,
                            'reference_number' => $reference,
                            'transaction_date' => now(),
                            'reason'           => 'Maintenance Start — ' . DB::table('storage_maintenance')->where('maintenance_id', $id)->value('title'),
                            'from_location_id' => $locationId,
                            'to_location_id'   => $tempLocationId,
                            'performed_by'     => $performedBy,
                            'created_at'       => now(),
                        ]);

                        // IN transaction at temp
                        DB::table('inventory_transactions')->insert([
                            'item_id'          => $itemId,
                            'batch_id'         => $newBatchId,
                            'transaction_type' => 'TRANSFER',
                            'quantity'         => $take,
                            'reference_number' => $reference,
                            'transaction_date' => now(),
                            'reason'           => 'Maintenance Start — ' . DB::table('storage_maintenance')->where('maintenance_id', $id)->value('title'),
                            'from_location_id' => $locationId,
                            'to_location_id'   => $tempLocationId,
                            'performed_by'     => $performedBy,
                            'created_at'       => now(),
                        ]);

                        $remaining  -= $take;
                        $totalMoved += $take;
                    }
                }

                DB::table('storage_maintenance')
                    ->where('maintenance_id', $id)
                    ->update([
                        'status'             => 'active',
                        'actual_start'       => now(),
                        'moved_out_quantity' => $totalMoved,
                        'updated_at'         => now(),
                    ]);
            });

            AuditLogService::log('storage_maintenance', $id, 'UPDATE', null,
                ['action' => 'start', 'items_moved' => $totalMoved], $request, $performedBy);

            return response()->json([
                'success' => true,
                'message' => "Maintenance started. {$totalMoved} units moved to temp storage.",
                'data'    => ['maintenance_id' => $id, 'items_moved' => $totalMoved, 'reference' => $reference],
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to start maintenance.',
                'error'   => config('app.debug') ? $e->getMessage() : null,
            ], 500);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RESTORE — move whatever remains back from temp → original location
    // ─────────────────────────────────────────────────────────────────────────
    public function restore(Request $request, int $id)
    {
        $record = $this->findOrFail($id);

        if ($record->status !== 'active') {
            return response()->json(['success' => false, 'message' => 'Only active maintenance can be restored.'], 422);
        }

        $locationId     = (int) $record->location_id;
        $tempLocationId = (int) $record->temp_location_id;

        $user        = auth('api')->user();
        $performedBy = $user?->user_id ?? auth()->id() ?? 1;
        $reference   = 'MAINT-RESTORE-' . $id . '-' . now()->format('YmdHis');
        $totalMoved  = 0;

        // Get tracked batches that still have remaining stock
        $trackedBatches = DB::table('storage_maintenance_batches as smb')
            ->join('inventory_batches as b', 'smb.batch_id', '=', 'b.batch_id')
            ->where('smb.maintenance_id', $id)
            ->where('b.status', 'active')
            ->where('b.quantity', '>', 0)
            ->select('smb.batch_id', 'smb.item_id', 'smb.original_quantity', 'b.quantity', 'b.expiry_date', 'b.manufactured_date', 'b.batch_value')
            ->get();

        try {
            $title = DB::table('storage_maintenance')->where('maintenance_id', $id)->value('title');

            DB::transaction(function () use (
                $id, $locationId, $tempLocationId, $trackedBatches,
                $performedBy, $reference, $title, &$totalMoved
            ) {
                foreach ($trackedBatches as $seg) {
                    $take = (int) $seg->quantity;
                    if ($take <= 0) continue;

                    // Deplete temp batch
                    DB::table('inventory_batches')
                        ->where('batch_id', $seg->batch_id)
                        ->update(['quantity' => 0, 'status' => 'depleted', 'updated_at' => now()]);

                    // Create new batch back at original location
                    $newBatchId = DB::table('inventory_batches')->insertGetId([
                        'item_id'          => $seg->item_id,
                        'location_id'      => $locationId,
                        'batch_number'     => 'MAINT-RST-' . $id . '-' . now()->format('YmdHis'),
                        'quantity'         => $take,
                        'expiry_date'      => $seg->expiry_date,
                        'manufactured_date'=> $seg->manufactured_date,
                        'batch_value'      => $seg->batch_value,
                        'status'           => 'active',
                        'created_at'       => now(),
                        'updated_at'       => now(),
                    ]);

                    // OUT from temp
                    DB::table('inventory_transactions')->insert([
                        'item_id'          => $seg->item_id,
                        'batch_id'         => (int) $seg->batch_id,
                        'transaction_type' => 'TRANSFER',
                        'quantity'         => -$take,
                        'reference_number' => $reference,
                        'transaction_date' => now(),
                        'reason'           => 'Maintenance Restore — ' . $title,
                        'from_location_id' => $tempLocationId,
                        'to_location_id'   => $locationId,
                        'performed_by'     => $performedBy,
                        'created_at'       => now(),
                    ]);

                    // IN at original
                    DB::table('inventory_transactions')->insert([
                        'item_id'          => $seg->item_id,
                        'batch_id'         => $newBatchId,
                        'transaction_type' => 'TRANSFER',
                        'quantity'         => $take,
                        'reference_number' => $reference,
                        'transaction_date' => now(),
                        'reason'           => 'Maintenance Restore — ' . $title,
                        'from_location_id' => $tempLocationId,
                        'to_location_id'   => $locationId,
                        'performed_by'     => $performedBy,
                        'created_at'       => now(),
                    ]);

                    $totalMoved += $take;
                }

                DB::table('storage_maintenance')
                    ->where('maintenance_id', $id)
                    ->update([
                        'status'              => 'completed',
                        'actual_end'          => now(),
                        'moved_back_quantity' => $totalMoved,
                        'updated_at'          => now(),
                    ]);
            });

            AuditLogService::log('storage_maintenance', $id, 'UPDATE', null,
                ['action' => 'restore', 'items_moved_back' => $totalMoved], $request, $performedBy);

            $consumed = (int) $record->moved_out_quantity - $totalMoved;

            return response()->json([
                'success' => true,
                'message' => "Maintenance completed. {$totalMoved} units restored." . ($consumed > 0 ? " {$consumed} units were consumed during maintenance." : ''),
                'data'    => [
                    'maintenance_id'   => $id,
                    'moved_back'       => $totalMoved,
                    'consumed_during'  => $consumed,
                    'reference'        => $reference,
                ],
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to restore items.',
                'error'   => config('app.debug') ? $e->getMessage() : null,
            ], 500);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CANCEL — only pending
    // ─────────────────────────────────────────────────────────────────────────
    public function cancel(Request $request, int $id)
    {
        $record = $this->findOrFail($id);

        if ($record->status !== 'pending') {
            return response()->json(['success' => false, 'message' => 'Only pending maintenance can be cancelled.'], 422);
        }

        DB::table('storage_maintenance')
            ->where('maintenance_id', $id)
            ->update(['status' => 'cancelled', 'updated_at' => now()]);

        return response()->json(['success' => true, 'message' => 'Maintenance cancelled.']);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // helpers
    // ─────────────────────────────────────────────────────────────────────────
    private function findOrFail(int $id): object
    {
        $record = DB::table('storage_maintenance as sm')
            ->join('locations as l',  'sm.location_id',      '=', 'l.location_id')
            ->join('locations as tl', 'sm.temp_location_id', '=', 'tl.location_id')
            ->where('sm.maintenance_id', $id)
            ->select(
                'sm.*',
                'l.location_name',
                'l.location_code',
                'tl.location_name as temp_location_name',
                'tl.location_code as temp_location_code'
            )
            ->first();

        if (!$record) {
            abort(404, 'Maintenance record not found.');
        }

        return $record;
    }

    private function itemsAtLocation(int $locationId): \Illuminate\Support\Collection
    {
        return DB::table('inventory_batches as b')
            ->join('items as i', 'b.item_id', '=', 'i.item_id')
            ->where('b.location_id', $locationId)
            ->where('b.status', 'active')
            ->where('b.quantity', '>', 0)
            ->groupBy('i.item_id', 'i.item_code', 'i.item_description', 'i.measurement_unit')
            ->get([
                'i.item_id',
                'i.item_code',
                'i.item_description',
                'i.measurement_unit',
                DB::raw('SUM(b.quantity) as stock'),
            ])
            ->map(fn ($r) => (object) [
                'item_id'         => (int) $r->item_id,
                'item_code'       => $r->item_code,
                'item_description'=> $r->item_description,
                'measurement_unit'=> $r->measurement_unit,
                'stock'           => (int) $r->stock,
            ]);
    }
}
