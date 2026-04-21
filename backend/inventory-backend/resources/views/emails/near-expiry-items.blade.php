<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.5;
            color: #1f2937;
            background-color: #f3f4f6;
            margin: 0;
            padding: 24px;
        }
        .container {
            max-width: 760px;
            margin: 0 auto;
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            overflow: hidden;
        }
        .header {
            background: #1d4ed8;
            color: #ffffff;
            padding: 20px 24px;
        }
        .header h1 {
            margin: 0;
            font-size: 22px;
            font-weight: 700;
        }
        .content {
            padding: 24px;
        }
        .meta {
            font-size: 13px;
            color: #4b5563;
            margin-bottom: 16px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
        }
        th,
        td {
            border: 1px solid #e5e7eb;
            padding: 10px;
            text-align: left;
        }
        th {
            background: #f9fafb;
            font-weight: 600;
        }
        .footer {
            border-top: 1px solid #e5e7eb;
            padding: 14px 24px;
            font-size: 12px;
            color: #6b7280;
            background: #f9fafb;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Items Near Expiry</h1>
        </div>

        <div class="content">
            <p>The following active inventory batches are nearing expiry within the next {{ $alertDays }} days.</p>

            <div class="meta">
                Generated at: {{ $generatedAt }}
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Item</th>
                        <th>Batch</th>
                        <th>Expiry Date</th>
                        <th>Days Left</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($items as $item)
                        <tr>
                            <td>{{ $item->item_description }}</td>
                            <td>{{ $item->batch_number ?? 'N/A' }}</td>
                            <td>{{ \Carbon\Carbon::parse($item->expiry_date)->format('Y-m-d') }}</td>
                            <td>{{ $item->days_until_expiry }}</td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>

        <div class="footer">
            NLCOM Inventory Management System - automated notification.
        </div>
    </div>
</body>
</html>
