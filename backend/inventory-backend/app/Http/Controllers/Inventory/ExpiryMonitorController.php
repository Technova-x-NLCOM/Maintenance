<?php

namespace App\Http\Controllers\Inventory;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ExpiryMonitorController extends Controller
{
    /**
     * List batches with expiry dates, sorted soonest-first.
     * Filters: status (expired|critical|warning|ok|all), search, per_page.
     *
     * Status definitions:
     *   expired  — expiry_date < today
     *   critical — expiry_date within 0–7 days
     *   warning  — expiry_date within 8–30 days
     *   ok       — expiry_date > 30 days from today
     */
    public function index(Request $request)
    {
        $perPage   = min((int) $request->input('per_page', 25), 200);
        $status    = $request->input('status', 'all');   // expired|critical|warning|ok|all
        $search    = trim((string) ($request->input('search', '')));

        $query = DB::table('inventory_batches as ib')
            ->join('items as i', 'ib.item_id', '=', 'i.item_id')
            ->leftJoin('locations as l', 'ib.location_id', '=', 'l.location_id')
            ->where('ib.status', 'active')
            ->where('ib.quantity', '>', 0)
            ->whereNotNull('ib.expiry_date')
            ->select(
                'ib.batch_id',
                'ib.batch_number',
                'ib.item_id',
                'i.item_code',
                'i.item_description',
                'i.measurement_unit',
                'ib.quantity',
                'ib.expiry_date',
                'ib.location_id',
                'l.location_name',
                'l.location_code',
                DB::raw("DATEDIFF(ib.expiry_date, CURDATE()) as days_until_expiry"),
                DB::raw("
                    CASE
                        WHEN ib.expiry_date < CURDATE() THEN 'expired'
                        WHEN DATEDIFF(ib.expiry_date, CURDATE()) <= 7  THEN 'critical'
                        WHEN DATEDIFF(ib.expiry_date, CURDATE()) <= 30 THEN 'warning'
                        ELSE 'ok'
                    END as expiry_status
                ")
            )
            ->orderByRaw('ib.expiry_date ASC')
            ->orderBy('i.item_description');

        // Status filter
        if ($status === 'expired') {
            $query->whereRaw('ib.expiry_date < CURDATE()');
        } elseif ($status === 'critical') {
            $query->whereRaw('ib.expiry_date >= CURDATE()')
                  ->whereRaw('DATEDIFF(ib.expiry_date, CURDATE()) <= 7');
        } elseif ($status === 'warning') {
            $query->whereRaw('DATEDIFF(ib.expiry_date, CURDATE()) BETWEEN 8 AND 30');
        } elseif ($status === 'ok') {
            $query->whereRaw('DATEDIFF(ib.expiry_date, CURDATE()) > 30');
        }

        // Search filter
        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('i.item_code', 'like', "%{$search}%")
                  ->orWhere('i.item_description', 'like', "%{$search}%")
                  ->orWhere('ib.batch_number', 'like', "%{$search}%")
                  ->orWhere('l.location_name', 'like', "%{$search}%");
            });
        }

        $results = $query->paginate($perPage);

        // Build summary counts (always all-status for the header stats)
        $counts = DB::table('inventory_batches as ib')
            ->where('ib.status', 'active')
            ->where('ib.quantity', '>', 0)
            ->whereNotNull('ib.expiry_date')
            ->selectRaw("
                SUM(CASE WHEN ib.expiry_date < CURDATE() THEN 1 ELSE 0 END)                               as expired,
                SUM(CASE WHEN ib.expiry_date >= CURDATE() AND DATEDIFF(ib.expiry_date, CURDATE()) <= 7 THEN 1 ELSE 0 END) as critical,
                SUM(CASE WHEN DATEDIFF(ib.expiry_date, CURDATE()) BETWEEN 8 AND 30 THEN 1 ELSE 0 END)    as warning,
                SUM(CASE WHEN DATEDIFF(ib.expiry_date, CURDATE()) > 30 THEN 1 ELSE 0 END)                as ok
            ")
            ->first();

        return response()->json([
            'success' => true,
            'message' => 'Expiry monitor data retrieved.',
            'summary' => [
                'expired'  => (int) ($counts->expired  ?? 0),
                'critical' => (int) ($counts->critical ?? 0),
                'warning'  => (int) ($counts->warning  ?? 0),
                'ok'       => (int) ($counts->ok       ?? 0),
            ],
            'data' => $results,
        ]);
    }
}
