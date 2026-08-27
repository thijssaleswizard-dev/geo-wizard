<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Services\ScraperService;

$service = app(ScraperService::class);
$prompt = "Waar kan ik een betrouwbare hovenier in Velp vinden die mijn tuin kan aanleggen?";

$res = $service->runScraper($prompt, "vitagroen");

echo "=== PIPELINE SCAN RESULT FOR: '{$prompt}' ===\n";
echo "Total Mentions: " . $res['totalMentions'] . " / " . $res['totalModels'] . "\n";
echo "ChatGPT Mentioned: " . ($res['modelMentions']['chatgpt']['mentioned'] ? 'YES' : 'NO') . "\n";
echo "Gemini Mentioned: " . ($res['modelMentions']['gemini']['mentioned'] ? 'YES' : 'NO') . "\n";
echo "Perplexity Mentioned: " . ($res['modelMentions']['perplexity']['mentioned'] ? 'YES' : 'NO') . "\n\n";

echo "--- ChatGPT Summary ---\n" . substr($res['modelMentions']['chatgpt']['summary'], 0, 500) . "\n\n";
echo "--- Gemini Summary ---\n" . substr($res['modelMentions']['gemini']['summary'], 0, 500) . "\n\n";
