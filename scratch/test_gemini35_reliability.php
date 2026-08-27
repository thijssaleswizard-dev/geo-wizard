<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\Http;

$apiKey = env('GEMINI_API_KEY');
$prompt = "Waar kan ik een betrouwbare hovenier in Velp vinden die mijn tuin kan aanleggen?";

echo "=== Testing gemini-3.5-flash Grounding ===\n";
for ($i = 1; $i <= 2; $i++) {
    $start = microtime(true);
    $res = Http::timeout(35)->post("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key={$apiKey}", [
        'contents' => [['parts' => [['text' => $prompt]]]],
        'tools' => [['google_search' => new \stdClass()]]
    ]);
    $dur = round((microtime(true) - $start) * 1000);
    echo "Call #{$i}: Status {$res->status()} in {$dur}ms\n";
    if ($res->successful()) {
        $text = $res->json()['candidates'][0]['content']['parts'][0]['text'] ?? '';
        echo "Output #{$i}: " . substr(str_replace("\n", " ", $text), 0, 150) . "...\n\n";
    }
}
