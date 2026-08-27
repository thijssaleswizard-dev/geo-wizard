<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Services\AiEngineService;

$service = app(AiEngineService::class);
$prompt = "Waar kan ik een betrouwbare hovenier in Velp vinden die mijn tuin kan aanleggen?";

echo "=== Testing Prompt: '{$prompt}' ===\n\n";

echo "--- 1. OpenAI (with Web Search) ---\n";
$openAi = $service->queryOpenAI($prompt, "vitagroen");
echo "Mentioned: " . ($openAi['mentioned'] ? 'YES' : 'NO') . "\n";
echo "Text:\n" . ($openAi['text'] ?? '') . "\n";
echo "Citations:\n";
print_r($openAi['citations'] ?? []);

echo "\n--- 2. Gemini (with Google Grounding) ---\n";
$gemini = $service->queryGemini($prompt, "vitagroen");
echo "Mentioned: " . ($gemini['mentioned'] ? 'YES' : 'NO') . "\n";
echo "Text:\n" . ($gemini['text'] ?? '') . "\n";

echo "\n--- 3. Perplexity ---\n";
$pplx = $service->queryPerplexity($prompt, "vitagroen");
echo "Mentioned: " . ($pplx['mentioned'] ? 'YES' : 'NO') . "\n";
echo "Text:\n" . ($pplx['text'] ?? '') . "\n";
echo "Citations:\n";
print_r($pplx['citations'] ?? []);
