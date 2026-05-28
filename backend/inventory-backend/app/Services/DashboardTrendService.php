<?php

namespace App\Services;

use Carbon\Carbon;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

class DashboardTrendService
{
    /**
     * Count records created in the current calendar month vs the previous calendar month.
     *
     * @param  callable(Builder): void|null  $scope
     * @return array{current: int, previous: int}
     */
    public function monthOverMonthCount(string $table, string $dateColumn, ?callable $scope = null): array
    {
        $currentStart = now()->copy()->startOfMonth();
        $previousStart = now()->copy()->subMonth()->startOfMonth();

        $countInRange = function (Carbon $start, ?Carbon $endExclusive = null) use ($table, $dateColumn, $scope): int {
            $query = DB::table($table)->where($dateColumn, '>=', $start);

            if ($endExclusive) {
                $query->where($dateColumn, '<', $endExclusive);
            }

            if ($scope) {
                $scope($query);
            }

            return (int) $query->count();
        };

        return [
            'current' => $countInRange($currentStart),
            'previous' => $countInRange($previousStart, $currentStart),
        ];
    }

    /**
     * Month-over-month counts used by inventory dashboards.
     *
     * @return array{
     *   items: array{current: int, previous: int},
     *   transactions: array{current: int, previous: int},
     *   categories: array{current: int, previous: int},
     *   batches: array{current: int, previous: int}
     * }
     */
    public function inventoryTrends(): array
    {
        return [
            'items' => $this->monthOverMonthCount('items', 'created_at'),
            'transactions' => $this->monthOverMonthCount('inventory_transactions', 'transaction_date'),
            'categories' => $this->monthOverMonthCount('categories', 'created_at'),
            'batches' => $this->monthOverMonthCount('inventory_batches', 'created_at'),
        ];
    }
}
