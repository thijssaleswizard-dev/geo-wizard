<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Keyword;
use App\Services\CompetitorScraperService;

$service = app(CompetitorScraperService::class);

$keywords = Keyword::with('project')->get();
foreach ($keywords as $kw) {
    $compKey = $kw->project ? $kw->project->company : 'Saleswizard';
    // Clear old cache to re-scrape cleanly
    $kw->update(['competitors_json' => null]);
    
    $results = $service->getOrScrapeCompetitors($kw->id, $kw->keyword, $compKey);
    
    echo "========================================\n";
    echo "Keyword #{$kw->id}: '{$kw->keyword}' (Bedrijf: {$compKey})\n";
    echo "Totaal gevonden echte concurrenten: " . count($results) . "\n";
    foreach (array_slice($results, 0, 10) as $c) {
        echo "  - {$c['rank']}: {$c['brand']} ({$c['domain']}) | Hits: " . ($c['hits'] ?? 1) . " | SOV: {$c['sov']}%\n";
    }
}
