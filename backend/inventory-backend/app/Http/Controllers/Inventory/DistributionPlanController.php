<?php

namespace App\Http\Controllers\Inventory;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;

class DistributionPlanController extends Controller
{
    public function index(Request $request)
    {
        $query = DB::table('distribution_plan_schedules as dps')
            ->join('distribution_templates as dt', 'dps.template_id', '=', 'dt.template_id')
            ->select(
                'dps.plan_id',
                'dps.week_label',
                'dps.planned_date',
                'dps.target_unit_count',
                'dps.status',
                'dps.precheck_at',
                'dps.final_check_at',
                'dps.completed_at',
                'dps.notes',
                'dps.created_at',
                'dps.updated_at',
                'dt.template_id',
                'dt.template_name',
                'dt.distribution_type',
                'dt.base_unit_count'
            )
            ->orderBy('dps.planned_date')
            ->orderBy('dps.plan_id');

        if ($request->filled('status')) {
            $query->where('dps.status', (string) $request->input('status'));
        }

        if ($request->filled('from_date')) {
            $query->whereDate('dps.planned_date', '>=', (string) $request->input('from_date'));
        }

        if ($request->filled('to_date')) {
            $query->whereDate('dps.planned_date', '<=', (string) $request->input('to_date'));
        }

        $plans = $query->get();

        return response()->json([
            'success' => true,
            'message' => 'Scheduled distribution plans retrieved successfully.',
            'data' => $plans,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'template_id' => ['required', 'integer', 'exists:distribution_templates,template_id'],
            'week_label' => ['required', 'string', 'max:50'],
            'planned_date' => ['required', 'date'],
            'target_unit_count' => ['required', 'integer', 'min:1'],
            'notes' => ['nullable', 'string'],
        ]);

        $template = DB::table('distribution_templates')
            ->select('template_id', 'distribution_type', 'is_active')
            ->where('template_id', (int) $validated['template_id'])
            ->first();

        if (!$template || !$template->is_active) {
            return response()->json([
                'success' => false,
                'message' => 'Selected template is inactive or not found.',
            ], 422);
        }

        if ($template->distribution_type !== 'feeding_program') {
            return response()->json([
                'success' => false,
                'message' => 'Only feeding program templates are allowed for weekly plan scheduling.',
            ], 422);
        }

        $user = auth('api')->user();
        $createdBy = $user?->user_id ?? auth()->id();

        $planId = DB::table('distribution_plan_schedules')->insertGetId([
            'template_id' => (int) $validated['template_id'],
            'week_label' => trim((string) $validated['week_label']),
            'planned_date' => $validated['planned_date'],
            'target_unit_count' => (int) $validated['target_unit_count'],
            'status' => 'planned',
            'notes' => $this->nullIfEmpty($validated['notes'] ?? null),
            'created_by' => $createdBy,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $this->show((int) $planId);
    }

    public function show(int $planId)
    {
        $plan = $this->getPlanWithTemplate($planId);
        if (!$plan) {
            return response()->json([
                'success' => false,
                'message' => 'Scheduled plan not found.',
            ], 404);
        }

        $checkData = $this->buildInventoryCheckData($plan);
        $remainingItems = DB::table('distribution_plan_remaining_items as dpri')
            ->join('items as i', 'dpri.item_id', '=', 'i.item_id')
            ->where('dpri.plan_id', $planId)
            ->orderBy('i.item_description')
            ->get([
                'dpri.remaining_id',
                'dpri.item_id',
                'i.item_code',
                'i.item_description',
                'i.measurement_unit',
                'dpri.remaining_quantity',
                'dpri.notes',
                'dpri.created_at',
                'dpri.updated_at',
            ]);

        return response()->json([
            'success' => true,
            'message' => 'Scheduled plan retrieved successfully.',
            'data' => [
                'plan' => $plan,
                'inventory_check' => $checkData,
                'remaining_items' => $remainingItems,
            ],
        ]);
    }

    public function runPrecheck(Request $request, int $planId)
    {
        $plan = $this->getPlanWithTemplate($planId);
        if (!$plan) {
            return response()->json([
                'success' => false,
                'message' => 'Scheduled plan not found.',
            ], 404);
        }

        $checkData = $this->buildInventoryCheckData($plan);

        DB::table('distribution_plan_schedules')
            ->where('plan_id', $planId)
            ->update([
                'status' => 'checked_pre',
                'precheck_at' => now(),
                'updated_at' => now(),
            ]);

        return response()->json([
            'success' => true,
            'message' => 'Pre-check completed successfully.',
            'data' => [
                'plan_id' => $planId,
                'check_type' => 'pre',
                'check_result' => $checkData,
                'ingredients' => $checkData['items'],
                'procurement_list' => collect($checkData['items'])
                    ->filter(fn ($line) => $line['shortage_quantity'] > 0)
                    ->values(),
            ],
        ]);
    }

    public function runFinalCheck(Request $request, int $planId)
    {
        $plan = $this->getPlanWithTemplate($planId);
        if (!$plan) {
            return response()->json([
                'success' => false,
                'message' => 'Scheduled plan not found.',
            ], 404);
        }

        $validated = $request->validate([
            'procured_items' => ['nullable', 'array'],
            'procured_items.*.item_id' => ['required_with:procured_items', 'integer', 'distinct', 'exists:items,item_id'],
            'procured_items.*.quantity_brought' => ['required_with:procured_items', 'integer', 'min:1'],
            'procured_items.*.notes' => ['nullable', 'string'],
        ]);

        $preCheckData = $this->buildInventoryCheckData($plan);
        $allowedItemIds = collect($preCheckData['items'])
            ->pluck('item_id')
            ->map(fn ($id) => (int) $id)
            ->all();

        $procuredItems = $validated['procured_items'] ?? [];
        foreach ($procuredItems as $line) {
            if (!in_array((int) $line['item_id'], $allowedItemIds, true)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Procured item is not part of the selected plan ingredients.',
                    'data' => [
                        'invalid_item_id' => (int) $line['item_id'],
                    ],
                ], 422);
            }
        }

        $performedBy = auth('api')->user()?->user_id ?? auth()->id() ?? 1;
        $procurementSummary = null;

        if (!empty($procuredItems)) {
            DB::transaction(function () use ($plan, $procuredItems, $performedBy, &$procurementSummary) {
                $procurementSummary = $this->recordProcuredIngredients($plan, $procuredItems, (int) $performedBy);
            });
        }

        $checkData = $this->buildInventoryCheckData($plan);
        $nextStatus = $checkData['summary']['can_proceed'] ? 'ready' : 'checked_pre';

        DB::table('distribution_plan_schedules')
            ->where('plan_id', $planId)
            ->update([
                'status' => $nextStatus,
                'final_check_at' => now(),
                'updated_at' => now(),
            ]);

        return response()->json([
            'success' => true,
            'message' => $checkData['summary']['can_proceed']
                ? 'Final inventory check passed. Plan is ready.'
                : 'Final inventory check found shortages. Plan remains not ready.',
            'data' => [
                'plan_id' => $planId,
                'check_type' => 'final',
                'status' => $nextStatus,
                'check_result' => $checkData,
                'ingredients' => $checkData['items'],
                'procurement_list' => collect($checkData['items'])
                    ->filter(fn ($line) => $line['shortage_quantity'] > 0)
                    ->values(),
                'procured_summary' => $procurementSummary,
            ],
        ]);
    }

    private function recordProcuredIngredients(object $plan, array $procuredItems, int $performedBy): array
    {
        $locationId = $this->resolveInventoryLocationId();
        if (Schema::hasColumn('inventory_batches', 'location_id') && $locationId === null) {
            throw new \RuntimeException('No valid inventory location configured for procured ingredients.');
        }

        $reference = 'PROC-' . now()->format('YmdHis') . '-' . strtoupper(substr((string) uniqid(), -4));
        $lines = [];
        $totalQty = 0;

        foreach ($procuredItems as $line) {
            $itemId = (int) $line['item_id'];
            $qty = (int) $line['quantity_brought'];
            if ($qty <= 0) {
                continue;
            }

            $item = DB::table('items')
                ->select('item_id', 'item_code', 'item_description')
                ->where('item_id', $itemId)
                ->first();

            if (!$item) {
                continue;
            }

            $batchInsert = [
                'item_id' => $itemId,
                'batch_number' => sprintf(
                    'PLAN-%d-%d-%s',
                    (int) $plan->plan_id,
                    $itemId,
                    now()->format('His')
                ),
                'quantity' => $qty,
                'expiry_date' => null,
                'manufactured_date' => null,
                'supplier_info' => 'Procured for scheduled plan',
                'batch_value' => null,
                'status' => 'active',
                'created_at' => now(),
                'updated_at' => now(),
            ];

            if (Schema::hasColumn('inventory_batches', 'location_id') && $locationId !== null) {
                $batchInsert['location_id'] = $locationId;
            }

            $batchId = DB::table('inventory_batches')->insertGetId($batchInsert);

            $transactionInsert = [
                'item_id' => $itemId,
                'batch_id' => $batchId,
                'transaction_type' => 'IN',
                'quantity' => $qty,
                'reference_number' => $reference,
                'transaction_date' => now(),
                'reason' => 'Final Check Procurement',
                'notes' => $this->buildProcurementNotes($plan, $line['notes'] ?? null),
                'performed_by' => $performedBy,
                'created_at' => now(),
            ];

            if (Schema::hasColumn('inventory_transactions', 'from_location_id') && $locationId !== null) {
                $transactionInsert['from_location_id'] = $locationId;
            }
            if (Schema::hasColumn('inventory_transactions', 'to_location_id') && $locationId !== null) {
                $transactionInsert['to_location_id'] = $locationId;
            }

            DB::table('inventory_transactions')->insert($transactionInsert);

            $lines[] = [
                'item_id' => (int) $item->item_id,
                'item_code' => (string) $item->item_code,
                'item_description' => (string) $item->item_description,
                'quantity_brought' => $qty,
            ];
            $totalQty += $qty;
        }

        return [
            'reference_number' => $reference,
            'line_count' => count($lines),
            'total_quantity_brought' => $totalQty,
            'procured_lines' => $lines,
        ];
    }

    private function buildProcurementNotes(object $plan, ?string $notes): string
    {
        $parts = [
            'Scheduled Plan Procurement',
            'Plan: ' . $plan->week_label,
            'Template: ' . $plan->template_name,
            'Planned Date: ' . $plan->planned_date,
        ];

        $notes = $this->nullIfEmpty($notes);
        if ($notes) {
            $parts[] = 'Notes: ' . $notes;
        }

        return implode(' | ', $parts);
    }

    private function resolveInventoryLocationId(): ?int
    {
        $candidates = [
            ['table' => 'locations', 'column' => 'location_id'],
            ['table' => 'inventory_locations', 'column' => 'location_id'],
            ['table' => 'stock_locations', 'column' => 'location_id'],
            ['table' => 'warehouses', 'column' => 'warehouse_id'],
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

    public function complete(Request $request, int $planId)
    {
        $plan = $this->getPlanWithTemplate($planId);
        if (!$plan) {
            return response()->json([
                'success' => false,
                'message' => 'Scheduled plan not found.',
            ], 404);
        }

        $validated = $request->validate([
            'remaining_items' => ['nullable', 'array'],
            'remaining_items.*.item_id' => ['required_with:remaining_items', 'integer', 'distinct', 'exists:items,item_id'],
            'remaining_items.*.remaining_quantity' => ['required_with:remaining_items', 'numeric', 'min:0'],
            'remaining_items.*.notes' => ['nullable', 'string'],
            'status' => ['nullable', Rule::in(['completed', 'cancelled'])],
            'issue_now' => ['nullable', 'boolean'],
            'issue_destination' => ['nullable', 'string', 'max:255'],
            'issue_reason' => ['nullable', 'string', 'max:255'],
            'issue_notes' => ['nullable', 'string'],
        ]);

        $user = auth('api')->user();
        $recordedBy = $user?->user_id ?? auth()->id();
        $nextStatus = $validated['status'] ?? 'completed';
        $issueNow = (bool) ($validated['issue_now'] ?? false);

        if ($issueNow && $nextStatus === 'cancelled') {
            return response()->json([
                'success' => false,
                'message' => 'Cannot issue inventory while marking plan as cancelled.',
            ], 422);
        }

        if ($issueNow && empty($validated['issue_destination'])) {
            return response()->json([
                'success' => false,
                'message' => 'Issue destination is required when issue_now is true.',
            ], 422);
        }

        $checkData = $this->buildInventoryCheckData($plan);

        if ($issueNow && !$checkData['summary']['can_proceed']) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot auto-issue because some items are below required stock.',
                'error_type' => 'insufficient_stock',
                'data' => [
                    'check_result' => $checkData,
                ],
            ], 422);
        }

        $issuanceSummary = null;
        $remainingItems = $validated['remaining_items'] ?? [];

        DB::transaction(function () use (
            $planId,
            $remainingItems,
            $recordedBy,
            $nextStatus,
            $issueNow,
            $validated,
            $checkData,
            $plan,
            &$issuanceSummary
        ) {
            if ($issueNow) {
                $issuanceSummary = $this->issuePlanItems(
                    $plan,
                    $checkData,
                    (int) $recordedBy,
                    trim((string) $validated['issue_destination']),
                    $validated['issue_reason'] ?? null,
                    $validated['issue_notes'] ?? null
                );
            }

            foreach ($remainingItems as $line) {
                DB::table('distribution_plan_remaining_items')->updateOrInsert(
                    [
                        'plan_id' => $planId,
                        'item_id' => (int) $line['item_id'],
                    ],
                    [
                        'remaining_quantity' => round((float) $line['remaining_quantity'], 4),
                        'notes' => $this->nullIfEmpty($line['notes'] ?? null),
                        'recorded_by' => $recordedBy,
                        'updated_at' => now(),
                        'created_at' => now(),
                    ]
                );
            }

            DB::table('distribution_plan_schedules')
                ->where('plan_id', $planId)
                ->update([
                    'status' => $nextStatus,
                    'completed_at' => now(),
                    'updated_at' => now(),
                ]);
        });

        $response = $this->show($planId);
        $payload = $response->getData(true);

        if ($issuanceSummary !== null) {
            $payload['data']['issuance'] = $issuanceSummary;
            $payload['message'] = 'Scheduled plan completed and inventory issued successfully.';
        } else {
            $payload['message'] = 'Scheduled plan completed successfully.';
        }

        return response()->json($payload, $response->status());
    }

    public function update(Request $request, int $planId)
    {
        $plan = $this->getPlanWithTemplate($planId);
        if (!$plan) {
            return response()->json([
                'success' => false,
                'message' => 'Scheduled plan not found.',
            ], 404);
        }

        if ($plan->status === 'completed' || $plan->status === 'cancelled') {
            return response()->json([
                'success' => false,
                'message' => 'Cannot issue inventory for a completed or cancelled plan.',
            ], 422);
        }

        $validated = $request->validate([
            'issue_destination' => ['required', 'string', 'max:255'],
            'issue_reason' => ['nullable', 'string', 'max:255'],
            'issue_notes' => ['nullable', 'string'],
        ]);

        $checkData = $this->buildInventoryCheckData($plan);
        if (!$checkData['summary']['can_proceed']) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot issue because some items are below required stock.',
                'error_type' => 'insufficient_stock',
                'data' => [
                    'check_result' => $checkData,
                ],
            ], 422);
        }

        $user = auth('api')->user();
        $performedBy = $user?->user_id ?? auth()->id();
        $issuanceSummary = null;

        DB::transaction(function () use ($planId, $plan, $checkData, $performedBy, $validated, &$issuanceSummary) {
            $issuanceSummary = $this->issuePlanItems(
                $plan,
                $checkData,
                (int) $performedBy,
                trim((string) $validated['issue_destination']),
                $validated['issue_reason'] ?? null,
                $validated['issue_notes'] ?? null
            );

            DB::table('distribution_plan_schedules')
                ->where('plan_id', $planId)
                ->update([
                    'status' => 'ready',
                    'final_check_at' => now(),
                    'updated_at' => now(),
                ]);
        });

        $response = $this->show($planId);
        $payload = $response->getData(true);
        $payload['data']['issuance'] = $issuanceSummary;
        $payload['message'] = 'Plan updated successfully. Inventory has been issued and the plan remains open for completion.';

        return response()->json($payload, $response->status());
    }

    private function issuePlanItems(
        object $plan,
        array $checkData,
        int $performedBy,
        string $destination,
        ?string $reason,
        ?string $notes
    ): array {
        $reference = 'PLAN-' . now()->format('YmdHis') . '-' . strtoupper(substr((string) uniqid(), -4));
        $issuedLines = [];
        $totalIssued = 0;

        foreach ($checkData['items'] as $line) {
            $itemId = (int) $line['item_id'];
            $required = (int) $line['required_quantity_for_issuance'];
            $remaining = $required;

            $batches = DB::table('inventory_batches')
                ->select('batch_id', 'quantity', 'expiry_date')
                ->where('item_id', $itemId)
                ->where('status', 'active')
                ->where('quantity', '>', 0)
                ->orderByRaw('expiry_date IS NULL, expiry_date ASC')
                ->orderBy('created_at')
                ->lockForUpdate()
                ->get();

            foreach ($batches as $batch) {
                if ($remaining <= 0) {
                    break;
                }

                $deduct = min($remaining, (int) $batch->quantity);
                if ($deduct <= 0) {
                    continue;
                }

                $newQty = ((int) $batch->quantity) - $deduct;

                DB::table('inventory_batches')
                    ->where('batch_id', $batch->batch_id)
                    ->update([
                        'quantity' => $newQty,
                        'status' => $newQty <= 0 ? 'depleted' : 'active',
                        'updated_at' => now(),
                    ]);

                DB::table('inventory_transactions')->insert([
                    'item_id' => $itemId,
                    'batch_id' => $batch->batch_id,
                    'transaction_type' => 'OUT',
                    'quantity' => $deduct,
                    'reference_number' => $reference,
                    'transaction_date' => now(),
                    'reason' => $reason ?: 'Scheduled Feeding Program Issuance',
                    'notes' => $this->buildIssuanceNotes($plan, $notes),
                    'destination' => $destination,
                    'performed_by' => $performedBy,
                    'created_at' => now(),
                ]);

                $remaining -= $deduct;
                $totalIssued += $deduct;
            }

            if ($remaining > 0) {
                throw new \RuntimeException('Insufficient stock detected during issuance. Transaction cancelled.');
            }

            $issuedLines[] = [
                'item_id' => $itemId,
                'item_code' => $line['item_code'],
                'item_description' => $line['item_description'],
                'required_quantity_for_issuance' => $required,
                'issued_quantity' => $required,
            ];
        }

        return [
            'reference_number' => $reference,
            'plan_id' => (int) $plan->plan_id,
            'week_label' => (string) $plan->week_label,
            'template_id' => (int) $plan->template_id,
            'template_name' => (string) $plan->template_name,
            'target_unit_count' => (int) $plan->target_unit_count,
            'destination' => $destination,
            'total_issued_quantity' => $totalIssued,
            'issued_lines' => $issuedLines,
        ];
    }

    private function buildIssuanceNotes(object $plan, ?string $userNotes): string
    {
        $parts = [
            'Scheduled Plan: ' . $plan->week_label,
            'Template: ' . $plan->template_name,
            'Planned Date: ' . $plan->planned_date,
            'Target Units: ' . $plan->target_unit_count,
        ];

        $userNotes = $this->nullIfEmpty($userNotes);
        if ($userNotes) {
            $parts[] = 'Notes: ' . $userNotes;
        }

        return implode(' | ', $parts);
    }

    private function getPlanWithTemplate(int $planId): ?object
    {
        return DB::table('distribution_plan_schedules as dps')
            ->join('distribution_templates as dt', 'dps.template_id', '=', 'dt.template_id')
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
            )
            ->first();
    }

    private function buildInventoryCheckData(object $plan): array
    {
        $items = $this->loadTemplateItems((int) $plan->template_id);
        $baseUnitCount = (int) $plan->base_unit_count;
        $targetUnitCount = (int) $plan->target_unit_count;

        if ($baseUnitCount <= 0) {
            return [
                'items' => [],
                'summary' => [
                    'line_count' => 0,
                    'insufficient_items_count' => 0,
                    'can_proceed' => false,
                    'error' => 'Template base unit count must be greater than zero.',
                ],
            ];
        }

        $multiplier = $targetUnitCount / $baseUnitCount;
        $insufficientCount = 0;

        $calculatedItems = array_map(function ($line) use ($multiplier, &$insufficientCount) {
            $requiredExact = round(((float) $line['quantity_per_base']) * $multiplier, 4);
            $requiredForIssuance = (int) ceil($requiredExact);
            $available = (int) $line['current_stock'];
            $shortage = max(0, $requiredForIssuance - $available);

            if ($shortage > 0) {
                $insufficientCount++;
            }

            return [
                'item_id' => (int) $line['item_id'],
                'item_code' => (string) $line['item_code'],
                'item_description' => (string) $line['item_description'],
                'measurement_unit' => $line['measurement_unit'] ? (string) $line['measurement_unit'] : null,
                'quantity_per_base' => (float) $line['quantity_per_base'],
                'required_quantity_exact' => $requiredExact,
                'required_quantity_for_issuance' => $requiredForIssuance,
                'current_stock' => $available,
                'shortage_quantity' => $shortage,
                'has_shortage' => $shortage > 0,
            ];
        }, $items);

        return [
            'items' => $calculatedItems,
            'summary' => [
                'line_count' => count($calculatedItems),
                'insufficient_items_count' => $insufficientCount,
                'can_proceed' => $insufficientCount === 0,
            ],
        ];
    }

    private function loadTemplateItems(int $templateId): array
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
                    'item_id' => (int) $line->item_id,
                    'item_code' => (string) $line->item_code,
                    'item_description' => (string) $line->item_description,
                    'measurement_unit' => $line->measurement_unit ? (string) $line->measurement_unit : null,
                    'quantity_per_base' => (float) $line->quantity_per_base,
                    'current_stock' => (int) $line->current_stock,
                ];
            })
            ->values()
            ->all();
    }

    private function nullIfEmpty(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $trimmed = trim($value);
        return $trimmed === '' ? null : $trimmed;
    }
}
