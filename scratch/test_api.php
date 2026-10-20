<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$geminiKey = env('GEMINI_API_KEY');
$prompt = 'Waar kan ik een betrouwbare hovenier in Velp vinden die mijn tuin kan aanleggen?';
$systemPrompt = "Je bent de Google AI Zoekmachine Suite (Google Gemini, Google AI Mode en Google AI Overviews) voor de Nederlandse markt.
Evalueer de volgende zoekvraag van een gebruiker die zoekt naar betrouwbare dienstverleners of bedrijven in Nederland:
\"{$prompt}\"
Antwoord ALTIJD in strikt valide JSON formaat met exact deze 3 sleutels:
{
  \"gemini\": \"Een natuurlijk, behulpzaam adviesantwoord zoals Google Gemini dat formuleert.\",
  \"aimode\": \"Een interactief en vergelijkend overzicht zoals Google AI Mode dat toont.\",
  \"aioverviews\": \"Een beknopte, feitelijke AI Snapshot zoals die direct bovenaan Google Search verschijnt.\"
}";

$ch = curl_init("https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key={$geminiKey}");
curl_setopt_array($ch, [
    CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
    CURLOPT_POSTFIELDS => json_encode(['contents' => [['parts' => [['text' => $systemPrompt]]]]]),
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 20,
]);
$resp = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);
echo "Gemini (gemini-flash-lite-latest) HTTP $code:\n" . substr($resp, 0, 400) . "\n\n";
exit;









// 2. Test Claude model names
$claudeKey = env('ANTHROPIC_API_KEY');
$claudeModelsToTest = [
    'claude-3-5-sonnet-latest',
    'claude-3-5-sonnet-20240620',
    'claude-3-5-haiku-latest',
    'claude-3-haiku-20240307',
    'claude-3-sonnet-20240229',
    'claude-3-7-sonnet-latest',
    'claude-instant-1.2'
];

echo "\n=== CLAUDE MODELS TEST ===\n";
foreach ($claudeModelsToTest as $m) {
    $ch = curl_init("https://api.anthropic.com/v1/messages");
    curl_setopt_array($ch, [
        CURLOPT_HTTPHEADER => [
            "x-api-key: $claudeKey",
            "anthropic-version: 2023-06-01",
            "content-type: application/json"
        ],
        CURLOPT_POSTFIELDS => json_encode([
            'model' => $m,
            'max_tokens' => 10,
            'messages' => [['role' => 'user', 'content' => 'Hi']]
        ]),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 5,
    ]);
    $resp = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    echo "Model $m -> HTTP $code\n";
    if ($code === 200) {
        echo "  SUCCESS with $m!\n";
        break;
    }
}



echo "=== DIAGNOSTIC TEST VAN ALLE 4 AI ENGINES ===\n\n";

// 1. OpenAI
echo "[1] TEST OPENAI (ChatGPT)\n";
try {
    $resOpenAi = $service->queryOpenAI($prompt, $company);
    echo "  Status: " . ($resOpenAi['fallbackUsed'] ? "❌ FALLBACK GEBRUIKT" : "✅ ACTIEF (SUCCESS)") . "\n";
    echo "  Methode: " . $resOpenAi['method'] . "\n";
    echo "  Citaties: " . count($resOpenAi['citations'] ?? []) . "\n";
    echo "  Merk vermeld: " . ($resOpenAi['mentioned'] ? 'JA' : 'NEE') . "\n";
    echo "  Score: " . ($resOpenAi['score'] ?? 'N/A') . "\n";
    echo "  Snippet: " . substr(str_replace(["\r", "\n"], ' ', $resOpenAi['text']), 0, 150) . "...\n";
} catch (\Throwable $e) {
    echo "  Fout: " . $e->getMessage() . "\n";
}
echo "\n";

// 2. Perplexity
echo "[2] TEST PERPLEXITY (Agent API)\n";
try {
    $resPplx = $service->queryPerplexity($prompt, $company);
    echo "  Status: " . ($resPplx['fallbackUsed'] ? "❌ FALLBACK GEBRUIKT" : "✅ ACTIEF (SUCCESS)") . "\n";
    echo "  Methode: " . $resPplx['method'] . "\n";
    echo "  Citaties: " . count($resPplx['citations'] ?? []) . "\n";
    echo "  Merk vermeld: " . ($resPplx['mentioned'] ? 'JA' : 'NEE') . "\n";
    echo "  Score: " . ($resPplx['score'] ?? 'N/A') . "\n";
    echo "  Snippet: " . substr(str_replace(["\r", "\n"], ' ', $resPplx['text']), 0, 150) . "...\n";
} catch (\Throwable $e) {
    echo "  Fout: " . $e->getMessage() . "\n";
}
echo "\n";

// 3. Google Gemini
echo "[3] TEST GOOGLE GEMINI\n";
try {
    $resGemini = $service->queryGemini($prompt, $company);
    echo "  Status: " . ($resGemini['fallbackUsed'] ? "❌ FALLBACK GEBRUIKT" : "✅ ACTIEF (SUCCESS)") . "\n";
    echo "  Methode: " . $resGemini['method'] . "\n";
    echo "  Citaties: " . count($resGemini['citations'] ?? []) . "\n";
    echo "  Merk vermeld: " . ($resGemini['mentioned'] ? 'JA' : 'NEE') . "\n";
    echo "  Score: " . ($resGemini['score'] ?? 'N/A') . "\n";
    echo "  Snippet: " . substr(str_replace(["\r", "\n"], ' ', $resGemini['text']), 0, 150) . "...\n";
    if (!empty($resGemini['errorMsg'])) {
        echo "  Detail error: " . $resGemini['errorMsg'] . "\n";
    }
} catch (\Throwable $e) {
    echo "  Fout: " . $e->getMessage() . "\n";
}
echo "\n";

// 4. Anthropic Claude
echo "[4] TEST ANTHROPIC CLAUDE\n";
try {
    $resClaude = $service->queryAnthropic($prompt, $company);
    echo "  Status: " . ($resClaude['fallbackUsed'] ? "❌ FALLBACK GEBRUIKT" : "✅ ACTIEF (SUCCESS)") . "\n";
    echo "  Methode: " . $resClaude['method'] . "\n";
    echo "  Citaties: " . count($resClaude['citations'] ?? []) . "\n";
    echo "  Merk vermeld: " . ($resClaude['mentioned'] ? 'JA' : 'NEE') . "\n";
    echo "  Score: " . ($resClaude['score'] ?? 'N/A') . "\n";
    echo "  Snippet: " . substr(str_replace(["\r", "\n"], ' ', $resClaude['text']), 0, 150) . "...\n";
    if (!empty($resClaude['errorMsg'])) {
        echo "  Detail error: " . $resClaude['errorMsg'] . "\n";
    }
} catch (\Throwable $e) {
    echo "  Fout: " . $e->getMessage() . "\n";
}
echo "\n============================================\n";
