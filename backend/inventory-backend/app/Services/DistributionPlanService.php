<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Shared business logic for distribution plan issuance and stock checks.
 * Used by both DistributionPlanController and AutoAllocateDistributionPlans command.
 */
class DistributionPlanService
{
    // ─────────────────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Fetch a plan row joined with its template, including all optional columns
     * added by migrations (preferred_location_id, completed_*, auto_allocation_*).
     */
    public function getPlanWithTemplate(int $planId): ?object
    {
        $query = DB::table('distribution_plan_schedules as dps')
            ->join('distribution_templates as dt', 'dps.template_id', '=', 'dt.template_id')
            ->leftJoin('locations as pl', 'dps.preferred_location_id', '=', 'pl.location_id')
            ->where('dps.plan_id', $planId)
            ->select(
                'dps.plan_id',
                'dps.template_id',
                'dps.week_label',
                'dps.planned_date',
                'dps.target_unit_count',
                'dps.status',
                'dps.notes',
                'dps.precheck_at',
                'dps.final_check_at',
                'dps.completed_at',
                'dps.created_at',
                'dps.updated_at',
                'dt.template_name',
                'dt.distribution_type',
                'dt.base_unit_count'
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
                'dps.completed_reference',
                'dps.completed_issued_qty',
                'dps.completed_target_people',
                'dps.completed_notes'
            );
        }

        if (Schema::hasColumn('distribution_plan_schedules', 'auto_allocated_at')) {
            $query->addSelect(
                'dps.auto_allocated_at',
                'dps.auto_allocation_ref'
            );
        }

        if (Schema::hasColumn('distribution_plan_schedules', 'is_deleted')) {
            $query->where('dps.is_deleted', false);
        }

        return $query->first();
    }

    /**
     * Build the inventory check data for a plan.
     * Returns an array with 'items' and 'summary' keys.
     */
    public function buildInventoryCheckData(object $plan): array
    {
        $items           = $this->loadTemplateItems((int) $plan->template_id);
        $baseUnitCount   = (int) $plan->base_unit_count;
        $targetUnitCount = (int) $plan->target_unit_count;

        if ($baseUnitCount <= 0) {
            return [
                'items'   => [],
                'summary' => [
                    'line_count'               => 0,
                    'insufficient_items_count' => 0,
                    'can_proceed'              => false,
                    'error'                    => 'Template base unit count must be greater than zero.',
                ],
            ];
        }

        $multiplier        = $targetUnitCount / $baseUnitCount;
        $preferredLocId    = isset($plan->preferred_location_id) ? (int) $plan->preferred_location_id : null;
        $insufficientCount = 0;

        $calculatedItems = array_map(
            function ($line) use ($multiplier, $preferredLocId, &$insufficientCount) {
                $itemId              = (int) $line['item_id'];
                $requiredExact       = round(((float) $line['quantity_per_base']) * $multiplier, 4);
                $requiredForIssuance = (int) ceil($requiredExact);

                $totalAvailable = (int) DB::table('inventory_batches')
                    ->where('item_id', $itemId)
                    ->where('status', 'active')
                    ->sum('quantity');

                $preferredAvailable = 0;
                if ($preferredLocId) {
                    $preferredAvailable = (int) DB::table('inventory_batches')
                        ->where('item_id', $itemId)
                        ->where('status', 'active')
                        ->where('location_id', $preferredLocId)
                        ->sum('quantity');
                }

                $shortage = max(0, $requiredForIssuance - $totalAvailable);
                if ($shortage > 0) {
                    $insufficientCount++;
                }

                $spilloverNeeded = ($preferredLocId && $preferredAvailable < $requiredForIssuance)
                    ? max(0, $requiredForIssuance - $preferredAvailable)
                    : 0;

                return [
                    'item_id'                        => $itemId,
                    'item_code'                      => (string) $line['item_code'],
                    'item_description'               => (string) $line['item_description'],
                    'measurement_unit'               => $line['measurement_unit'] ? (string) $line['measurement_unit'] : null,
                    'quantity_per_base'              => (float) $line['quantity_per_base'],
                    'required_quantity_exact'        => $requiredExact,
                    'required_quantity_for_issuance' => $requiredForIssuance,
                    'current_stock'                  => $totalAvailable,
                    'preferred_location_stock'       => $preferredLocId ? $preferredAvailable : null,
                    'spillover_needed'               => $preferredLocId ? $spilloverNeeded : null,
                    'shortage_quantity'              => $shortage,
                    'has_shortage'                   => $shortage > 0,
                ];
            },
            $items
        );

        return [
            'items'   => $calculatedItems,
            'summary' => [
                'line_count'               => count($calculatedItems),
                'insufficient_items_count' => $insufficientCount,
                'can_proceed'              => $insufficientCount === 0,
            ],
        ];
    }

    /**
     * Issue stock for a plan using location-aware FEFO.
     * Pass 1 pulls from preferred_location_id; Pass 2 spills over to other locations.
     * Writes the completion snapshot to the plan row.
     * Must be called inside a DB::transaction().
     */
    public function issuePlanItems(
        object $plan,
        array $checkData,
        ?int $performedBy,
        string $destination,
        ?string $reason,
        ?string $notes,
        string $referencePrefix = 'PLAN'
    ): array {
        // Resolve a valid user ID — column is NOT NULL in the DB
        $actorId = $performedBy ?? $this->resolveSystemUserId();
        $reference      = $referencePrefix . '-' . now()->format('YmdHis') . '-' . strtoupper(substr((string) uniqid(), -4));
        $issuedLines    = [];
        $totalIssued    = 0;
        $preferredLocId = isset($plan->preferred_location_id) ? (int) $plan->preferred_location_id : null;

        foreach ($checkData['items'] as $line) {
            $itemId    = (int) $line['item_id'];
            $required  = (int) $line['required_quantity_for_issuance'];
            $remaining = $required;

            // ── Pass 1: preferred location FEFO ──────────────────────────────
            if ($preferredLocId && $remaining > 0) {
                $prefBatches = DB::table('inventory_batches')
                    ->select('batch_id', 'quantity', 'expiry_date', 'location_id')
                    ->where('item_id', $itemId)
                    ->where('location_id', $preferredLocId)
                    ->where('status', 'active')
                    ->where('quantity', '>', 0)
                    ->orderByRaw('expiry_date IS NULL, expiry_date ASC')
                    ->orderBy('created_at')
                    ->lockForUpdate()
                    ->get();

                foreach ($prefBatches as $batch) {
                    if ($remaining <= 0) break;
                    $deduct = min($remaining, (int) $batch->quantity);
                    if ($deduct <= 0) continue;

                    $newQty = ((int) $batch->quantity) - $deduct;
                    DB::table('inventory_batches')->where('batch_id', $batch->batch_id)->update([
                        'quantity'   => $newQty,
                        'status'     => $newQty <= 0 ? 'depleted' : 'active',
                        'updated_at' => now(),
                    ]);

                    $txInsert = $this->buildTransactionInsert(
                        $itemId, $batch->batch_id, $deduct,
                        $reference, $reason, $notes, $destination, $actorId, $plan
                    );
                    if (Schema::hasColumn('inventory_transactions', 'from_location_id')) {
                        $txInsert['from_location_id'] = (int) $batch->location_id;
                    }
                    DB::table('inventory_transactions')->insert($txInsert);

                    $remaining   -= $deduct;
                    $totalIssued += $deduct;
                }
            }

            // ── Pass 2: spillover across remaining locations ───────────────
            if ($remaining > 0) {
                $spillBatches = DB::table('inventory_batches')
                    ->select('batch_id', 'quantity', 'expiry_date', 'location_id')
                    ->where('item_id', $itemId)
                    ->where('status', 'active')
                    ->where('quantity', '>', 0)
                    ->when($preferredLocId, fn ($q) => $q->where('location_id', '!=', $preferredLocId))
                    ->orderByRaw('expiry_date IS NULL, expiry_date ASC')
                    ->orderBy('created_at')
                    ->lockForUpdate()
                    ->get();

                foreach ($spillBatches as $batch) {
                    if ($remaining <= 0) break;
                    $deduct = min($remaining, (int) $batch->quantity);
                    if ($deduct <= 0) continue;

                    $newQty = ((int) $batch->quantity) - $deduct;
                    DB::table('inventory_batches')->where('batch_id', $batch->batch_id)->update([
                        'quantity'   => $newQty,
                        'status'     => $newQty <= 0 ? 'depleted' : 'active',
                        'updated_at' => now(),
                    ]);

                    $txInsert = $this->buildTransactionInsert(
                        $itemId, $batch->batch_id, $deduct,
                        $reference, $reason, $notes, $destination, $actorId, $plan
                    );
                    if (Schema::hasColumn('inventory_transactions', 'from_location_id')) {
                        $txInsert['from_location_id'] = $batch->location_id ? (int) $batch->location_id : null;
                    }
                    DB::table('inventory_transactions')->insert($txInsert);

                    $remaining   -= $deduct;
                    $totalIssued += $deduct;
                }
            }

            if ($remaining > 0) {
                throw new \RuntimeException(
                    "Insufficient stock for item {$line['item_code']} during issuance. Transaction cancelled."
                );
            }

            $issuedLines[] = [
                'item_id'                        => $itemId,
                'item_code'                      => $line['item_code'],
                'item_description'               => $line['item_description'],
                'measurement_unit'               => $line['measurement_unit'],
                'required_quantity_for_issuance' => $required,
                'issued_quantity'                => $required,
            ];
        }

        // Write completion snapshot if migration ran
        if (Schema::hasColumn('distribution_plan_schedules', 'completed_reference')) {
            DB::table('distribution_plan_schedules')
                ->where('plan_id', $plan->plan_id)
                ->update([
                    'completed_reference'     => $reference,
                    'completed_issued_qty'    => $totalIssued,
                    'completed_target_people' => (int) $plan->target_unit_count,
                    'completed_notes'         => $notes,
                ]);
        }

        return [
            'reference_number'      => $reference,
            'plan_id'               => (int) $plan->plan_id,
            'week_label'            => (string) $plan->week_label,
            'template_id'           => (int) $plan->template_id,
            'template_name'         => (string) $plan->template_name,
            'target_unit_count'     => (int) $plan->target_unit_count,
            'destination'           => $destination,
            'total_issued_quantity' => $totalIssued,
            'issued_lines'          => $issuedLines,
            'preferred_location_id' => isset($plan->preferred_location_id) ? (int) $plan->preferred_location_id : null,
        ];
    }

    /**
     * Build the per-ingredient, per-location FEFO breakdown for display.
     */
    public function buildLocationBreakdown(object $plan, array $checkItems): array
    {
        if (empty($checkItems)) {
            return [];
        }

        $preferredLocId = isset($plan->preferred_location_id) ? (int) $plan->preferred_location_id : null;
        $result         = [];

        foreach ($checkItems as $item) {
            $itemId   = (int) $item['item_id'];
            $required = (int) $item['required_quantity_for_issuance'];

            $batches = DB::table('inventory_batches as b')
                ->leftJoin('locations as l', 'b.location_id', '=', 'l.location_id')
                ->where('b.item_id', $itemId)
                ->where('b.status', 'active')
                ->where('b.quantity', '>', 0)
                ->orderByRaw('b.expiry_date IS NULL, b.expiry_date ASC')
                ->orderBy('b.created_at')
                ->get([
                    'b.batch_id',
                    'b.location_id',
                    'b.quantity',
                    'b.expiry_date',
                    'b.batch_number',
                    'l.location_name',
                    'l.location_code',
                ]);

            $locationPulls = [];
            $remaining     = $required;

            // Pass 1 — preferred
            if ($preferredLocId) {
                foreach ($batches as $batch) {
                    if ($remaining <= 0) break;
                    if ((int) $batch->location_id !== $preferredLocId) continue;

                    $pull = min($remaining, (int) $batch->quantity);
                    $key  = $batch->location_id ?? 'unassigned';

                    if (!isset($locationPulls[$key])) {
                        $locationPulls[$key] = [
                            'location_id'   => $batch->location_id ? (int) $batch->location_id : null,
                            'location_name' => $batch->location_name ?? 'Unassigned',
                            'location_code' => $batch->location_code,
                            'pull_quantity'  => 0,
                            'available'      => 0,
                            'is_preferred'   => true,
                            'is_spillover'   => false,
                            'batches'        => [],
                        ];
                    }

                    $locationPulls[$key]['pull_quantity'] += $pull;
                    $locationPulls[$key]['batches'][] = [
                        'batch_id'     => (int) $batch->batch_id,
                        'batch_number' => $batch->batch_number,
                        'quantity'     => (int) $batch->quantity,
                        'pull'         => $pull,
                        'expiry_date'  => $batch->expiry_date,
                    ];
                    $remaining -= $pull;
                }
            }

            // Pass 2 — spillover
            foreach ($batches as $batch) {
                if ($remaining <= 0) break;
                if ($preferredLocId && (int) $batch->location_id === $preferredLocId) continue;

                $pull = min($remaining, (int) $batch->quantity);
                $key  = $batch->location_id ?? 'unassigned';

                if (!isset($locationPulls[$key])) {
                    $locationPulls[$key] = [
                        'location_id'   => $batch->location_id ? (int) $batch->location_id : null,
                        'location_name' => $batch->location_name ?? 'Unassigned',
                        'location_code' => $batch->location_code,
                        'pull_quantity'  => 0,
                        'available'      => 0,
                        'is_preferred'   => false,
                        'is_spillover'   => (bool) $preferredLocId,
                        'batches'        => [],
                    ];
                }

                $locationPulls[$key]['pull_quantity'] += $pull;
                $locationPulls[$key]['batches'][] = [
                    'batch_id'     => (int) $batch->batch_id,
                    'batch_number' => $batch->batch_number,
                    'quantity'     => (int) $batch->quantity,
                    'pull'         => $pull,
                    'expiry_date'  => $batch->expiry_date,
                ];
                $remaining -= $pull;
            }

            foreach ($batches as $batch) {
                $key = $batch->location_id ?? 'unassigned';
                if (isset($locationPulls[$key])) {
                    $locationPulls[$key]['available'] += (int) $batch->quantity;
                }
            }

            $result[] = [
                'item_id'          => $itemId,
                'item_code'        => $item['item_code'],
                'item_description' => $item['item_description'],
                'measurement_unit' => $item['measurement_unit'],
                'required'         => $required,
                'unfulfilled'      => max(0, $remaining),
                'locations'        => array_values($locationPulls),
            ];
        }

        return $result;
    }

    /**
     * Load template ingredient lines with current stock totals.
     */
    public function loadTemplateItems(int $templateId): array
    {
        $stockSubquery = DB::table('inventory_batches')
            ->select('item_id', DB::raw('COALESCE(SUM(quantity), 0) as current_stock'))
            ->where('status', 'active')
            ->groupBy('item_id');

        return DB::table('distribution_template_items as dti')
            ->join('items as i', 'dti.item_id', '=', 'i.item_id')
            ->leftJoinSub($stockSubquery, 's', function ($join) {
                $join->on('dti.item_id', '=', 's.item_id');
            })
            ->where('dti.template_id', $templateId)
            ->orderBy('i.item_description')
            ->get([
                'dti.item_id',
                'i.item_code',
                'i.item_description',
                'i.measurement_unit',
                'dti.quantity_per_base',
                DB::raw('COALESCE(s.current_stock, 0) as current_stock'),
            ])
            ->map(function ($line) {
                return [
                    'item_id'          => (int) $line->item_id,
                    'item_code'        => (string) $line->item_code,
                    'item_description' => (string) $line->item_description,
                    'measurement_unit' => $line->measurement_unit ? (string) $line->measurement_unit : null,
                    'quantity_per_base' => (float) $line->quantity_per_base,
                    'current_stock'    => (int) $line->current_stock,
                ];
            })
            ->values()
            ->all();
    }

    /**
     * Find the first available inventory location ID, checking common table names.
     */
    public function resolveInventoryLocationId(): ?int
    {
        $candidates = [
            ['table' => 'locations',          'column' => 'location_id'],
            ['table' => 'inventory_locations', 'column' => 'location_id'],
            ['table' => 'stock_locations',     'column' => 'location_id'],
            ['table' => 'warehouses',          'column' => 'warehouse_id'],
        ];

        foreach ($candidates as $candidate) {
            if (!Schema::hasTable($candidate['table']) || !Schema::hasColumn($candidate['table'], $candidate['column'])) {
                continue;
            }

            $id = DB::table($candidate['table'])
                ->whereNotNull($candidate['column'])
                ->orderBy($candidate['column'])
                ->value($candidate['column']);

            if ($id !== null) {
                return (int) $id;
            }
        }

        return null;
    }

    public function nullIfEmpty(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }
        $trimmed = trim($value);
        return $trimmed === '' ? null : $trimmed;
    }

    public function buildIssuanceNotes(object $plan, ?string $userNotes): string
    {
        $parts = [
            'Scheduled Plan: ' . $plan->week_label,
            'Template: '       . $plan->template_name,
            'Planned Date: '   . $plan->planned_date,
            'Target Units: '   . $plan->target_unit_count,
        ];

        $userNotes = $this->nullIfEmpty($userNotes);
        if ($userNotes) {
            $parts[] = 'Notes: ' . $userNotes;
        }

        return implode(' | ', $parts);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Private helpers
    // ─────────────────────────────────────────────────────────────────────────

    private function buildTransactionInsert(
        int $itemId,
        int $batchId,
        int $deduct,
        string $reference,
        ?string $reason,
        ?string $notes,
        string $destination,
        int $performedBy,
        object $plan
    ): array {
        return [
            'item_id'          => $itemId,
            'batch_id'         => $batchId,
            'transaction_type' => 'OUT',
            'quantity'         => $deduct,
            'reference_number' => $reference,
            'transaction_date' => now(),
            'reason'           => $reason ?: 'Scheduled Batch Distribution',
            'notes'            => $this->buildIssuanceNotes($plan, $notes),
            'destination'      => $destination,
            'performed_by'     => $performedBy,
            'created_at'       => now(),
        ];
    }

    /**
     * Resolve a system-level user ID for automated operations (e.g. auto-allocation).
     * Returns the first active super_admin user, falling back to the first active user.
     * Throws if the users table is empty — something is seriously wrong in that case.
     */
    public function resolveSystemUserId(): int
    {
        // Try the first active super_admin
        $id = DB::table('users as u')
            ->join('user_roles as ur', 'u.user_id', '=', 'ur.user_id')
            ->join('roles as r', 'ur.role_id', '=', 'r.role_id')
            ->where('u.is_active', true)
            ->where('r.role_name', 'super_admin')
            ->orderBy('u.user_id')
            ->value('u.user_id');

        if ($id !== null) {
            return (int) $id;
        }

        // Fall back to any active user
        $id = DB::table('users')
            ->where('is_active', true)
            ->orderBy('user_id')
            ->value('user_id');

        if ($id !== null) {
            return (int) $id;
        }

        throw new \RuntimeException('No active users found in the system. Cannot assign performed_by for auto-allocation.');
    }
}
