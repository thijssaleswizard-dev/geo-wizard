<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\Http;

$apiKey = env('GEMINI_API_KEY');
echo "Testing Gemini 3.6 Flash with Google Search Grounding (Live Browse Mode)...\n";

$response = Http::timeout(30)
    ->post("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key={$apiKey}", [
        'contents' => [
            ['parts' => [['text' => 'Welke online marketing bureaus zijn gevestigd en het beste beoordeeld in Arnhem? Noem o.a. Saleswizard, JG Webmarketing, Marketingkenners, etc.']]]
        ],
        'tools' => [
            ['google_search' => new \stdClass()]
        ]
    ]);

if ($response->successful()) {
    $data = $response->json();
    $text = $data['candidates'][0]['content']['parts'][0]['text'] ?? '';
    echo "Gemini Grounded Response:\n" . substr($text, 0, 800) . "\n";
    $groundingMetadata = $data['candidates'][0]['groundingMetadata'] ?? null;
    echo "Grounding Metadata (Live Web Search Queries & Citations):\n";
    print_r($groundingMetadata ?? []);
} else {
    echo "Error: " . $response->body() . "\n";
}
