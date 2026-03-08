<?php

require_once __DIR__ . '/vendor/autoload.php';

// Bootstrap Laravel
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Http\Controllers\AuthController;
use Illuminate\Http\Request;

echo "NLCOM Inventory System - Authentication Testing\n";
echo "===============================================\n\n";

$controller = new AuthController();

// Test cases
$testCases = [
    [
        'name' => 'Valid Login - Super Admin',
        'data' => ['identifier' => 'superadmin', 'password' => 'SuperAdmin123!'],
        'expected_status' => 200
    ],
    [
        'name' => 'Valid Login - Inventory Manager',
        'data' => ['identifier' => 'inventory_manager', 'password' => 'InventoryManager123!'],
        'expected_status' => 200
    ],
    [
        'name' => 'Login with Email - Super Admin',
        'data' => ['identifier' => 'superadmin@nlcom.org', 'password' => 'SuperAdmin123!'],
        'expected_status' => 200
    ],
    [
        'name' => 'Invalid Password',
        'data' => ['identifier' => 'superadmin', 'password' => 'wrongpassword'],
        'expected_status' => 401
    ],
    [
        'name' => 'Non-existent User',
        'data' => ['identifier' => 'nonexistent', 'password' => 'anypassword'],
        'expected_status' => 404
    ],
    [
        'name' => 'Empty Identifier',
        'data' => ['identifier' => '', 'password' => 'SuperAdmin123!'],
        'expected_status' => 422
    ],
    [
        'name' => 'Empty Password',
        'data' => ['identifier' => 'superadmin', 'password' => ''],
        'expected_status' => 422
    ],
    [
        'name' => 'Missing Identifier',
        'data' => ['password' => 'SuperAdmin123!'],
        'expected_status' => 422
    ],
    [
        'name' => 'Missing Password',
        'data' => ['identifier' => 'superadmin'],
        'expected_status' => 422
    ],
    [
        'name' => 'Short Identifier',
        'data' => ['identifier' => 'ab', 'password' => 'SuperAdmin123!'],
        'expected_status' => 422
    ],
];

$passed = 0;
$failed = 0;

foreach ($testCases as $test) {
    echo "Testing: {$test['name']}\n";
    echo str_repeat("-", 50) . "\n";
    
    $request = new Request();
    $request->merge($test['data']);
    
    try {
        $response = $controller->login($request);
        $statusCode = $response->getStatusCode();
        $data = json_decode($response->getContent(), true);
        
        echo "Status Code: {$statusCode} (Expected: {$test['expected_status']})\n";
        echo "Message: " . ($data['message'] ?? 'No message') . "\n";
        
        if ($statusCode === $test['expected_status']) {
            echo "✅ PASSED\n";
            $passed++;
        } else {
            echo "❌ FAILED - Status code mismatch\n";
            $failed++;
        }
        
        // Show validation errors if present
        if (isset($data['errors'])) {
            echo "Validation Errors:\n";
            foreach ($data['errors'] as $field => $errors) {
                echo "  - {$field}: " . implode(', ', $errors) . "\n";
            }
        }
        
        // Show error type if present
        if (isset($data['error_type'])) {
            echo "Error Type: {$data['error_type']}\n";
        }
        
    } catch (Exception $e) {
        echo "❌ FAILED - Exception: " . $e->getMessage() . "\n";
        $failed++;
    }
    
    echo "\n";
}

echo "Test Summary:\n";
echo "=============\n";
echo "✅ Passed: {$passed}\n";
echo "❌ Failed: {$failed}\n";
echo "Total: " . ($passed + $failed) . "\n";

if ($failed === 0) {
    echo "\n🎉 All tests passed! Authentication system is working correctly.\n";
} else {
    echo "\n⚠️  Some tests failed. Please review the results above.\n";
}