<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Services\AiEngineService;
use App\Services\CompetitorScraperService;

$service = app(CompetitorScraperService::class);
$ai = app(AiEngineService::class);

echo "=== 1. AI Perplexity prompt for 'hovenier velp' ===\n";
$res = $ai->queryPerplexity("Welke bekende hoveniersbedrijven en tuinmannen zijn gevestigd of actief in Velp (Gelderland)? Noem o.a. Fred Buurman, Vitagroen, Biljoen Groen, For U Green etc.", "vitagroen");
echo "Perplexity text:\n" . substr($res['text'] ?? '', 0, 800) . "\n";
echo "Perplexity citations:\n";
print_r($res['citations'] ?? []);
