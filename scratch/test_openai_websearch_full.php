<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\Http;

$apiKey = env('OPENAI_API_KEY');
$prompt = "Waar kan ik een betrouwbare hovenier in Velp vinden voor mijn tuinproject? Noem lokale bedrijven met Google reviews.";

$res = Http::withToken($apiKey)
    ->timeout(30)
    ->post('https://api.openai.com/v1/responses', [
        'model' => 'gpt-4o',
        'input' => $prompt,
        'tools' => [
            ['type' => 'web_search_preview']
        ]
    ]);

if ($res->successful()) {
    $data = $res->json();
    echo "=== OPENAI LIVE WEB SEARCH RESPONSES API ===\n";
    $outputItems = $data['output'] ?? [];
    $fullText = '';
    $citations = [];

    foreach ($outputItems as $item) {
        if ($item['type'] === 'message') {
            foreach ($item['content'] ?? [] as $c) {
                if ($c['type'] === 'output_text') {
                    $fullText .= $c['text'] ?? '';
                    foreach ($c['annotations'] ?? [] as $anno) {
                        if ($anno['type'] === 'url_citation' && !empty($anno['url'])) {
                            $citations[] = $anno['url'];
                        }
                    }
                }
            }
        }
    }

    echo "--- Full Text ---\n" . $fullText . "\n\n";
    echo "--- Citations (" . count($citations) . ") ---\n";
    print_r(array_unique($citations));
} else {
    echo "Error: " . $res->body() . "\n";
}
