<?php

namespace App\Services;

use Illuminate\Http\Client\Pool;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class DataForSeoService
{
    protected AiEngineService $aiEngine;

    public function __construct(?AiEngineService $aiEngine = null)
    {
        $this->aiEngine = $aiEngine ?? new AiEngineService();
    }

    public static function getLogin(): ?string
    {
        $val = config('services.dataforseo.login');
        return is_string($val) && trim($val) !== '' ? trim($val) : null;
    }

    public static function getPassword(): ?string
    {
        $val = config('services.dataforseo.password');
        return is_string($val) && trim($val) !== '' ? trim($val) : null;
    }

    public static function isConfigured(): bool
    {
        return self::getLogin() !== null && self::getPassword() !== null;
    }

    public static function getBaseUrl(): string
    {
        return rtrim((string) (config('services.dataforseo.base_url') ?: 'https://api.dataforseo.com/v3'), '/');
    }

    public static function getLocationCode(): int
    {
        return (int) config('services.dataforseo.location_code', 2528);
    }

    public static function getLanguageCode(): string
    {
        return (string) config('services.dataforseo.language_code', 'nl');
    }

    public static function getCountryIso(): string
    {
        return strtoupper((string) config('services.dataforseo.country_iso', 'NL'));
    }

    public static function getTimeout(): int
    {
        // DataForSEO Live LLM Scraper endpoints have an upstream execution window of up to 120 seconds.
        return max(30, (int) config('services.dataforseo.timeout', 125));
    }

    public static function getFallbackTimeout(): int
    {
        return max(20, (int) config('services.dataforseo.fallback_timeout', 45));
    }

    /**
     * Detect account-wide DataForSEO auth or empty-balance errors that should trip the circuit breaker.
     * Single-endpoint errors (e.g. 40400, 40501, 40102 "No Search Results", 40201 "Internal SE Server Error", 500xx) do NOT trip it.
     */
    public static function isAccountLevelCircuitBreakerError(?int $statusCode, string $message): bool
    {
        $lower = strtolower($message);

        // 40102 ("No Search Results") and 40201 ("Internal SE Server Error") are single-request/engine conditions, NEVER account failures
        if (in_array($statusCode, [40102, 40201, 40202], true)
            || str_contains($lower, 'no search results')
            || str_contains($lower, 'internal se server error')
            || str_contains($lower, 'internal error')) {
            return false;
        }

        // Only account-wide empty balance (40200 Payment Required) should trip the global circuit breaker.
        // 40100 (Not Authorized / IP whitelist / endpoint access) can occur on a single product (e.g. Perplexity LLM Responses)
        // while Google SERP, AI Mode, Gemini and Claude succeed on the same account.
        if ($statusCode === 40200) {
            return true;
        }

        foreach (['payment required', 'insufficient funds', 'insufficient balance', 'balance is empty'] as $hint) {
            if (str_contains($lower, $hint)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Fetch live DataForSEO account balance via the free /v3/appendix/user_data endpoint (cached 5 min).
     */
    public static function getAccountSummary(bool $forceRefresh = false): array
    {
        if (!self::isConfigured()) {
            return [
                'configured' => false,
                'connected' => false,
                'login' => null,
                'balanceUsd' => null,
                'balanceEur' => null,
                'error' => 'DATAFORSEO_LOGIN en/of DATAFORSEO_PASSWORD ontbreken in .env',
            ];
        }

        if ($forceRefresh) {
            Cache::forget('dataforseo_account_summary');
        }

        return Cache::remember('dataforseo_account_summary', 300, function () {
            try {
                $response = Http::withBasicAuth(self::getLogin(), self::getPassword())
                    ->timeout(10)
                    ->get(self::getBaseUrl() . '/appendix/user_data');

                if ($response->successful()) {
                    $json = $response->json();
                    $topCode = (int) ($json['status_code'] ?? 0);
                    $task = $json['tasks'][0] ?? [];
                    $taskCode = (int) ($task['status_code'] ?? 0);

                    if ($topCode === 20000 && $taskCode === 20000) {
                        $res = $task['result'][0] ?? [];
                        $balanceUsd = isset($res['money']['balance']) ? (float) $res['money']['balance'] : null;
                        $balanceEur = $balanceUsd !== null ? round($balanceUsd * LlmCostService::USD_TO_EUR_RATE, 2) : null;

                        return [
                            'configured' => true,
                            'connected' => true,
                            'login' => $res['login'] ?? self::getLogin(),
                            'balanceUsd' => $balanceUsd !== null ? round($balanceUsd, 4) : null,
                            'balanceEur' => $balanceEur,
                            'error' => ($balanceUsd !== null && $balanceUsd <= 0) ? 'DataForSEO saldo is €0,00 — waardeer tegoed op.' : null,
                        ];
                    }

                    $errMsg = $task['status_message'] ?? $json['status_message'] ?? 'Onbekende DataForSEO fout';
                    return [
                        'configured' => true,
                        'connected' => false,
                        'login' => self::getLogin(),
                        'balanceUsd' => null,
                        'balanceEur' => null,
                        'error' => $errMsg,
                    ];
                }

                return [
                    'configured' => true,
                    'connected' => false,
                    'login' => self::getLogin(),
                    'balanceUsd' => null,
                    'balanceEur' => null,
                    'error' => $response->json('status_message') ?: "HTTP {$response->status()}",
                ];
            } catch (\Exception $e) {
                return [
                    'configured' => true,
                    'connected' => false,
                    'login' => self::getLogin(),
                    'balanceUsd' => null,
                    'balanceEur' => null,
                    'error' => $e->getMessage(),
                ];
            }
        });
    }

    /**
     * Run all DataForSEO web-client & SERP endpoints IN PARALLEL using Http::pool().
     * Keeps full 6-engine prompt scans to ~20-45s instead of 150s+ sequentially.
     */
    public function queryAllEnginesConcurrently(
        string $prompt,
        string $companyName,
        ?int $projectId = null,
        ?int $promptId = null,
        bool $includePerplexity = true,
        bool $includeClaude = true,
        bool $includeChatGpt = true
    ): array {
        $promptSnippet = mb_substr(trim(preg_replace('/\s+/', ' ', $prompt)), 0, 70) . '...';
        $startTime = microtime(true);

        $specs = $this->buildEngineSpecs($prompt, $includePerplexity, $includeClaude, $includeChatGpt);

        // Short-circuit cleanly if credentials missing or account-wide breaker active
        $circuitError = Cache::get('ai_circuit_breaker_dataforseo');
        if (!self::isConfigured() || $circuitError) {
            $reason = !self::isConfigured()
                ? 'DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD niet geconfigureerd in .env'
                : $circuitError;

            $out = ['organicCitations' => []];
            foreach ($specs as $key => $spec) {
                $this->recordFailure($spec, $companyName, $reason, 0, $projectId, $promptId, $promptSnippet);
                $out[$key] = $this->buildUnavailableResult($spec['displayName'], $reason);
            }
            return $out;
        }

        GeoLog::aiCall(
            'DataForSEO Web-Client',
            'parallel-pool (' . implode(', ', array_keys($specs)) . ')',
            $promptSnippet,
            'START',
            null,
            "Start parallelle live Web-Client scan (" . count($specs) . " engines) voor [{$companyName}]"
        );

        $login = self::getLogin();
        $password = self::getPassword();
        $baseUrl = self::getBaseUrl();
        $scraperTimeout = self::getTimeout();
        $fastTimeout = min($scraperTimeout, 75);
        $fallbackTimeout = self::getFallbackTimeout();
        $engineLatencies = [];

        $responses = Http::pool(function (Pool $pool) use ($specs, $login, $password, $baseUrl, $scraperTimeout, $fastTimeout, &$engineLatencies) {
            $requests = [];
            foreach ($specs as $key => $spec) {
                $reqTimeout = !empty($spec['isBrowserScraper']) ? $scraperTimeout : $fastTimeout;
                $requests[$key] = $pool->as($key)
                    ->withBasicAuth($login, $password)
                    ->acceptJson()
                    ->asJson()
                    ->connectTimeout(15)
                    ->timeout($reqTimeout)
                    ->withOptions([
                        'on_stats' => function (\GuzzleHttp\TransferStats $stats) use (&$engineLatencies, $key) {
                            $engineLatencies[$key] = (int) round($stats->getTransferTime() * 1000);
                        },
                    ])
                    ->post($baseUrl . $spec['endpoint'], $spec['payload']);
            }
            return $requests;
        });

        $poolDurationMs = (int) round((microtime(true) - $startTime) * 1000);
        $results = ['organicCitations' => []];

        // Identify any engines that timed out (cURL 28), hit HTTP 5xx/504, or returned transient/empty scraper errors,
        // and execute their fallback/retry specs IN PARALLEL so total scan time stays fast and bounded.
        $fallbackSpecs = [];
        foreach ($specs as $key => $spec) {
            $resp = $responses[$key] ?? null;
            if ($this->shouldFallbackOrRetry($key, $spec, $resp)) {
                $fbSpec = $this->buildFallbackSpec($key, $spec, $prompt);
                if ($fbSpec !== null) {
                    $primaryErr = $this->describeFailureReason($resp);
                    GeoLog::info("⚠️ [DATAFORSEO FALLBACK] {$spec['logName']} faalde/time-out na " . ($engineLatencies[$key] ?? $poolDurationMs) . "ms ({$primaryErr}) -> overschakelen naar {$fbSpec['endpoint']}...");
                    $fallbackSpecs[$key] = $fbSpec;
                }
            }
        }

        if (!empty($fallbackSpecs)) {
            $fbStart = microtime(true);
            $fbLatencies = [];
            $fbResponses = Http::pool(function (Pool $pool) use ($fallbackSpecs, $login, $password, $baseUrl, $fallbackTimeout, &$fbLatencies) {
                $requests = [];
                foreach ($fallbackSpecs as $key => $fbSpec) {
                    $requests[$key] = $pool->as($key)
                        ->withBasicAuth($login, $password)
                        ->acceptJson()
                        ->asJson()
                        ->connectTimeout(10)
                        ->timeout($fallbackTimeout)
                        ->withOptions([
                            'on_stats' => function (\GuzzleHttp\TransferStats $stats) use (&$fbLatencies, $key) {
                                $fbLatencies[$key] = (int) round($stats->getTransferTime() * 1000);
                            },
                        ])
                        ->post($baseUrl . $fbSpec['endpoint'], $fbSpec['payload']);
                }
                return $requests;
            });
            $fbPoolMs = (int) round((microtime(true) - $fbStart) * 1000);

            foreach ($fallbackSpecs as $key => $fbSpec) {
                $responses[$key] = $fbResponses[$key] ?? null;
                $specs[$key] = $fbSpec;
                $engineLatencies[$key] = $fbLatencies[$key] ?? $fbPoolMs;
            }
        }

        foreach ($specs as $key => $spec) {
            $resp = $responses[$key] ?? null;
            $reqDurationMs = $engineLatencies[$key] ?? $poolDurationMs;

            $parsed = $this->handleRawResponse($key, $spec, $resp, $companyName, $reqDurationMs, $projectId, $promptId, $promptSnippet);
            if ($key === 'aioverviews' && !empty($parsed['organicCitations'])) {
                $results['organicCitations'] = $parsed['organicCitations'];
            }
            $results[$key] = $parsed;
        }

        return $results;
    }

    protected function describeFailureReason(mixed $resp): string
    {
        if ($resp instanceof \Throwable) {
            return mb_substr($resp->getMessage(), 0, 140);
        }
        if ($resp instanceof Response) {
            if (!$resp->successful()) {
                return "HTTP {$resp->status()}";
            }
            $json = $resp->json();
            $code = $json['tasks'][0]['status_code'] ?? $json['status_code'] ?? '?';
            $msg = $json['tasks'][0]['status_message'] ?? $json['status_message'] ?? 'Leeg/ongeldig resultaat';
            return "{$code}: {$msg}";
        }
        return 'Geen HTTP-respons';
    }

    /**
     * Determine if a primary DataForSEO call timed out (e.g. cURL error 28 after 90-125s),
     * returned HTTP 5xx/504/429, or returned a transient/empty scraper payload — warranting fallback/retry.
     * Account-level errors (40200 empty balance) are NEVER retried.
     */
    protected function shouldFallbackOrRetry(string $key, array $spec, mixed $resp): bool
    {
        if ($resp instanceof \Throwable) {
            return true;
        }

        if (!($resp instanceof Response)) {
            return true;
        }

        if (!$resp->successful()) {
            $status = $resp->status();
            if ($status === 402 || $status === 401 || $status === 403) {
                return false;
            }
            return $status >= 500 || $status === 429 || $status === 408 || !empty($spec['isBrowserScraper']);
        }

        $json = $resp->json();
        if (!is_array($json)) {
            return true;
        }

        $topCode = (int) ($json['status_code'] ?? 0);
        $topMsg = (string) ($json['status_message'] ?? '');
        if (self::isAccountLevelCircuitBreakerError($topCode, $topMsg)) {
            return false;
        }

        $task = $json['tasks'][0] ?? null;
        $taskCode = is_array($task) ? (int) ($task['status_code'] ?? 0) : 50000;
        $taskMsg = is_array($task) ? (string) ($task['status_message'] ?? '') : '';

        if (self::isAccountLevelCircuitBreakerError($taskCode, $taskMsg)) {
            return false;
        }

        // Transient DataForSEO errors (50000+, 50401 Timeout, 40201 Internal SE Server Error)
        $msgLower = strtolower($taskMsg);
        if ($taskCode >= 50000
            || $taskCode === 40201
            || str_contains($msgLower, 'timeout')
            || str_contains($msgLower, 'internal se server error')
            || str_contains($msgLower, 'internal error')) {
            return true;
        }

        // For ChatGPT / Gemini browser scrapers, also fall back to llm_responses/live if scraper returned non-20000 or empty text
        if (!empty($spec['isBrowserScraper'])) {
            if ($taskCode !== 20000) {
                return true;
            }
            $res = $task['result'][0] ?? [];
            if (empty($res['markdown']) && empty($res['items'])) {
                return true;
            }
        }

        return false;
    }

    /**
     * Build the fast fallback or retry specification for an engine whose primary request timed out or failed.
     * ChatGPT & Gemini browser scrapers seamlessly fall back to DataForSEO llm_responses/live with web_search=true.
     */
    protected function buildFallbackSpec(string $key, array $primarySpec, string $prompt): ?array
    {
        $shortPrompt = mb_substr(trim($prompt), 0, 500);
        $countryIso = self::getCountryIso();

        if ($key === 'chatgpt' && !empty($primarySpec['isBrowserScraper'])) {
            $chatModel = (string) config('geo.dataforseo_chatgpt_model', 'gpt-4.1-mini');
            return [
                'endpoint' => '/ai_optimization/chat_gpt/llm_responses/live',
                'parserType' => 'llm_responses',
                'isBrowserScraper' => false,
                'payload' => [[
                    'user_prompt' => $shortPrompt,
                    'model_name' => $chatModel,
                    'web_search' => true,
                    'force_web_search' => true,
                    'web_search_country_iso_code' => $countryIso,
                ]],
                'logEngine' => 'openai',
                'logModel' => 'dataforseo-chatgpt-' . $chatModel,
                'operation' => 'web_client_scan_fallback',
                'logName' => 'ChatGPT Web (DataForSEO Fallback)',
                'displayName' => 'ChatGPT Web',
                'methodLabel' => "ChatGPT Live Web Search (DataForSEO · {$chatModel})",
            ];
        }

        if ($key === 'gemini' && !empty($primarySpec['isBrowserScraper'])) {
            $gemModel = (string) config('geo.dataforseo_gemini_model', 'gemini-2.5-flash');
            return [
                'endpoint' => '/ai_optimization/gemini/llm_responses/live',
                'parserType' => 'llm_responses',
                'isBrowserScraper' => false,
                'payload' => [[
                    'user_prompt' => $shortPrompt,
                    'model_name' => $gemModel,
                    'web_search' => true,
                    'max_output_tokens' => 2048,
                ]],
                'logEngine' => 'gemini',
                'logModel' => 'dataforseo-' . $gemModel,
                'operation' => 'web_client_scan_fallback',
                'logName' => 'Gemini Web (DataForSEO Fallback)',
                'displayName' => 'Google Gemini',
                'methodLabel' => "Google Gemini Live Web Search (DataForSEO · {$gemModel})",
            ];
        }

        // Standard transient retry for aioverviews / aimode / perplexity / claude
        $retrySpec = $primarySpec;
        $retrySpec['isBrowserScraper'] = false;
        if ($key === 'aioverviews' && isset($retrySpec['payload'][0]['load_async_ai_overview'])) {
            unset($retrySpec['payload'][0]['load_async_ai_overview']);
        }
        return $retrySpec;
    }

    public function queryChatGptWeb(string $prompt, string $companyName, ?int $projectId = null, ?int $promptId = null): array
    {
        return $this->querySingleEngine('chatgpt', $prompt, $companyName, $projectId, $promptId);
    }

    public function queryGeminiWeb(string $prompt, string $companyName, ?int $projectId = null, ?int $promptId = null): array
    {
        return $this->querySingleEngine('gemini', $prompt, $companyName, $projectId, $promptId);
    }

    public function queryGoogleAiOverview(string $prompt, string $companyName, ?int $projectId = null, ?int $promptId = null): array
    {
        return $this->querySingleEngine('aioverviews', $prompt, $companyName, $projectId, $promptId);
    }

    public function queryGoogleAiMode(string $prompt, string $companyName, ?int $projectId = null, ?int $promptId = null): array
    {
        return $this->querySingleEngine('aimode', $prompt, $companyName, $projectId, $promptId);
    }

    public function queryPerplexity(string $prompt, string $companyName, ?int $projectId = null, ?int $promptId = null): array
    {
        return $this->querySingleEngine('perplexity', $prompt, $companyName, $projectId, $promptId);
    }

    public function queryClaude(string $prompt, string $companyName, ?int $projectId = null, ?int $promptId = null): array
    {
        return $this->querySingleEngine('claude', $prompt, $companyName, $projectId, $promptId);
    }

    protected function querySingleEngine(string $key, string $prompt, string $companyName, ?int $projectId, ?int $promptId): array
    {
        $specs = $this->buildEngineSpecs($prompt, true, true);
        $spec = $specs[$key] ?? null;
        if (!$spec) {
            return $this->buildUnavailableResult(ucfirst($key), "Onbekende DataForSEO engine: {$key}");
        }

        $promptSnippet = mb_substr(trim(preg_replace('/\s+/', ' ', $prompt)), 0, 70) . '...';
        $circuitError = Cache::get('ai_circuit_breaker_dataforseo');

        if (!self::isConfigured() || $circuitError) {
            $reason = !self::isConfigured()
                ? 'DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD niet geconfigureerd in .env'
                : $circuitError;
            $this->recordFailure($spec, $companyName, $reason, 0, $projectId, $promptId, $promptSnippet);
            return $this->buildUnavailableResult($spec['displayName'], $reason);
        }

        $startTime = microtime(true);
        GeoLog::aiCall($spec['logName'], $spec['logModel'], $promptSnippet, 'START', null, "DataForSEO live aanroep ({$spec['endpoint']}) voor [{$companyName}]");

        try {
            $reqTimeout = !empty($spec['isBrowserScraper']) ? self::getTimeout() : min(self::getTimeout(), 75);
            $resp = Http::withBasicAuth(self::getLogin(), self::getPassword())
                ->acceptJson()
                ->asJson()
                ->connectTimeout(15)
                ->timeout($reqTimeout)
                ->post(self::getBaseUrl() . $spec['endpoint'], $spec['payload']);
        } catch (\Throwable $e) {
            $resp = $e;
        }

        if ($this->shouldFallbackOrRetry($key, $spec, $resp)) {
            $fbSpec = $this->buildFallbackSpec($key, $spec, $prompt);
            if ($fbSpec !== null) {
                $primaryErr = $this->describeFailureReason($resp);
                GeoLog::info("⚠️ [DATAFORSEO FALLBACK] {$spec['logName']} faalde/time-out ({$primaryErr}) -> overschakelen naar {$fbSpec['endpoint']}...");
                $startTime = microtime(true);
                $spec = $fbSpec;
                try {
                    $resp = Http::withBasicAuth(self::getLogin(), self::getPassword())
                        ->acceptJson()
                        ->asJson()
                        ->connectTimeout(10)
                        ->timeout(self::getFallbackTimeout())
                        ->post(self::getBaseUrl() . $spec['endpoint'], $spec['payload']);
                } catch (\Throwable $fbEx) {
                    $resp = $fbEx;
                }
            }
        }

        $durationMs = (int) round((microtime(true) - $startTime) * 1000);
        return $this->handleRawResponse($key, $spec, $resp, $companyName, $durationMs, $projectId, $promptId, $promptSnippet);
    }

    protected function buildEngineSpecs(string $prompt, bool $includePerplexity, bool $includeClaude, bool $includeChatGpt = true): array
    {
        $loc = self::getLocationCode();
        $lang = self::getLanguageCode();
        $countryIso = self::getCountryIso();
        $shortPrompt = mb_substr(trim($prompt), 0, 500);
        $preferFastResponses = (bool) config('geo.dataforseo_prefer_fast_responses', false);
        $chatModel = (string) config('geo.dataforseo_chatgpt_model', 'gpt-4.1-mini');
        $gemModel = (string) config('geo.dataforseo_gemini_model', 'gemini-2.5-flash');
        $pplxModel = (string) config('geo.dataforseo_perplexity_model', 'sonar');
        $claudeModel = (string) config('geo.dataforseo_claude_model', 'claude-haiku-4-5');
        $claudeWebSearch = (bool) config('geo.dataforseo_claude_web_search', true);

        $specs = [];
        if ($includeChatGpt) {
            if ($preferFastResponses) {
                $specs['chatgpt'] = [
                    'endpoint' => '/ai_optimization/chat_gpt/llm_responses/live',
                    'parserType' => 'llm_responses',
                    'isBrowserScraper' => false,
                    'payload' => [[
                        'user_prompt' => $shortPrompt,
                        'model_name' => $chatModel,
                        'web_search' => true,
                        'force_web_search' => true,
                        'web_search_country_iso_code' => $countryIso,
                    ]],
                    'logEngine' => 'openai',
                    'logModel' => 'dataforseo-chatgpt-' . $chatModel,
                    'operation' => 'web_client_scan',
                    'logName' => 'ChatGPT Web (DataForSEO)',
                    'displayName' => 'ChatGPT Web',
                    'methodLabel' => "ChatGPT Live Web Search (DataForSEO · {$chatModel})",
                ];
            } else {
                $specs['chatgpt'] = [
                    'endpoint' => '/ai_optimization/chat_gpt/llm_scraper/live/advanced',
                    'parserType' => 'chatgpt_scraper',
                    'isBrowserScraper' => true,
                    'payload' => [[
                        'keyword' => $prompt,
                        'location_code' => $loc,
                        'language_code' => $lang,
                        'force_web_search' => true,
                    ]],
                    'logEngine' => 'openai',
                    'logModel' => 'chatgpt-web-client',
                    'operation' => 'web_client_scan',
                    'logName' => 'ChatGPT Web (DataForSEO)',
                    'displayName' => 'ChatGPT Web',
                    'methodLabel' => 'ChatGPT Web UI (DataForSEO Live Web Search)',
                ];
            }
        }

        if ($preferFastResponses) {
            $specs['gemini'] = [
                'endpoint' => '/ai_optimization/gemini/llm_responses/live',
                'parserType' => 'llm_responses',
                'isBrowserScraper' => false,
                'payload' => [[
                    'user_prompt' => $shortPrompt,
                    'model_name' => $gemModel,
                    'web_search' => true,
                    'max_output_tokens' => 2048,
                ]],
                'logEngine' => 'gemini',
                'logModel' => 'dataforseo-' . $gemModel,
                'operation' => 'web_client_scan',
                'logName' => 'Gemini Web (DataForSEO)',
                'displayName' => 'Google Gemini',
                'methodLabel' => "Google Gemini Live Web Search (DataForSEO · {$gemModel})",
            ];
        } else {
            $specs['gemini'] = [
                'endpoint' => '/ai_optimization/gemini/llm_scraper/live/advanced',
                'parserType' => 'gemini_scraper',
                'isBrowserScraper' => true,
                'payload' => [[
                    'keyword' => $prompt,
                    'location_code' => $loc,
                    'language_code' => $lang,
                ]],
                'logEngine' => 'gemini',
                'logModel' => 'gemini-web-client',
                'operation' => 'web_client_scan',
                'logName' => 'Gemini Web (DataForSEO)',
                'displayName' => 'Google Gemini',
                'methodLabel' => 'Google Gemini Web UI (DataForSEO Live)',
            ];
        }
        $specs['aioverviews'] = [
            'endpoint' => '/serp/google/organic/live/advanced',
            'payload' => [[
                'keyword' => $prompt,
                'location_code' => $loc,
                'language_code' => $lang,
                'device' => 'desktop',
                'depth' => 10,
                'load_async_ai_overview' => true,
            ]],
            'logEngine' => 'gemini',
            'logModel' => 'google-ai-overviews',
            'operation' => 'google_serp_aio_scan',
            'logName' => 'Google AI Overviews (DataForSEO)',
            'displayName' => 'Google AI Overviews',
            'methodLabel' => 'Google.nl AI Overviews (DataForSEO Live SERP)',
        ];
        $specs['aimode'] = [
            'endpoint' => '/serp/google/ai_mode/live/advanced',
            'payload' => [[
                'keyword' => $prompt,
                'location_code' => $loc,
                'language_code' => $lang,
                'device' => 'desktop',
            ]],
            'logEngine' => 'gemini',
            'logModel' => 'google-ai-mode',
            'operation' => 'google_ai_mode_scan',
            'logName' => 'Google AI Mode (DataForSEO)',
            'displayName' => 'Google AI Mode',
            'methodLabel' => 'Google.nl AI Mode (DataForSEO Live SERP)',
        ];

        if ($includePerplexity) {
            $specs['perplexity'] = [
                'endpoint' => '/ai_optimization/perplexity/llm_responses/live',
                'payload' => [[
                    'user_prompt' => $shortPrompt,
                    'model_name' => $pplxModel,
                    'web_search' => true,
                    'web_search_country_iso_code' => $countryIso,
                ]],
                'logEngine' => 'perplexity',
                'logModel' => 'dataforseo-perplexity-' . $pplxModel,
                'operation' => 'web_client_scan',
                'logName' => 'Perplexity Web (DataForSEO)',
                'displayName' => 'Perplexity AI',
                'methodLabel' => "Perplexity Web Search (DataForSEO · {$pplxModel})",
            ];
        }

        if ($includeClaude) {
            $specs['claude'] = [
                'endpoint' => '/ai_optimization/claude/llm_responses/live',
                'payload' => [[
                    'user_prompt' => $shortPrompt,
                    'model_name' => $claudeModel,
                    'web_search' => $claudeWebSearch,
                    'max_output_tokens' => 2048,
                ]],
                'logEngine' => 'anthropic',
                'logModel' => 'dataforseo-' . $claudeModel,
                'operation' => 'web_client_scan',
                'logName' => 'Claude Web (DataForSEO)',
                'displayName' => 'Anthropic Claude',
                'methodLabel' => "Anthropic Claude Web Search (DataForSEO · {$claudeModel})",
            ];
        }

        return $specs;
    }

    protected function handleRawResponse(
        string $key,
        array $spec,
        mixed $resp,
        string $companyName,
        int $durationMs,
        ?int $projectId,
        ?int $promptId,
        string $promptSnippet
    ): array {
        if ($resp instanceof \Throwable) {
            $errMsg = $resp->getMessage();
            $this->recordFailure($spec, $companyName, $errMsg, $durationMs, $projectId, $promptId, $promptSnippet);
            return $this->buildUnavailableResult($spec['displayName'], $errMsg);
        }

        if (!($resp instanceof Response)) {
            $errMsg = 'Geen geldige HTTP-respons ontvangen van DataForSEO.';
            $this->recordFailure($spec, $companyName, $errMsg, $durationMs, $projectId, $promptId, $promptSnippet);
            return $this->buildUnavailableResult($spec['displayName'], $errMsg);
        }

        if (!$resp->successful()) {
            $jsonErr = $resp->json();
            $statusCode = isset($jsonErr['status_code']) ? (int) $jsonErr['status_code'] : $resp->status();
            $errMsg = $jsonErr['status_message'] ?? $resp->body() ?: "HTTP {$resp->status()}";
            if (self::isAccountLevelCircuitBreakerError($statusCode, $errMsg)) {
                Cache::put('ai_circuit_breaker_dataforseo', $errMsg, 300);
            }
            $this->recordFailure($spec, $companyName, $errMsg, $durationMs, $projectId, $promptId, $promptSnippet);
            return $this->buildUnavailableResult($spec['displayName'], $errMsg);
        }

        $json = $resp->json();
        if (!is_array($json)) {
            $errMsg = 'Ongeldige JSON-respons van DataForSEO.';
            $this->recordFailure($spec, $companyName, $errMsg, $durationMs, $projectId, $promptId, $promptSnippet);
            return $this->buildUnavailableResult($spec['displayName'], $errMsg);
        }

        $parserType = $spec['parserType'] ?? null;
        if ($parserType === 'llm_responses') {
            $parsed = $this->parseLlmResponsesResponse($json, $companyName, $spec['displayName'], $spec['methodLabel'], $key);
        } else {
            $parsed = match ($key) {
                'chatgpt' => $this->parseChatGptResponse($json, $companyName),
                'gemini' => $this->parseGeminiResponse($json, $companyName),
                'aioverviews' => $this->parseGoogleOrganicAiOverviewResponse($json, $companyName),
                'aimode' => $this->parseGoogleAiModeResponse($json, $companyName),
                'perplexity' => $this->parseLlmResponsesResponse($json, $companyName, $spec['displayName'], $spec['methodLabel'], 'perplexity'),
                'claude' => $this->parseLlmResponsesResponse($json, $companyName, $spec['displayName'], $spec['methodLabel'], 'claude'),
                default => $this->buildUnavailableResult($spec['displayName'], "Geen parser voor {$key}"),
            };
        }

        if (!empty($parsed['failed']) || empty($parsed['available'])) {
            $statusCode = $parsed['statusCode'] ?? null;
            $errMsg = $parsed['errorMsg'] ?? 'Onbekende DataForSEO fout';
            if (self::isAccountLevelCircuitBreakerError(is_int($statusCode) ? $statusCode : null, $errMsg)) {
                Cache::put('ai_circuit_breaker_dataforseo', $errMsg, 300);
            }
            $this->recordFailure($spec, $companyName, $errMsg, $durationMs, $projectId, $promptId, $promptSnippet);
            return $parsed;
        }

        $costUsd = (float) ($parsed['costUsd'] ?? 0.0);
        $inTokens = (int) ($parsed['inputTokens'] ?? 0);
        $outTokens = (int) ($parsed['outputTokens'] ?? 0);

        $costLog = LlmCostService::recordUsage(
            $spec['logEngine'],
            $spec['logModel'],
            $spec['operation'],
            $inTokens,
            $outTokens,
            'SUCCESS',
            $durationMs,
            $projectId,
            $promptId,
            true,
            [
                'via' => 'dataforseo_web_client',
                'endpoint' => $spec['endpoint'],
                'company' => $companyName,
                'source_engine' => $key,
                'dataforseo_cost_usd' => $costUsd,
            ],
            0,
            $costUsd
        );

        $citCount = count($parsed['citations'] ?? []);
        $mentionSummary = !empty($parsed['mentioned'])
            ? "JA (Positie #" . ($parsed['position'] ?? 1) . ")"
            : "NEE";

        AiEngineService::logApiCall(
            $spec['logEngine'],
            'SUCCESS',
            "{$spec['methodLabel']} voltooid ({$citCount} bronnen, vermeld: {$mentionSummary}).",
            $durationMs,
            $costLog->cost_eur,
            $costLog->total_tokens
        );

        GeoLog::aiCall(
            $spec['logName'],
            $spec['logModel'],
            $promptSnippet,
            'SUCCESS',
            $durationMs,
            "{$citCount} citaties | Merk vermeld: {$mentionSummary} | Kosten: €" . number_format((float) $costLog->cost_eur, 4)
        );

        $parsed['costEur'] = (float) $costLog->cost_eur;
        $parsed['tokens'] = (int) $costLog->total_tokens;

        return $parsed;
    }

    protected function recordFailure(
        array $spec,
        string $companyName,
        string $errorMsg,
        int $durationMs,
        ?int $projectId,
        ?int $promptId,
        string $promptSnippet
    ): void {
        LlmCostService::recordUsage(
            $spec['logEngine'],
            $spec['logModel'],
            $spec['operation'],
            0,
            0,
            'ERROR',
            $durationMs ?: null,
            $projectId,
            $promptId,
            false,
            [
                'via' => 'dataforseo_web_client',
                'endpoint' => $spec['endpoint'],
                'company' => $companyName,
                'source_engine' => $spec['logModel'],
                'error' => $errorMsg,
            ]
        );

        AiEngineService::logApiCall($spec['logEngine'], 'ERROR', "[DataForSEO] {$errorMsg}", $durationMs ?: null);
        GeoLog::aiCall($spec['logName'], $spec['logModel'], $promptSnippet, 'ERROR', $durationMs ?: null, "DataForSEO fout: {$errorMsg}");
    }

    /**
     * Validate common DataForSEO v3 response envelope and extract task result & exact cost.
     */
    protected function extractTaskResult(array $json, bool $allowNoSearchResults = false): array
    {
        $topCode = (int) ($json['status_code'] ?? 0);
        if ($topCode !== 20000) {
            return [
                'ok' => false,
                'statusCode' => $topCode,
                'error' => (string) ($json['status_message'] ?? "DataForSEO status {$topCode}"),
                'costUsd' => (float) ($json['cost'] ?? 0.0),
                'result' => null,
            ];
        }

        $task = $json['tasks'][0] ?? null;
        if (!is_array($task)) {
            return [
                'ok' => false,
                'statusCode' => 50000,
                'error' => 'DataForSEO antwoord bevat geen task object.',
                'costUsd' => (float) ($json['cost'] ?? 0.0),
                'result' => null,
            ];
        }

        $taskCode = (int) ($task['status_code'] ?? 0);
        $taskMsg = (string) ($task['status_message'] ?? '');
        $costUsd = (float) ($task['cost'] ?? $json['cost'] ?? 0.0);

        if ($taskCode === 40102 && $allowNoSearchResults) {
            return [
                'ok' => true,
                'noResults' => true,
                'statusCode' => $taskCode,
                'error' => null,
                'costUsd' => $costUsd,
                'result' => [],
            ];
        }

        if ($taskCode !== 20000) {
            return [
                'ok' => false,
                'statusCode' => $taskCode,
                'error' => $taskMsg !== '' ? $taskMsg : "DataForSEO task fout ({$taskCode})",
                'costUsd' => $costUsd,
                'result' => null,
            ];
        }

        $result = $task['result'][0] ?? [];
        return [
            'ok' => true,
            'noResults' => empty($result),
            'statusCode' => $taskCode,
            'error' => null,
            'costUsd' => $costUsd,
            'result' => is_array($result) ? $result : [],
        ];
    }

    /**
     * Parser 1: ChatGPT Web UI (/v3/ai_optimization/chat_gpt/llm_scraper/live/advanced)
     */
    public function parseChatGptResponse(array $json, string $companyName): array
    {
        $env = $this->extractTaskResult($json);
        if (!$env['ok']) {
            return $this->buildUnavailableResult('ChatGPT Web', $env['error'], $env['statusCode']);
        }

        $res = $env['result'];
        $chunks = [];
        $richCitations = [];
        $citationUrls = [];

        if (!empty($res['markdown']) && is_string($res['markdown'])) {
            $chunks[] = trim($res['markdown']);
        }

        $items = is_array($res['items'] ?? null) ? $res['items'] : [];
        if (empty($chunks)) {
            foreach ($items as $item) {
                if (!is_array($item)) {
                    continue;
                }
                $type = (string) ($item['type'] ?? '');
                if ($type === 'chat_gpt_table' && !empty($item['table']) && is_array($item['table'])) {
                    $mdTable = $this->renderTableToMarkdown($item['table']);
                    if ($mdTable !== '') {
                        $chunks[] = $mdTable;
                    }
                } elseif (!empty($item['markdown'])) {
                    $chunks[] = trim((string) $item['markdown']);
                } elseif (!empty($item['text'])) {
                    $chunks[] = trim((string) $item['text']);
                } elseif (!empty($item['items']) && is_array($item['items'])) {
                    foreach ($item['items'] as $sub) {
                        if (!is_array($sub)) {
                            continue;
                        }
                        $line = trim(($sub['title'] ?? '') . (!empty($sub['description']) ? ' — ' . $sub['description'] : ''));
                        if ($line !== '') {
                            $chunks[] = '- ' . $line;
                        }
                        if (!empty($sub['url'])) {
                            $this->addCitation($citationUrls, $richCitations, $sub['url'], $sub['title'] ?? null, $sub['description'] ?? null, 'chatgpt');
                        }
                    }
                }
            }
        }

        // Collect all cited web sources & search_results from ChatGPT Web UI
        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }
            foreach (($item['sources'] ?? []) as $src) {
                if (is_array($src) && !empty($src['url'])) {
                    $this->addCitation($citationUrls, $richCitations, $src['url'], $src['title'] ?? null, $src['snippet'] ?? ($src['description'] ?? null), 'chatgpt');
                }
            }
        }
        foreach (($res['sources'] ?? []) as $src) {
            if (is_array($src) && !empty($src['url'])) {
                $this->addCitation($citationUrls, $richCitations, $src['url'], $src['title'] ?? null, $src['snippet'] ?? ($src['description'] ?? null), 'chatgpt');
            }
        }
        foreach (($res['search_results'] ?? []) as $sr) {
            if (is_array($sr) && !empty($sr['url'])) {
                $this->addCitation($citationUrls, $richCitations, $sr['url'], $sr['title'] ?? null, $sr['description'] ?? ($sr['snippet'] ?? null), 'chatgpt');
            }
        }

        $content = trim(implode("\n\n", array_filter($chunks)));
        if ($content === '') {
            return $this->buildUnavailableResult('ChatGPT Web', 'ChatGPT Web UI gaf een leeg antwoord terug.', $env['statusCode']);
        }

        return $this->buildLiveResult(
            'ChatGPT Web',
            'ChatGPT Web UI (DataForSEO Live Web Search)',
            $content,
            $companyName,
            $citationUrls,
            $richCitations,
            $env['costUsd']
        );
    }

    /**
     * Parser 2: Gemini Web UI (/v3/ai_optimization/gemini/llm_scraper/live/advanced)
     */
    public function parseGeminiResponse(array $json, string $companyName): array
    {
        $env = $this->extractTaskResult($json);
        if (!$env['ok']) {
            return $this->buildUnavailableResult('Google Gemini', $env['error'], $env['statusCode']);
        }

        $res = $env['result'];
        $chunks = [];
        $richCitations = [];
        $citationUrls = [];

        if (!empty($res['markdown']) && is_string($res['markdown'])) {
            $chunks[] = trim($res['markdown']);
        }

        $items = is_array($res['items'] ?? null) ? $res['items'] : [];
        if (empty($chunks)) {
            foreach ($items as $item) {
                if (!is_array($item)) {
                    continue;
                }
                if (!empty($item['table']) && is_array($item['table'])) {
                    $mdTable = $this->renderTableToMarkdown($item['table']);
                    if ($mdTable !== '') {
                        $chunks[] = $mdTable;
                    }
                } elseif (!empty($item['markdown'])) {
                    $chunks[] = trim((string) $item['markdown']);
                } elseif (!empty($item['text'])) {
                    $chunks[] = trim((string) $item['text']);
                }
            }
        }

        foreach (($res['sources'] ?? []) as $src) {
            if (is_array($src) && !empty($src['url'])) {
                $this->addCitation($citationUrls, $richCitations, $src['url'], $src['title'] ?? null, $src['text_snippet'] ?? ($src['snippet'] ?? null), 'gemini');
            }
        }
        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }
            foreach (($item['sources'] ?? []) as $src) {
                if (is_array($src) && !empty($src['url'])) {
                    $this->addCitation($citationUrls, $richCitations, $src['url'], $src['title'] ?? null, $src['text_snippet'] ?? ($src['snippet'] ?? null), 'gemini');
                }
            }
        }

        $content = trim(implode("\n\n", array_filter($chunks)));
        if ($content === '') {
            return $this->buildUnavailableResult('Google Gemini', 'Gemini Web UI gaf een leeg antwoord terug.', $env['statusCode']);
        }

        return $this->buildLiveResult(
            'Google Gemini',
            'Google Gemini Web UI (DataForSEO Live)',
            $content,
            $companyName,
            $citationUrls,
            $richCitations,
            $env['costUsd']
        );
    }

    /**
     * Parser 3: Real Google.nl Organic SERP with load_async_ai_overview=true (/v3/serp/google/organic/live/advanced)
     * Extracts BOTH the real Google AI Overview AND real Google.nl Organic top results for web citations.
     */
    public function parseGoogleOrganicAiOverviewResponse(array $json, string $companyName): array
    {
        $env = $this->extractTaskResult($json, true);
        if (!$env['ok']) {
            return $this->buildUnavailableResult('Google AI Overviews', $env['error'], $env['statusCode']);
        }

        $res = $env['result'];
        $items = is_array($res['items'] ?? null) ? $res['items'] : [];

        $aioChunks = [];
        $aioCitationUrls = [];
        $aioRichCitations = [];
        $organicCitations = [];
        $hasAiOverview = false;

        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }
            $type = (string) ($item['type'] ?? '');

            if ($type === 'ai_overview') {
                $hasAiOverview = true;
                $this->extractAiOverviewBlock($item, $aioChunks, $aioCitationUrls, $aioRichCitations, 'aioverviews');
            } elseif ($type === 'organic' && !empty($item['url']) && count($organicCitations) < 8) {
                $dom = $this->extractDomain((string) $item['url']);
                if ($dom !== '') {
                    $organicCitations[] = [
                        'url' => (string) $item['url'],
                        'title' => (string) ($item['title'] ?? "Google.nl resultaat: {$dom}"),
                        'domain' => $dom,
                        'snippet' => (string) ($item['description'] ?? ''),
                        'sourceEngine' => 'google_organic',
                    ];
                }
            }
        }

        $aioText = trim(implode("\n\n", array_filter($aioChunks)));

        // If Google.nl legitimately rendered NO AI Overview for this search query, that is a REAL live measurement (not mentioned, not a failure!)
        if (!$hasAiOverview || $aioText === '') {
            return [
                'method' => 'Google.nl AI Overviews (DataForSEO Live SERP)',
                'name' => 'Google AI Overviews',
                'text' => 'Google.nl toont momenteel geen AI Overview voor deze zoekopdracht.',
                'citations' => [],
                'richCitations' => [],
                'organicCitations' => $organicCitations,
                'hasAiOverview' => false,
                'mentioned' => false,
                'available' => true,
                'failed' => false,
                'isSimulated' => false,
                'fallbackUsed' => false,
                'position' => null,
                'score' => 0,
                'sentiment' => 'N/A',
                'costUsd' => $env['costUsd'],
                'inputTokens' => 0,
                'outputTokens' => 0,
            ];
        }

        $result = $this->buildLiveResult(
            'Google AI Overviews',
            'Google.nl AI Overviews (DataForSEO Live SERP)',
            $aioText,
            $companyName,
            $aioCitationUrls,
            $aioRichCitations,
            $env['costUsd']
        );
        $result['hasAiOverview'] = true;
        $result['organicCitations'] = $organicCitations;

        return $result;
    }

    /**
     * Parser 4: Real Google.nl AI Mode (/v3/serp/google/ai_mode/live/advanced)
     */
    public function parseGoogleAiModeResponse(array $json, string $companyName): array
    {
        $env = $this->extractTaskResult($json, true);
        if (!$env['ok']) {
            return $this->buildUnavailableResult('Google AI Mode', $env['error'], $env['statusCode']);
        }

        $res = $env['result'];
        $items = is_array($res['items'] ?? null) ? $res['items'] : [];
        $chunks = [];
        $citationUrls = [];
        $richCitations = [];

        $hasTopMarkdown = !empty($res['markdown']) && is_string($res['markdown']);
        if ($hasTopMarkdown) {
            $chunks[] = trim($res['markdown']);
        }

        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }
            $subChunks = [];
            $this->extractAiOverviewBlock($item, $subChunks, $citationUrls, $richCitations, 'aimode');
            if (!$hasTopMarkdown && !empty($subChunks)) {
                foreach ($subChunks as $sc) {
                    $chunks[] = $sc;
                }
            }
        }

        $content = trim(implode("\n\n", array_filter($chunks)));
        if ($content === '') {
            return [
                'method' => 'Google.nl AI Mode (DataForSEO Live SERP)',
                'name' => 'Google AI Mode',
                'text' => 'Google AI Mode gaf geen AI-overzicht terug voor deze zoekopdracht.',
                'citations' => [],
                'richCitations' => [],
                'mentioned' => false,
                'available' => true,
                'failed' => false,
                'isSimulated' => false,
                'fallbackUsed' => false,
                'position' => null,
                'score' => 0,
                'sentiment' => 'N/A',
                'costUsd' => $env['costUsd'],
                'inputTokens' => 0,
                'outputTokens' => 0,
            ];
        }

        return $this->buildLiveResult(
            'Google AI Mode',
            'Google.nl AI Mode (DataForSEO Live SERP)',
            $content,
            $companyName,
            $citationUrls,
            $richCitations,
            $env['costUsd']
        );
    }

    /**
     * Parser 5 & 6: DataForSEO LLM Responses Live (Perplexity & Claude with web_search=true)
     */
    public function parseLlmResponsesResponse(
        array $json,
        string $companyName,
        string $engineDisplayName,
        string $methodLabel,
        string $sourceEngineKey = 'perplexity'
    ): array {
        $env = $this->extractTaskResult($json);
        if (!$env['ok']) {
            return $this->buildUnavailableResult($engineDisplayName, $env['error'], $env['statusCode']);
        }

        $res = $env['result'];
        $chunks = [];
        $citationUrls = [];
        $richCitations = [];

        $items = is_array($res['items'] ?? null) ? $res['items'] : [];
        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }
            if (!empty($item['sections']) && is_array($item['sections'])) {
                foreach ($item['sections'] as $sec) {
                    if (!is_array($sec)) {
                        continue;
                    }
                    if (!empty($sec['text'])) {
                        $chunks[] = trim((string) $sec['text']);
                    }
                    foreach (($sec['annotations'] ?? []) as $anno) {
                        if (is_array($anno) && !empty($anno['url'])) {
                            $this->addCitation($citationUrls, $richCitations, $anno['url'], $anno['title'] ?? null, null, $sourceEngineKey);
                        }
                    }
                }
            } elseif (!empty($item['markdown'])) {
                $chunks[] = trim((string) $item['markdown']);
            } elseif (!empty($item['text'])) {
                $chunks[] = trim((string) $item['text']);
            }
        }

        foreach (($res['search_results'] ?? []) as $sr) {
            if (is_array($sr) && !empty($sr['url'])) {
                $this->addCitation($citationUrls, $richCitations, $sr['url'], $sr['title'] ?? null, $sr['snippet'] ?? ($sr['description'] ?? null), $sourceEngineKey);
            }
        }
        foreach (($res['sources'] ?? []) as $src) {
            if (is_array($src) && !empty($src['url'])) {
                $this->addCitation($citationUrls, $richCitations, $src['url'], $src['title'] ?? null, $src['snippet'] ?? ($src['description'] ?? null), $sourceEngineKey);
            }
        }
        foreach (($res['annotations'] ?? []) as $anno) {
            if (is_array($anno) && !empty($anno['url'])) {
                $this->addCitation($citationUrls, $richCitations, $anno['url'], $anno['title'] ?? null, null, $sourceEngineKey);
            }
        }

        $content = trim(implode("\n\n", array_filter($chunks)));
        if ($content === '') {
            return $this->buildUnavailableResult($engineDisplayName, "{$engineDisplayName} gaf een leeg antwoord terug via DataForSEO.", $env['statusCode']);
        }

        $result = $this->buildLiveResult(
            $engineDisplayName,
            $methodLabel,
            $content,
            $companyName,
            $citationUrls,
            $richCitations,
            $env['costUsd']
        );
        $result['inputTokens'] = (int) ($res['input_tokens'] ?? 0);
        $result['outputTokens'] = (int) ($res['output_tokens'] ?? 0);

        return $result;
    }

    /**
     * Recursively extract text, tables, and references from DataForSEO AI Overview / AI Mode items.
     */
    protected function extractAiOverviewBlock(
        array $item,
        array &$chunks,
        array &$citationUrls,
        array &$richCitations,
        string $sourceEngineKey
    ): void {
        if (!empty($item['title']) && is_string($item['title']) && empty($item['markdown'])) {
            $chunks[] = '**' . trim($item['title']) . '**';
        }
        if (!empty($item['markdown']) && is_string($item['markdown'])) {
            $chunks[] = trim($item['markdown']);
        } elseif (!empty($item['text']) && is_string($item['text'])) {
            $chunks[] = trim($item['text']);
        }

        if (!empty($item['table']) && is_array($item['table'])) {
            $mdTable = $this->renderTableToMarkdown($item['table']);
            if ($mdTable !== '') {
                $chunks[] = $mdTable;
            }
        }

        if (!empty($item['images']) && is_array($item['images'])) {
            foreach ($item['images'] as $img) {
                if (is_array($img)) {
                    $imgUrl = trim((string) ($img['image_url'] ?? $img['url'] ?? ''));
                    if ($imgUrl !== '' && str_starts_with(strtolower($imgUrl), 'http')) {
                        $imgAlt = trim((string) ($img['alt'] ?? $img['title'] ?? 'Afbeelding'));
                        $pageUrl = trim((string) ($img['url'] ?? $imgUrl));
                        if ($pageUrl !== '' && $pageUrl !== $imgUrl && str_starts_with(strtolower($pageUrl), 'http')) {
                            $chunks[] = "[![{$imgAlt}]({$imgUrl})]({$pageUrl})";
                        } else {
                            $chunks[] = "![{$imgAlt}]({$imgUrl})";
                        }
                    }
                }
            }
        }

        foreach (($item['references'] ?? []) as $ref) {
            if (is_array($ref) && !empty($ref['url'])) {
                $this->addCitation(
                    $citationUrls,
                    $richCitations,
                    $ref['url'],
                    $ref['title'] ?? ($ref['source'] ?? null),
                    $ref['text'] ?? ($ref['snippet'] ?? null),
                    $sourceEngineKey
                );
            }
        }

        foreach (($item['links'] ?? []) as $lnk) {
            if (is_array($lnk) && !empty($lnk['url'])) {
                $this->addCitation($citationUrls, $richCitations, $lnk['url'], $lnk['title'] ?? null, null, $sourceEngineKey);
            }
        }

        foreach (($item['items'] ?? []) as $sub) {
            if (is_array($sub)) {
                $this->extractAiOverviewBlock($sub, $chunks, $citationUrls, $richCitations, $sourceEngineKey);
            }
        }
    }

    protected function renderTableToMarkdown(array $table): string
    {
        $headers = is_array($table['table_header'] ?? null) ? $table['table_header'] : [];
        $rows = is_array($table['table_content'] ?? null) ? $table['table_content'] : [];

        if (empty($headers) && empty($rows)) {
            return '';
        }

        $cleanCell = static fn($v) => trim(str_replace(["\r", "\n", '|'], [' ', ' ', '/'], (string) $v));
        $lines = [];

        if (!empty($headers)) {
            $headerCells = array_map($cleanCell, $headers);
            $lines[] = '| ' . implode(' | ', $headerCells) . ' |';
            $lines[] = '| ' . implode(' | ', array_fill(0, count($headerCells), '---')) . ' |';
        }

        foreach ($rows as $row) {
            if (is_array($row)) {
                $cells = array_map($cleanCell, $row);
                $lines[] = '| ' . implode(' | ', $cells) . ' |';
            }
        }

        return implode("\n", $lines);
    }

    protected function addCitation(
        array &$citationUrls,
        array &$richCitations,
        string $url,
        ?string $title,
        ?string $snippet,
        string $sourceEngineKey
    ): void {
        $url = trim($url);
        if ($url === '' || !str_starts_with(strtolower($url), 'http')) {
            return;
        }
        $domain = $this->extractDomain($url);
        if ($domain === '') {
            return;
        }
        if (!in_array($url, $citationUrls, true)) {
            $citationUrls[] = $url;
            $richCitations[] = [
                'url' => $url,
                'title' => $title ? trim($title) : "Bron: {$domain}",
                'domain' => $domain,
                'snippet' => $snippet ? trim($snippet) : '',
                'sourceEngine' => $sourceEngineKey,
            ];
        }
    }

    protected function extractDomain(string $url): string
    {
        $host = parse_url($url, PHP_URL_HOST);
        if (!is_string($host) || trim($host) === '') {
            return '';
        }
        return strtolower(preg_replace('/^www\./i', '', trim($host)));
    }

    protected function buildLiveResult(
        string $displayName,
        string $methodLabel,
        string $content,
        string $companyName,
        array $citationUrls,
        array $richCitations,
        float $costUsd
    ): array {
        $uniqueCitations = array_values(array_unique($citationUrls));
        $mentioned = $this->aiEngine->isBrandMentioned($content, $companyName, $uniqueCitations);
        $position = $mentioned ? $this->detectMentionPosition($content, $companyName, $uniqueCitations) : null;
        $score = $mentioned ? max(60, 100 - (($position - 1) * 8)) : 0;

        return [
            'method' => $methodLabel,
            'name' => $displayName,
            'text' => $content,
            'citations' => $uniqueCitations,
            'richCitations' => $richCitations,
            'mentioned' => $mentioned,
            'available' => true,
            'failed' => false,
            'isSimulated' => false,
            'fallbackUsed' => false,
            'position' => $position,
            'score' => $score,
            'sentiment' => $mentioned ? '+92' : 'N/A',
            'costUsd' => $costUsd,
            'inputTokens' => 0,
            'outputTokens' => 0,
        ];
    }

    protected function buildUnavailableResult(string $displayName, string $errorMsg, ?int $statusCode = null): array
    {
        return [
            'method' => 'Niet gemeten (DataForSEO fout)',
            'name' => $displayName,
            'text' => '',
            'citations' => [],
            'richCitations' => [],
            'mentioned' => false,
            'available' => false,
            'failed' => true,
            'isSimulated' => true,
            'fallbackUsed' => true,
            'position' => null,
            'score' => 0,
            'sentiment' => 'N/A',
            'costUsd' => 0.0,
            'costEur' => 0.0,
            'tokens' => 0,
            'errorMsg' => $errorMsg,
            'statusCode' => $statusCode,
        ];
    }

    /**
     * Estimate brand rank position (1..10) from numbered lists, markdown tables, or text offset.
     */
    public function detectMentionPosition(string $content, string $companyName, array $citations = []): int
    {
        $lines = preg_split('/\r?\n/', $content) ?: [];

        // 1. Check numbered lists (e.g. "1. **Saleswizard**", "2. Bureau X")
        $numberedIndex = 0;
        foreach ($lines as $line) {
            if (preg_match('/^\s*(\d{1,2})[\.\)]\s+(.+)$/', $line, $m)) {
                $numberedIndex++;
                $declaredRank = (int) $m[1];
                if ($this->aiEngine->isBrandMentioned($m[2], $companyName)) {
                    return max(1, min(10, $declaredRank > 0 ? $declaredRank : $numberedIndex));
                }
            }
        }

        // 2. Check markdown table data rows
        $tableRowIdx = 0;
        $seenSeparator = false;
        foreach ($lines as $line) {
            $trim = trim($line);
            if (!str_starts_with($trim, '|')) {
                $seenSeparator = false;
                $tableRowIdx = 0;
                continue;
            }
            if (preg_match('/^\|\s*[\-\:]+/', $trim)) {
                $seenSeparator = true;
                $tableRowIdx = 0;
                continue;
            }
            if ($seenSeparator) {
                $tableRowIdx++;
                if ($this->aiEngine->isBrandMentioned($trim, $companyName)) {
                    return max(1, min(10, $tableRowIdx));
                }
            }
        }

        // 3. Check citation order if brand only matched via URL
        $brandKey = AiEngineService::cleanBrandKey($companyName);
        if ($brandKey !== '') {
            foreach ($citations as $idx => $url) {
                if (is_string($url) && str_contains(strtolower($url), $brandKey)) {
                    return max(1, min(10, $idx + 1));
                }
            }
        }

        // 4. Relative text offset fallback
        $lower = strtolower($content);
        $len = max(1, strlen($lower));
        $pos = $brandKey !== '' ? strpos($lower, $brandKey) : false;
        if ($pos === false && $brandKey !== '') {
            $spaced = str_replace(['-', '_'], ' ', $brandKey);
            $pos = strpos($lower, $spaced);
        }
        if ($pos !== false) {
            $ratio = $pos / $len;
            if ($ratio < 0.25) {
                return 1;
            }
            if ($ratio < 0.50) {
                return 2;
            }
            if ($ratio < 0.75) {
                return 3;
            }
            return 4;
        }

        return 1;
    }
}
