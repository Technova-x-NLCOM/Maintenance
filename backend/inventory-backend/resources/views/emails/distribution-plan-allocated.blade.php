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
        .section-title { margin: 20px 0 10px; font-size: 16px; font-weight: 700; }
        table { width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 18px; }
        th, td { border: 1px solid #e5e7eb; padding: 10px; text-align: left; }
        th { background: #f9fafb; font-weight: 600; }
        .ref-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 12px 16px; margin-bottom: 20px; font-size: 13px; }
        .ref-box strong { font-size: 15px; color: #15803d; }
        .footer { border-top: 1px solid #e5e7eb; padding: 14px 24px; font-size: 12px; color: #6b7280; background: #f9fafb; }
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
            </div>

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

            <p style="font-size:13px; color:#4b5563;">
                The plan status has been set to <strong>Stock Allocated</strong>. 
                When the date arrives, run the batch from the Batch Distribution screen to complete it.
            </p>
        </div>

        <div class="footer">
            NLCOM Inventory Management System — automated notification. Do not reply to this email.
        </div>
    </div>
</body>
</html>
