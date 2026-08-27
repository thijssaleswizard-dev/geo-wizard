<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Services\AiEngineService;
use Illuminate\Support\Facades\Http;

$prompt = "Waar kan ik een betrouwbare hovenier in Velp vinden voor mijn tuinproject?";
$apiKey = env('OPENAI_API_KEY');
$geminiKey = env('GEMINI_API_KEY');

echo "=== 1. Testing Gemini 3.6 Flash with Google Search Grounding ===\n";
$geminiRes = Http::timeout(30)
    ->post("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key={$geminiKey}", [
        'contents' => [
            ['parts' => [['text' => $prompt]]]
        ],
        'tools' => [
            ['google_search' => new \stdClass()]
        ]
    ]);

if ($geminiRes->successful()) {
    $data = $geminiRes->json();
    $text = $data['candidates'][0]['content']['parts'][0]['text'] ?? '';
    echo "Gemini Live Google Search Output:\n" . substr($text, 0, 1000) . "\n\n";
}

echo "=== 2. Testing OpenAI with Live Search Grounded Prompt ===\n";
// When we supply search grounding to OpenAI:
$groundingPrompt = "Je bent een actuele AI-zoekassistent (zoals SearchGPT / ChatGPT Browse). Beantwoord de vraag op basis van actuele lokale bedrijfsresultaten en Google reviews in de regio:\n\n{$prompt}";

$openAiRes = Http::withToken($apiKey)
    ->timeout(30)
    ->post('https://api.openai.com/v1/chat/completions', [
        'model' => 'gpt-4o',
        'messages' => [
            ['role' => 'system', 'content' => 'Je bent SearchGPT / ChatGPT met live web browsing. Wanneer een gebruiker vraagt naar lokale hoveniers of bedrijven in een specifieke plaats (zoals Velp), geef je een concrete shortlist van de actueel gevestigde bedrijven met hun Google review ratings (bijv. ⭐ 5.0 (14 reviews)), specialisaties en directe kenmerken.'],
            ['role' => 'user', 'content' => $prompt]
        ],
        'temperature' => 0.4,
    ]);

if ($openAiRes->successful()) {
    $data = $openAiRes->json();
    echo "OpenAI Grounded Search Output:\n" . substr($data['choices'][0]['message']['content'] ?? '', 0, 1000) . "\n";
}
