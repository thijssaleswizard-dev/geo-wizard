<?php

namespace App\Services;

use App\Models\LlmCostLog;
use Illuminate\Support\Facades\Cache;
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
            'cost' => $costEur !== null ? '€' . number_format($costEur, 2, ',', '.') : null,
            'tokens' => $tokens !== null ? number_format($tokens) : null,
        ]);

        if (count(self::$apiCallHistory) > 50) {
            array_pop(self::$apiCallHistory);
        }
    }

    public static function getApiHistory(): array
    {
        try {
            $logs = LlmCostLog::with('project')
                ->whereNotIn('operation', ['manual_invoice', 'google_ai_studio_billing'])
                ->orderBy('id', 'desc')
                ->limit(50)
                ->get();

            if ($logs->isNotEmpty()) {
                return $logs->map(function (LlmCostLog $log) {
                    $company = $log->project?->company ?? ($log->metadata['company'] ?? null);
                    $prefix = $company ? "[{$company}] " : '';

                    if ($log->status === 'ERROR') {
                        $err = $log->metadata['error'] ?? 'Onbekende API fout.';
                        $msg = "{$prefix}FOUT: {$err}";
                    } elseif ($log->status === 'FALLBACK') {
                        $err = $log->metadata['error'] ?? 'Fallback simulator actief (geen API kosten).';
                        $msg = "{$prefix}{$err}";
                    } else {
                        $msg = "{$prefix}Succesvol uitgevoerd ({$log->model} · {$log->operation})";
                    }

                    return [
                        'id' => $log->id,
                        'timestamp' => $log->created_at ? $log->created_at->toISOString() : now()->toISOString(),
                        'engine' => $log->engine,
                        'status' => $log->status,
                        'message' => $msg,
                        'latency' => $log->latency_ms !== null ? "{$log->latency_ms}ms" : 'N/A',
                        'cost' => '€' . number_format((float) $log->cost_eur, 4, ',', '.'),
                        'tokens' => number_format((int) $log->total_tokens),
                    ];
                })->values()->all();
            }
        } catch (\Exception $e) {
            // Fallback to in-memory history if database is unavailable
        }

        return self::$apiCallHistory;
    }

    /**
     * Record circuit-breaker blocks or missing-key fallbacks without overwriting an error just logged.
     */
    protected static function resolveFallbackReason(
        string $engine,
        string $model,
        string $operation,
        string $logName,
        string $promptSnippet,
        string $companyName,
        ?string $apiKey,
        ?string $lastError,
        ?int $projectId,
        ?int $promptId
    ): string {
        $circuitError = $apiKey ? Cache::get("ai_circuit_breaker_{$engine}") : null;
        $activeError = !$apiKey
            ? 'Geen API-sleutel geconfigureerd in .env'
            : ($circuitError ?: ($lastError ?: 'API fout, fallback simulator actief'));

        if ($apiKey && $circuitError && !$lastError) {
            LlmCostService::recordUsage($engine, $model, $operation, 0, 0, 'ERROR', null, $projectId, $promptId, false, ['error' => $circuitError, 'company' => $companyName]);
            self::logApiCall($engine, 'ERROR', $circuitError, null);
            GeoLog::aiCall($logName, $model, $promptSnippet, 'BLOCKED', null, "API aanroep overgeslagen wegens actieve blokkade: {$circuitError}");
        } elseif (!$apiKey) {
            LlmCostService::recordUsage($engine, $model, $operation, 0, 0, 'ERROR', null, $projectId, $promptId, false, ['company' => $companyName, 'error' => $activeError]);
            self::logApiCall($engine, 'ERROR', $activeError, null, 0.0, 0);
        }

        GeoLog::aiCall($logName, $model, $promptSnippet, 'UNAVAILABLE', null, "Niet gemeten (uitgesloten van scores): {$activeError}");
        return $activeError;
    }

    /**
     * Determine whether an API error indicates a billing / spending cap / credit / auth block
     * (versus a transient per-minute 429 rate limit which should NOT disable the engine for an hour).
     */
    public static function isBillingCircuitBreakerError(string $errorMsg): bool
    {
        $lower = strtolower($errorMsg);
        $transientHints = ['rate limit', 'rate_limit', 'per minute', 'too many requests', 'try again later', 'overloaded'];
        foreach ($transientHints as $hint) {
            if (str_contains($lower, $hint)) {
                return false;
            }
        }

        $billingHints = [
            'spending cap',
            'paid credits',
            'credit balance',
            'insufficient_quota',
            'billing',
            'payment required',
            'exceeded its monthly',
            'api key not valid',
            'invalid_api_key',
        ];
        foreach ($billingHints as $hint) {
            if (str_contains($lower, $hint)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Resolve active AI scan driver: 'dataforseo' (web-client) or 'api' (direct developer APIs).
     * When GEO_AI_DRIVER=auto (default), DataForSEO activates automatically once credentials are set.
     */
    public static function getActiveDriver(): string
    {
        $configured = strtolower(trim((string) config('geo.ai_driver', 'auto')));
        if ($configured === 'dataforseo') {
            return 'dataforseo';
        }
        if ($configured === 'api') {
            return 'api';
        }
        return DataForSeoService::isConfigured() ? 'dataforseo' : 'api';
    }

    public static function isDataForSeoActive(): bool
    {
        return self::getActiveDriver() === 'dataforseo';
    }

    /**
     * Clear all active API circuit breaker cache keys (e.g. after adding credits or raising spending cap).
     */
    public static function clearCircuitBreakers(): void
    {
        foreach (['openai', 'chatgpt', 'gemini', 'perplexity', 'anthropic', 'claude', 'copilot', 'meta', 'aio', 'aimode', 'aioverviews', 'dataforseo'] as $key) {
            Cache::forget("ai_circuit_breaker_{$key}");
        }
        Cache::forget('dataforseo_account_summary');
    }

    /**
     * Detect whether a stored or freshly returned modelMention entry is simulated, fallback, or failed.
     * Any such entry is strictly excluded from Share of Voice, rank, position, and visibility metrics.
     */
    public static function isSimulatedOrFailedModel(array $m): bool
    {
        $method = strtolower((string) ($m['method'] ?? ''));
        $summary = strtolower(trim((string) ($m['summary'] ?? '')));

        return !empty($m['isSimulated'])
            || !empty($m['fallbackUsed'])
            || !empty($m['failed'])
            || (array_key_exists('available', $m) && !$m['available'])
            || str_contains($method, 'simulator')
            || str_contains($method, 'niet gemeten')
            || str_starts_with($summary, '[simulator]');
    }

    /**
     * Recalculate clean live-only metrics from a prompt's stored results JSON.
     * Guarantees legacy simulator results and failed API calls NEVER count in scores.
     */
    public static function extractLivePromptMetrics(?array $results, bool $fallbackMentioned = false, $fallbackPosition = null): array
    {
        if (empty($results) || empty($results['modelMentions']) || !is_array($results['modelMentions'])) {
            return [
                'modelMentions' => $results['modelMentions'] ?? null,
                'liveModelsCount' => 0,
                'failedModelsCount' => 0,
                'totalMentions' => 0,
                'totalModels' => 0,
                'mentioned' => false,
                'engines' => [],
                'overallScore' => 0,
                'position' => null,
                'hasLiveData' => false,
            ];
        }

        $sanitized = [];
        $liveCount = 0;
        $failedCount = 0;
        $liveMentionedKeys = [];
        $positions = [];

        foreach ($results['modelMentions'] as $key => $m) {
            if (!is_array($m)) {
                continue;
            }
            if (self::isSimulatedOrFailedModel($m)) {
                $failedCount++;
                $sanitized[$key] = array_merge($m, [
                    'mentioned' => false,
                    'position' => null,
                    'score' => 0,
                    'sentiment' => 'N/A',
                    'available' => false,
                    'failed' => true,
                    'isSimulated' => true,
                    'fallbackUsed' => true,
                    'brands' => 0,
                    'sources' => 0,
                    'method' => str_contains(strtolower((string) ($m['method'] ?? '')), 'simulator')
                        ? 'Niet gemeten (oude simulator uitgesloten)'
                        : ($m['method'] ?? 'Niet gemeten (API fout)'),
                ]);
            } else {
                $liveCount++;
                $isMentioned = !empty($m['mentioned']);
                $sanitized[$key] = array_merge($m, [
                    'available' => true,
                    'failed' => false,
                    'isSimulated' => false,
                    'fallbackUsed' => false,
                    'mentioned' => $isMentioned,
                ]);
                if ($isMentioned) {
                    $liveMentionedKeys[] = $key;
                    if (!empty($m['position']) && is_numeric($m['position'])) {
                        $positions[] = (float) $m['position'];
                    }
                }
            }
        }

        $totalMentions = count($liveMentionedKeys);
        $overallScore = $liveCount > 0 ? (int) round(($totalMentions / $liveCount) * 100) : 0;
        $avgPosition = !empty($positions) ? round(array_sum($positions) / count($positions), 1) : null;

        return [
            'modelMentions' => $sanitized,
            'liveModelsCount' => $liveCount,
            'failedModelsCount' => $failedCount,
            'totalMentions' => $totalMentions,
            'totalModels' => $liveCount,
            'mentioned' => $totalMentions > 0,
            'engines' => $liveMentionedKeys,
            'overallScore' => $overallScore,
            'position' => $avgPosition,
            'hasLiveData' => $liveCount > 0,
        ];
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
        $useDfs = self::isDataForSeoActive();
        $dfsConfigured = DataForSeoService::isConfigured();
        $dfsPplx = $useDfs && (bool) config('geo.dataforseo_include_perplexity', true);
        $dfsClaude = $useDfs && (bool) config('geo.dataforseo_include_claude', true);

        return [
            'chatgpt' => [
                'key' => 'chatgpt',
                'apiKey' => $useDfs ? ($dfsConfigured ? 'dataforseo' : null) : self::getApiKey('openai'),
                'envKey' => $useDfs ? 'DATAFORSEO_LOGIN' : 'OPENAI_API_KEY',
                'name' => $useDfs ? 'ChatGPT Web UI (DataForSEO)' : 'OpenAI (gpt-4o-mini)',
                'shortName' => 'ChatGPT',
                'alwaysAvailable' => true,
                'viaDataForSeo' => $useDfs,
                'check' => $useDfs ? fn($k) => $dfsConfigured : fn($k) => !empty($k) && str_starts_with($k, 'sk-'),
            ],
            'gemini' => [
                'key' => 'gemini',
                'apiKey' => $useDfs ? ($dfsConfigured ? 'dataforseo' : null) : self::getApiKey('gemini'),
                'envKey' => $useDfs ? 'DATAFORSEO_LOGIN' : 'GEMINI_API_KEY',
                'name' => $useDfs ? 'Google Gemini Web UI (DataForSEO)' : 'Google AI Studio (Gemini Flash)',
                'shortName' => $useDfs ? 'Gemini Web' : 'Google AI Studio',
                'alwaysAvailable' => true,
                'viaDataForSeo' => $useDfs,
                'check' => $useDfs ? fn($k) => $dfsConfigured : fn($k) => !empty($k),
            ],
            'perplexity' => [
                'key' => 'perplexity',
                'apiKey' => $dfsPplx ? ($dfsConfigured ? 'dataforseo' : null) : self::getApiKey('perplexity'),
                'envKey' => $dfsPplx ? 'DATAFORSEO_LOGIN' : 'PERPLEXITY_API_KEY',
                'name' => $dfsPplx ? 'Perplexity Web (DataForSEO)' : 'Perplexity API',
                'shortName' => 'Perplexity',
                'alwaysAvailable' => true,
                'viaDataForSeo' => $dfsPplx,
                'check' => $dfsPplx ? fn($k) => $dfsConfigured : fn($k) => !empty($k),
            ],
            'claude' => [
                'key' => 'claude',
                'apiKey' => $dfsClaude ? ($dfsConfigured ? 'dataforseo' : null) : self::getApiKey('anthropic'),
                'envKey' => $dfsClaude ? 'DATAFORSEO_LOGIN' : 'ANTHROPIC_API_KEY',
                'name' => $dfsClaude ? 'Claude Web (DataForSEO)' : 'Anthropic Claude 3.5',
                'shortName' => 'Claude',
                'alwaysAvailable' => true,
                'viaDataForSeo' => $dfsClaude,
                'check' => $dfsClaude ? fn($k) => $dfsConfigured : fn($k) => !empty($k),
            ],
            'aio' => [
                'key' => 'aio',
                'apiKey' => $useDfs ? ($dfsConfigured ? 'dataforseo' : null) : null,
                'envKey' => $useDfs ? 'DATAFORSEO_LOGIN' : null,
                'name' => $useDfs ? 'Google.nl AI Overviews (DataForSEO)' : 'Google AI Overviews',
                'shortName' => 'AI Overviews',
                'alwaysAvailable' => true,
                'viaDataForSeo' => $useDfs,
                'check' => fn($k) => $useDfs ? $dfsConfigured : true,
            ],
            'copilot' => [
                'key' => 'copilot',
                'apiKey' => self::getApiKey('copilot'),
                'envKey' => 'COPILOT_API_KEY',
                'name' => 'Microsoft Copilot',
                'shortName' => 'Copilot',
                'alwaysAvailable' => false, // Conditioneel: alleen als COPILOT_API_KEY geconfigureerd is
                'viaDataForSeo' => false,
                'check' => fn($k) => !empty($k),
            ],
            'meta' => [
                'key' => 'meta',
                'apiKey' => self::getApiKey('meta'),
                'envKey' => 'META_API_KEY',
                'name' => 'Meta AI',
                'shortName' => 'Meta AI',
                'alwaysAvailable' => false, // Conditioneel: alleen als META_API_KEY geconfigureerd is
                'viaDataForSeo' => false,
                'check' => fn($k) => !empty($k),
            ],
        ];
    }

    /**
     * Normalize any company name, workspace, or domain by stripping protocols, www, and ANY domain extension (.nl, .com, .eu, etc.)
     */
    public static function cleanBrandKey(?string $domainOrCompany): string
    {
        if (empty($domainOrCompany)) {
            return '';
        }
        $cleaned = strtolower(trim(urldecode($domainOrCompany)));
        $cleaned = preg_replace('#^https?://#i', '', $cleaned);
        $cleaned = preg_replace('#^www\.#i', '', $cleaned);
        $cleaned = explode('/', $cleaned)[0];
        $cleaned = preg_replace('/\.(co\.[a-z]{2}|[a-z]{2,10})$/i', '', $cleaned);
        return trim($cleaned);
    }

    public static function isEngineEnabled(string $key): bool
    {
        $configs = self::getEngineConfigs();
        $normalized = strtolower(trim($key));
        if (!isset($configs[$normalized])) {
            return false;
        }

        $cfg = $configs[$normalized];

        if (!empty($cfg['viaDataForSeo'])) {
            if (Cache::has('ai_circuit_breaker_dataforseo')) {
                return false;
            }
            return DataForSeoService::isConfigured();
        }

        $breakerKey = match ($normalized) {
            'chatgpt' => 'openai',
            'claude' => 'anthropic',
            'aio', 'aimode', 'aioverviews' => 'gemini',
            default => $normalized,
        };

        // If circuit breaker is active (spending cap, unpaid credits), engine is temporarily blocked
        if (Cache::has("ai_circuit_breaker_{$normalized}") || Cache::has("ai_circuit_breaker_{$breakerKey}")) {
            return false;
        }

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
        $useDfs = self::isDataForSeoActive();
        $dfsConfigured = DataForSeoService::isConfigured();
        $dfsPplx = $useDfs && (bool) config('geo.dataforseo_include_perplexity', true);
        $dfsClaude = $useDfs && (bool) config('geo.dataforseo_include_claude', true);

        $engines = [
            [
                'key' => 'openai',
                'name' => $useDfs ? 'ChatGPT Web (DataForSEO)' : 'OpenAI (gpt-4o / gpt-4o-mini)',
                'envKey' => $useDfs ? 'DATAFORSEO_LOGIN' : 'OPENAI_API_KEY',
                'viaDataForSeo' => $useDfs,
                'check' => $useDfs ? fn($k) => $dfsConfigured : fn($k) => !empty($k) && str_starts_with($k, 'sk-'),
            ],
            [
                'key' => 'gemini',
                'name' => $useDfs ? 'Google Suite Web & SERP (DataForSEO)' : 'Google AI Studio (Gemini Flash)',
                'envKey' => $useDfs ? 'DATAFORSEO_LOGIN' : 'GEMINI_API_KEY',
                'viaDataForSeo' => $useDfs,
                'check' => $useDfs ? fn($k) => $dfsConfigured : fn($k) => !empty($k),
            ],
            [
                'key' => 'perplexity',
                'name' => $dfsPplx ? 'Perplexity Web (DataForSEO)' : 'Perplexity API (Agent API)',
                'envKey' => $dfsPplx ? 'DATAFORSEO_LOGIN' : 'PERPLEXITY_API_KEY',
                'viaDataForSeo' => $dfsPplx,
                'check' => $dfsPplx ? fn($k) => $dfsConfigured : fn($k) => !empty($k),
            ],
            [
                'key' => 'anthropic',
                'name' => $dfsClaude ? 'Claude Web (DataForSEO)' : 'Anthropic Claude Sonnet 5.5',
                'envKey' => $dfsClaude ? 'DATAFORSEO_LOGIN' : 'ANTHROPIC_API_KEY',
                'viaDataForSeo' => $dfsClaude,
                'check' => $dfsClaude ? fn($k) => $dfsConfigured : fn($k) => !empty($k),
            ],
            [
                'key' => 'copilot',
                'name' => 'Microsoft Copilot',
                'envKey' => 'COPILOT_API_KEY',
                'viaDataForSeo' => false,
                'check' => fn($k) => !empty($k),
            ],
        ];

        $costsByEngine = [];
        $liveCostsByEngine = [];
        try {
            $costsByEngine = LlmCostLog::selectRaw('engine, SUM(cost_eur) as total_eur, SUM(total_tokens) as total_tokens, COUNT(*) as total_calls')
                ->groupBy('engine')
                ->get()
                ->keyBy('engine');

            $liveCostsByEngine = LlmCostLog::whereNotIn('operation', ['manual_invoice', 'google_ai_studio_billing'])
                ->selectRaw("engine, SUM(cost_eur) as live_eur, SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) as ok_calls, SUM(CASE WHEN status = 'ERROR' THEN 1 ELSE 0 END) as err_calls")
                ->groupBy('engine')
                ->get()
                ->keyBy('engine');
        } catch (\Exception $e) {
            // graceful fallback if table not yet migrated
        }

        $dfsCircuitMsg = Cache::get('ai_circuit_breaker_dataforseo');

        return array_map(function ($eng) use ($costsByEngine, $liveCostsByEngine, $dfsCircuitMsg) {
            $isDfsEngine = !empty($eng['viaDataForSeo']);
            $key = $isDfsEngine ? DataForSeoService::getLogin() : self::getApiKey($eng['key']);
            $isConfigured = ($eng['check'])($key);

            // 1. Check circuit breaker in Cache
            $circuitBreakerMsg = $isDfsEngine
                ? $dfsCircuitMsg
                : Cache::get("ai_circuit_breaker_{$eng['key']}");

            // 2. Check latest DB log for persistent state across FPM requests
            // When powered by DataForSEO, only evaluate DataForSEO logs so historical direct-API billing errors don't falsely mark engines red!
            $latestDbLog = null;
            $lastErrorLog = null;
            $recentFailRatio = 0.0;
            try {
                $baseLogQuery = LlmCostLog::where('engine', $eng['key'])
                    ->whereNotIn('operation', ['manual_invoice', 'google_ai_studio_billing']);
                if ($isDfsEngine) {
                    $baseLogQuery->where('metadata->via', 'dataforseo_web_client');
                }

                $recentLogs = (clone $baseLogQuery)
                    ->whereIn('status', ['SUCCESS', 'ERROR'])
                    ->orderBy('id', 'desc')
                    ->limit(5)
                    ->get();

                $latestDbLog = $recentLogs->first();
                if ($recentLogs->isNotEmpty()) {
                    $recentErrs = $recentLogs->where('status', 'ERROR')->count();
                    $recentFailRatio = $recentErrs / $recentLogs->count();
                }

                if (!$latestDbLog) {
                    $latestDbLog = (clone $baseLogQuery)
                        ->orderBy('id', 'desc')
                        ->first();
                }

                $lastErrorLog = (clone $baseLogQuery)
                    ->where('status', 'ERROR')
                    ->orderBy('id', 'desc')
                    ->first();
            } catch (\Exception $e) {
            }

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
            } elseif ($circuitBreakerMsg) {
                $status = 'ERROR';
                $lastError = $circuitBreakerMsg;
            } elseif ($lastLog) {
                $status = $lastLog['status'] === 'SUCCESS' ? 'ACTIVE' : 'ERROR';
                $lastError = $lastLog['status'] !== 'SUCCESS' ? $lastLog['message'] : null;
            } elseif ($latestDbLog) {
                if ($latestDbLog->status === 'ERROR') {
                    $status = 'ERROR';
                    $lastError = $latestDbLog->metadata['error'] ?? 'API fout opgetreden';
                } elseif ($latestDbLog->status === 'FALLBACK') {
                    $status = 'ERROR';
                    $lastError = $lastErrorLog?->metadata['error'] ?? 'Geen live API-respons ontvangen';
                } elseif ($recentFailRatio >= 0.6 && $lastErrorLog) {
                    $status = 'DEGRADED';
                    $lastError = $lastErrorLog->metadata['error'] ?? 'Meerdere recente API fouten';
                } else {
                    $status = 'ACTIVE';
                    $lastError = null;
                }
            } else {
                $status = 'ACTIVE';
                $lastError = null;
            }

            $costStat = $costsByEngine[$eng['key']] ?? null;
            $liveStat = $liveCostsByEngine[$eng['key']] ?? null;

            return [
                'engine' => $eng['key'],
                'name' => $eng['name'],
                'driver' => $isDfsEngine ? 'dataforseo' : 'api',
                'configured' => (bool) $isConfigured,
                'status' => $status,
                'lastError' => $lastError,
                'lastUsed' => $lastLog ? $lastLog['timestamp'] : ($latestDbLog?->created_at?->toIso8601String() ?? null),
                'totalCostEur' => $costStat ? round((float) $costStat->total_eur, 2) : 0.00,
                'liveCostEur' => $liveStat ? round((float) $liveStat->live_eur, 2) : 0.00,
                'totalTokens' => $costStat ? (int) $costStat->total_tokens : 0,
                'totalCalls' => $costStat ? (int) $costStat->total_calls : 0,
                'successCalls' => $liveStat ? (int) $liveStat->ok_calls : 0,
                'failedCalls' => $liveStat ? (int) $liveStat->err_calls : 0,
            ];
        }, $engines);
    }

    // 1. OpenAI API (or DataForSEO ChatGPT Web UI when web-client driver is active)
    public function queryOpenAI(string $prompt, string $companyName, ?int $projectId = null, ?int $promptId = null): array
    {
        if (self::isDataForSeoActive()) {
            return (new DataForSeoService($this))->queryChatGptWeb($prompt, $companyName, $projectId, $promptId);
        }

        $apiKey = self::getApiKey('openai');
        $companyKey = self::cleanBrandKey($companyName);
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
                    $searchCalls = 0;

                    foreach ($outputItems as $item) {
                        if (($item['type'] ?? '') === 'web_search_call') {
                            $searchCalls++;
                        }
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

                    // Track tokens and cost (including web_search_preview tool calls)
                    $usage = $data['usage'] ?? [];
                    $inTokens = $usage['prompt_tokens'] ?? $usage['input_tokens'] ?? (int) ceil(mb_strlen($prompt) / 4);
                    $outTokens = $usage['completion_tokens'] ?? $usage['output_tokens'] ?? (int) ceil(mb_strlen($content) / 4);
                    $costLog = LlmCostService::recordUsage('openai', 'gpt-4o', 'prompt_scan', $inTokens, $outTokens, 'SUCCESS', $duration, $projectId, $promptId, false, ['company' => $companyName], max(1, $searchCalls));

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

                $lastError = $response->json('error.message') ?? $response->body();
                LlmCostService::recordUsage('openai', 'gpt-4o', 'prompt_scan', 0, 0, 'ERROR', $duration, $projectId, $promptId, false, ['error' => $lastError, 'company' => $companyName]);
                self::logApiCall('openai', 'ERROR', $lastError, $duration);
                GeoLog::aiCall('OpenAI ChatGPT', 'gpt-4o (SearchGPT Web)', $promptSnippet, 'ERROR', $duration, "Fout respons: {$lastError}");
            } catch (\Exception $e) {
                $duration = (int) round((microtime(true) - $startTime) * 1000);
                $lastError = $e->getMessage();
                LlmCostService::recordUsage('openai', 'gpt-4o', 'prompt_scan', 0, 0, 'ERROR', $duration, $projectId, $promptId, false, ['error' => $lastError, 'company' => $companyName]);
                self::logApiCall('openai', 'ERROR', $lastError, $duration);
                GeoLog::aiCall('OpenAI ChatGPT', 'gpt-4o (SearchGPT Web)', $promptSnippet, 'ERROR', $duration, "Exception: {$lastError}");
            }
        }

        // No fake simulator fallback: mark strictly as unavailable/failed so it never counts in scores
        $activeError = self::resolveFallbackReason('openai', 'gpt-4o', 'prompt_scan', 'OpenAI ChatGPT', $promptSnippet, $companyName, $apiKey, $lastError ?? null, $projectId, $promptId);
        return [
            'method' => 'Niet gemeten (API fout)',
            'name' => 'ChatGPT 4o',
            'text' => '',
            'citations' => [],
            'mentioned' => false,
            'available' => false,
            'failed' => true,
            'position' => null,
            'score' => 0,
            'sentiment' => 'N/A',
            'fallbackUsed' => true,
            'isSimulated' => true,
            'costEur' => 0.0,
            'tokens' => 0,
            'errorMsg' => $activeError,
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
        if ($apiKey && !Cache::has('ai_circuit_breaker_gemini')) {
            try {
                $startTime = microtime(true);
                $response = Http::timeout(20)
                    ->post("https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key={$apiKey}", [
                        'contents' => [
                            ['parts' => [['text' => $prompt]]]
                        ]
                    ]);
                $duration = (int) round((microtime(true) - $startTime) * 1000);

                if ($response->successful()) {
                    $data = $response->json();
                    $text = $data['candidates'][0]['content']['parts'][0]['text'] ?? '';

                    $usage = $data['usageMetadata'] ?? [];
                    $inTokens = $usage['promptTokenCount'] ?? (int) ceil(mb_strlen($prompt) / 4);
                    $outTokens = $usage['candidatesTokenCount'] ?? (int) ceil(mb_strlen($text) / 4);
                    LlmCostService::recordUsage('gemini', 'gemini-flash-lite-latest', 'gemini_raw_query', $inTokens, $outTokens, 'SUCCESS', $duration, $projectId, null, false);

                    return [
                        'success' => true,
                        'text' => $text,
                    ];
                }

                $errMsg = $response->json('error.message') ?? $response->body();
                if (self::isBillingCircuitBreakerError($errMsg)) {
                    Cache::put('ai_circuit_breaker_gemini', $errMsg, 300);
                }
                LlmCostService::recordUsage('gemini', 'gemini-flash-lite-latest', 'gemini_raw_query', 0, 0, 'ERROR', $duration, $projectId, null, false, ['error' => $errMsg]);
            } catch (\Exception $e) {
                LlmCostService::recordUsage('gemini', 'gemini-flash-lite-latest', 'gemini_raw_query', 0, 0, 'ERROR', null, $projectId, null, false, ['error' => $e->getMessage()]);
                GeoLog::warning("⚠️ [Gemini Raw Fout] " . $e->getMessage());
            }
        }

        // Clean fallback to cheap OpenAI gpt-4o-mini when Gemini direct API is unavailable or disconnected
        $openaiKey = self::getApiKey('openai');
        if ($openaiKey && str_starts_with($openaiKey, 'sk-')) {
            try {
                $startTime = microtime(true);
                $response = Http::withToken($openaiKey)
                    ->timeout(15)
                    ->post('https://api.openai.com/v1/chat/completions', [
                        'model' => 'gpt-4o-mini',
                        'messages' => [['role' => 'user', 'content' => $prompt]],
                        'max_tokens' => 400,
                        'temperature' => 0.3,
                    ]);
                $duration = (int) round((microtime(true) - $startTime) * 1000);

                if ($response->successful()) {
                    $text = trim((string) ($response->json('choices.0.message.content') ?? ''));
                    $usage = $response->json('usage') ?? [];
                    $inTokens = $usage['prompt_tokens'] ?? (int) ceil(mb_strlen($prompt) / 4);
                    $outTokens = $usage['completion_tokens'] ?? (int) ceil(mb_strlen($text) / 4);
                    LlmCostService::recordUsage('openai', 'gpt-4o-mini', 'keyword_recommendation', $inTokens, $outTokens, 'SUCCESS', $duration, $projectId, null, false);

                    return [
                        'success' => true,
                        'text' => $text,
                    ];
                }
            } catch (\Exception $e) {
                GeoLog::warning("⚠️ [OpenAI Raw Fallback Fout] " . $e->getMessage());
            }
        }

        return ['success' => false, 'text' => ''];
    }

    /**
     * Consolidated Google AI Ecosystem query (Gemini, AI Mode, AI Overviews).
     * When DataForSEO Web-Client is active, queries real Gemini Web UI, Google.nl AI Overviews & Google.nl AI Mode concurrently.
     */
    public function queryGoogleEcosystem(string $prompt, string $companyName, array $webCitations = [], ?int $projectId = null, ?int $promptId = null): array
    {
        if (self::isDataForSeoActive()) {
            $dfs = new DataForSeoService($this);
            $batch = $dfs->queryAllEnginesConcurrently($prompt, $companyName, $projectId, $promptId, false, false, false);
            return [
                'gemini' => $batch['gemini'],
                'aimode' => $batch['aimode'],
                'aioverviews' => $batch['aioverviews'],
            ];
        }

        $apiKey = self::getApiKey('gemini');
        $companyKey = self::cleanBrandKey($companyName);
        $promptSnippet = mb_substr(trim(preg_replace('/\s+/', ' ', $prompt)), 0, 70) . '...';
        $startTime = microtime(true);
        $useSearchGrounding = self::isSearchGroundingEnabled();

        GeoLog::aiCall('Google Suite', 'gemini-flash-lite-latest', $promptSnippet, 'START', null, "Querying consolidated Google AI Suite (RAG " . ($useSearchGrounding ? '+ Google Grounding' : 'Web Grounded') . ") for [{$companyName}]");

        if ($apiKey && !Cache::has('ai_circuit_breaker_gemini')) {
            try {
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

                $response = Http::timeout(25)->post("https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key={$apiKey}", $payload);

                // Retry once on transient HTTP 429 rate-limit (unless it's a hard spending cap)
                if ($response->status() === 429 && !self::isBillingCircuitBreakerError($response->json('error.message') ?? $response->body())) {
                    sleep(2);
                    $response = Http::timeout(25)->post("https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key={$apiKey}", $payload);
                }

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

                $lastError = $response->json('error.message') ?? $response->body();
                if (self::isBillingCircuitBreakerError($lastError)) {
                    Cache::put('ai_circuit_breaker_gemini', $lastError, 300);
                }
                LlmCostService::recordUsage('gemini', 'gemini-flash-latest', 'google_suite_scan', 0, 0, 'ERROR', $duration, $projectId, $promptId, false, ['error' => $lastError, 'company' => $companyName]);
                self::logApiCall('gemini', 'ERROR', $lastError, $duration);
                GeoLog::aiCall('Google Suite', 'gemini-flash-latest', $promptSnippet, 'ERROR', $duration, "Fout respons: {$lastError}");
            } catch (\Exception $e) {
                $duration = (int) round((microtime(true) - $startTime) * 1000);
                $lastError = $e->getMessage();
                LlmCostService::recordUsage('gemini', 'gemini-flash-latest', 'google_suite_scan', 0, 0, 'ERROR', $duration, $projectId, $promptId, false, ['error' => $lastError, 'company' => $companyName]);
                self::logApiCall('gemini', 'ERROR', $lastError, $duration);
                GeoLog::aiCall('Google Suite', 'gemini-flash-latest', $promptSnippet, 'ERROR', $duration, "Exception: {$lastError}");
            }
        }

        // No fake simulator fallback: mark all 3 strictly as unavailable/failed so they NEVER count in scores
        $activeError = self::resolveFallbackReason('gemini', 'gemini-flash-latest', 'google_suite_scan', 'Google Suite', $promptSnippet, $companyName, $apiKey, $lastError ?? null, $projectId, $promptId);
        $unavailableBase = [
            'method' => 'Niet gemeten (API fout)',
            'text' => '',
            'citations' => [],
            'mentioned' => false,
            'available' => false,
            'failed' => true,
            'position' => null,
            'score' => 0,
            'sentiment' => 'N/A',
            'fallbackUsed' => true,
            'isSimulated' => true,
            'costEur' => 0.0,
            'tokens' => 0,
            'errorMsg' => $activeError,
        ];
        return [
            'gemini' => array_merge($unavailableBase, ['name' => 'Gemini Flash']),
            'aimode' => array_merge($unavailableBase, ['name' => 'Google AI Mode']),
            'aioverviews' => array_merge($unavailableBase, ['name' => 'Google AI Overviews']),
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

    // 3. Perplexity API (or DataForSEO Perplexity Web Search when web-client driver is active)
    public function queryPerplexity(string $prompt, string $companyName, ?int $projectId = null, ?int $promptId = null): array
    {
        if (self::isDataForSeoActive() && (bool) config('geo.dataforseo_include_perplexity', true)) {
            return (new DataForSeoService($this))->queryPerplexity($prompt, $companyName, $projectId, $promptId);
        }

        $apiKey = self::getApiKey('perplexity');
        $companyKey = self::cleanBrandKey($companyName);
        $promptSnippet = mb_substr(trim(preg_replace('/\s+/', ' ', $prompt)), 0, 70) . '...';
        $startTime = microtime(true);

        GeoLog::aiCall('Perplexity AI', 'sonar', $promptSnippet, 'START', null, "Querying live model & search index for [{$companyName}]");

        if ($apiKey && !Cache::has('ai_circuit_breaker_perplexity')) {
            try {
                // Perplexity Agent API (v1/responses) with live web search
                $pplxPayload = [
                    'preset' => 'fast',
                    'instructions' => "Je bent Perplexity AI met live web browsing voor Nederlandse lokale zoekopdrachten. Wanneer de gebruiker vraagt naar betrouwbare hoveniers, bureaus of bedrijven in een stad of regio, doorzoek je actuele recensies en bedrijfsvermeldingen. Rangschik de partijen op basis van betrouwbaarheid (reviewscore en aantal reviews), specialisaties en lokale aanwezigheid. Geef een overzichtelijke shortlist / tabel met sterren en reviews en licht de top bureaus toe.",
                    'input' => $prompt,
                ];
                $response = Http::withToken($apiKey)
                    ->timeout(25)
                    ->post('https://api.perplexity.ai/v1/responses', $pplxPayload);

                // Retry once on transient HTTP 429 rate-limit (unless it's a billing/credits error)
                if ($response->status() === 429 && !self::isBillingCircuitBreakerError($response->json('error.message') ?? $response->body())) {
                    sleep(2);
                    $response = Http::withToken($apiKey)
                        ->timeout(25)
                        ->post('https://api.perplexity.ai/v1/responses', $pplxPayload);
                }

                $duration = (int) round((microtime(true) - $startTime) * 1000);

                if ($response->successful()) {
                    $data = $response->json();
                    $outputItems = $data['output'] ?? [];
                    $content = '';
                    $citations = [];

                    foreach ($outputItems as $item) {
                        if (($item['type'] ?? '') === 'search_results') {
                            foreach ($item['results'] ?? [] as $res) {
                                if (!empty($res['url'])) {
                                    $citations[] = $res['url'];
                                }
                            }
                        }
                        if (($item['type'] ?? '') === 'message') {
                            foreach ($item['content'] ?? [] as $c) {
                                if (($c['type'] ?? '') === 'output_text') {
                                    $content .= $c['text'] ?? '';
                                }
                                foreach ($c['annotations'] ?? [] as $anno) {
                                    if (!empty($anno['url'])) {
                                        $citations[] = $anno['url'];
                                    }
                                }
                            }
                        }
                    }

                    if (empty($content)) {
                        $content = $data['output_text'] ?? ($data['choices'][0]['message']['content'] ?? '');
                    }
                    if (empty($citations) && !empty($data['citations'])) {
                        $citations = $data['citations'];
                    }

                    $mentionsBrand = $this->isBrandMentioned($content, $companyName, $citations);

                    // Track tokens and cost
                    $usage = $data['usage'] ?? [];
                    $inTokens = $usage['input_tokens'] ?? $usage['prompt_tokens'] ?? (int) ceil(mb_strlen($prompt) / 4);
                    $outTokens = $usage['output_tokens'] ?? $usage['completion_tokens'] ?? (int) ceil(mb_strlen($content) / 4);
                    $costLog = LlmCostService::recordUsage('perplexity', 'sonar', 'prompt_scan', $inTokens, $outTokens, 'SUCCESS', $duration, $projectId, $promptId, true, ['company' => $companyName]);

                    self::logApiCall('perplexity', 'SUCCESS', 'Call completed successfully with Perplexity Agent API.', $duration, $costLog->cost_eur, $costLog->total_tokens);
                    GeoLog::aiCall('Perplexity AI', 'Agent API (fast)', $promptSnippet, 'SUCCESS', $duration, count($citations) . " citaties | Merk vermeld: " . ($mentionsBrand ? "JA (Score 86)" : "NEE (Score 30)") . " | Kosten: €" . number_format($costLog->cost_eur, 4));

                    return [
                        'method' => 'Perplexity API (Agent API / responses)',
                        'name' => 'Perplexity AI',
                        'text' => $content,
                        'citations' => array_values(array_unique($citations)),
                        'mentioned' => $mentionsBrand,
                        'position' => $mentionsBrand ? 2 : null,
                        'score' => $mentionsBrand ? 86 : 30,
                        'sentiment' => $mentionsBrand ? '+92' : 'N/A',
                        'fallbackUsed' => false,
                        'costEur' => $costLog->cost_eur,
                        'tokens' => $costLog->total_tokens,
                    ];
                }

                $lastError = $response->json('error.message') ?? $response->body();
                if (self::isBillingCircuitBreakerError($lastError)) {
                    Cache::put('ai_circuit_breaker_perplexity', $lastError, 300);
                }
                LlmCostService::recordUsage('perplexity', 'sonar', 'prompt_scan', 0, 0, 'ERROR', $duration, $projectId, $promptId, false, ['error' => $lastError, 'company' => $companyName]);
                self::logApiCall('perplexity', 'ERROR', $lastError, $duration);
                GeoLog::aiCall('Perplexity AI', 'sonar', $promptSnippet, 'ERROR', $duration, "Fout respons: {$lastError}");
            } catch (\Exception $e) {
                $duration = (int) round((microtime(true) - $startTime) * 1000);
                $lastError = $e->getMessage();
                LlmCostService::recordUsage('perplexity', 'sonar', 'prompt_scan', 0, 0, 'ERROR', $duration, $projectId, $promptId, false, ['error' => $lastError, 'company' => $companyName]);
                self::logApiCall('perplexity', 'ERROR', $lastError, $duration);
                GeoLog::aiCall('Perplexity AI', 'sonar', $promptSnippet, 'ERROR', $duration, "Exception: {$lastError}");
            }
        }

        // No fake simulator fallback: mark strictly as unavailable/failed so it never counts in scores
        $activeError = self::resolveFallbackReason('perplexity', 'sonar', 'prompt_scan', 'Perplexity AI', $promptSnippet, $companyName, $apiKey, $lastError ?? null, $projectId, $promptId);
        return [
            'method' => 'Niet gemeten (API fout)',
            'name' => 'Perplexity AI',
            'text' => '',
            'citations' => [],
            'mentioned' => false,
            'available' => false,
            'failed' => true,
            'position' => null,
            'score' => 0,
            'sentiment' => 'N/A',
            'fallbackUsed' => true,
            'isSimulated' => true,
            'costEur' => 0.0,
            'tokens' => 0,
            'errorMsg' => $activeError,
        ];
    }

    // 4. Anthropic Claude API (or DataForSEO Claude Web Search when web-client driver is active)
    public function queryAnthropic(string $prompt, string $companyName, ?int $projectId = null, ?int $promptId = null): array
    {
        if (self::isDataForSeoActive() && (bool) config('geo.dataforseo_include_claude', true)) {
            return (new DataForSeoService($this))->queryClaude($prompt, $companyName, $projectId, $promptId);
        }

        $apiKey = self::getApiKey('anthropic');
        $companyKey = self::cleanBrandKey($companyName);
        $promptSnippet = mb_substr(trim(preg_replace('/\s+/', ' ', $prompt)), 0, 70) . '...';
        $startTime = microtime(true);

        GeoLog::aiCall('Anthropic Claude', 'claude-sonnet-5-5', $promptSnippet, 'START', null, "Querying live model for [{$companyName}]");

        if ($apiKey) {
            try {
                $response = Http::withHeaders([
                    'x-api-key' => $apiKey,
                    'anthropic-version' => '2023-06-01',
                ])
                ->withOptions([
                    'curl' => [CURLOPT_IPRESOLVE => CURL_IPRESOLVE_V4],
                ])
                ->timeout(20)->post('https://api.anthropic.com/v1/messages', [
                            'model' => 'claude-sonnet-5-5',
                            'max_tokens' => 2500,
                            'thinking' => ['type' => 'between_tools'],
                            'system' => "Je bent Claude met expertise in de Nederlandse lokale markt. Wanneer de gebruiker vraagt naar betrouwbare dienstverleners of bedrijven (zoals hoveniers) in een stad of regio, geef je een gedetailleerd en eerlijk advies. Rangschik de beste partijen in een overzichtelijke markdown-tabel met beoordeling, specialisaties en toelichting per topkeuze.",
                            'messages' => [
                                ['role' => 'user', 'content' => $prompt],
                            ],
                        ]);

                $duration = (int) round((microtime(true) - $startTime) * 1000);

                if ($response->successful()) {
                    $data = $response->json();
                    $content = '';
                    foreach ($data['content'] ?? [] as $block) {
                        if (($block['type'] ?? '') === 'text') {
                            $content .= $block['text'] ?? '';
                        }
                    }
                    if (empty($content) && !empty($data['content'][0]['text'])) {
                        $content = $data['content'][0]['text'];
                    }
                    $mentionsBrand = $this->isBrandMentioned($content, $companyName);

                    // Track tokens and cost
                    $usage = $data['usage'] ?? [];
                    $inTokens = $usage['input_tokens'] ?? (int) ceil(mb_strlen($prompt) / 4);
                    $outTokens = $usage['output_tokens'] ?? (int) ceil(mb_strlen($content) / 4);
                    $costLog = LlmCostService::recordUsage('anthropic', 'claude-sonnet-5-5', 'prompt_scan', $inTokens, $outTokens, 'SUCCESS', $duration, $projectId, $promptId, false, ['company' => $companyName]);

                    self::logApiCall('anthropic', 'SUCCESS', 'Call completed successfully.', $duration, $costLog->cost_eur, $costLog->total_tokens);
                    GeoLog::aiCall('Anthropic Claude', 'claude-sonnet-5-5', $promptSnippet, 'SUCCESS', $duration, "Merk vermeld: " . ($mentionsBrand ? "JA (Score 84)" : "NEE (Score 20)") . " | Kosten: €" . number_format($costLog->cost_eur, 4));

                    return [
                        'method' => 'Anthropic API (claude-sonnet-5-5)',
                        'name' => 'Claude Sonnet 5.5',
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

                $lastError = $response->json('error.message') ?? $response->body();
                LlmCostService::recordUsage('anthropic', 'claude-sonnet-5-5', 'prompt_scan', 0, 0, 'ERROR', $duration, $projectId, $promptId, false, ['error' => $lastError, 'company' => $companyName]);
                self::logApiCall('anthropic', 'ERROR', $lastError, $duration);
                GeoLog::aiCall('Anthropic Claude', 'claude-sonnet-5-5', $promptSnippet, 'ERROR', $duration, "Fout respons: {$lastError}");
            } catch (\Exception $e) {
                $duration = (int) round((microtime(true) - $startTime) * 1000);
                $lastError = $e->getMessage();
                LlmCostService::recordUsage('anthropic', 'claude-sonnet-5-5', 'prompt_scan', 0, 0, 'ERROR', $duration, $projectId, $promptId, false, ['error' => $lastError, 'company' => $companyName]);
                self::logApiCall('anthropic', 'ERROR', $lastError, $duration);
                GeoLog::aiCall('Anthropic Claude', 'claude-sonnet-5-5', $promptSnippet, 'ERROR', $duration, "Exception: {$lastError}");
            }
        }

        // No fake simulator fallback: mark strictly as unavailable/failed so it never counts in scores
        $activeError = self::resolveFallbackReason('anthropic', 'claude-sonnet-5-5', 'prompt_scan', 'Anthropic Claude', $promptSnippet, $companyName, $apiKey, $lastError ?? null, $projectId, $promptId);
        return [
            'method' => 'Niet gemeten (API fout)',
            'name' => 'Claude Sonnet 5.5',
            'text' => '',
            'citations' => [],
            'mentioned' => false,
            'available' => false,
            'failed' => true,
            'position' => null,
            'score' => 0,
            'sentiment' => 'N/A',
            'fallbackUsed' => true,
            'isSimulated' => true,
            'costEur' => 0.0,
            'tokens' => 0,
            'errorMsg' => $activeError,
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
        $cleanBase = self::cleanBrandKey($cleanDom) ?: explode('.', $cleanDom)[0];
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
