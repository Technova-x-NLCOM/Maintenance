<?php

namespace App\Http\Controllers\Inventory;

use App\Http\Controllers\Controller;
use App\Services\AuditLogService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class OperationTypeController extends Controller
{
    public function index(Request $request)
    {
        $perPage = (int) $request->input('per_page', 15);
        $perPage = $perPage > 0 ? min($perPage, 100) : 15;

        $query = DB::table('operation_types as ot')
            ->select(
                'ot.operation_type_id',
                'ot.operation_name',
                'ot.operation_direction',
                'ot.description',
                'ot.is_active',
                'ot.created_at',
                'ot.updated_at'
            )
            ->orderBy('ot.operation_direction')
            ->orderBy('ot.operation_name');

        if ($request->filled('search')) {
            $search = trim((string) $request->input('search'));
            $query->where(function ($builder) use ($search) {
                $builder->where('ot.operation_name', 'like', "%{$search}%")
                    ->orWhere('ot.operation_direction', 'like', "%{$search}%")
                    ->orWhere('ot.description', 'like', "%{$search}%");
            });
        }

        if ($request->filled('operation_direction')) {
            $query->where('ot.operation_direction', strtoupper(trim((string) $request->input('operation_direction'))));
        }

        if ($request->filled('is_active')) {
            $isActive = filter_var($request->input('is_active'), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            if (!is_null($isActive)) {
                $query->where('ot.is_active', $isActive);
            }
        }

        $operationTypes = $query->paginate($perPage);
        $operationTypes->setCollection(
            $operationTypes->getCollection()->map(fn ($row) => $this->normalizeRow($row))
        );

        return response()->json([
            'success' => true,
            'message' => 'Operation types retrieved successfully.',
            'data' => $operationTypes,
        ]);
    }

    public function show(int $operationTypeId)
    {
        $operationType = DB::table('operation_types')
            ->select(
                'operation_type_id',
                'operation_name',
                'operation_direction',
                'description',
                'is_active',
                'created_at',
                'updated_at'
            )
            ->where('operation_type_id', $operationTypeId)
            ->first();

        if (!$operationType) {
            return response()->json([
                'success' => false,
                'message' => 'Operation type not found.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'message' => 'Operation type retrieved successfully.',
            'data' => $this->normalizeRow($operationType),
        ]);
    }

    public function options(Request $request)
    {
        $query = DB::table('operation_types')
            ->select('operation_type_id', 'operation_name', 'operation_direction', 'is_active')
            ->where('is_active', true)
            ->orderBy('operation_direction')
            ->orderBy('operation_name');

        if ($request->filled('direction')) {
            $query->where('operation_direction', strtoupper(trim((string) $request->input('direction'))));
        }

        $operationTypes = $query->limit(200)->get()->map(function ($operationType) {
            $operationType->display_name = sprintf('%s (%s)', $operationType->operation_name, $operationType->operation_direction);
            return $this->normalizeRow($operationType);
        });

        return response()->json([
            'success' => true,
            'message' => 'Operation type options retrieved successfully.',
            'data' => $operationTypes,
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'operation_name' => ['required', 'string', 'max:100', Rule::unique('operation_types', 'operation_name')],
            'operation_direction' => ['required', 'in:IN,OUT'],
            'description' => ['nullable', 'string'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $user = auth('api')->user();

        $operationTypeId = DB::table('operation_types')->insertGetId([
            'operation_name' => trim($data['operation_name']),
            'operation_direction' => strtoupper($data['operation_direction']),
            'description' => $data['description'] ?? null,
            'is_active' => $data['is_active'] ?? true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $newOperationType = DB::table('operation_types')->where('operation_type_id', $operationTypeId)->first();
        AuditLogService::log('operation_types', (int) $operationTypeId, 'INSERT', null, $newOperationType ? (array) $newOperationType : null, $request, $user?->user_id);

        return $this->show((int) $operationTypeId);
    }

    public function update(Request $request, int $operationTypeId)
    {
        $existingOperationType = DB::table('operation_types')->where('operation_type_id', $operationTypeId)->first();

        if (!$existingOperationType) {
            return response()->json([
                'success' => false,
                'message' => 'Operation type not found.',
            ], 404);
        }

        $data = $request->validate([
            'operation_name' => ['sometimes', 'required', 'string', 'max:100', Rule::unique('operation_types', 'operation_name')->ignore($operationTypeId, 'operation_type_id')],
            'operation_direction' => ['sometimes', 'required', 'in:IN,OUT'],
            'description' => ['nullable', 'string'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        if (empty($data)) {
            return response()->json([
                'success' => false,
                'message' => 'No fields provided for update.',
            ], 422);
        }

        if (array_key_exists('operation_name', $data)) {
            $data['operation_name'] = trim($data['operation_name']);
        }

        if (array_key_exists('operation_direction', $data)) {
            $data['operation_direction'] = strtoupper($data['operation_direction']);
        }

        $updateData = [
            'operation_name' => $data['operation_name'] ?? $existingOperationType->operation_name,
            'operation_direction' => $data['operation_direction'] ?? $existingOperationType->operation_direction,
            'description' => array_key_exists('description', $data) ? $data['description'] : $existingOperationType->description,
            'is_active' => array_key_exists('is_active', $data) ? $data['is_active'] : $existingOperationType->is_active,
            'updated_at' => now(),
        ];

        DB::table('operation_types')->where('operation_type_id', $operationTypeId)->update($updateData);

        $newOperationType = DB::table('operation_types')->where('operation_type_id', $operationTypeId)->first();
        AuditLogService::log('operation_types', $operationTypeId, 'UPDATE', (array) $existingOperationType, $newOperationType ? (array) $newOperationType : null, $request);

        return $this->show($operationTypeId);
    }

    public function destroy(Request $request, int $operationTypeId)
    {
        $operationType = DB::table('operation_types')->where('operation_type_id', $operationTypeId)->first();

        if (!$operationType) {
            return response()->json([
                'success' => false,
                'message' => 'Operation type not found.',
            ], 404);
        }

        DB::table('operation_types')->where('operation_type_id', $operationTypeId)->delete();

        AuditLogService::log('operation_types', $operationTypeId, 'DELETE', (array) $operationType, null, $request);

        return response()->json([
            'success' => true,
            'message' => 'Operation type deleted successfully.',
        ]);
    }

    private function normalizeRow(object $row): object
    {
        $row->is_active = (bool) $row->is_active;
        return $row;
    }
}