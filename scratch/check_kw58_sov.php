<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Services\CompetitorScraperService;

$service = app(CompetitorScraperService::class);
$results = $service->getOrScrapeCompetitors(58, 'hovenier velp', 'vitagroen');

echo "=== Current Results for 'hovenier velp' ===\n";
foreach ($results as $c) {
    echo "{$c['rank']}: {$c['brand']} ({$c['domain']}) | Hits: {$c['hits']} | URLs: {$c['citations']} | SOV: {$c['sov']}% | Pos: {$c['position']}\n";
}
