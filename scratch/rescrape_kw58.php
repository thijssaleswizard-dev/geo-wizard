<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Keyword;
use App\Services\CompetitorScraperService;

// Clear any hallucinated cache
$kw = Keyword::find(58);
if ($kw) {
    $kw->update(['competitors_json' => null]);
}

$service = app(CompetitorScraperService::class);
$competitors = $service->getOrScrapeCompetitors(58, 'hovernier velp', 'vitagroen');

echo "=== 100% PURE REAL LIVE SERP COMPETITORS (Total: " . count($competitors) . ") ===\n";
foreach ($competitors as $c) {
    echo "{$c['rank']}: {$c['brand']} ({$c['domain']}) | Hits: " . ($c['hits'] ?? 1) . " | SOV: {$c['sov']}% | URL: " . ($c['citationUrls'][0] ?? 'N/A') . "\n";
}
