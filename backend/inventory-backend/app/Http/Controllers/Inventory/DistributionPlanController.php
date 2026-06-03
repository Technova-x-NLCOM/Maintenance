<?php

namespace App\Http\Controllers\Inventory;

use App\Http\Controllers\Controller;
use App\Services\DistributionPlanService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;

class DistributionPlanController extends Controller
{
    public function __construct(private DistributionPlanService $planService) {}

    public function index(Request $request)
    {
        $query = DB::table('distribution_plan_schedules as dps')
            ->join('distribution_templates as dt', 'dps.template_id', '=', 'dt.template_id')
            ->leftJoin('locations as pl', 'dps.preferred_location_id', '=', 'pl.location_id')
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

        // Include new location + snapshot columns if migration ran
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

        if (Schema::hasColumn('distribution_plan_schedules', 'is_deleted')) {
            $query->where('dps.is_deleted', false);
        }

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
            'data'    => $plans,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'template_id'          => ['required', 'integer', 'exists:distribution_templates,template_id'],
            'week_label'           => ['required', 'string', 'max:50'],
            'planned_date'         => ['required', 'date', 'after_or_equal:today'],
            'target_unit_count'    => ['required', 'integer', 'min:1'],
            'preferred_location_id'=> ['nullable', 'integer', 'exists:locations,location_id'],
            'notes'                => ['nullable', 'string'],
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

        $user = auth('api')->user();
        $createdBy = $user?->user_id ?? auth()->id();

        $planId = DB::table('distribution_plan_schedules')->insertGetId([
            'template_id'           => (int) $validated['template_id'],
            'week_label'            => trim((string) $validated['week_label']),
            'planned_date'          => $validated['planned_date'],
            'target_unit_count'     => (int) $validated['target_unit_count'],
            'preferred_location_id' => isset($validated['preferred_location_id']) ? (int) $validated['preferred_location_id'] : null,
            'status'                => 'planned',
            'notes'                 => $this->nullIfEmpty($validated['notes'] ?? null),
            'created_by'            => $createdBy,
            'created_at'            => now(),
            'updated_at'            => now(),
        ]);

        // ensure backward compatibility when migration not yet run
        if (Schema::hasColumn('distribution_plan_schedules', 'is_deleted')) {
            DB::table('distribution_plan_schedules')
                ->where('plan_id', $planId)
                ->update(['is_deleted' => false]);
        }

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

        $checkData      = $this->buildInventoryCheckData($plan);
        $locationBreakdown = $this->buildLocationBreakdown($plan, $checkData['items']);

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
            'data'    => [
                'plan'               => $plan,
                'inventory_check'    => $checkData,
                'location_breakdown' => $locationBreakdown,
                'remaining_items'    => $remainingItems,
            ],
        ]);
    }

    public function stockReadiness(int $planId)
    {
        $plan = $this->getPlanWithTemplate($planId);
        if (!$plan) {
            return response()->json([
                'success' => false,
                'message' => 'Scheduled plan not found.',
            ], 404);
        }

        $checkData = $this->buildInventoryCheckData($plan);
        $lineCount = (int) $checkData['summary']['line_count'];
        $insufficientCount = (int) $checkData['summary']['insufficient_items_count'];

        if ($lineCount === 0) {
            $message = $checkData['summary']['error'] ?? 'Template not configured with items.';

            return response()->json([
                'success' => false,
                'message' => $message,
                'error' => 'template_not_configured',
                'data' => [
                    'plan_id' => (int) $plan->plan_id,
                    'required' => 0,
                    'available' => 0,
                    'line_count' => 0,
                    'ready_line_count' => 0,
                    'insufficient_items_count' => 0,
                    'percentage' => 0,
                    'can_proceed' => false,
                    'status' => 'insufficient',
                ],
            ], 422);
        }

        $readyLineCount = $lineCount - $insufficientCount;
        // Per-ingredient readiness: 100% only when every line can cover its required quantity.
        $percentage = (int) round(($readyLineCount / $lineCount) * 100);

        $totalRequired = 0;
        $totalCovered = 0;
        foreach ($checkData['items'] as $line) {
            $requiredForIssuance = (int) $line['required_quantity_for_issuance'];
            $available = (int) $line['current_stock'];
            $totalRequired += $requiredForIssuance;
            $totalCovered += min($requiredForIssuance, $available);
        }

        return response()->json([
            'success' => true,
            'message' => 'Stock readiness calculated successfully.',
            'data' => [
                'plan_id' => (int) $plan->plan_id,
                'required' => $totalRequired,
                'available' => $totalCovered,
                'line_count' => $lineCount,
                'ready_line_count' => $readyLineCount,
                'insufficient_items_count' => $insufficientCount,
                'percentage' => $percentage,
                'can_proceed' => (bool) $checkData['summary']['can_proceed'],
                'status' => $percentage >= 100 ? 'ready' : ($percentage >= 50 ? 'partial' : 'insufficient'),
            ],
        ]);
    }

    public function reserve(Request $request, int $planId)
    {
        $plan = $this->getPlanWithTemplate($planId);
        if (!$plan) {
            return response()->json([
                'success' => false,
                'message' => 'Scheduled plan not found.',
            ], 404);
        }

        if ((string) $plan->status !== 'planned') {
            return response()->json([
                'success' => false,
                'message' => 'Only upcoming planned batches can be reserved.',
            ], 422);
        }

        $validated = $request->validate([
            'destination' => ['nullable', 'string', 'max:255'],
            'reason' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
        ]);

        $checkData = $this->buildInventoryCheckData($plan);
        if (!$checkData['summary']['can_proceed']) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot reserve inventory. Stock readiness must be 100%.',
                'error_type' => 'insufficient_stock',
                'data' => [
                    'check_result' => $checkData,
                ],
            ], 422);
        }

        $performedBy = auth('api')->user()?->user_id ?? auth()->id() ?? 1;
        $issuanceSummary = null;

        DB::transaction(function () use ($planId, $plan, $checkData, $performedBy, $validated, &$issuanceSummary) {
            $issuanceSummary = $this->issuePlanItems(
                $plan,
                $checkData,
                (int) $performedBy,
                trim((string) ($validated['destination'] ?? ('Reserved for ' . $plan->week_label))),
                $validated['reason'] ?? 'Inventory Reservation',
                $validated['notes'] ?? 'Reserved from Recipe & Distribution'
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
        $payload['message'] = 'Inventory reserved successfully using FIFO allocation.';

        return response()->json($payload, $response->status());
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
            'issue_destination' => ['nullable', 'string', 'max:255'],
            'issue_reason' => ['nullable', 'string', 'max:255'],
            'issue_notes' => ['nullable', 'string'],
        ]);

        $preCheckData = $this->buildInventoryCheckData($plan);
        $allowedItemIds = collect($preCheckData['items'])
            ->pluck('item_id')
            ->map(fn ($id) => (int) $id)
            ->all();

        $requiredShortages = collect($preCheckData['items'])
            ->filter(fn ($line) => (int) $line['shortage_quantity'] > 0)
            ->mapWithKeys(fn ($line) => [
                (int) $line['item_id'] => (int) $line['shortage_quantity'],
            ])
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

        if (!empty($requiredShortages)) {
            if (empty($procuredItems)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Final check requires bought items to be recorded as IN before issuing OUT.',
                    'error_type' => 'procurement_required',
                    'data' => [
                        'plan_id' => $planId,
                        'required_shortages' => $requiredShortages,
                        'procurement_list' => collect($preCheckData['items'])
                            ->filter(fn ($line) => $line['shortage_quantity'] > 0)
                            ->values(),
                    ],
                ], 422);
            }

            foreach ($requiredShortages as $itemId => $shortageQty) {
                $procuredLine = collect($procuredItems)
                    ->first(fn ($line) => (int) $line['item_id'] === (int) $itemId);

                $broughtQty = (int) ($procuredLine['quantity_brought'] ?? 0);
                if ($broughtQty < $shortageQty) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Bought item quantities must cover all shortages before issuing OUT.',
                        'error_type' => 'insufficient_procurement',
                        'data' => [
                            'item_id' => (int) $itemId,
                            'required_quantity' => (int) $shortageQty,
                            'provided_quantity' => (int) $broughtQty,
                        ],
                    ], 422);
                }
            }
        }

        $performedBy = auth('api')->user()?->user_id ?? auth()->id() ?? 1;
        $procurementSummary = null;
        $issuanceSummary = null;

        if (!empty($procuredItems)) {
            DB::transaction(function () use ($plan, $procuredItems, $performedBy, &$procurementSummary) {
                $procurementSummary = $this->recordProcuredIngredients($plan, $procuredItems, (int) $performedBy);
            });
        }

        $checkData = $this->buildInventoryCheckData($plan);
        if (!$checkData['summary']['can_proceed']) {
            return response()->json([
                'success' => false,
                'message' => 'Final check cannot proceed. Some shortages remain after receiving bought items.',
                'error_type' => 'insufficient_stock',
                'data' => [
                    'plan_id' => $planId,
                    'check_type' => 'final',
                    'check_result' => $checkData,
                    'ingredients' => $checkData['items'],
                    'procurement_list' => collect($checkData['items'])
                        ->filter(fn ($line) => $line['shortage_quantity'] > 0)
                        ->values(),
                    'procured_summary' => $procurementSummary,
                ],
            ], 422);
        }

        DB::transaction(function () use (
            $planId,
            $plan,
            $checkData,
            $performedBy,
            $validated,
            &$issuanceSummary
        ) {
            $issuanceSummary = $this->issuePlanItems(
                $plan,
                $checkData,
                (int) $performedBy,
                trim((string) ($validated['issue_destination'] ?? $plan->week_label)),
                trim((string) $validated['issue_reason']),
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

        return response()->json([
            'success' => true,
            'message' => 'Final check completed. Bought items were received and plan quantities were issued out.',
            'data' => [
                'plan_id' => $planId,
                'check_type' => 'final',
                'status' => 'ready',
                'check_result' => $checkData,
                'ingredients' => $checkData['items'],
                'procurement_list' => collect($checkData['items'])
                    ->filter(fn ($line) => $line['shortage_quantity'] > 0)
                    ->values(),
                'procured_summary' => $procurementSummary,
                'issuance' => $issuanceSummary,
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
                'reason' => 'For ' . $plan->week_label,
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

    public function complete(Request $request, int $planId)
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
                'message' => 'Remainder stage is already finalized for this plan.',
            ], 422);
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
        $remainderReceivingSummary = null;
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
            &$issuanceSummary,
            &$remainderReceivingSummary
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

            $remainderReceivingSummary = $this->recordRemainderItems(
                $plan,
                $remainingItems,
                (int) $recordedBy
            );

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
        $payload['data']['remainder_receiving'] = $remainderReceivingSummary;

        if ($issuanceSummary !== null) {
            $payload['data']['issuance'] = $issuanceSummary;
            $payload['message'] = 'Scheduled plan completed and inventory issued successfully.';
        } else {
            $payload['message'] = 'Remainder stage completed. Leftover ingredients were stored back into inventory.';
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
            'issue_destination' => ['nullable', 'string', 'max:255'],
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
                trim((string) ($validated['issue_destination'] ?? $plan->week_label)),
                trim((string) $validated['issue_reason']),
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

    public function updateSchedule(Request $request, int $planId)
    {
        $plan = $this->getPlanWithTemplate($planId);
        if (!$plan) {
            return response()->json([
                'success' => false,
                'message' => 'Scheduled plan not found.',
            ], 404);
        }

        if ($plan->status !== 'planned') {
            return response()->json([
                'success' => false,
                'message' => 'Only planned schedules can be edited.',
            ], 422);
        }

        $validated = $request->validate([
            'template_id'           => ['required', 'integer', 'exists:distribution_templates,template_id'],
            'week_label'            => ['required', 'string', 'max:50'],
            'planned_date'          => ['required', 'date', 'after_or_equal:today'],
            'target_unit_count'     => ['required', 'integer', 'min:1'],
            'preferred_location_id' => ['nullable', 'integer', 'exists:locations,location_id'],
            'notes'                 => ['nullable', 'string'],
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

        DB::table('distribution_plan_schedules')
            ->where('plan_id', $planId)
            ->update([
                'template_id'           => (int) $validated['template_id'],
                'week_label'            => trim((string) $validated['week_label']),
                'planned_date'          => $validated['planned_date'],
                'target_unit_count'     => (int) $validated['target_unit_count'],
                'preferred_location_id' => isset($validated['preferred_location_id']) ? (int) $validated['preferred_location_id'] : null,
                'notes'                 => $this->nullIfEmpty($validated['notes'] ?? null),
                'updated_at'            => now(),
            ]);

        $response = $this->show($planId);
        $payload = $response->getData(true);
        $payload['message'] = 'Schedule updated successfully.';

        return response()->json($payload, $response->status());
    }

    public function destroy(int $planId)
    {
        $plan = DB::table('distribution_plan_schedules')
            ->where('plan_id', $planId)
            ->first();

        if (!$plan) {
            return response()->json([
                'success' => false,
                'message' => 'Scheduled plan not found.',
            ], 404);
        }

        if (in_array($plan->status, ['ready', 'completed'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'Only planned or cancelled schedules can be deleted.',
            ], 422);
        }

        DB::transaction(function () use ($planId) {
            if (Schema::hasColumn('distribution_plan_schedules', 'is_deleted')) {
                DB::table('distribution_plan_schedules')
                    ->where('plan_id', $planId)
                    ->update([
                        'is_deleted' => true,
                        'status' => 'cancelled',
                        'updated_at' => now(),
                    ]);
            } else {
                DB::table('distribution_plan_remaining_items')
                    ->where('plan_id', $planId)
                    ->delete();

                DB::table('distribution_plan_schedules')
                    ->where('plan_id', $planId)
                    ->delete();
            }
        });

        return response()->json([
            'success' => true,
            'message' => 'Scheduled plan deleted successfully.',
        ]);
    }

    private function issuePlanItems(
        object $plan,
        array $checkData,
        int $performedBy,
        string $destination,
        ?string $reason,
        ?string $notes
    ): array {
        return $this->planService->issuePlanItems($plan, $checkData, $performedBy, $destination, $reason, $notes);
    }

    private function buildIssuanceNotes(object $plan, ?string $userNotes): string
    {
        return $this->planService->buildIssuanceNotes($plan, $userNotes);
    }

    private function recordRemainderItems(object $plan, array $remainingItems, int $performedBy): array
    {
        $locationId = $this->resolveInventoryLocationId();
        if (Schema::hasColumn('inventory_batches', 'location_id') && $locationId === null) {
            throw new \RuntimeException('No valid inventory location configured for remainder storage.');
        }

        $reference = 'REM-' . now()->format('YmdHis') . '-' . strtoupper(substr((string) uniqid(), -4));
        $storedLines = [];
        $totalStored = 0;

        foreach ($remainingItems as $line) {
            $itemId = (int) $line['item_id'];
            $qty = (float) $line['remaining_quantity'];
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
                    'REM-%d-%d-%s',
                    (int) $plan->plan_id,
                    $itemId,
                    now()->format('His')
                ),
                'quantity' => $qty,
                'expiry_date' => null,
                'manufactured_date' => null,
                'supplier_info' => 'Remainder storage for scheduled plan',
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
                'reason' => 'Remainder (For ' . $plan->week_label . ')',
                'notes' => $this->nullIfEmpty($line['notes'] ?? null),
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

            $storedLines[] = [
                'item_id' => (int) $item->item_id,
                'item_code' => (string) $item->item_code,
                'item_description' => (string) $item->item_description,
                'stored_quantity' => $qty,
            ];
            $totalStored += $qty;
        }

        return [
            'reference_number' => $reference,
            'line_count' => count($storedLines),
            'total_stored_quantity' => round($totalStored, 4),
            'stored_lines' => $storedLines,
        ];
    }

    private function getPlanWithTemplate(int $planId): ?object
    {
        return $this->planService->getPlanWithTemplate($planId);
    }

    private function buildInventoryCheckData(object $plan): array
    {
        return $this->planService->buildInventoryCheckData($plan);
    }

    private function buildLocationBreakdown(object $plan, array $checkItems): array
    {
        return $this->planService->buildLocationBreakdown($plan, $checkItems);
    }

    private function loadTemplateItems(int $templateId): array
    {
        return $this->planService->loadTemplateItems($templateId);
    }

    private function resolveInventoryLocationId(): ?int
    {
        return $this->planService->resolveInventoryLocationId();
    }

    private function nullIfEmpty(?string $value): ?string
    {
        return $this->planService->nullIfEmpty($value);
    }
}
