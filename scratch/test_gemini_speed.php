<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\Http;

$apiKey = env('GEMINI_API_KEY');
$prompt = "Waar kan ik een betrouwbare hovenier in Velp vinden die mijn tuin kan aanleggen?";

$modelsToTest = ['gemini-3.5-flash', 'gemini-3.7-flash', 'gemini-flash-latest', 'gemini-3.6-flash'];

foreach ($modelsToTest as $m) {
    echo "Testing {$m} with Google Search Grounding...\n";
    $start = microtime(true);
    $res = Http::timeout(45)->post("https://generativelanguage.googleapis.com/v1beta/models/{$m}:generateContent?key={$apiKey}", [
        'contents' => [['parts' => [['text' => $prompt]]]],
        'tools' => [['google_search' => new \stdClass()]]
    ]);
    $dur = round((microtime(true) - $start) * 1000);
    echo "-> {$m}: Status {$res->status()} in {$dur}ms\n";
    if ($res->successful()) {
        $text = $res->json()['candidates'][0]['content']['parts'][0]['text'] ?? '';
        echo "   Output: " . substr(str_replace("\n", " ", $text), 0, 120) . "...\n";
    } else {
        echo "   Error: " . substr($res->body(), 0, 150) . "\n";
    }
    echo "\n";
}
