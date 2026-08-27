<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Services\AiEngineService;

$service = app(AiEngineService::class);
$prompt = "Waar kan ik een betrouwbare hovenier in Velp vinden die mijn tuin kan aanleggen?";

echo "=== Testing Pure Native SearchGPT & Google Grounding Pipeline for: '{$prompt}' ===\n\n";

$openAi = $service->queryOpenAI($prompt, "vitagroen");
echo "1. OpenAI (SearchGPT Web):\n";
echo "   - Mentioned: " . ($openAi['mentioned'] ? 'YES' : 'NO') . "\n";
echo "   - Text snippet: " . substr($openAi['text'], 0, 300) . "...\n";
echo "   - Citations: " . implode(', ', $openAi['citations'] ?? []) . "\n\n";

$gemini = $service->queryGemini($prompt, "vitagroen");
echo "2. Gemini (Google Search Grounding):\n";
echo "   - Mentioned: " . ($gemini['mentioned'] ? 'YES' : 'NO') . "\n";
echo "   - Text snippet: " . substr($gemini['text'], 0, 300) . "...\n\n";

$pplx = $service->queryPerplexity($prompt, "vitagroen");
echo "3. Perplexity (Sonar Live Index):\n";
echo "   - Mentioned: " . ($pplx['mentioned'] ? 'YES' : 'NO') . "\n";
echo "   - Text snippet: " . substr($pplx['text'], 0, 300) . "...\n";
echo "   - Citations: " . implode(', ', $pplx['citations'] ?? []) . "\n";
