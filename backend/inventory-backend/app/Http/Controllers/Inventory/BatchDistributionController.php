<?php

namespace App\Http\Controllers\Inventory;

use App\Http\Controllers\Controller;
use App\Services\AuditLogService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class BatchDistributionController extends Controller
{
    public function listTemplates(Request $request)
    {
        $query = DB::table('distribution_templates as dt')
            ->leftJoin('distribution_template_items as dti', 'dt.template_id', '=', 'dti.template_id')
            ->select(
                'dt.template_id',
                'dt.template_name',
                'dt.distribution_type',
                'dt.base_unit_count',
                'dt.notes',
                'dt.is_active',
                'dt.created_at',
                'dt.updated_at',
                DB::raw('COUNT(dti.template_item_id) as item_count')
            )
            ->groupBy(
                'dt.template_id',
                'dt.template_name',
                'dt.distribution_type',
                'dt.base_unit_count',
                'dt.notes',
                'dt.is_active',
                'dt.created_at',
                'dt.updated_at'
            )
            ->orderBy('dt.template_name');

        if ($request->filled('search')) {
            $search = trim((string) $request->input('search'));
            $query->where('dt.template_name', 'like', "%{$search}%");
        }

        if ($request->filled('distribution_type')) {
            $query->where('dt.distribution_type', (string) $request->input('distribution_type'));
        }

        $templates = $query->get()->map(function ($row) {
            $row->item_count = (int) $row->item_count;
            $row->base_unit_count = (int) $row->base_unit_count;
            $row->distribution_type_label = $this->distributionTypeLabel($row->distribution_type);
            return $row;
        });

        return response()->json([
            'success' => true,
            'message' => 'Batch distribution templates retrieved successfully.',
            'data' => $templates,
        ]);
    }

    public function itemOptions(Request $request)
    {
        $stockSubquery = DB::table('inventory_batches')
            ->select('item_id', DB::raw('COALESCE(SUM(quantity), 0) as current_stock'))
            ->where('status', 'active')
            ->groupBy('item_id');

        $query = DB::table('items as i')
            ->leftJoinSub($stockSubquery, 's', function ($join) {
                $join->on('i.item_id', '=', 's.item_id');
            })
            ->select(
                'i.item_id',
                'i.item_code',
                'i.item_description',
                'i.measurement_unit',
                DB::raw('COALESCE(s.current_stock, 0) as current_stock')
            )
            ->where('i.is_active', true)
            ->orderBy('i.item_description');

        if ($request->filled('search')) {
            $search = trim((string) $request->input('search'));
            $query->where(function ($builder) use ($search) {
                $builder->where('i.item_code', 'like', "%{$search}%")
                    ->orWhere('i.item_description', 'like', "%{$search}%");
            });
        }

        $items = $query->limit(300)->get()->map(function ($item) {
            $item->current_stock = (int) $item->current_stock;
            return $item;
        });

        return response()->json([
            'success' => true,
            'message' => 'Batch distribution item options retrieved successfully.',
            'data' => $items,
        ]);
    }

    public function showTemplate(int $templateId)
    {
        $template = DB::table('distribution_templates')
            ->select('template_id', 'template_name', 'distribution_type', 'base_unit_count', 'notes', 'is_active', 'created_at', 'updated_at')
            ->where('template_id', $templateId)
            ->first();

        if (!$template) {
            return response()->json([
                'success' => false,
                'message' => 'Distribution template not found.',
            ], 404);
        }

        $items = $this->loadTemplateItems($templateId);
        $template->distribution_type_label = $this->distributionTypeLabel($template->distribution_type);
        $template->base_unit_count = (int) $template->base_unit_count;

        return response()->json([
            'success' => true,
            'message' => 'Distribution template retrieved successfully.',
            'data' => [
                'template' => $template,
                'items' => $items,
            ],
        ]);
    }

    public function createTemplate(Request $request)
    {
        $validated = $this->validateTemplatePayload($request);
        $user = auth('api')->user();
        $createdBy = $user?->user_id ?? auth()->id();

        try {
            $templateId = DB::transaction(function () use ($validated, $createdBy) {
                $newTemplateId = DB::table('distribution_templates')->insertGetId([
                    'template_name' => trim((string) $validated['template_name']),
                    'distribution_type' => $validated['distribution_type'],
                    'base_unit_count' => (int) $validated['base_unit_count'],
                    'notes' => $this->nullIfEmpty($validated['notes'] ?? null),
                    'is_active' => true,
                    'created_by' => $createdBy,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                $lineRows = $this->normalizeTemplateItemsForInsert($newTemplateId, $validated['items']);
                DB::table('distribution_template_items')->insert($lineRows);

                return $newTemplateId;
            });

            $newTemplate = DB::table('distribution_templates')->where('template_id', $templateId)->first();
            AuditLogService::log(
                'distribution_templates',
                (int) $templateId,
                'INSERT',
                null,
                $newTemplate ? (array) $newTemplate : null,
                $request,
                $createdBy
            );

            return $this->showTemplate($templateId);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to create distribution template.',
                'error' => config('app.debug') ? $e->getMessage() : null,
            ], 500);
        }
    }

    public function updateTemplate(Request $request, int $templateId)
    {
        $template = DB::table('distribution_templates')->where('template_id', $templateId)->first();
        if (!$template) {
            return response()->json([
                'success' => false,
                'message' => 'Distribution template not found.',
            ], 404);
        }

        $validated = $this->validateTemplatePayload($request, $templateId);

        try {
            $oldTemplate = (array) $template;
            DB::transaction(function () use ($templateId, $validated) {
                DB::table('distribution_templates')
                    ->where('template_id', $templateId)
                    ->update([
                        'template_name' => trim((string) $validated['template_name']),
                        'distribution_type' => $validated['distribution_type'],
                        'base_unit_count' => (int) $validated['base_unit_count'],
                        'notes' => $this->nullIfEmpty($validated['notes'] ?? null),
                        'updated_at' => now(),
                    ]);

                DB::table('distribution_template_items')
                    ->where('template_id', $templateId)
                    ->delete();

                $lineRows = $this->normalizeTemplateItemsForInsert($templateId, $validated['items']);
                DB::table('distribution_template_items')->insert($lineRows);
            });

            $newTemplate = DB::table('distribution_templates')->where('template_id', $templateId)->first();
            AuditLogService::log(
                'distribution_templates',
                $templateId,
                'UPDATE',
                $oldTemplate,
                $newTemplate ? (array) $newTemplate : null,
                $request
            );

            return $this->showTemplate($templateId);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to update distribution template.',
                'error' => config('app.debug') ? $e->getMessage() : null,
            ], 500);
        }
    }

    public function deleteTemplate(Request $request, int $templateId)
    {
        $template = DB::table('distribution_templates')->where('template_id', $templateId)->first();
        if (!$template) {
            return response()->json([
                'success' => false,
                'message' => 'Distribution template not found.',
            ], 404);
        }

        try {
            DB::transaction(function () use ($templateId) {
                DB::table('distribution_template_items')
                    ->where('template_id', $templateId)
                    ->delete();

                DB::table('distribution_templates')
                    ->where('template_id', $templateId)
                    ->delete();
            });

            AuditLogService::log(
                'distribution_templates',
                $templateId,
                'DELETE',
                $template ? (array) $template : null,
                null,
                $request
            );

            return response()->json([
                'success' => true,
                'message' => 'Distribution template deleted successfully.',
            ]);
        } catch (	hrowable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete distribution template.',
                'error' => config('app.debug') ? $e->getMessage() : null,
            ], 500);
        }
    }

    public function calculate(Request $request)
    {
        $validated = $request->validate([
            'template_id' => ['required', 'integer', 'exists:distribution_templates,template_id'],
            'target_unit_count' => ['required', 'integer', 'min:1'],
        ]);

        return $this->buildCalculationResponse(
            (int) $validated['template_id'],
            (int) $validated['target_unit_count']
        );
    }

    public function issue(Request $request)
    {
        $validated = $request->validate([
            'template_id' => ['required', 'integer', 'exists:distribution_templates,template_id'],
            'target_unit_count' => ['required', 'integer', 'min:1'],
            'destination' => ['required', 'string', 'max:255'],
            'reason' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
        ]);

        $calcResponse = $this->buildCalculationData((int) $validated['template_id'], (int) $validated['target_unit_count']);
        if (!$calcResponse['success']) {
            return response()->json([
                'success' => false,
                'message' => $calcResponse['message'],
            ], 422);
        }

        $calc = $calcResponse['data'];

        if ((float) $calc['summary']['total_shortage_quantity'] > 0) {
            return response()->json([
                'success' => false,
                'message' => 'Unable to issue batch distribution because some items are below required stock.',
                'error_type' => 'insufficient_stock',
                'data' => $calc,
            ], 422);
        }

        $user = auth('api')->user();
        $performedBy = $user?->user_id ?? auth()->id() ?? 1;
        $reference = 'BDT-' . now()->format('YmdHis') . '-' . strtoupper(substr((string) uniqid(), -4));

        try {
            $summary = DB::transaction(function () use ($calc, $validated, $performedBy, $reference) {
                $issuedLines = [];
                $totalIssued = 0;

                foreach ($calc['items'] as $line) {
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
                            'reason' => $validated['reason'] ?? 'Batch Distribution',
                            'notes' => $this->buildTransactionNotes($calc, $validated['notes'] ?? null),
                            'destination' => trim((string) $validated['destination']),
                            'performed_by' => $performedBy,
                            'created_at' => now(),
                        ]);

                        $remaining -= $deduct;
                        $totalIssued += $deduct;
                    }

                    $issuedLines[] = [
                        'item_id' => $itemId,
                        'item_code' => $line['item_code'],
                        'item_description' => $line['item_description'],
                        'required_quantity_for_issuance' => $required,
                        'issued_quantity' => $required - $remaining,
                    ];
                }

                return [
                    'reference_number' => $reference,
                    'template_id' => $calc['template']['template_id'],
                    'template_name' => $calc['template']['template_name'],
                    'distribution_type' => $calc['template']['distribution_type'],
                    'target_unit_count' => $calc['target_unit_count'],
                    'destination' => trim((string) $validated['destination']),
                    'total_issued_quantity' => $totalIssued,
                    'issued_lines' => $issuedLines,
                ];
            });

            AuditLogService::log(
                'inventory_transactions',
                0,
                'UPDATE',
                null,
                $summary,
                $request,
                $performedBy
            );

            return response()->json([
                'success' => true,
                'message' => 'Batch distribution issued successfully.',
                'data' => $summary,
            ], 201);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to issue batch distribution.',
                'error' => config('app.debug') ? $e->getMessage() : null,
            ], 500);
        }
    }

    private function buildCalculationResponse(int $templateId, int $targetUnitCount)
    {
        $calc = $this->buildCalculationData($templateId, $targetUnitCount);

        if (!$calc['success']) {
            return response()->json([
                'success' => false,
                'message' => $calc['message'],
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => 'Batch distribution calculated successfully.',
            'data' => $calc['data'],
        ]);
    }

    private function buildCalculationData(int $templateId, int $targetUnitCount): array
    {
        $template = DB::table('distribution_templates')
            ->select('template_id', 'template_name', 'distribution_type', 'base_unit_count', 'notes')
            ->where('template_id', $templateId)
            ->first();

        if (!$template) {
            return [
                'success' => false,
                'message' => 'Distribution template not found.',
            ];
        }

        $template->template_id = (int) $template->template_id;
        $template->base_unit_count = (int) $template->base_unit_count;
        $template->distribution_type_label = $this->distributionTypeLabel($template->distribution_type);

        if ($template->base_unit_count <= 0) {
            return [
                'success' => false,
                'message' => 'Template base unit count must be greater than zero.',
            ];
        }

        $items = $this->loadTemplateItems($templateId);
        if (empty($items)) {
            return [
                'success' => false,
                'message' => 'Template does not contain any items.',
            ];
        }

        $multiplier = $targetUnitCount / $template->base_unit_count;
        $insufficientCount = 0;
        $totalRequiredForIssuance = 0;
        $totalShortageQuantity = 0;

        $calculatedItems = array_map(function ($line) use ($multiplier, &$insufficientCount, &$totalRequiredForIssuance, &$totalShortageQuantity) {
            $requiredExact = round(((float) $line['quantity_per_base']) * $multiplier, 4);
            $requiredForIssuance = (int) ceil($requiredExact);
            $available = (int) $line['current_stock'];
            $shortage = max(0, $requiredForIssuance - $available);

            if ($shortage > 0) {
                $insufficientCount++;
            }

            $totalRequiredForIssuance += $requiredForIssuance;
            $totalShortageQuantity += $shortage;

            return [
                'item_id' => (int) $line['item_id'],
                'item_code' => (string) $line['item_code'],
                'item_description' => (string) $line['item_description'],
                'measurement_unit' => $line['measurement_unit'] ? (string) $line['measurement_unit'] : null,
                'quantity_per_base' => (float) $line['quantity_per_base'],
                'required_quantity_exact' => $requiredExact,
                'required_quantity_for_issuance' => $requiredForIssuance,
                'current_stock' => $available,
                'shortage_quantity' => round($shortage, 4),
                'has_shortage' => $shortage > 0,
            ];
        }, $items);

        $totalShortageQuantity = (int) $totalShortageQuantity;

        return [
            'success' => true,
            'data' => [
                'template' => [
                    'template_id' => (int) $template->template_id,
                    'template_name' => (string) $template->template_name,
                    'distribution_type' => (string) $template->distribution_type,
                    'distribution_type_label' => (string) $template->distribution_type_label,
                    'base_unit_count' => (int) $template->base_unit_count,
                    'notes' => $template->notes,
                ],
                'target_unit_count' => $targetUnitCount,
                'multiplier' => round($multiplier, 4),
                'items' => $calculatedItems,
                'summary' => [
                    'line_count' => count($calculatedItems),
                    'total_required_quantity_for_issuance' => $totalRequiredForIssuance,
                    'total_shortage_quantity' => $totalShortageQuantity,
                    'insufficient_items_count' => $insufficientCount,
                    'can_issue' => $totalShortageQuantity <= 0,
                ],
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

    private function validateTemplatePayload(Request $request, ?int $templateId = null): array
    {
        return $request->validate([
            'template_name' => [
                'required',
                'string',
                'max:150',
                Rule::unique('distribution_templates', 'template_name')
                    ->where(function ($query) use ($request) {
                        return $query->where('distribution_type', $request->input('distribution_type'));
                    })
                    ->ignore($templateId, 'template_id'),
            ],
            'distribution_type' => ['required', Rule::in(['feeding_program', 'relief_goods'])],
            'base_unit_count' => ['required', 'integer', 'min:1'],
            'notes' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.item_id' => ['required', 'integer', 'distinct', 'exists:items,item_id'],
            'items.*.quantity_per_base' => ['required', 'numeric', 'min:0.0001'],
            'items.*.notes' => ['nullable', 'string'],
        ]);
    }

    private function normalizeTemplateItemsForInsert(int $templateId, array $items): array
    {
        $rows = [];

        foreach ($items as $line) {
            $rows[] = [
                'template_id' => $templateId,
                'item_id' => (int) $line['item_id'],
                'quantity_per_base' => round((float) $line['quantity_per_base'], 4),
                'notes' => $this->nullIfEmpty($line['notes'] ?? null),
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }

        return $rows;
    }

    private function distributionTypeLabel(string $distributionType): string
    {
        return $distributionType === 'relief_goods' ? 'Relief Goods' : 'Feeding Program';
    }

    private function buildTransactionNotes(array $calc, ?string $userNotes): string
    {
        $parts = [
            'Batch Template: ' . $calc['template']['template_name'],
            'Target Units: ' . $calc['target_unit_count'],
            'Multiplier: ' . $calc['multiplier'],
        ];

        $userNotes = $this->nullIfEmpty($userNotes);
        if ($userNotes) {
            $parts[] = 'Notes: ' . $userNotes;
        }

        return implode(' | ', $parts);
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
