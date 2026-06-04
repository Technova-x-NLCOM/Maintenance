<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.5; color: #1f2937; background-color: #f3f4f6; margin: 0; padding: 24px; }
        .container { max-width: 760px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
        .header { background: #15803d; color: #ffffff; padding: 20px 24px; }
        .header h1 { margin: 0; font-size: 22px; font-weight: 700; }
        .header p { margin: 4px 0 0; font-size: 14px; opacity: 0.85; }
        .content { padding: 24px; }
        .meta { font-size: 13px; color: #4b5563; margin-bottom: 16px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
        .info-item { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; }
        .info-item .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin-bottom: 2px; }
        .info-item .value { font-size: 15px; font-weight: 600; color: #111827; }
        .badge-success { display: inline-block; background: #dcfce7; color: #15803d; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; }
        .badge-spillover { display: inline-block; background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
        .badge-preferred { display: inline-block; background: #dcfce7; color: #166534; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
        .section-title { margin: 24px 0 10px; font-size: 16px; font-weight: 700; color: #111827; border-bottom: 2px solid #e5e7eb; padding-bottom: 6px; }
        .section-sub { font-size: 13px; color: #6b7280; margin: -6px 0 12px; }
        table { width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 18px; }
        th, td { border: 1px solid #e5e7eb; padding: 10px; text-align: left; }
        th { background: #f9fafb; font-weight: 600; color: #374151; }
        tr:nth-child(even) td { background: #f9fafb; }
        .ref-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 12px 16px; margin-bottom: 20px; font-size: 13px; }
        .ref-box strong { font-size: 15px; color: #15803d; font-family: monospace; }
        .loc-block { border: 1px solid #e5e7eb; border-radius: 6px; margin-bottom: 14px; overflow: hidden; }
        .loc-item-header { background: #f9fafb; padding: 10px 14px; border-bottom: 1px solid #e5e7eb; font-weight: 600; font-size: 14px; }
        .loc-item-header span { color: #6b7280; font-size: 12px; font-weight: 400; margin-left: 8px; }
        .loc-row { display: flex; justify-content: space-between; align-items: center; padding: 9px 14px; border-bottom: 1px solid #f3f4f6; font-size: 13px; }
        .loc-row:last-child { border-bottom: none; }
        .loc-row.preferred { background: #f0fdf4; }
        .loc-row.spillover { background: #fffbeb; }
        .loc-name { font-weight: 500; color: #111827; }
        .loc-qty { color: #374151; }
        .loc-qty strong { color: #111827; font-weight: 700; }
        .footer { border-top: 1px solid #e5e7eb; padding: 14px 24px; font-size: 12px; color: #6b7280; background: #f9fafb; }
        .notice { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 12px 16px; font-size: 13px; color: #1e40af; margin-bottom: 18px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✅ Batch Auto-Allocated</h1>
            <p>Stock has been reserved automatically for the scheduled batch below.</p>
        </div>

        <div class="content">
            <div class="meta">Generated at: {{ $generatedAt }}</div>

            <div class="ref-box">
                Issuance Reference: <strong>{{ $issuanceSummary['reference_number'] }}</strong>
                &nbsp;·&nbsp; <span class="badge-success">Auto-Allocated</span>
            </div>

            <div class="info-grid">
                <div class="info-item">
                    <div class="label">Batch Label</div>
                    <div class="value">{{ $plan->week_label }}</div>
                </div>
                <div class="info-item">
                    <div class="label">Planned Date</div>
                    <div class="value">{{ $plan->planned_date }}</div>
                </div>
                <div class="info-item">
                    <div class="label">Template / Recipe</div>
                    <div class="value">{{ $plan->template_name }}</div>
                </div>
                <div class="info-item">
                    <div class="label">Target People</div>
                    <div class="value">{{ $plan->target_unit_count }}</div>
                </div>
                @if (!empty($plan->preferred_location_name))
                <div class="info-item">
                    <div class="label">Preferred Location</div>
                    <div class="value">{{ $plan->preferred_location_name }}{{ !empty($plan->preferred_location_code) ? ' (' . $plan->preferred_location_code . ')' : '' }}</div>
                </div>
                @endif
                <div class="info-item">
                    <div class="label">Total Units Issued</div>
                    <div class="value">{{ $issuanceSummary['total_issued_quantity'] }}</div>
                </div>
            </div>

            {{-- ── Location Pull Breakdown ──────────────────────────────── --}}
            @if (!empty($issuanceSummary['location_breakdown']) && count($issuanceSummary['location_breakdown']) > 0)
            <div class="section-title">📍 Where to Pick Items From</div>
            <p class="section-sub">Items were pulled from these storage locations using FEFO (First Expiry, First Out) order.</p>

            @foreach ($issuanceSummary['location_breakdown'] as $lbItem)
            <div class="loc-block">
                <div class="loc-item-header">
                    {{ $lbItem['item_code'] }} — {{ $lbItem['item_description'] }}
                    <span>Required: {{ $lbItem['required'] }}{{ !empty($lbItem['measurement_unit']) ? ' ' . $lbItem['measurement_unit'] : '' }}</span>
                </div>
                @foreach ($lbItem['locations'] as $loc)
                <div class="loc-row {{ $loc['is_preferred'] ? 'preferred' : ($loc['is_spillover'] ? 'spillover' : '') }}">
                    <div class="loc-name">
                        📦 {{ $loc['location_name'] }}
                        @if (!empty($loc['location_code'])) <span style="color:#6b7280">({{ $loc['location_code'] }})</span> @endif
                        @if ($loc['is_preferred']) &nbsp;<span class="badge-preferred">Preferred</span> @endif
                        @if ($loc['is_spillover']) &nbsp;<span class="badge-spillover">Spillover</span> @endif
                    </div>
                    <div class="loc-qty">Pull: <strong>{{ $loc['pull_quantity'] }}</strong> / {{ $loc['available'] }} available</div>
                </div>
                @endforeach
            </div>
            @endforeach

            @else
            {{-- Fallback: issued_lines table when no location breakdown available --}}
            <div class="section-title">Items Issued</div>
            <table>
                <thead>
                    <tr>
                        <th>Item Code</th>
                        <th>Description</th>
                        <th>Unit</th>
                        <th>Qty Issued</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($issuanceSummary['issued_lines'] as $line)
                        <tr>
                            <td>{{ $line['item_code'] }}</td>
                            <td>{{ $line['item_description'] }}</td>
                            <td>{{ $line['measurement_unit'] ?? '—' }}</td>
                            <td>{{ $line['issued_quantity'] }}</td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
            @endif

            {{-- ── Issued lines summary ────────────────────────────────── --}}
            @if (!empty($issuanceSummary['location_breakdown']) && count($issuanceSummary['location_breakdown']) > 0)
            <div class="section-title">Items Issued Summary</div>
            <table>
                <thead>
                    <tr>
                        <th>Item Code</th>
                        <th>Description</th>
                        <th>Unit</th>
                        <th>Qty Issued</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($issuanceSummary['issued_lines'] as $line)
                        <tr>
                            <td>{{ $line['item_code'] }}</td>
                            <td>{{ $line['item_description'] }}</td>
                            <td>{{ $line['measurement_unit'] ?? '—' }}</td>
                            <td>{{ $line['issued_quantity'] }}</td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
            @endif

            <div class="notice">
                The plan status has been set to <strong>Stock Allocated</strong>.
                When the distribution date arrives, run the batch from the Batch Distribution screen to complete it.
            </div>
        </div>

        <div class="footer">
            NLCOM Inventory Management System — automated notification. Do not reply to this email.
        </div>
    </div>
</body>
</html>
