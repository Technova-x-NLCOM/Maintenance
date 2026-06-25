<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: DejaVu Sans, Arial, sans-serif; font-size: 11px; color: #1f2937; background: #fff; padding: 24px; }

  .header { background: #15803d; color: #fff; padding: 16px 20px; border-radius: 6px 6px 0 0; margin-bottom: 0; }
  .header h1 { font-size: 18px; font-weight: 700; margin: 0; }
  .header p  { font-size: 12px; margin: 4px 0 0; opacity: 0.9; }

  .body { border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 6px 6px; padding: 18px 20px; }

  .meta { font-size: 11px; color: #6b7280; margin-bottom: 14px; }

  .ref-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 5px; padding: 10px 14px; margin-bottom: 16px; font-size: 12px; }
  .ref-box strong { font-size: 14px; color: #15803d; font-family: monospace; }
  .badge { display: inline; background: #dcfce7; color: #15803d; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 700; }

  .info-grid { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  .info-grid td { width: 50%; padding: 8px 10px; background: #f9fafb; border: 1px solid #e5e7eb; vertical-align: top; }
  .info-grid .lbl { font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; margin-bottom: 3px; }
  .info-grid .val { font-size: 13px; font-weight: 600; color: #111827; }

  .section-title { font-size: 13px; font-weight: 700; color: #111827; border-bottom: 2px solid #e5e7eb; padding-bottom: 5px; margin: 18px 0 10px; }
  .section-sub   { font-size: 11px; color: #6b7280; margin-bottom: 10px; }

  table.data { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 14px; }
  table.data th { background: #f9fafb; font-weight: 700; color: #374151; padding: 8px 10px; border: 1px solid #e5e7eb; text-align: left; }
  table.data td { padding: 7px 10px; border: 1px solid #e5e7eb; }
  table.data tr:nth-child(even) td { background: #f9fafb; }

  .loc-block { border: 1px solid #e5e7eb; border-radius: 5px; margin-bottom: 10px; overflow: hidden; }
  .loc-head  { background: #f9fafb; padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-weight: 700; font-size: 12px; }
  .loc-head span { color: #6b7280; font-size: 11px; font-weight: 400; margin-left: 8px; }
  .loc-row   { padding: 7px 12px; border-bottom: 1px solid #f3f4f6; font-size: 11px; }
  .loc-row:last-child { border-bottom: none; }
  .loc-row.preferred { background: #f0fdf4; }
  .loc-row.spillover  { background: #fffbeb; }
  .loc-name { font-weight: 600; }
  .loc-qty  { color: #374151; float: right; }
  .badge-pre { display: inline; background: #dcfce7; color: #166534; padding: 1px 6px; border-radius: 8px; font-size: 9px; font-weight: 700; }
  .badge-spl { display: inline; background: #fef3c7; color: #92400e; padding: 1px 6px; border-radius: 8px; font-size: 9px; font-weight: 700; }

  .notice { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 5px; padding: 10px 14px; font-size: 11px; color: #1e40af; margin-bottom: 14px; }

  .footer { margin-top: 20px; font-size: 10px; color: #9ca3af; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 10px; }
</style>
</head>
<body>

<div class="header">
  <h1>Batch Auto-Allocated — Issuance Summary</h1>
  <p>Generated at: {{ $generatedAt }}</p>
</div>

<div class="body">

  <div class="ref-box">
    Issuance Reference: <strong>{{ $issuanceSummary['reference_number'] }}</strong>
    &nbsp; <span class="badge">Auto-Allocated</span>
  </div>

  <table class="info-grid">
    <tr>
      <td><div class="lbl">Batch Label</div><div class="val">{{ $plan->week_label }}</div></td>
      <td><div class="lbl">Planned Date</div><div class="val">{{ $plan->planned_date }}</div></td>
    </tr>
    <tr>
      <td><div class="lbl">Recipe / Template</div><div class="val">{{ $plan->template_name }}</div></td>
      <td><div class="lbl">Target People</div><div class="val">{{ $plan->target_unit_count }}</div></td>
    </tr>
    @if (!empty($plan->preferred_location_name))
    <tr>
      <td><div class="lbl">Preferred Location</div><div class="val">{{ $plan->preferred_location_name }}{{ !empty($plan->preferred_location_code) ? ' (' . $plan->preferred_location_code . ')' : '' }}</div></td>
      <td><div class="lbl">Total Units Issued</div><div class="val">{{ $issuanceSummary['total_issued_quantity'] }}</div></td>
    </tr>
    @else
    <tr>
      <td colspan="2"><div class="lbl">Total Units Issued</div><div class="val">{{ $issuanceSummary['total_issued_quantity'] }}</div></td>
    </tr>
    @endif
  </table>

  {{-- ── Location Pull Breakdown ─────────────────────────────────── --}}
  @if (!empty($issuanceSummary['location_breakdown']) && count($issuanceSummary['location_breakdown']) > 0)
  <div class="section-title">Where Items Were Pulled From</div>
  <p class="section-sub">Storage locations used during auto-allocation (FEFO order).</p>

  @foreach ($issuanceSummary['location_breakdown'] as $lbItem)
  <div class="loc-block">
    <div class="loc-head">
      {{ $lbItem['item_code'] }} — {{ $lbItem['item_description'] }}
      <span>Required: {{ $lbItem['required'] }}{{ !empty($lbItem['measurement_unit']) ? ' ' . $lbItem['measurement_unit'] : '' }}</span>
    </div>
    @foreach ($lbItem['locations'] as $loc)
    <div class="loc-row {{ $loc['is_preferred'] ? 'preferred' : ($loc['is_spillover'] ? 'spillover' : '') }}">
      <span class="loc-name">
        {{ $loc['location_name'] }}
        @if (!empty($loc['location_code'])) ({{ $loc['location_code'] }}) @endif
        @if ($loc['is_preferred']) &nbsp;<span class="badge-pre">Preferred</span> @endif
        @if ($loc['is_spillover']) &nbsp;<span class="badge-spl">Spillover</span> @endif
      </span>
      <span class="loc-qty">Pulled: <strong>{{ $loc['pull_quantity'] }}</strong></span>
    </div>
    @endforeach
  </div>
  @endforeach

  {{-- Issued lines summary --}}
  <div class="section-title">Items Issued Summary</div>
  <table class="data">
    <thead><tr><th>Item Code</th><th>Description</th><th>Unit</th><th>Qty Issued</th></tr></thead>
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

  @else
  <div class="section-title">Items Issued</div>
  <table class="data">
    <thead><tr><th>Item Code</th><th>Description</th><th>Unit</th><th>Qty Issued</th></tr></thead>
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
    Plan status is now <strong>Stock Allocated</strong>. Run the batch on the distribution date to complete issuance.
  </div>

</div>

<div class="footer">
  NLCOM Inventory Management System — Auto-generated report. Do not reply to this email.
</div>

</body>
</html>
