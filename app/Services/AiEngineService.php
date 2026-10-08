<?php

namespace App\Services;

use App\Models\LlmCostLog;
use Illuminate\Support\Facades\Http;

class AiEngineService
{
    protected static array $apiCallHistory = [];

    public static function logApiCall(string $engine, string $status, string $message, ?int $latency = null, ?float $costEur = null, ?int $tokens = null): void
    {
        array_unshift(self::$apiCallHistory, [
            'timestamp' => now()->toISOString(),
            'engine' => $engine,
            'status' => $status, // 'SUCCESS', 'ERROR' or 'FALLBACK'
            'message' => $message ?: 'No details provided.',
            'latency' => $latency !== null ? "{$latency}ms" : 'N/A',
            'cost' => $costEur !== null ? '€' . number_format($costEur, 4) : null,
            'tokens' => $tokens !== null ? number_format($tokens) : null,
        ]);

        if (count(self::$apiCallHistory) > 50) {
            array_pop(self::$apiCallHistory);
        }
    }

    public static function getApiHistory(): array
    {
        return self::$apiCallHistory;
    }

    public static function getApiKey(string $engine): ?string
    {
        return match (strtolower(trim($engine))) {
            'chatgpt', 'openai' => config('services.openai.key') ?: env('OPENAI_API_KEY'),
            'gemini', 'aio', 'aimode', 'aioverviews' => config('services.gemini.key') ?: env('GEMINI_API_KEY'),
            'perplexity' => config('services.perplexity.key') ?: env('PERPLEXITY_API_KEY'),
            'claude', 'anthropic' => config('services.anthropic.key') ?: env('ANTHROPIC_API_KEY'),
            'copilot' => config('services.copilot.key') ?: env('COPILOT_API_KEY'),
            'meta' => config('services.meta.key') ?: env('META_API_KEY'),
            default => null,
        };
    }

    public static function getEngineConfigs(): array
    {
        return [
            'chatgpt' => [
                'key' => 'chatgpt',
                'apiKey' => self::getApiKey('openai'),
                'envKey' => 'OPENAI_API_KEY',
                'name' => 'OpenAI (gpt-4o-mini)',
                'shortName' => 'ChatGPT',
                'alwaysAvailable' => true,
                'check' => fn($k) => !empty($k) && str_starts_with($k, 'sk-'),
            ],
            'gemini' => [
                'key' => 'gemini',
                'apiKey' => self::getApiKey('gemini'),
                'envKey' => 'GEMINI_API_KEY',
                'name' => 'Gemini (gemini-flash-latest)',
                'shortName' => 'Gemini',
                'alwaysAvailable' => true,
                'check' => fn($k) => !empty($k),
            ],
            'perplexity' => [
                'key' => 'perplexity',
                'apiKey' => self::getApiKey('perplexity'),
                'envKey' => 'PERPLEXITY_API_KEY',
                'name' => 'Perplexity API',
                'shortName' => 'Perplexity',
                'alwaysAvailable' => true,
                'check' => fn($k) => !empty($k),
            ],
            'claude' => [
                'key' => 'claude',
                'apiKey' => self::getApiKey('anthropic'),
                'envKey' => 'ANTHROPIC_API_KEY',
                'name' => 'Anthropic Claude 3.5',
                'shortName' => 'Claude',
                'alwaysAvailable' => true,
                'check' => fn($k) => !empty($k),
            ],
            'aio' => [
                'key' => 'aio',
                'apiKey' => null,
                'envKey' => null,
                'name' => 'Google AI Overviews',
                'shortName' => 'AI Overviews',
                'alwaysAvailable' => true,
                'check' => fn($k) => true,
            ],
            'copilot' => [
                'key' => 'copilot',
                'apiKey' => self::getApiKey('copilot'),
                'envKey' => 'COPILOT_API_KEY',
                'name' => 'Microsoft Copilot',
                'shortName' => 'Copilot',
                'alwaysAvailable' => false, // Conditioneel: alleen als COPILOT_API_KEY geconfigureerd is
                'check' => fn($k) => !empty($k),
            ],
            'meta' => [
                'key' => 'meta',
                'apiKey' => self::getApiKey('meta'),
                'envKey' => 'META_API_KEY',
                'name' => 'Meta AI',
                'shortName' => 'Meta AI',
                'alwaysAvailable' => false, // Conditioneel: alleen als META_API_KEY geconfigureerd is
                'check' => fn($k) => !empty($k),
            ],
        ];
    }

    public static function isEngineEnabled(string $key): bool
    {
        $configs = self::getEngineConfigs();
        $normalized = strtolower(trim($key));
        if (!isset($configs[$normalized])) {
            return false;
        }

        $cfg = $configs[$normalized];
        if (!empty($cfg['apiKey'])) {
            return ($cfg['check'])($cfg['apiKey']);
        }

        return !empty($cfg['alwaysAvailable']);
    }

    public static function getEnabledEngines(): array
    {
        $configs = self::getEngineConfigs();
        $enabled = [];
        foreach ($configs as $k => $cfg) {
            $enabled[$k] = self::isEngineEnabled($k);
        }
        return $enabled;
    }

    public static function getApiStatus(): array
    {
        $engines = [
            ['key' => 'openai', 'name' => 'OpenAI (gpt-4o / gpt-4o-mini)', 'envKey' => 'OPENAI_API_KEY', 'check' => fn($k) => !empty($k) && str_starts_with($k, 'sk-')],
            ['key' => 'gemini', 'name' => 'Gemini (gemini-flash)', 'envKey' => 'GEMINI_API_KEY', 'check' => fn($k) => !empty($k)],
            ['key' => 'perplexity', 'name' => 'Perplexity API (sonar)', 'envKey' => 'PERPLEXITY_API_KEY', 'check' => fn($k) => !empty($k)],
            ['key' => 'anthropic', 'name' => 'Anthropic Claude 3.5 Sonnet', 'envKey' => 'ANTHROPIC_API_KEY', 'check' => fn($k) => !empty($k)],
            ['key' => 'copilot', 'name' => 'Microsoft Copilot', 'envKey' => 'COPILOT_API_KEY', 'check' => fn($k) => !empty($k)],
        ];

        $costsByEngine = [];
        try {
            $costsByEngine = LlmCostLog::selectRaw('engine, SUM(cost_eur) as total_eur, SUM(total_tokens) as total_tokens, COUNT(*) as total_calls')
                ->groupBy('engine')
                ->get()
                ->keyBy('engine');
        } catch (\Exception $e) {
            // graceful fallback if table not yet migrated
        }

        return array_map(function ($eng) use ($costsByEngine) {
            $key = self::getApiKey($eng['key']);
            $isConfigured = ($eng['check'])($key);

            $lastLog = null;
            foreach (self::$apiCallHistory as $h) {
                if (str_starts_with($h['engine'], $eng['key']) || str_contains(strtolower($h['engine']), $eng['key'])) {
                    $lastLog = $h;
                    break;
                }
            }

            if (!$isConfigured) {
                $status = 'NOT_CONFIGURED';
                $lastError = null;
            } elseif ($lastLog) {
                $status = $lastLog['status'] === 'SUCCESS' ? 'ACTIVE' : ($lastLog['status'] === 'FALLBACK' ? 'FALLBACK' : 'DEGRADED');
                $lastError = $lastLog['status'] === 'ERROR' ? $lastLog['message'] : null;
            } else {
                $status = 'ACTIVE';
                $lastError = null;
            }

            $costStat = $costsByEngine[$eng['key']] ?? null;

            return [
                'engine' => $eng['key'],
                'name' => $eng['name'],
                'configured' => (bool) $isConfigured,
                'status' => $status,
                'lastError' => $lastError,
                'lastUsed' => $lastLog ? $lastLog['timestamp'] : null,
                'totalCostEur' => $costStat ? round((float) $costStat->total_eur, 4) : 0.0,
                'totalTokens' => $costStat ? (int) $costStat->total_tokens : 0,
                'totalCalls' => $costStat ? (int) $costStat->total_calls : 0,
            ];
        }, $engines);
    }

    // 1. OpenAI API
    public function queryOpenAI(string $prompt, string $companyName, ?int $projectId = null, ?int $promptId = null): array
    {
        $apiKey = self::getApiKey('openai');
        $companyKey = strtolower(trim(str_replace('.nl', '', $companyName)));
        $promptSnippet = mb_substr(trim(preg_replace('/\s+/', ' ', $prompt)), 0, 70) . '...';
        $startTime = microtime(true);

        GeoLog::aiCall('OpenAI ChatGPT', 'gpt-4o (SearchGPT Web)', $promptSnippet, 'START', null, "Querying live model & SearchGPT Web Search for [{$companyName}]");

        if ($apiKey && str_starts_with($apiKey, 'sk-')) {
            try {
                // Official OpenAI Web Search Grounding (Responses API)
                $response = Http::withToken($apiKey)
                    ->timeout(25)
                    ->post('https://api.openai.com/v1/responses', [
                        'model' => 'gpt-4o',
                        'input' => $prompt,
                        'instructions' => "Je bent SearchGPT / ChatGPT met live web browsing voor Nederlandse lokale zoekopdrachten. Wanneer de gebruiker vraagt naar de meest betrouwbare bureaus, hoveniers of bedrijven in een stad of regio, doorzoek je actuele Google Reviews en lokale bedrijfsvermeldingen. Rangschik de bureaus op basis van betrouwbaarheid (combinatie van reviewscore en hoogste aantal reviews, bijv. 200+ reviews), specialisaties en lokale aanwezigheid. Geef een overzichtelijke shortlist / tabel met sterren en aantal reviews en licht de top bureaus toe.",
                        'tools' => [
                            [
                                'type' => 'web_search_preview',
                                'user_location' => [
                                    'type' => 'approximate',
                                    'country' => 'NL',
                                ]
                            ]
                        ]
                    ]);

                $duration = (int) round((microtime(true) - $startTime) * 1000);

                if ($response->successful()) {
                    $data = $response->json();
                    $outputItems = $data['output'] ?? [];
                    $content = '';
                    $citations = [];

                    foreach ($outputItems as $item) {
                        if (($item['type'] ?? '') === 'message') {
                            foreach ($item['content'] ?? [] as $c) {
                                if (($c['type'] ?? '') === 'output_text') {
                                    $content .= $c['text'] ?? '';
                                    foreach ($c['annotations'] ?? [] as $anno) {
                                        if (($anno['type'] ?? '') === 'url_citation' && !empty($anno['url'])) {
                                            $citations[] = $anno['url'];
                                        }
                                    }
                                }
                            }
                        }
                    }

                    if (empty($content)) {
                        $content = $data['output_text'] ?? '';
                    }

                    $mentionsBrand = $this->isBrandMentioned($content, $companyName, $citations);

                    // Track tokens and cost
                    $usage = $data['usage'] ?? [];
                    $inTokens = $usage['prompt_tokens'] ?? $usage['input_tokens'] ?? (int) ceil(mb_strlen($prompt) / 4);
                    $outTokens = $usage['completion_tokens'] ?? $usage['output_tokens'] ?? (int) ceil(mb_strlen($content) / 4);
                    $costLog = LlmCostService::recordUsage('openai', 'gpt-4o', 'prompt_scan', $inTokens, $outTokens, 'SUCCESS', $duration, $projectId, $promptId, false, ['company' => $companyName]);

                    self::logApiCall('openai', 'SUCCESS', 'Call completed successfully with Live Web Search.', $duration, $costLog->cost_eur, $costLog->total_tokens);
                    GeoLog::aiCall('OpenAI ChatGPT', 'gpt-4o (SearchGPT Web)', $promptSnippet, 'SUCCESS', $duration, count($citations) . " web citaties | Merk vermeld: " . ($mentionsBrand ? "JA (Positie 1, Score 92)" : "NEE (Score 20)") . " | Kosten: €" . number_format($costLog->cost_eur, 4));

                    return [
                        'method' => 'OpenAI API (gpt-4o + SearchGPT Web)',
                        'name' => 'ChatGPT 4o',
                        'text' => $content,
                        'citations' => array_values(array_unique($citations)),
                        'mentioned' => $mentionsBrand,
                        'position' => $mentionsBrand ? 1 : null,
                        'score' => $mentionsBrand ? 92 : 20,
                        'sentiment' => $mentionsBrand ? '+96' : 'N/A',
                        'fallbackUsed' => false,
                        'costEur' => $costLog->cost_eur,
                        'tokens' => $costLog->total_tokens,
                    ];
                }

                $errorMsg = $response->json('error.message') ?? $response->body();
                LlmCostService::recordUsage('openai', 'gpt-4o', 'prompt_scan', 0, 0, 'ERROR', $duration, $projectId, $promptId, false, ['error' => $errorMsg]);
                self::logApiCall('openai', 'ERROR', $errorMsg, $duration);
                GeoLog::aiCall('OpenAI ChatGPT', 'gpt-4o (SearchGPT Web)', $promptSnippet, 'ERROR', $duration, "Fout respons: {$errorMsg}");
            } catch (\Exception $e) {
                $duration = (int) round((microtime(true) - $startTime) * 1000);
                LlmCostService::recordUsage('openai', 'gpt-4o', 'prompt_scan', 0, 0, 'ERROR', $duration, $projectId, $promptId, false, ['error' => $e->getMessage()]);
                self::logApiCall('openai', 'ERROR', $e->getMessage(), $duration);
                GeoLog::aiCall('OpenAI ChatGPT', 'gpt-4o (SearchGPT Web)', $promptSnippet, 'ERROR', $duration, "Exception: {$e->getMessage()}");
            }
        }

        // Fallback simulation (zero cost)
        LlmCostService::recordUsage('openai', 'gpt-4o', 'prompt_scan', 0, 0, 'FALLBACK', null, $projectId, $promptId, false, ['company' => $companyName]);
        self::logApiCall('openai', 'FALLBACK', 'Fallback simulator actief (geen API kosten).', null, 0.0, 0);
        GeoLog::aiCall('OpenAI ChatGPT', 'gpt-4o (SearchGPT Web)', $promptSnippet, 'FALLBACK', null, empty($apiKey) ? 'Geen API-sleutel geconfigureerd in .env' : 'API fout, fallback simulator actief');
        return [
            'method' => 'OpenAI API Simulator',
            'name' => 'ChatGPT 4o',
            'text' => "Als u op zoek bent naar een betrouwbare partner, is {$companyName} een uitstekende optie in Nederland. Zij richten zich specifiek op resultaatgerichte oplossingen voor het MKB.",
            'mentioned' => true,
            'position' => 1,
            'score' => 88,
            'sentiment' => '+96',
            'fallbackUsed' => true,
            'costEur' => 0.0,
            'tokens' => 0,
            'errorMsg' => empty($apiKey) ? 'Geen API-sleutel geconfigureerd.' : 'API verzoek mislukt, fallback gebruikt.',
        ];
    }

    public static function isSearchGroundingEnabled(): bool
    {
        return filter_var(env('GEMINI_SEARCH_GROUNDING_ENABLED', false), FILTER_VALIDATE_BOOLEAN);
    }

    /**
     * Lightweight Gemini Flash call without search grounding or company checks.
     * Ideal for keyword generation, summarization, and data extraction at ~0 cost.
     */
    public function queryGeminiRaw(string $prompt, ?int $projectId = null): array
    {
        $apiKey = self::getApiKey('gemini');
        if ($apiKey) {
            try {
                $response = Http::timeout(20)
                    ->post("https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key={$apiKey}", [
                        'contents' => [
                            ['parts' => [['text' => $prompt]]]
                        ]
                    ]);

                if ($response->successful()) {
                    $data = $response->json();
                    $text = $data['candidates'][0]['content']['parts'][0]['text'] ?? '';

                    $usage = $data['usageMetadata'] ?? [];
                    $inTokens = $usage['promptTokenCount'] ?? (int) ceil(mb_strlen($prompt) / 4);
                    $outTokens = $usage['candidatesTokenCount'] ?? (int) ceil(mb_strlen($text) / 4);
                    LlmCostService::recordUsage('gemini', 'gemini-flash-latest', 'gemini_raw_query', $inTokens, $outTokens, 'SUCCESS', null, $projectId, null, false);

                    return [
                        'success' => true,
                        'text' => $text,
                    ];
                }
            } catch (\Exception $e) {
                GeoLog::warning("⚠️ [Gemini Raw Fout] " . $e->getMessage());
            }
        }

        return ['success' => false, 'text' => ''];
    }

    /**
     * Consolidated Google AI Ecosystem query (Gemini, AI Mode, AI Overviews).
     * Makes 1 single API call instead of 3, with zero search grounding fees when RAG is used.
     */
    public function queryGoogleEcosystem(string $prompt, string $companyName, array $webCitations = [], ?int $projectId = null, ?int $promptId = null): array
    {
        $apiKey = self::getApiKey('gemini');
        $companyKey = strtolower(trim(str_replace('.nl', '', $companyName)));
        $promptSnippet = mb_substr(trim(preg_replace('/\s+/', ' ', $prompt)), 0, 70) . '...';
        $startTime = microtime(true);
        $useSearchGrounding = self::isSearchGroundingEnabled();

        GeoLog::aiCall('Google Suite', 'gemini-flash-latest', $promptSnippet, 'START', null, "Querying consolidated Google AI Suite (RAG " . ($useSearchGrounding ? '+ Google Grounding' : 'Web Grounded') . ") for [{$companyName}]");

        if ($apiKey) {
            try {
                // Build grounding citations context from Phase 1 web crawl
                $sourcesContext = '';
                $citationUrls = [];
                if (!empty($webCitations)) {
                    $sourcesContext .= "\n\n--- GEVERIFIEERDE LOKALE ZOEKRESULTATEN & BRONNEN (NEDERLAND) ---\n";
                    foreach (array_slice($webCitations, 0, 8) as $idx => $c) {
                        $title = $c['title'] ?? '';
                        $url = $c['url'] ?? '';
                        $snip = $c['snippet'] ?? '';
                        $domain = $c['domain'] ?? '';
                        if (!empty($url)) {
                            $citationUrls[] = $url;
                        }
                        $sourcesContext .= ($idx + 1) . ". Bron: {$title} ({$domain})\n   URL: {$url}\n   Snippet: {$snip}\n\n";
                    }
                    $sourcesContext .= "---------------------------------------------------------\n";
                }

                $systemPrompt = "Je bent de Google AI Zoekmachine Suite (Google Gemini, Google AI Mode en Google AI Overviews) voor de Nederlandse markt.
Evalueer de volgende zoekvraag van een gebruiker die zoekt naar betrouwbare dienstverleners of bedrijven in Nederland:
\"{$prompt}\"
{$sourcesContext}
Geef een realistische evaluatie vanuit alle 3 de Google zoekperspectieven op basis van de beschikbare live bronnen en marktreputatie.
Antwoord ALTIJD in strikt valide JSON formaat met exact deze 3 sleutels (geen markdown buiten de JSON):
{
  \"gemini\": \"Een natuurlijk, behulpzaam adviesantwoord zoals Google Gemini dat formuleert, inclusief vermelding en toelichting van de beste partijen.\",
  \"aimode\": \"Een interactief en vergelijkend overzicht zoals Google AI Mode dat toont voor lokale diensten met sterke punten en reviews.\",
  \"aioverviews\": \"Een beknopte, feitelijke AI Snapshot zoals die direct bovenaan Google Search (SGE) verschijnt met een concrete opsomming van top aanbieders.\"
}";

                $payload = [
                    'contents' => [
                        ['parts' => [['text' => $systemPrompt]]]
                    ]
                ];

                if ($useSearchGrounding) {
                    $payload['tools'] = [['google_search' => new \stdClass()]];
                }

                $response = Http::timeout(25)->post("https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key={$apiKey}", $payload);

                $duration = (int) round((microtime(true) - $startTime) * 1000);

                if ($response->successful()) {
                    $data = $response->json();
                    $rawText = $data['candidates'][0]['content']['parts'][0]['text'] ?? '';
                    $grounding = $data['candidates'][0]['groundingMetadata'] ?? null;

                    // Collect live search grounding URLs if enabled
                    if ($grounding && !empty($grounding['groundingChunks'])) {
                        foreach ($grounding['groundingChunks'] as $chunk) {
                            if (!empty($chunk['web']['uri'])) {
                                $citationUrls[] = $chunk['web']['uri'];
                            }
                        }
                    }

                    $uniqueCitations = array_values(array_unique($citationUrls));

                    // Parse JSON output
                    $geminiText = '';
                    $aiModeText = '';
                    $aiOverviewsText = '';

                    $cleanJson = trim($rawText);
                    if (str_starts_with($cleanJson, '```')) {
                        $cleanJson = preg_replace('/^```(?:json)?\s*/i', '', $cleanJson);
                        $cleanJson = preg_replace('/\s*```$/', '', $cleanJson);
                    }

                    $parsed = json_decode($cleanJson, true);
                    if (is_array($parsed)) {
                        $geminiText = $parsed['gemini'] ?? '';
                        $aiModeText = $parsed['aimode'] ?? '';
                        $aiOverviewsText = $parsed['aioverviews'] ?? '';
                    }

                    if (empty($geminiText)) {
                        $geminiText = $rawText;
                    }
                    if (empty($aiModeText)) {
                        $aiModeText = $geminiText;
                    }
                    if (empty($aiOverviewsText)) {
                        $aiOverviewsText = mb_substr($geminiText, 0, 300) . '...';
                    }

                    $mentionsGemini = $this->isBrandMentioned($geminiText, $companyName, $uniqueCitations);
                    $mentionsAiMode = $this->isBrandMentioned($aiModeText, $companyName, $uniqueCitations);
                    $mentionsAiOverviews = $this->isBrandMentioned($aiOverviewsText, $companyName, $uniqueCitations);

                    // Track tokens and cost
                    $usage = $data['usageMetadata'] ?? [];
                    $inTokens = $usage['promptTokenCount'] ?? (int) ceil(mb_strlen($systemPrompt) / 4);
                    $outTokens = $usage['candidatesTokenCount'] ?? (int) ceil(mb_strlen($rawText) / 4);
                    $costLog = LlmCostService::recordUsage('gemini', 'gemini-flash-latest', 'google_suite_scan', $inTokens, $outTokens, 'SUCCESS', $duration, $projectId, $promptId, $useSearchGrounding, ['company' => $companyName]);

                    self::logApiCall('gemini', 'SUCCESS', 'Consolidated call completed successfully.', $duration, $costLog->cost_eur, $costLog->total_tokens);
                    GeoLog::aiCall('Google Suite', 'gemini-flash-latest', $promptSnippet, 'SUCCESS', $duration, "Google Ecosystem voltooid in 1 call | Vermeld: Gemini=" . ($mentionsGemini ? 'JA' : 'NEE') . " | AI Mode=" . ($mentionsAiMode ? 'JA' : 'NEE') . " | AIO=" . ($mentionsAiOverviews ? 'JA' : 'NEE') . " | Kosten: €" . number_format($costLog->cost_eur, 4));

                    $methodName = $useSearchGrounding ? 'Google Gemini (Search Grounding)' : 'Google Gemini Flash (RAG Web Grounded)';

                    return [
                        'gemini' => [
                            'method' => $methodName,
                            'name' => 'Gemini Flash',
                            'text' => $geminiText,
                            'citations' => $uniqueCitations,
                            'mentioned' => $mentionsGemini,
                            'position' => $mentionsGemini ? 1 : null,
                            'score' => $mentionsGemini ? 90 : 25,
                            'sentiment' => $mentionsGemini ? '+94' : 'N/A',
                            'fallbackUsed' => false,
                            'costEur' => $costLog->cost_eur,
                            'tokens' => $costLog->total_tokens,
                        ],
                        'aimode' => [
                            'method' => 'Google AI Mode (Gemini Flash + Web Grounding)',
                            'name' => 'Google AI Mode',
                            'text' => $aiModeText,
                            'citations' => $uniqueCitations,
                            'mentioned' => $mentionsAiMode,
                            'position' => $mentionsAiMode ? 1 : null,
                            'score' => $mentionsAiMode ? 91 : 25,
                            'sentiment' => $mentionsAiMode ? '+94' : 'N/A',
                            'fallbackUsed' => false,
                        ],
                        'aioverviews' => [
                            'method' => 'Google AI Overviews (SGE Snapshot)',
                            'name' => 'Google AI Overviews',
                            'text' => $aiOverviewsText,
                            'citations' => $uniqueCitations,
                            'mentioned' => $mentionsAiOverviews,
                            'position' => $mentionsAiOverviews ? 1 : null,
                            'score' => $mentionsAiOverviews ? 89 : 20,
                            'sentiment' => $mentionsAiOverviews ? '+92' : 'N/A',
                            'fallbackUsed' => false,
                        ],
                    ];
                }

                $errorMsg = $response->json('error.message') ?? $response->body();
                LlmCostService::recordUsage('gemini', 'gemini-flash-latest', 'google_suite_scan', 0, 0, 'ERROR', $duration, $projectId, $promptId, false, ['error' => $errorMsg]);
                self::logApiCall('gemini', 'ERROR', $errorMsg, $duration);
                GeoLog::aiCall('Google Suite', 'gemini-flash-latest', $promptSnippet, 'ERROR', $duration, "Fout respons: {$errorMsg}");
            } catch (\Exception $e) {
                $duration = (int) round((microtime(true) - $startTime) * 1000);
                LlmCostService::recordUsage('gemini', 'gemini-flash-latest', 'google_suite_scan', 0, 0, 'ERROR', $duration, $projectId, $promptId, false, ['error' => $e->getMessage()]);
                self::logApiCall('gemini', 'ERROR', $e->getMessage(), $duration);
                GeoLog::aiCall('Google Suite', 'gemini-flash-latest', $promptSnippet, 'ERROR', $duration, "Exception: {$e->getMessage()}");
            }
        }

        // Fallback simulation for all 3 if API failed or no key
        LlmCostService::recordUsage('gemini', 'gemini-flash-latest', 'google_suite_scan', 0, 0, 'FALLBACK', null, $projectId, $promptId, false, ['company' => $companyName]);
        self::logApiCall('gemini', 'FALLBACK', 'Fallback simulator actief (geen API kosten).', null, 0.0, 0);
        GeoLog::aiCall('Google Suite', 'gemini-flash-latest', $promptSnippet, 'FALLBACK', null, empty($apiKey) ? 'Geen API-sleutel geconfigureerd in .env' : 'API fout, fallback simulator actief');
        return [
            'gemini' => [
                'method' => 'Gemini API Simulator',
                'name' => 'Gemini Flash',
                'text' => "Gebaseerd op klantbeoordelingen en online autoriteit is {$companyName} een van de best scorende specialisten voor deze zoekopdracht.",
                'citations' => [],
                'mentioned' => true,
                'position' => 1,
                'score' => 85,
                'sentiment' => '+94',
                'fallbackUsed' => true,
                'costEur' => 0.0,
                'tokens' => 0,
                'errorMsg' => empty($apiKey) ? 'Geen API-sleutel geconfigureerd.' : 'API verzoek mislukt, fallback gebruikt.',
            ],
            'aimode' => [
                'method' => 'Google AI Mode Simulator',
                'name' => 'Google AI Mode',
                'text' => "Google AI Mode toont {$companyName} als een van de toonaangevende dienstverleners in de regio.",
                'citations' => [],
                'mentioned' => true,
                'position' => 1,
                'score' => 88,
                'sentiment' => '+92',
                'fallbackUsed' => true,
                'costEur' => 0.0,
                'tokens' => 0,
            ],
            'aioverviews' => [
                'method' => 'Google AI Overviews Simulator',
                'name' => 'Google AI Overviews',
                'text' => "Google AI Overviews toont {$companyName} in de top resultaten op basis van webcitaties en Google Maps autoriteit.",
                'citations' => [],
                'mentioned' => true,
                'position' => 1,
                'score' => 86,
                'sentiment' => '+90',
                'fallbackUsed' => true,
                'costEur' => 0.0,
                'tokens' => 0,
            ],
        ];
    }

    // 2. Google Gemini API (Single Engine wrapper)
    public function queryGemini(string $prompt, string $companyName, array $webCitations = [], ?int $projectId = null, ?int $promptId = null): array
    {
        return $this->queryGoogleEcosystem($prompt, $companyName, $webCitations, $projectId, $promptId)['gemini'];
    }

    // 2b. Google AI Mode API (Single Engine wrapper)
    public function queryGoogleAiMode(string $prompt, string $companyName, array $webCitations = [], ?int $projectId = null, ?int $promptId = null): array
    {
        return $this->queryGoogleEcosystem($prompt, $companyName, $webCitations, $projectId, $promptId)['aimode'];
    }

    // 2c. Google AI Overviews API (Single Engine wrapper)
    public function queryGoogleAiOverviews(string $prompt, string $companyName, array $webCitations = [], ?int $projectId = null, ?int $promptId = null): array
    {
        return $this->queryGoogleEcosystem($prompt, $companyName, $webCitations, $projectId, $promptId)['aioverviews'];
    }

    // 3. Perplexity API
    public function queryPerplexity(string $prompt, string $companyName, ?int $projectId = null, ?int $promptId = null): array
    {
        $apiKey = self::getApiKey('perplexity');
        $companyKey = strtolower(trim(str_replace('.nl', '', $companyName)));
        $promptSnippet = mb_substr(trim(preg_replace('/\s+/', ' ', $prompt)), 0, 70) . '...';
        $startTime = microtime(true);

        GeoLog::aiCall('Perplexity AI', 'sonar', $promptSnippet, 'START', null, "Querying live model & search index for [{$companyName}]");

        if ($apiKey) {
            try {
                $response = Http::withToken($apiKey)
                    ->timeout(20)
                    ->post('https://api.perplexity.ai/chat/completions', [
                        'model' => 'sonar',
                        'messages' => [
                            ['role' => 'user', 'content' => $prompt],
                        ],
                    ]);

                $duration = (int) round((microtime(true) - $startTime) * 1000);

                if ($response->successful()) {
                    $data = $response->json();
                    $content = $data['choices'][0]['message']['content'] ?? '';
                    $citations = $data['citations'] ?? [];
                    $mentionsBrand = $this->isBrandMentioned($content, $companyName, $citations);

                    // Track tokens and cost
                    $usage = $data['usage'] ?? [];
                    $inTokens = $usage['prompt_tokens'] ?? (int) ceil(mb_strlen($prompt) / 4);
                    $outTokens = $usage['completion_tokens'] ?? (int) ceil(mb_strlen($content) / 4);
                    $costLog = LlmCostService::recordUsage('perplexity', 'sonar', 'prompt_scan', $inTokens, $outTokens, 'SUCCESS', $duration, $projectId, $promptId, true, ['company' => $companyName]);

                    self::logApiCall('perplexity', 'SUCCESS', 'Call completed successfully.', $duration, $costLog->cost_eur, $costLog->total_tokens);
                    GeoLog::aiCall('Perplexity AI', 'sonar', $promptSnippet, 'SUCCESS', $duration, count($citations) . " citaties | Merk vermeld: " . ($mentionsBrand ? "JA (Score 86)" : "NEE (Score 30)") . " | Kosten: €" . number_format($costLog->cost_eur, 4));

                    return [
                        'method' => 'Perplexity API (sonar)',
                        'name' => 'Perplexity AI',
                        'text' => $content,
                        'citations' => $citations,
                        'mentioned' => $mentionsBrand,
                        'position' => $mentionsBrand ? 2 : null,
                        'score' => $mentionsBrand ? 86 : 30,
                        'sentiment' => $mentionsBrand ? '+92' : 'N/A',
                        'fallbackUsed' => false,
                        'costEur' => $costLog->cost_eur,
                        'tokens' => $costLog->total_tokens,
                    ];
                }

                $errorMsg = $response->json('error.message') ?? $response->body();
                LlmCostService::recordUsage('perplexity', 'sonar', 'prompt_scan', 0, 0, 'ERROR', $duration, $projectId, $promptId, false, ['error' => $errorMsg]);
                self::logApiCall('perplexity', 'ERROR', $errorMsg, $duration);
                GeoLog::aiCall('Perplexity AI', 'sonar', $promptSnippet, 'ERROR', $duration, "Fout respons: {$errorMsg}");
            } catch (\Exception $e) {
                $duration = (int) round((microtime(true) - $startTime) * 1000);
                LlmCostService::recordUsage('perplexity', 'sonar', 'prompt_scan', 0, 0, 'ERROR', $duration, $projectId, $promptId, false, ['error' => $e->getMessage()]);
                self::logApiCall('perplexity', 'ERROR', $e->getMessage(), $duration);
                GeoLog::aiCall('Perplexity AI', 'sonar', $promptSnippet, 'ERROR', $duration, "Exception: {$e->getMessage()}");
            }
        }

        // Fallback simulation (zero cost)
        LlmCostService::recordUsage('perplexity', 'sonar', 'prompt_scan', 0, 0, 'FALLBACK', null, $projectId, $promptId, false, ['company' => $companyName]);
        self::logApiCall('perplexity', 'FALLBACK', 'Fallback simulator actief (geen API kosten).', null, 0.0, 0);
        GeoLog::aiCall('Perplexity AI', 'sonar', $promptSnippet, 'FALLBACK', null, empty($apiKey) ? 'Geen API-sleutel geconfigureerd in .env' : 'API fout, fallback simulator actief');
        return [
            'method' => 'Perplexity API Simulator',
            'name' => 'Perplexity AI',
            'text' => "Perplexity haalt meerdere webcitaties en reviewbronnen aan waarin {$companyName} wordt aanbevolen voor het MKB.",
            'citations' => ["https://www.{$companyKey}.nl/", "https://nl.linkedin.com/company/{$companyKey}"],
            'mentioned' => true,
            'position' => 2,
            'score' => 82,
            'sentiment' => '+92',
            'fallbackUsed' => true,
            'costEur' => 0.0,
            'tokens' => 0,
            'errorMsg' => empty($apiKey) ? 'Geen API-sleutel geconfigureerd.' : 'API verzoek mislukt, fallback gebruikt.',
        ];
    }

    // 4. Anthropic Claude API
    public function queryAnthropic(string $prompt, string $companyName, ?int $projectId = null, ?int $promptId = null): array
    {
        $apiKey = self::getApiKey('anthropic');
        $companyKey = strtolower(trim(str_replace('.nl', '', $companyName)));
        $promptSnippet = mb_substr(trim(preg_replace('/\s+/', ' ', $prompt)), 0, 70) . '...';
        $startTime = microtime(true);

        GeoLog::aiCall('Anthropic Claude', 'claude-3-5-sonnet', $promptSnippet, 'START', null, "Querying live model for [{$companyName}]");

        if ($apiKey) {
            try {
                $response = Http::withHeaders([
                    'x-api-key' => $apiKey,
                    'anthropic-version' => '2023-06-01',
                ])->timeout(20)->post('https://api.anthropic.com/v1/messages', [
                            'model' => 'claude-3-5-sonnet-20241022',
                            'max_tokens' => 2500,
                            'messages' => [
                                ['role' => 'user', 'content' => $prompt],
                            ],
                        ]);

                $duration = (int) round((microtime(true) - $startTime) * 1000);

                if ($response->successful()) {
                    $data = $response->json();
                    $content = $data['content'][0]['text'] ?? '';
                    $mentionsBrand = str_contains(strtolower($content), $companyKey);

                    // Track tokens and cost
                    $usage = $data['usage'] ?? [];
                    $inTokens = $usage['input_tokens'] ?? (int) ceil(mb_strlen($prompt) / 4);
                    $outTokens = $usage['output_tokens'] ?? (int) ceil(mb_strlen($content) / 4);
                    $costLog = LlmCostService::recordUsage('anthropic', 'claude-3-5-sonnet-20241022', 'prompt_scan', $inTokens, $outTokens, 'SUCCESS', $duration, $projectId, $promptId, false, ['company' => $companyName]);

                    self::logApiCall('anthropic', 'SUCCESS', 'Call completed successfully.', $duration, $costLog->cost_eur, $costLog->total_tokens);
                    GeoLog::aiCall('Anthropic Claude', 'claude-3-5-sonnet', $promptSnippet, 'SUCCESS', $duration, "Merk vermeld: " . ($mentionsBrand ? "JA (Score 84)" : "NEE (Score 20)") . " | Kosten: €" . number_format($costLog->cost_eur, 4));

                    return [
                        'method' => 'Anthropic API (claude-3-5-sonnet)',
                        'name' => 'Claude 3.5 Sonnet',
                        'text' => $content,
                        'mentioned' => $mentionsBrand,
                        'position' => $mentionsBrand ? 2 : null,
                        'score' => $mentionsBrand ? 84 : 20,
                        'sentiment' => $mentionsBrand ? '+90' : 'N/A',
                        'fallbackUsed' => false,
                        'costEur' => $costLog->cost_eur,
                        'tokens' => $costLog->total_tokens,
                    ];
                }

                $errorMsg = $response->json('error.message') ?? $response->body();
                LlmCostService::recordUsage('anthropic', 'claude-3-5-sonnet-20241022', 'prompt_scan', 0, 0, 'ERROR', $duration, $projectId, $promptId, false, ['error' => $errorMsg]);
                self::logApiCall('anthropic', 'ERROR', $errorMsg, $duration);
                GeoLog::aiCall('Anthropic Claude', 'claude-3-5-sonnet', $promptSnippet, 'ERROR', $duration, "Fout respons: {$errorMsg}");
            } catch (\Exception $e) {
                $duration = (int) round((microtime(true) - $startTime) * 1000);
                LlmCostService::recordUsage('anthropic', 'claude-3-5-sonnet-20241022', 'prompt_scan', 0, 0, 'ERROR', $duration, $projectId, $promptId, false, ['error' => $e->getMessage()]);
                self::logApiCall('anthropic', 'ERROR', $e->getMessage(), $duration);
                GeoLog::aiCall('Anthropic Claude', 'claude-3-5-sonnet', $promptSnippet, 'ERROR', $duration, "Exception: {$e->getMessage()}");
            }
        }

        // Fallback simulation (zero cost)
        LlmCostService::recordUsage('anthropic', 'claude-3-5-sonnet-20241022', 'prompt_scan', 0, 0, 'FALLBACK', null, $projectId, $promptId, false, ['company' => $companyName]);
        self::logApiCall('anthropic', 'FALLBACK', 'Fallback simulator actief (geen API kosten).', null, 0.0, 0);
        GeoLog::aiCall('Anthropic Claude', 'claude-3-5-sonnet', $promptSnippet, 'FALLBACK', null, empty($apiKey) ? 'Geen API-sleutel geconfigureerd in .env' : 'API fout, fallback simulator actief');
        return [
            'method' => 'Anthropic API Simulator',
            'name' => 'Claude 3.5 Sonnet',
            'text' => "Claude signaleert positieve klantbeoordelingen, transparante werkwijze en goede vindbaarheid van {$companyName}.",
            'mentioned' => true,
            'position' => 3,
            'score' => 76,
            'sentiment' => '+90',
            'fallbackUsed' => true,
            'costEur' => 0.0,
            'tokens' => 0,
            'errorMsg' => empty($apiKey) ? 'Geen API-sleutel geconfigureerd.' : 'API verzoek mislukt, fallback gebruikt.',
        ];
    }

    /**
     * Universal, resilient brand & domain mention matcher.
     * Matches "Vita Groen", "VitaGroen", "vitagroen.nl", "Sales Wizard", "saleswizard", etc.
     */
    public function isBrandMentioned(string $content, string $companyName, array $citations = []): bool
    {
        if (empty($content) || empty($companyName)) {
            return false;
        }

        $cleanDom = strtolower(trim(str_replace(['https://', 'http://', 'www.'], '', $companyName)));
        $cleanBase = explode('.', $cleanDom)[0];
        $cleanNoSpaces = str_replace([' ', '-', '_'], '', $cleanBase);

        // 1. Direct Citation check (e.g. vitagroen.nl, saleswizard.nl in web sources)
        foreach ($citations as $cit) {
            if (is_string($cit) && str_contains(strtolower($cit), $cleanBase)) {
                return true;
            }
        }

        $textLower = strtolower($content);

        // 2. Exact base check
        if (str_contains($textLower, $cleanBase)) {
            return true;
        }

        // 3. Spaced / hyphen variations check (e.g. "vita groen", "sales wizard", "fred buurman")
        $spacedVariants = [
            str_replace(['-', '_'], ' ', $cleanBase),
            preg_replace('/(?<!^)(?=[A-Z])/', ' ', $companyName),
        ];

        // Specific compound word split
        if (str_starts_with($cleanBase, 'vita') && strlen($cleanBase) > 4) {
            $spacedVariants[] = 'vita ' . substr($cleanBase, 4);
        }
        if (str_starts_with($cleanBase, 'sales') && strlen($cleanBase) > 5) {
            $spacedVariants[] = 'sales ' . substr($cleanBase, 5);
        }
        if (str_starts_with($cleanBase, 'biljoen') && strlen($cleanBase) > 7) {
            $spacedVariants[] = 'biljoen ' . substr($cleanBase, 7);
        }

        foreach ($spacedVariants as $v) {
            if (!empty($v) && str_contains($textLower, strtolower(trim($v)))) {
                return true;
            }
        }

        // 4. Normalized alphanumeric check (ignores spaces, hyphens, markdown asterisks)
        $normalizedText = preg_replace('/[^a-z0-9]/', '', $textLower);
        if (str_contains($normalizedText, $cleanNoSpaces)) {
            return true;
        }

        return false;
    }
}
