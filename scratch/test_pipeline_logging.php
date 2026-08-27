<?php

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Services\GeoLog;
use App\Services\ScraperService;
use App\Services\AiEngineService;

GeoLog::section("DEMO TEST VAN GEO LOGGING");

$aiEngine = new AiEngineService();
$scraperService = new ScraperService($aiEngine);

$result = $scraperService->runScraper("Wat is het beste online marketing bureau in Arnhem?", "Saleswizard");

GeoLog::info("Test afgerond. Overall score: {$result['overallScore']}%");
