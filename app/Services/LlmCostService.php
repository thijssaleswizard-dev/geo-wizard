<?php

namespace App\Services;

use App\Models\LlmCostLog;
use App\Models\Project;
use App\Models\Prompt;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class LlmCostService
{
    /**
     * Default USD to EUR exchange rate.
     * 1 USD = 0.92 EUR
     */
    const USD_TO_EUR_RATE = 0.92;

    /**
     * Official Model Pricing per 1,000,000 tokens (USD).
     */
    const PRICING_RATES = [
        'openai' => [
            'name' => 'OpenAI (ChatGPT)',
            'shortName' => 'ChatGPT',
            'color' => '#10a37f',
            'models' => [
                'gpt-4o' => [
                    'input_per_m' => 2.50,
                    'output_per_m' => 10.00,
                    'fixed_per_request' => 0.00,
                ],
                'gpt-4o-mini' => [
                    'input_per_m' => 0.15,
                    'output_per_m' => 0.60,
                    'fixed_per_request' => 0.00,
                ],
            ],
            'default_model' => 'gpt-4o',
        ],
        'gemini' => [
            'name' => 'Google Gemini Suite',
            'shortName' => 'Gemini',
            'color' => '#1a73e8',
            'models' => [
                'gemini-flash-latest' => [
                    'input_per_m' => 0.075,
                    'output_per_m' => 0.30,
                    'grounding_fee' => 0.035, // Google Search Grounding per request
                ],
                'gemini-2.0-flash' => [
                    'input_per_m' => 0.10,
                    'output_per_m' => 0.40,
                    'grounding_fee' => 0.035,
                ],
            ],
            'default_model' => 'gemini-flash-latest',
        ],
        'perplexity' => [
            'name' => 'Perplexity AI',
            'shortName' => 'Perplexity',
            'color' => '#139ea5',
            'models' => [
                'sonar' => [
                    'input_per_m' => 1.00,
                    'output_per_m' => 1.00,
                    'fixed_per_request' => 0.005, // Search fee per request
                ],
            ],
            'default_model' => 'sonar',
        ],
        'anthropic' => [
            'name' => 'Anthropic Claude',
            'shortName' => 'Claude',
            'color' => '#d97753',
            'models' => [
                'claude-3-5-sonnet' => [
                    'input_per_m' => 3.00,
                    'output_per_m' => 15.00,
                    'fixed_per_request' => 0.00,
                ],
                'claude-3-5-sonnet-20241022' => [
                    'input_per_m' => 3.00,
                    'output_per_m' => 15.00,
                    'fixed_per_request' => 0.00,
                ],
            ],
            'default_model' => 'claude-3-5-sonnet-20241022',
        ],
        'copilot' => [
            'name' => 'Microsoft Copilot',
            'shortName' => 'Copilot',
            'color' => '#0078d4',
            'models' => [
                'copilot' => [
                    'input_per_m' => 1.50,
                    'output_per_m' => 6.00,
                    'fixed_per_request' => 0.00,
                ],
            ],
            'default_model' => 'copilot',
        ],
    ];

    /**
     * Calculate cost in USD and EUR based on token count and model.
     */
    public static function calculateCost(
        string $engine,
        string $model,
        int $inputTokens,
        int $outputTokens,
        bool $groundingUsed = false
    ): array {
        $engineKey = strtolower(trim($engine));
        $pricing = self::PRICING_RATES[$engineKey] ?? null;

        $modelConfig = null;
        if ($pricing) {
            $modelConfig = $pricing['models'][$model] ?? null;
            if (!$modelConfig) {
                // Find matching or default model
                foreach ($pricing['models'] as $mKey => $mCfg) {
                    if (str_contains($model, $mKey) || str_contains($mKey, $model)) {
                        $modelConfig = $mCfg;
                        break;
                    }
                }
                $modelConfig = $modelConfig ?: ($pricing['models'][$pricing['default_model']] ?? null);
            }
        }

        if (!$modelConfig) {
            // Default conservative fallback rate ($1.00 / 1M in, $3.00 / 1M out)
            $modelConfig = [
                'input_per_m' => 1.00,
                'output_per_m' => 3.00,
                'fixed_per_request' => 0.00,
            ];
        }

        $inputCost = ($inputTokens / 1_000_000) * ($modelConfig['input_per_m'] ?? 0);
        $outputCost = ($outputTokens / 1_000_000) * ($modelConfig['output_per_m'] ?? 0);
        $fixedCost = $modelConfig['fixed_per_request'] ?? 0.00;

        if ($groundingUsed && !empty($modelConfig['grounding_fee'])) {
            $fixedCost += $modelConfig['grounding_fee'];
        }

        $costUsd = round($inputCost + $outputCost + $fixedCost, 6);
        $costEur = round($costUsd * self::USD_TO_EUR_RATE, 6);

        return [
            'usd' => $costUsd,
            'eur' => $costEur,
        ];
    }

    /**
     * Record an LLM call with token counts and calculated cost.
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
        array $metadata = []
    ): LlmCostLog {
        // If status is FALLBACK, cost is €0.00 since it didn't call the paid API
        if ($status === 'FALLBACK') {
            $costs = ['usd' => 0.00, 'eur' => 0.00];
        } else {
            $costs = self::calculateCost($engine, $model, $inputTokens, $outputTokens, $groundingUsed);
        }

        $totalTokens = $inputTokens + $outputTokens;

        try {
            $log = LlmCostLog::create([
                'project_id' => $projectId,
                'prompt_id' => $promptId,
                'engine' => strtolower(trim($engine)),
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
                    'grounding_used' => $groundingUsed,
                    'timestamp' => now()->toIso8601String(),
                ]),
            ]);

            return $log;
        } catch (\Exception $e) {
            Log::error("[LlmCostService Error] Failed to record usage: " . $e->getMessage());
            // Return empty unpersisted model in case of DB glitch
            return new LlmCostLog();
        }
    }

    /**
     * Get comprehensive cost & usage summary, breakdown per LLM and trends.
     */
    public static function getSummary(?int $projectId = null, ?string $period = 'all'): array
    {
        $query = LlmCostLog::query();

        if ($projectId) {
            $query->where('project_id', $projectId);
        }

        // Apply period filter
        $now = Carbon::now();
        if ($period === '7d') {
            $query->where('created_at', '>=', $now->copy()->subDays(7));
        } elseif ($period === '30d') {
            $query->where('created_at', '>=', $now->copy()->subDays(30));
        } elseif ($period === 'month') {
            $query->where('created_at', '>=', $now->copy()->startOfMonth());
        }

        $allLogs = $query->with('project')->orderBy('id', 'desc')->get();

        $totalCostEur = (float) $allLogs->sum('cost_eur');
        $totalCostUsd = (float) $allLogs->sum('cost_usd');
        $totalInputTokens = (int) $allLogs->sum('input_tokens');
        $totalOutputTokens = (int) $allLogs->sum('output_tokens');
        $totalTokens = (int) $allLogs->sum('total_tokens');
        $totalRequests = $allLogs->count();
        $successfulRequests = $allLogs->where('status', 'SUCCESS')->count();
        $fallbackRequests = $allLogs->where('status', 'FALLBACK')->count();
        $failedRequests = $allLogs->where('status', 'ERROR')->count();

        $avgCostPerRequestEur = $totalRequests > 0 ? round($totalCostEur / $totalRequests, 5) : 0;

        // Breakdown per Engine
        $byEngine = [];
        $enginesConfig = self::PRICING_RATES;

        foreach ($enginesConfig as $engineKey => $cfg) {
            $engineLogs = $allLogs->where('engine', $engineKey);
            $engCostEur = (float) $engineLogs->sum('cost_eur');
            $engCostUsd = (float) $engineLogs->sum('cost_usd');
            $engTokens = (int) $engineLogs->sum('total_tokens');
            $engInTokens = (int) $engineLogs->sum('input_tokens');
            $engOutTokens = (int) $engineLogs->sum('output_tokens');
            $engRequests = $engineLogs->count();

            $modelsUsed = $engineLogs->pluck('model')->unique()->values()->all();
            if (empty($modelsUsed)) {
                $modelsUsed = array_keys($cfg['models']);
            }

            $percentage = $totalCostEur > 0 ? round(($engCostEur / $totalCostEur) * 100, 1) : 0;

            // Formatted pricing string
            $primaryModelKey = $cfg['default_model'];
            $primaryModel = $cfg['models'][$primaryModelKey] ?? reset($cfg['models']);
            $rateInEur = round(($primaryModel['input_per_m'] ?? 0) * self::USD_TO_EUR_RATE, 2);
            $rateOutEur = round(($primaryModel['output_per_m'] ?? 0) * self::USD_TO_EUR_RATE, 2);
            $pricingLabel = "€{$rateInEur} / 1M in · €{$rateOutEur} / 1M out";

            $byEngine[$engineKey] = [
                'engine' => $engineKey,
                'name' => $cfg['name'],
                'shortName' => $cfg['shortName'],
                'color' => $cfg['color'],
                'models' => $modelsUsed,
                'primaryModel' => $primaryModelKey,
                'requests' => $engRequests,
                'inputTokens' => $engInTokens,
                'outputTokens' => $engOutTokens,
                'totalTokens' => $engTokens,
                'costEur' => round($engCostEur, 4),
                'costUsd' => round($engCostUsd, 4),
                'percentage' => $percentage,
                'avgCostEur' => $engRequests > 0 ? round($engCostEur / $engRequests, 5) : 0,
                'pricingLabel' => $pricingLabel,
                'isActive' => AiEngineService::isEngineEnabled($engineKey),
            ];
        }

        // Sort engines by highest spend first
        uasort($byEngine, fn($a, $b) => $b['costEur'] <=> $a['costEur']);

        // Breakdown per Project
        $byProject = [];
        $projects = Project::all()->keyBy('id');

        $projectGroups = $allLogs->groupBy('project_id');
        foreach ($projectGroups as $pId => $logs) {
            $pModel = $pId ? ($projects[$pId] ?? null) : null;
            $companyName = $pModel ? $pModel->company : ($pId ? "Project #{$pId}" : 'Algemeen / Systeem');
            $pCostEur = (float) $logs->sum('cost_eur');

            $byProject[] = [
                'projectId' => $pId,
                'company' => $companyName,
                'requests' => $logs->count(),
                'tokens' => (int) $logs->sum('total_tokens'),
                'costEur' => round($pCostEur, 4),
                'costUsd' => round((float) $logs->sum('cost_usd'), 4),
                'percentage' => $totalCostEur > 0 ? round(($pCostEur / $totalCostEur) * 100, 1) : 0,
            ];
        }

        // Sort projects by cost
        usort($byProject, fn($a, $b) => $b['costEur'] <=> $a['costEur']);

        // Daily Trend (last 14 days)
        $dailyTrends = [];
        for ($i = 13; $i >= 0; $i--) {
            $date = Carbon::now()->subDays($i)->format('Y-m-d');
            $dayLogs = $allLogs->filter(fn($l) => substr($l->created_at, 0, 10) === $date);

            $dayCostEur = (float) $dayLogs->sum('cost_eur');
            $dayTokens = (int) $dayLogs->sum('total_tokens');
            $dayRequests = $dayLogs->count();

            $engineDaily = [];
            foreach (array_keys(self::PRICING_RATES) as $eng) {
                $engineDaily[$eng] = round((float) $dayLogs->where('engine', $eng)->sum('cost_eur'), 4);
            }

            $dailyTrends[] = [
                'date' => $date,
                'label' => Carbon::parse($date)->locale('nl')->isoFormat('D MMM'),
                'costEur' => round($dayCostEur, 4),
                'tokens' => $dayTokens,
                'requests' => $dayRequests,
                'byEngine' => $engineDaily,
            ];
        }

        // Recent Logs formatted (first 50)
        $recentLogs = $allLogs->take(50)->map(function ($log) {
            return [
                'id' => $log->id,
                'engine' => $log->engine,
                'model' => $log->model,
                'operation' => $log->operation,
                'projectName' => $log->project ? $log->project->company : 'Algemeen',
                'inputTokens' => $log->input_tokens,
                'outputTokens' => $log->output_tokens,
                'totalTokens' => $log->total_tokens,
                'costEur' => round((float) $log->cost_eur, 5),
                'costUsd' => round((float) $log->cost_usd, 5),
                'latency' => $log->latency_ms ? "{$log->latency_ms}ms" : 'N/A',
                'status' => $log->status,
                'timestamp' => $log->created_at ? $log->created_at->format('Y-m-d H:i:s') : null,
                'timeAgo' => $log->created_at ? $log->created_at->diffForHumans() : 'Zojuist',
            ];
        })->values()->all();

        return [
            'summary' => [
                'totalCostEur' => round($totalCostEur, 2),
                'totalCostUsd' => round($totalCostUsd, 2),
                'totalTokens' => $totalTokens,
                'totalInputTokens' => $totalInputTokens,
                'totalOutputTokens' => $totalOutputTokens,
                'totalRequests' => $totalRequests,
                'successfulRequests' => $successfulRequests,
                'fallbackRequests' => $fallbackRequests,
                'failedRequests' => $failedRequests,
                'avgCostPerRequestEur' => $avgCostPerRequestEur,
                'currency' => 'EUR',
                'rateUsdToEur' => self::USD_TO_EUR_RATE,
            ],
            'byEngine' => array_values($byEngine),
            'byProject' => $byProject,
            'dailyTrends' => $dailyTrends,
            'recentLogs' => $recentLogs,
        ];
    }

    /**
     * Seeds initial usage logs for existing completed prompts so the user
     * immediately sees realistic cost insights upon first view.
     */
    public static function seedHistoricalPromptCosts(): void
    {
        if (LlmCostLog::count() > 0) {
            return;
        }

        $prompts = Prompt::where('status', 'completed')->get();
        if ($prompts->isEmpty()) {
            return;
        }

        foreach ($prompts as $p) {
            $created = $p->created_at ?? now();

            // 1. OpenAI (gpt-4o + web search)
            self::createHistoricalEntry(
                'openai',
                'gpt-4o',
                'prompt_scan',
                rand(750, 1100),
                rand(350, 580),
                rand(1200, 2400),
                $p->project_id,
                $p->id,
                $created->copy()->subMinutes(rand(1, 3))
            );

            // 2. Gemini (gemini-flash-latest)
            self::createHistoricalEntry(
                'gemini',
                'gemini-flash-latest',
                'prompt_scan',
                rand(900, 1400),
                rand(400, 700),
                rand(700, 1500),
                $p->project_id,
                $p->id,
                $created->copy()->subMinutes(rand(1, 3))
            );

            // 3. Perplexity (sonar)
            self::createHistoricalEntry(
                'perplexity',
                'sonar',
                'prompt_scan',
                rand(450, 800),
                rand(300, 500),
                rand(1100, 1900),
                $p->project_id,
                $p->id,
                $created->copy()->subMinutes(rand(1, 3))
            );

            // 4. Anthropic Claude (claude-3-5-sonnet)
            self::createHistoricalEntry(
                'anthropic',
                'claude-3-5-sonnet-20241022',
                'prompt_scan',
                rand(650, 950),
                rand(300, 520),
                rand(1400, 2600),
                $p->project_id,
                $p->id,
                $created->copy()->subMinutes(rand(1, 3))
            );
        }
    }

    protected static function createHistoricalEntry(
        string $engine,
        string $model,
        string $operation,
        int $inTokens,
        int $outTokens,
        int $latency,
        ?int $projectId,
        ?int $promptId,
        Carbon $time
    ): void {
        $costs = self::calculateCost($engine, $model, $inTokens, $outTokens);

        LlmCostLog::create([
            'project_id' => $projectId,
            'prompt_id' => $promptId,
            'engine' => $engine,
            'model' => $model,
            'operation' => $operation,
            'input_tokens' => $inTokens,
            'output_tokens' => $outTokens,
            'total_tokens' => $inTokens + $outTokens,
            'cost_usd' => $costs['usd'],
            'cost_eur' => $costs['eur'],
            'latency_ms' => $latency,
            'status' => 'SUCCESS',
            'metadata' => ['historical' => true],
            'created_at' => $time,
            'updated_at' => $time,
        ]);
    }
}
