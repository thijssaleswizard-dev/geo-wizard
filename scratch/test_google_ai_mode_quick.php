<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\Http;

$apiKey = env('GEMINI_API_KEY');
$prompt = "Waar kan ik een betrouwbare hovenier in Velp vinden die mijn tuin kan aanleggen?";

echo "Testing Google AI Mode with Gemini & Google Search Tools (45s timeout)...\n";
$res = Http::timeout(45)
    ->post("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key={$apiKey}", [
        'contents' => [
            ['parts' => [['text' => "[Google AI Mode - Live Search]\nBeantwoord de vraag als Google AI Mode op basis van actuele lokale Google zoekresultaten en reviews:\n\n{$prompt}"]]]
        ],
        'tools' => [
            ['google_search' => new \stdClass()]
        ]
    ]);

if ($res->successful()) {
    $data = $res->json();
    $text = $data['candidates'][0]['content']['parts'][0]['text'] ?? '';
    echo "=== GOOGLE AI MODE OUTPUT ===\n" . substr($text, 0, 1000) . "\n\n";
    $grounding = $data['candidates'][0]['groundingMetadata'] ?? null;
    echo "Web Search Queries:\n";
    print_r($grounding['webSearchQueries'] ?? []);
} else {
    echo "Error: " . $res->body() . "\n";
}
