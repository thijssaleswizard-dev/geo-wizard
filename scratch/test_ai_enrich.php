<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Services\AiEngineService;

$ai = app(AiEngineService::class);
$prompt = "Je bent een expert in de Nederlandse markt en concurrentieanalyse voor GEO (Generative Engine Optimization).
Geef een lijst van 10-15 echte, actieve Nederlandse bedrijven/concurrenten voor de zoekterm: \"hovenier velp\".
Antwoord UITSLUITEND met een geldige JSON array van objecten, GEEN markdown codeblocks (geen ```json of ```), exact in dit formaat:
[
  {\"brand\": \"Bedrijfsnaam\", \"domain\": \"bedrijfsnaam.nl\"}
]";

$res = $ai->queryGemini($prompt, 'vitagroen');
echo "Gemini Response:\n" . $res['text'] . "\n";
