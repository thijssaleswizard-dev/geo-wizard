<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Services\AiEngineService;

$service = app(AiEngineService::class);
$prompt = "Wat zijn de meest betrouwbare online marketing bureaus in Arnhem?";

$res = $service->queryOpenAI($prompt, "saleswizard");

echo "=== OpenAI Live SearchGPT Output for Saleswizard ===\n";
echo "Mentioned: " . ($res['mentioned'] ? 'YES' : 'NO') . "\n";
echo "Position: " . $res['position'] . "\n";
echo "Score: " . $res['score'] . "\n\n";
echo "--- Full Text ---\n" . $res['text'] . "\n\n";
echo "--- Citations ---\n";
print_r($res['citations'] ?? []);
