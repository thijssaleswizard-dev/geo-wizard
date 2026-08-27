<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Services\CompetitorScraperService;

$service = app(CompetitorScraperService::class);
$competitors = $service->getOrScrapeCompetitors(58, 'hovernier velp', 'vitagroen');

echo "Total competitors found for 'hovernier velp': " . count($competitors) . "\n";
foreach ($competitors as $c) {
    echo "{$c['rank']}: {$c['brand']} ({$c['domain']}) | Hits: " . ($c['hits'] ?? 1) . " | SOV: {$c['sov']}%\n";
}
