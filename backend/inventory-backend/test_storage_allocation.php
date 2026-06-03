<?php

require_once __DIR__ . '/vendor/autoload.php';

use App\Http\Controllers\Inventory\BatchDistributionController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

// Bootstrap Laravel application
$app = require_once __DIR__ . '/bootstrap/app.php';

$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

echo "Testing Storage Allocation Functionality\n";
echo "==========================================\n\n";

// Check if we have templates
$templateCount = DB::table('distribution_templates')->count();
echo "Distribution Templates: $templateCount\n";

// Check if we have inventory batches with locations
$batchCount = DB::table('inventory_batches')
    ->whereNotNull('location_id')
    ->count();
echo "Inventory Batches with Locations: $batchCount\n";

// Check if we have locations
$locationCount = DB::table('locations')->count();
echo "Storage Locations: $locationCount\n\n";

if ($templateCount > 0) {
    echo "Testing Storage Allocation Calculation...\n";
    
    $template = DB::table('distribution_templates')->first();
    echo "Using template: {$template->template_name}\n";
    
    // Create controller instance
    $controller = new BatchDistributionController();
    
    // Create mock request
    $request = new Request([
        'template_id' => $template->template_id,
        'target_unit_count' => $template->base_unit_count
    ]);
    
    try {
        // Test the new storage allocation calculation method
        $response = $controller->calculateStorageAllocation($request);
        $responseData = json_decode($response->getContent(), true);
        
        if ($responseData['success']) {
            echo "✓ Storage allocation calculation successful\n";
            $data = $responseData['data'];
            echo "Template: {$data['template']['template_name']}\n";
            echo "Target Units: {$data['target_unit_count']}\n";
            echo "Items: " . count($data['items']) . "\n";
            
            foreach ($data['items'] as $item) {
                echo "  - {$item['item_description']}: {$item['required_quantity_for_issuance']} needed\n";
                if (isset($item['storage_allocations'])) {
                    foreach ($item['storage_allocations'] as $allocation) {
                        echo "    └ {$allocation['location_display']}: {$allocation['allocated_quantity']} units\n";
                    }
                }
            }
        } else {
            echo "✗ Storage allocation calculation failed: {$responseData['message']}\n";
        }
    } catch (Exception $e) {
        echo "✗ Error testing storage allocation: " . $e->getMessage() . "\n";
    }
} else {
    echo "No templates found for testing.\n";
}

echo "\nDone!\n";