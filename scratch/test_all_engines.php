<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Services\ScraperService;

$service = app(ScraperService::class);
$prompt = "Waar kan ik een betrouwbare hovenier in Velp vinden die mijn tuin kan aanleggen?";

$res = $service->runScraper($prompt, "vitagroen");

echo "\n=== ALL 8 ENGINES RESULT ===\n";
foreach ($res['modelMentions'] as $k => $m) {
    echo "- [" . strtoupper($k) . "] " . $m['name'] . ": Mentioned = " . ($m['mentioned'] ? 'YES' : 'NO') . " (Method: " . $m['method'] . ")\n";
    echo "  Summary snippet: " . substr(str_replace("\n", " ", $m['summary']), 0, 100) . "...\n";
}
