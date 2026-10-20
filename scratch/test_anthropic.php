<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\Http;

$apiKey = env('ANTHROPIC_API_KEY');

// Test 1: standard Http::post
echo "Test 1: standard Http post with IPv4 option...\n";
$start = microtime(true);
try {
    $res = Http::withHeaders([
        'x-api-key' => $apiKey,
        'anthropic-version' => '2023-06-01',
    ])->withOptions([
        'curl' => [CURLOPT_IPRESOLVE => CURL_IPRESOLVE_V4],
    ])->timeout(15)->post('https://api.anthropic.com/v1/messages', [
        'model' => 'claude-sonnet-4-6',
        'max_tokens' => 50,
        'messages' => [['role' => 'user', 'content' => 'Hallo']],
    ]);
    $time = round((microtime(true) - $start) * 1000);
    echo "Result: HTTP " . $res->status() . " in {$time}ms\n";
    echo substr($res->body(), 0, 200) . "\n\n";
} catch (\Throwable $e) {
    echo "Error: " . $e->getMessage() . "\n\n";
}

// Test 2: claude-haiku-4-5-20251001
echo "Test 2: claude-haiku-4-5-20251001...\n";
$start = microtime(true);
try {
    $res = Http::withHeaders([
        'x-api-key' => $apiKey,
        'anthropic-version' => '2023-06-01',
    ])->withOptions([
        'curl' => [CURLOPT_IPRESOLVE => CURL_IPRESOLVE_V4],
    ])->timeout(15)->post('https://api.anthropic.com/v1/messages', [
        'model' => 'claude-haiku-4-5-20251001',
        'max_tokens' => 50,
        'messages' => [['role' => 'user', 'content' => 'Hallo']],
    ]);
    $time = round((microtime(true) - $start) * 1000);
    echo "Result: HTTP " . $res->status() . " in {$time}ms\n";
    echo substr($res->body(), 0, 200) . "\n\n";
} catch (\Throwable $e) {
    echo "Error: " . $e->getMessage() . "\n\n";
}
