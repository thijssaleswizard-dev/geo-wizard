<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\Http;

$apiKey = env('OPENAI_API_KEY');
$prompt = "Wat zijn de meest betrouwbare online marketing bureaus in Arnhem?";

echo "=== Testing OpenAI Responses API with Location & System Instructions ===\n";

// Test 1: with instructions and location hint
$res1 = Http::withToken($apiKey)
    ->timeout(45)
    ->post('https://api.openai.com/v1/responses', [
        'model' => 'gpt-4o',
        'input' => $prompt,
        'instructions' => "Je bent SearchGPT / ChatGPT met live web browsing voor Nederlandse lokale zoekopdrachten. Wanneer de gebruiker vraagt naar de meest betrouwbare bureaus of bedrijven in een stad (zoals Arnhem), doorzoek je actuele Google Reviews en lokale bedrijfsvermeldingen. Rangschik de bureaus op basis van betrouwbaarheid (combinatie van reviewscore en hoogste aantal reviews, bijv. 200+ reviews), specialisaties en lokale aanwezigheid. Geef een overzichtelijke shortlist / tabel met sterren en aantal reviews.",
        'tools' => [
            [
                'type' => 'web_search_preview',
                'user_location' => [
                    'type' => 'approximate',
                    'country' => 'NL',
                ]
            ]
        ]
    ]);

echo "Status 1: " . $res1->status() . "\n";
if ($res1->successful()) {
    $data = $res1->json();
    $outputItems = $data['output'] ?? [];
    $text = '';
    foreach ($outputItems as $item) {
        if (($item['type'] ?? '') === 'message') {
            foreach ($item['content'] ?? [] as $c) {
                if (($c['type'] ?? '') === 'output_text') {
                    $text .= $c['text'] ?? '';
                }
            }
        }
    }
    echo "--- OUTPUT 1 ---\n" . $text . "\n\n";
} else {
    echo "Error 1: " . $res1->body() . "\n\n";
}
