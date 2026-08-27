<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\Http;

$apiKey = env('OPENAI_API_KEY');
echo "=== Testing OpenAI API with Web Search Tool ===\n";

// 1. Test with tools: [{"type": "web_search_preview"}] in chat completions / responses
$prompt = "Waar kan ik een betrouwbare hovenier in Velp vinden voor mijn tuinproject? Noem lokale bedrijven met Google reviews.";

echo "\n--- Attempt A: chat/completions with web_search_preview ---\n";
$resA = Http::withToken($apiKey)
    ->timeout(30)
    ->post('https://api.openai.com/v1/chat/completions', [
        'model' => 'gpt-4o',
        'messages' => [
            ['role' => 'user', 'content' => $prompt]
        ],
        'tools' => [
            ['type' => 'web_search_preview']
        ]
    ]);

echo "Status A: " . $resA->status() . "\n";
if ($resA->successful()) {
    $data = $resA->json();
    echo "Content A:\n" . substr($data['choices'][0]['message']['content'] ?? '', 0, 800) . "\n";
    print_r($data['choices'][0]['message']['annotations'] ?? []);
} else {
    echo "Body A: " . $resA->body() . "\n";
}

echo "\n--- Attempt B: responses API / v1/responses with web_search_preview ---\n";
$resB = Http::withToken($apiKey)
    ->timeout(30)
    ->post('https://api.openai.com/v1/responses', [
        'model' => 'gpt-4o',
        'input' => $prompt,
        'tools' => [
            ['type' => 'web_search_preview']
        ]
    ]);

echo "Status B: " . $resB->status() . "\n";
if ($resB->successful()) {
    $data = $resB->json();
    echo "Content B:\n" . substr($data['output_text'] ?? json_encode($data), 0, 800) . "\n";
} else {
    echo "Body B: " . $resB->body() . "\n";
}
