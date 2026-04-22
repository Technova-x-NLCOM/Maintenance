<?php

namespace App\Http\Controllers\Inventory;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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
            ],
        ]);
    }

    public function complete(Request $request, int $planId)
    {
        $plan = DB::table('distribution_plan_schedules')->where('plan_id', $planId)->first();
        if (!$plan) {
            return response()->json([
                'success' => false,
                'message' => 'Scheduled plan not found.',
            ], 404);
        }

        $validated = $request->validate([
            'remaining_items' => ['required', 'array', 'min:1'],
            'remaining_items.*.item_id' => ['required', 'integer', 'distinct', 'exists:items,item_id'],
            'remaining_items.*.remaining_quantity' => ['required', 'numeric', 'min:0'],
            'remaining_items.*.notes' => ['nullable', 'string'],
            'status' => ['nullable', Rule::in(['completed', 'cancelled'])],
        ]);

        $user = auth('api')->user();
        $recordedBy = $user?->user_id ?? auth()->id();
        $nextStatus = $validated['status'] ?? 'completed';

        DB::transaction(function () use ($planId, $validated, $recordedBy, $nextStatus) {
            foreach ($validated['remaining_items'] as $line) {
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

        return $this->show($planId);
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
