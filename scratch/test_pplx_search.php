<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Services\AiEngineService;

$ai = app(AiEngineService::class);

echo "=== TESTING PERPLEXITY SEARCH (which has live real-time web search index) ===\n";
try {
    $res = $ai->queryPerplexity("Welke online marketing bureaus en internetbureaus zijn gevestigd of actief in Arnhem? Geef de echte bedrijfsnamen en hun domeinen (bijv. saleswizard.nl, zigt.nl, dofollow.nl, etc).", 'Saleswizard');
    echo "Perplexity Text:\n" . substr($res['text'] ?? '', 0, 1000) . "\n";
    echo "Perplexity Citations (" . count($res['citations'] ?? []) . "):\n";
    print_r($res['citations'] ?? []);
} catch (\Exception $e) {
    echo "Perplexity err: " . $e->getMessage() . "\n";
}
