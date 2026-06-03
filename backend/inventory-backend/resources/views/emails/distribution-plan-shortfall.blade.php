<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.5; color: #1f2937; background-color: #f3f4f6; margin: 0; padding: 24px; }
        .container { max-width: 760px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
        .header { background: #b91c1c; color: #ffffff; padding: 20px 24px; }
        .header h1 { margin: 0; font-size: 22px; font-weight: 700; }
        .header p { margin: 4px 0 0; font-size: 14px; opacity: 0.85; }
        .content { padding: 24px; }
        .meta { font-size: 13px; color: #4b5563; margin-bottom: 16px; }
        .alert-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 12px 16px; margin-bottom: 20px; font-size: 13px; color: #991b1b; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
        .info-item { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; }
        .info-item .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin-bottom: 2px; }
        .info-item .value { font-size: 15px; font-weight: 600; color: #111827; }
        .section-title { margin: 20px 0 10px; font-size: 16px; font-weight: 700; }
        table { width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 18px; }
        th, td { border: 1px solid #e5e7eb; padding: 10px; text-align: left; }
        th { background: #f9fafb; font-weight: 600; }
        .shortage { color: #b91c1c; font-weight: 600; }
        .ok { color: #15803d; }
        .footer { border-top: 1px solid #e5e7eb; padding: 14px 24px; font-size: 12px; color: #6b7280; background: #f9fafb; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⚠️ Stock Shortfall — Action Required</h1>
            <p>Auto-allocation could not proceed. Insufficient stock for the batch below.</p>
        </div>

        <div class="content">
            <div class="meta">Generated at: {{ $generatedAt }}</div>

            <div class="alert-box">
                The scheduled batch <strong>"{{ $plan->week_label }}"</strong> planned for 
                <strong>{{ $plan->planned_date }}</strong> was not allocated because one or more 
                ingredients do not have enough stock. Please restock and allocate manually.
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
            </div>

            <div class="section-title">Stock Requirements</div>
            <table>
                <thead>
                    <tr>
                        <th>Item Code</th>
                        <th>Description</th>
                        <th>Unit</th>
                        <th>Required</th>
                        <th>Available</th>
                        <th>Shortage</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($shortfallItems as $item)
                        <tr>
                            <td>{{ $item['item_code'] }}</td>
                            <td>{{ $item['item_description'] }}</td>
                            <td>{{ $item['measurement_unit'] ?? '—' }}</td>
                            <td>{{ $item['required_quantity_for_issuance'] }}</td>
                            <td class="{{ $item['has_shortage'] ? '' : 'ok' }}">{{ $item['current_stock'] }}</td>
                            <td class="{{ $item['has_shortage'] ? 'shortage' : 'ok' }}">
                                {{ $item['has_shortage'] ? $item['shortage_quantity'] : '✓ OK' }}
                            </td>
                        </tr>
                    @endforeach
                </tbody>
            </table>

            <p style="font-size:13px; color:#4b5563;">
                Log in to the Inventory System and receive the missing items before the planned date, 
                then run the batch manually from the Batch Distribution screen.
            </p>
        </div>

        <div class="footer">
            NLCOM Inventory Management System — automated notification. Do not reply to this email.
        </div>
    </div>
</body>
</html>
