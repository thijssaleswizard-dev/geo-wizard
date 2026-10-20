<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$service = new App\Services\AiEngineService();
$company = 'vitagroen.nl';
$prompt = 'Waar kan ik een betrouwbare hovenier in Velp vinden die mijn tuin kan aanleggen?';

echo "========================================================\n";
echo "🚀 DEFINITIEVE TEST VAN ALLE 4 AI ENGINES IN GEO-WIZARD\n";
echo "========================================================\n\n";

// 1. OpenAI ChatGPT
echo "[1] OPENAI (ChatGPT)\n";
$start = microtime(true);
$res1 = $service->queryOpenAI($prompt, $company);
$dur1 = round((microtime(true) - $start) * 1000);
echo "  Status: " . ($res1['fallbackUsed'] ? "❌ FALLBACK" : "✅ LIVE API SUCCESS") . " ({$dur1}ms)\n";
echo "  Methode: " . $res1['method'] . "\n";
echo "  Citaties: " . count($res1['citations'] ?? []) . "\n";
echo "  Merk vermeld: " . ($res1['mentioned'] ? 'JA' : 'NEE') . "\n";
echo "  Snippet: " . substr(str_replace(["\r", "\n"], ' ', $res1['text']), 0, 140) . "...\n\n";

// 2. Perplexity AI
echo "[2] PERPLEXITY AI (Agent API)\n";
$start = microtime(true);
$res2 = $service->queryPerplexity($prompt, $company);
$dur2 = round((microtime(true) - $start) * 1000);
echo "  Status: " . ($res2['fallbackUsed'] ? "❌ FALLBACK" : "✅ LIVE API SUCCESS") . " ({$dur2}ms)\n";
echo "  Methode: " . $res2['method'] . "\n";
echo "  Citaties: " . count($res2['citations'] ?? []) . "\n";
echo "  Merk vermeld: " . ($res2['mentioned'] ? 'JA' : 'NEE') . "\n";
echo "  Snippet: " . substr(str_replace(["\r", "\n"], ' ', $res2['text']), 0, 140) . "...\n\n";

// 3. Google Gemini
echo "[3] GOOGLE GEMINI (Google Suite)\n";
$start = microtime(true);
$res3 = $service->queryGemini($prompt, $company);
$dur3 = round((microtime(true) - $start) * 1000);
echo "  Status: " . ($res3['fallbackUsed'] ? "❌ FALLBACK" : "✅ LIVE API SUCCESS") . " ({$dur3}ms)\n";
echo "  Methode: " . $res3['method'] . "\n";
echo "  Citaties: " . count($res3['citations'] ?? []) . "\n";
echo "  Merk vermeld: " . ($res3['mentioned'] ? 'JA' : 'NEE') . "\n";
echo "  Snippet: " . substr(str_replace(["\r", "\n"], ' ', $res3['text']), 0, 140) . "...\n\n";

// 4. Anthropic Claude
echo "[4] ANTHROPIC CLAUDE\n";
$start = microtime(true);
$res4 = $service->queryAnthropic($prompt, $company);
$dur4 = round((microtime(true) - $start) * 1000);
echo "  Status: " . ($res4['fallbackUsed'] ? "❌ FALLBACK" : "✅ LIVE API SUCCESS") . " ({$dur4}ms)\n";
echo "  Methode: " . $res4['method'] . "\n";
echo "  Citaties: " . count($res4['citations'] ?? []) . "\n";
echo "  Merk vermeld: " . ($res4['mentioned'] ? 'JA' : 'NEE') . "\n";
echo "  Snippet: " . substr(str_replace(["\r", "\n"], ' ', $res4['text']), 0, 140) . "...\n\n";

echo "========================================================\n";
