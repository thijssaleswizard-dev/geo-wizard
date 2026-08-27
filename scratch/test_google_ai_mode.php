<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\Http;

$apiKey = env('GEMINI_API_KEY');
$prompt = "Waar kan ik een betrouwbare hovenier in Velp vinden die mijn tuin kan aanleggen?";
$companyName = "vitagroen";

echo "=== 1. Testing Google AI Mode (Gemini + Live Google Search Grounding) ===\n";

$aiModeResponse = Http::timeout(30)
    ->post("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key={$apiKey}", [
        'system_instruction' => [
            'parts' => [
                ['text' => "Je bent Google AI Mode, de interactieve AI-zoekmodus van Google. Geef een accuraat, realtime en overzichtelijk overzicht van de beste lokale opties en bedrijven voor de zoekvraag. Noem concrete partijen met hun specialisaties."]
            ]
        ],
        'contents' => [
            ['parts' => [['text' => $prompt]]]
        ],
        'tools' => [
            ['google_search' => new \stdClass()]
        ]
    ]);

if ($aiModeResponse->successful()) {
    $data = $aiModeResponse->json();
    $text = $data['candidates'][0]['content']['parts'][0]['text'] ?? '';
    echo "Google AI Mode Result:\n" . substr($text, 0, 1000) . "\n\n";
    $grounding = $data['candidates'][0]['groundingMetadata'] ?? null;
    echo "Web Search Queries: " . implode(', ', $grounding['webSearchQueries'] ?? []) . "\n";
} else {
    echo "AI Mode Error: " . $aiModeResponse->body() . "\n";
}

echo "\n=== 2. Testing Google AI Overviews (SGE Snapshot) ===\n";

$sgeResponse = Http::timeout(30)
    ->post("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key={$apiKey}", [
        'system_instruction' => [
            'parts' => [
                ['text' => "Je bent Google AI Overviews (SGE). Genereer een beknopte, feitelijke AI Snapshot die direct bovenaan Google Search wordt getoond voor deze zoekopdracht. Som de meest relevante lokale partijen, keurmerken en tips op."]
            ]
        ],
        'contents' => [
            ['parts' => [['text' => $prompt]]]
        ],
        'tools' => [
            ['google_search' => new \stdClass()]
        ]
    ]);

if ($sgeResponse->successful()) {
    $data = $sgeResponse->json();
    $text = $data['candidates'][0]['content']['parts'][0]['text'] ?? '';
    echo "Google AI Overviews Result:\n" . substr($text, 0, 1000) . "\n\n";
} else {
    echo "SGE Error: " . $sgeResponse->body() . "\n";
}
