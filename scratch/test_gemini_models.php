<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\Http;

$apiKey = env('GEMINI_API_KEY');
$prompt = "Waar kan ik een betrouwbare hovenier in Velp vinden die mijn tuin kan aanleggen?";

echo "=== Listing available Gemini models ===\n";
$modelsRes = Http::timeout(15)->get("https://generativelanguage.googleapis.com/v1beta/models?key={$apiKey}");
if ($modelsRes->successful()) {
    $models = $modelsRes->json('models') ?? [];
    foreach ($models as $m) {
        if (str_contains($m['name'], 'gemini') && str_contains($m['name'], 'flash')) {
            echo "- " . $m['name'] . " (" . ($m['displayName'] ?? '') . ")\n";
        }
    }
} else {
    echo "List models error: " . $modelsRes->body() . "\n";
}

echo "\n=== Testing gemini-2.5-flash with Grounding ===\n";
$start = microtime(true);
$res25 = Http::timeout(60)->post("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={$apiKey}", [
    'contents' => [['parts' => [['text' => $prompt]]]],
    'tools' => [['google_search' => new \stdClass()]]
]);
$dur25 = round((microtime(true) - $start) * 1000);
echo "gemini-2.5-flash: Status {$res25->status()} in {$dur25}ms\n";
if ($res25->successful()) {
    echo "Snippet: " . substr($res25->json()['candidates'][0]['content']['parts'][0]['text'] ?? '', 0, 150) . "...\n";
}
