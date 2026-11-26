<?php

namespace App\Services;

use App\Models\LlmCostLog;
use App\Models\Project;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;

class LlmCostService
{
    /**
     * Default USD to EUR exchange rate (DataForSEO bills in USD).
     */
    const USD_TO_EUR_RATE = 0.92;

    /**
     * Canonical DataForSEO channels used by GEO Wizard.
     */
    const DATAFORSEO_CHANNELS = [
        'chatgpt' => [
            'key' => 'chatgpt',
            'name' => 'ChatGPT Web (DataForSEO)',
            'shortName' => 'ChatGPT Web',
            'endpointLabel' => '/v3/ai_optimization/chat_gpt/*',
            'color' => '#10a37f',
        ],
        'gemini' => [
            'key' => 'gemini',
            'name' => 'Gemini Web (DataForSEO)',
            'shortName' => 'Gemini Web',
            'endpointLabel' => '/v3/ai_optimization/gemini/*',
            'color' => '#1a73e8',
        ],
        'aimode' => [
            'key' => 'aimode',
            'name' => 'Google AI Mode (DataForSEO)',
            'shortName' => 'Google AI Mode',
            'endpointLabel' => '/v3/serp/google/ai_mode/live/advanced',
            'color' => '#4f46e5',
        ],
        'aioverviews' => [
            'key' => 'aioverviews',
            'name' => 'Google AI Overviews (DataForSEO)',
            'shortName' => 'AI Overviews',
            'endpointLabel' => '/v3/serp/google/organic/live/advanced',
            'color' => '#2563eb',
        ],
        'perplexity' => [
            'key' => 'perplexity',
            'name' => 'Perplexity Web (DataForSEO)',
            'shortName' => 'Perplexity Web',
            'endpointLabel' => '/v3/ai_optimization/perplexity/llm_responses/live',
            'color' => '#0d9488',
        ],
        'claude' => [
            'key' => 'claude',
            'name' => 'Claude Web (DataForSEO)',
            'shortName' => 'Claude Web',
            'endpointLabel' => '/v3/ai_optimization/claude/llm_responses/live',
            'color' => '#d97753',
        ],
        'serp' => [
            'key' => 'serp',
            'name' => 'Google.nl SERP & Concurrenten (DataForSEO)',
            'shortName' => 'Google SERP',
            'endpointLabel' => '/v3/serp/google/organic/live/regular',
            'color' => '#7c3aed',
        ],
    ];

    /**
     * Fallback pricing table kept for backwards-compatible helper calls when overrideCostUsd is omitted.
     */
    public static function calculateCost(
        string $engine,
        string $model,
        int $inputTokens,
        int $outputTokens,
        bool $groundingUsed = false,
        int $searchCalls = 0
    ): array {
        $fixedUsd = match ($model) {
            'chatgpt-web-client' => 0.004,
            'gemini-web-client' => 0.004,
            'google-ai-overviews', 'google-ai-mode', 'dataforseo-google-serp-competitors' => 0.002,
            'dataforseo-perplexity-sonar' => 0.005,
            'dataforseo-claude-haiku-4-5' => 0.020,
            default => 0.0,
        };

        return [
            'usd' => round($fixedUsd, 6),
            'eur' => round($fixedUsd * self::USD_TO_EUR_RATE, 6),
        ];
    }

    /**
     * Record a DataForSEO call with exact provider-reported USD cost.
     */
    public static function recordUsage(
        string $engine,
        string $model,
        string $operation,
        int $inputTokens,
        int $outputTokens,
        string $status = 'SUCCESS',
        ?int $latencyMs = null,
        ?int $projectId = null,
        ?int $promptId = null,
        bool $groundingUsed = false,
        array $metadata = [],
        int $searchCalls = 0,
        ?float $overrideCostUsd = null
    ): LlmCostLog {
        // Ignore non-DataForSEO auxiliary/legacy calls so the cost table stays 100% DataForSEO-only
        $via = strtolower((string) ($metadata['via'] ?? ''));
        $modelLower = strtolower($model);
        $engineLower = strtolower(trim($engine));
        $isDfsCall = str_starts_with($via, 'dataforseo')
            || str_starts_with($engineLower, 'dataforseo')
            || str_starts_with($modelLower, 'dataforseo-')
            || in_array($modelLower, ['chatgpt-web-client', 'gemini-web-client', 'google-ai-overviews', 'google-ai-mode'], true)
            || in_array(strtolower($operation), ['web_client_scan', 'google_serp_aio_scan', 'google_ai_mode_scan', 'competitor_serp_scan', 'dataforseo_topup'], true);

        if (!$isDfsCall) {
            return new LlmCostLog();
        }

        if ($status !== 'SUCCESS') {
            $costs = ['usd' => 0.00, 'eur' => 0.00];
        } elseif ($overrideCostUsd !== null) {
            $rawUsd = max(0.0, $overrideCostUsd);
            $costs = [
                'usd' => round($rawUsd, 6),
                'eur' => round($rawUsd * self::USD_TO_EUR_RATE, 6),
            ];
        } else {
            $costs = self::calculateCost($engine, $model, $inputTokens, $outputTokens, $groundingUsed, $searchCalls);
        }

        $totalTokens = $inputTokens + $outputTokens;

        try {
            return LlmCostLog::create([
                'project_id' => $projectId,
                'prompt_id' => $promptId,
                'engine' => $engineLower,
                'model' => $model,
                'operation' => $operation,
                'input_tokens' => $inputTokens,
                'output_tokens' => $outputTokens,
                'total_tokens' => $totalTokens,
                'cost_usd' => $costs['usd'],
                'cost_eur' => $costs['eur'],
                'latency_ms' => $latencyMs,
                'status' => $status,
                'metadata' => array_merge($metadata, [
                    'timestamp' => now()->toIso8601String(),
                ]),
            ]);
        } catch (\Exception $e) {
            Log::error('[LlmCostService Error] Failed to record DataForSEO usage: ' . $e->getMessage());
            return new LlmCostLog();
        }
    }

    /**
     * Determine whether a log row belongs to DataForSEO (excluding legacy Google AI Studio / direct LLM API rows).
     */
    public static function isDataForSeoLog(LlmCostLog $log): bool
    {
        $op = strtolower((string) $log->operation);
        if ($op === 'google_ai_studio_billing') {
            return false;
        }

        $meta = is_array($log->metadata) ? $log->metadata : (json_decode((string) $log->metadata, true) ?: []);
        $via = strtolower((string) ($meta['via'] ?? ''));
        $source = strtolower((string) ($meta['source'] ?? ''));
        $engine = strtolower((string) $log->engine);
        $model = strtolower((string) $log->model);

        if (str_starts_with($via, 'dataforseo') || $source === 'dataforseo' || str_starts_with($engine, 'dataforseo')) {
            return true;
        }

        if (
            str_starts_with($model, 'dataforseo-') ||
            in_array($model, ['chatgpt-web-client', 'gemini-web-client', 'google-ai-overviews', 'google-ai-mode'], true) ||
            in_array($op, ['web_client_scan', 'google_serp_aio_scan', 'google_ai_mode_scan', 'competitor_serp_scan', 'dataforseo_topup'], true)
        ) {
            return true;
        }

        if ($op === 'manual_invoice' && $engine === 'dataforseo') {
            return true;
        }

        return false;
    }

    /**
     * Map a DataForSEO log row to one of the canonical DataForSEO channels.
     */
    public static function resolveChannelKey(LlmCostLog $log): string
    {
        $model = strtolower((string) $log->model);
        $op = strtolower((string) $log->operation);
        $engine = strtolower((string) $log->engine);
        $meta = is_array($log->metadata) ? $log->metadata : [];
        $srcEngine = strtolower((string) ($meta['source_engine'] ?? ''));

        if ($model === 'google-ai-mode' || $op === 'google_ai_mode_scan' || $srcEngine === 'aimode') {
            return 'aimode';
        }
        if ($model === 'google-ai-overviews' || $op === 'google_serp_aio_scan' || $srcEngine === 'aioverviews') {
            return 'aioverviews';
        }
        if ($model === 'dataforseo-google-serp-competitors' || $op === 'competitor_serp_scan' || $engine === 'dataforseo_serp') {
            return 'serp';
        }
        if ($engine === 'openai' || str_contains($model, 'chatgpt') || $srcEngine === 'chatgpt') {
            return 'chatgpt';
        }
        if ($engine === 'perplexity' || str_contains($model, 'perplexity') || $srcEngine === 'perplexity') {
            return 'perplexity';
        }
        if ($engine === 'anthropic' || str_contains($model, 'claude') || $srcEngine === 'claude') {
            return 'claude';
        }
        if ($engine === 'gemini' || str_contains($model, 'gemini') || $srcEngine === 'gemini') {
            return 'gemini';
        }

        return 'serp';
    }

    /**
     * Permanently delete legacy non-DataForSEO rows (Google AI Studio Mastercard charges, old direct OpenAI/Gemini/Claude/Perplexity API rows).
     */
    public static function purgeLegacyNonDataForSeoLogs(): int
    {
        $deleted = 0;
        try {
            $all = LlmCostLog::all(['id', 'engine', 'model', 'operation', 'metadata']);
            $legacyIds = $all->reject(fn(LlmCostLog $l) => self::isDataForSeoLog($l))->pluck('id')->all();
            if (!empty($legacyIds)) {
                $deleted = LlmCostLog::whereIn('id', $legacyIds)->delete();
            }
        } catch (\Exception $e) {
            Log::warning('[LlmCostService] Legacy cleanup warning: ' . $e->getMessage());
        }

        return $deleted;
    }

    /**
     * Clean DataForSEO-only cost & usage summary.
     */
    public static function getSummary(?int $projectId = null, ?string $period = 'all', bool $forceBalanceRefresh = false): array
    {
        // Automatically purge any legacy Google AI Studio / old direct LLM API rows so only DataForSEO remains
        self::purgeLegacyNonDataForSeoLogs();

        $query = LlmCostLog::query();

        if ($projectId) {
            $query->where('project_id', $projectId);
        }

        $now = Carbon::now();
        if ($period === '7d') {
            $query->where('created_at', '>=', $now->copy()->subDays(7));
        } elseif ($period === '30d') {
            $query->where('created_at', '>=', $now->copy()->subDays(30));
        } elseif ($period === 'month') {
            $query->where('created_at', '>=', $now->copy()->startOfMonth());
        }

        $dfsLogs = $query->with('project')->orderBy('id', 'desc')->get()
            ->filter(fn(LlmCostLog $l) => self::isDataForSeoLog($l))
            ->values();

        $topupOps = ['manual_invoice', 'dataforseo_topup'];
        $liveScanLogs = $dfsLogs->filter(fn(LlmCostLog $l) => !in_array($l->operation, $topupOps, true))->values();
        $topupLogs = $dfsLogs->filter(fn(LlmCostLog $l) => in_array($l->operation, $topupOps, true))->values();

        $liveCostEur = round((float) $liveScanLogs->sum('cost_eur'), 2);
        $liveCostUsd = round((float) $liveScanLogs->sum('cost_usd'), 2);
        $topupCostEur = round((float) $topupLogs->sum('cost_eur'), 2);

        $totalRequests = $liveScanLogs->count();
        $successfulRequests = $liveScanLogs->where('status', 'SUCCESS')->count();
        $failedRequests = $liveScanLogs->where('status', 'ERROR')->count();

        $billableSumEur = (float) $liveScanLogs->where('status', 'SUCCESS')->sum('cost_eur');
        $avgCostPerRequestEur = $successfulRequests > 0 ? round($billableSumEur / $successfulRequests, 4) : 0.00;
        $estimatedCostPerPromptEur = round($avgCostPerRequestEur * 6, 4);

        // Breakdown per DataForSEO Channel
        $byEngine = [];
        foreach (self::DATAFORSEO_CHANNELS as $chKey => $chCfg) {
            $chLogs = $liveScanLogs->filter(fn(LlmCostLog $l) => self::resolveChannelKey($l) === $chKey);
            $chCostEur = round((float) $chLogs->sum('cost_eur'), 4);
            $chCostUsd = round((float) $chLogs->sum('cost_usd'), 4);
            $chRequests = $chLogs->count();
            $chSuccess = $chLogs->where('status', 'SUCCESS')->count();
            $chFailed = $chLogs->where('status', 'ERROR')->count();
            $avgLatency = (int) round((float) ($chLogs->whereNotNull('latency_ms')->avg('latency_ms') ?? 0));

            $pct = $liveCostEur > 0 ? round(($chCostEur / $liveCostEur) * 100, 1) : 0.0;

            $byEngine[] = [
                'engine' => $chKey,
                'name' => $chCfg['name'],
                'shortName' => $chCfg['shortName'],
                'endpointLabel' => $chCfg['endpointLabel'],
                'color' => $chCfg['color'],
                'requests' => $chRequests,
                'successRequests' => $chSuccess,
                'failedRequests' => $chFailed,
                'avgLatencyMs' => $avgLatency,
                'costEur' => round($chCostEur, 2),
                'costEurExact' => $chCostEur,
                'liveCostEur' => round($chCostEur, 2),
                'costUsd' => round($chCostUsd, 2),
                'avgCostEur' => $chSuccess > 0 ? round($chCostEur / $chSuccess, 4) : 0.0000,
                'percentage' => $pct,
            ];
        }

        usort($byEngine, fn($a, $b) => $b['costEurExact'] <=> $a['costEurExact']);

        // Breakdown per Client Project
        $byProject = [];
        $projects = Project::all()->keyBy('id');
        $projectGroups = $liveScanLogs->groupBy(fn(LlmCostLog $l) => $l->project_id ?: 0);

        foreach ($projectGroups as $pId => $logs) {
            $pModel = $pId ? ($projects[$pId] ?? null) : null;
            $companyName = $pModel ? $pModel->company : 'Algemeen / Losse scans';
            $pCostEur = round((float) $logs->sum('cost_eur'), 4);
            $pCostUsd = round((float) $logs->sum('cost_usd'), 4);
            $uniquePrompts = $logs->pluck('prompt_id')->filter()->unique()->count();

            $byProject[] = [
                'projectId' => $pId ?: null,
                'company' => $companyName,
                'requests' => $logs->count(),
                'successRequests' => $logs->where('status', 'SUCCESS')->count(),
                'promptsScanned' => $uniquePrompts,
                'costEur' => round($pCostEur, 2),
                'costEurExact' => $pCostEur,
                'costUsd' => round($pCostUsd, 2),
                'percentage' => $liveCostEur > 0 ? round(($pCostEur / $liveCostEur) * 100, 1) : 0.0,
            ];
        }

        usort($byProject, fn($a, $b) => $b['costEurExact'] <=> $a['costEurExact']);

        // Recent DataForSEO Logs (latest 100)
        $recentLogs = $dfsLogs->take(100)->map(function (LlmCostLog $log) use ($topupOps) {
            $meta = is_array($log->metadata) ? $log->metadata : [];
            $isTopup = in_array($log->operation, $topupOps, true);
            $chKey = $isTopup ? 'topup' : self::resolveChannelKey($log);
            $chCfg = self::DATAFORSEO_CHANNELS[$chKey] ?? null;

            $endpoint = $meta['endpoint']
                ?? ($isTopup ? ($meta['description'] ?? 'DataForSEO tegoed / factuur') : ($chCfg['endpointLabel'] ?? $log->operation));

            return [
                'id' => $log->id,
                'channel' => $chKey,
                'engine' => $chKey,
                'engineLabel' => $isTopup ? 'DataForSEO Opwaardering / Factuur' : ($chCfg['name'] ?? 'DataForSEO'),
                'shortLabel' => $isTopup ? 'Opwaardering' : ($chCfg['shortName'] ?? 'DataForSEO'),
                'model' => $log->model,
                'operation' => $log->operation,
                'endpoint' => $endpoint,
                'projectName' => $log->project ? $log->project->company : ($meta['company'] ?? 'Algemeen'),
                'costEur' => round((float) $log->cost_eur, 4),
                'costUsd' => round((float) $log->cost_usd, 4),
                'latency' => $log->latency_ms ? round($log->latency_ms / 1000, 1) . 's' : '—',
                'latencyMs' => $log->latency_ms,
                'status' => $log->status,
                'invoiceRef' => $meta['invoice_reference'] ?? null,
                'error' => $meta['error'] ?? null,
                'timestamp' => $log->created_at ? $log->created_at->format('Y-m-d H:i:s') : null,
            ];
        })->values()->all();

        $dataForSeoAccount = DataForSeoService::getAccountSummary($forceBalanceRefresh);

        return [
            'summary' => [
                'totalCostEur' => $liveCostEur,
                'totalCostUsd' => $liveCostUsd,
                'liveApiCostEur' => $liveCostEur,
                'topupCostEur' => $topupCostEur,
                'totalRequests' => $totalRequests,
                'successfulRequests' => $successfulRequests,
                'failedRequests' => $failedRequests,
                'avgCostPerRequestEur' => $avgCostPerRequestEur,
                'estimatedCostPerPromptEur' => $estimatedCostPerPromptEur,
                'currency' => 'EUR',
                'rateUsdToEur' => self::USD_TO_EUR_RATE,
                'aiDriver' => 'dataforseo',
                'dataforseo' => $dataForSeoAccount,
            ],
            'byEngine' => $byEngine,
            'byProject' => $byProject,
            'recentLogs' => $recentLogs,
        ];
    }

    /**
     * Kept as safe no-op for legacy callers.
     */
    public static function seedHistoricalPromptCosts(): void
    {
    }

    /**
     * Record a manual DataForSEO top-up / invoice entry.
     */
    public static function recordManualInvoice(
        string $engine,
        float $amountEur,
        string $description,
        ?string $invoiceRef = null,
        ?string $date = null,
        ?int $projectId = null
    ): LlmCostLog {
        $amountEur = round($amountEur, 2);
        $amountUsd = round($amountEur / self::USD_TO_EUR_RATE, 2);
        $timestamp = $date ? Carbon::parse($date) : now();

        return LlmCostLog::create([
            'project_id' => $projectId,
            'prompt_id' => null,
            'engine' => 'dataforseo',
            'model' => 'dataforseo-balance-topup',
            'operation' => 'dataforseo_topup',
            'input_tokens' => 0,
            'output_tokens' => 0,
            'total_tokens' => 0,
            'cost_usd' => $amountUsd,
            'cost_eur' => $amountEur,
            'latency_ms' => null,
            'status' => 'SUCCESS',
            'metadata' => [
                'via' => 'dataforseo_billing',
                'source' => 'dataforseo',
                'invoice_reference' => $invoiceRef ?: ('DFS-' . strtoupper(substr(md5(uniqid()), 0, 8))),
                'description' => $description,
                'manual_entry' => true,
            ],
            'created_at' => $timestamp,
            'updated_at' => $timestamp,
        ]);
    }
}
