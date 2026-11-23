<?php

namespace App\Jobs;

use App\Models\Prompt;
use App\Services\GeoLog;
use App\Services\ScraperService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;

class ProcessPromptJob implements ShouldQueue
{
    use Queueable;

    public int $promptId;

    /**
     * The number of seconds the job can run before timing out.
     */
    public int $timeout = 300;

    /**
     * The number of times the job may be attempted.
     */
    public int $tries = 1;

    /**
     * Indicate if the job should fail on timeout.
     */
    public bool $failOnTimeout = true;

    /**
     * Create a new job instance.
     */
    public function __construct(int $promptId)
    {
        $this->promptId = $promptId;
    }

    /**
     * Execute the job.
     */
    public function handle(ScraperService $scraperService): void
    {
        $promptRecord = Prompt::find($this->promptId);
        if (!$promptRecord) {
            GeoLog::warning("⚠️ [ProcessPromptJob] Prompt #{$this->promptId} niet gevonden in database.");
            return;
        }

        $project = $promptRecord->project_id ? \App\Models\Project::find($promptRecord->project_id) : null;
        $companyName = $project ? $project->company : 'Saleswizard';

        GeoLog::subSection("QUEUE WORKER: VERWERKEN PROMPT #{$this->promptId}");
        GeoLog::info("Opstarten AI scan voor Prompt #{$this->promptId}: \"{$promptRecord->prompt_text}\" (Project ID: #" . ($promptRecord->project_id ?? 'geen') . ", Bedrijf: {$companyName})");

        $promptRecord->update([
            'status' => 'processing',
            'updated_at' => now(),
        ]);

        try {
            $result = $scraperService->runScraper(
                $promptRecord->prompt_text,
                $companyName,
                $promptRecord->project_id,
                $promptRecord->id
            );

            $totalMentioned = $result['totalMentions'] ?? 0;
            $totalModels = $result['totalLiveModels'] ?? $result['totalModels'] ?? 0;
            $failedModelsCount = $result['failedModelsCount'] ?? 0;

            $promptRecord->update([
                'status' => $totalModels > 0 ? 'completed' : 'failed',
                'brand_mentioned' => $totalMentioned > 0,
                'position' => $totalMentioned > 0 ? ($result['position'] ?? null) : null,
                'response_summary' => $totalModels > 0
                    ? "{$companyName} wordt door {$totalMentioned} van de {$totalModels} live AI-modellen aanbevolen." . ($failedModelsCount > 0 ? " ({$failedModelsCount} niet gemeten)" : "")
                    : "Geen live AI-modellen beschikbaar tijdens deze scan.",
                'sentiment' => $totalMentioned > 0 ? ($result['sentiment'] ?? '+90') : 'N/A',
                'logs' => $result['logs'] ?? [],
                'results' => $result,
                'updated_at' => now(),
            ]);

            // Auto-enrich keyword competitors if the keyword belongs to this prompt and currently has few competitors (< 5)
            if ($promptRecord->keyword_id) {
                try {
                    $kwModel = \App\Models\Keyword::find($promptRecord->keyword_id);
                    if ($kwModel) {
                        $existingComps = is_array($kwModel->competitors_json)
                            ? $kwModel->competitors_json
                            : json_decode($kwModel->competitors_json ?? '[]', true);
                        if (!is_array($existingComps) || count($existingComps) < 5) {
                            app(\App\Services\CompetitorScraperService::class)->getOrScrapeCompetitors(
                                $kwModel->id,
                                $kwModel->keyword,
                                $kwModel->company_key ?: ($project ? $project->company : 'saleswizard'),
                                true
                            );
                        }
                    }
                } catch (\Throwable $compErr) {
                    GeoLog::warning("⚠️ [ProcessPromptJob Competitor Enrichment Fout] Keyword #{$promptRecord->keyword_id}: {$compErr->getMessage()}");
                }
            }

            // Auto-recalculate overview metrics strictly from live (non-simulated) prompt results
            if ($project) {
                try {
                    $citationsCount = \App\Models\Citation::where('project_id', $project->id)->count();
                    $allPrompts = $project->prompts()->get();
                    $actualPromptsCount = $allPrompts->count();
                    $liveMeasuredPrompts = 0;
                    $liveMentionedPrompts = 0;

                    foreach ($allPrompts as $pItem) {
                        $pRes = is_array($pItem->results) ? $pItem->results : json_decode($pItem->results ?? '[]', true);
                        $lm = \App\Services\AiEngineService::extractLivePromptMetrics(is_array($pRes) ? $pRes : null);
                        if ($lm['hasLiveData']) {
                            $liveMeasuredPrompts++;
                            if ($lm['mentioned']) {
                                $liveMentionedPrompts++;
                            }
                        }
                    }

                    if ($liveMeasuredPrompts === 0 || $liveMentionedPrompts === 0) {
                        $geoScore = 0;
                        $brandShare = 0;
                    } else {
                        $mentionRate = $liveMentionedPrompts / $liveMeasuredPrompts;
                        $geoScore = min(100, max(0, (int) round($mentionRate * 85 + min(15, $citationsCount * 2))));
                        $brandShare = min(100, max(0, (int) round($mentionRate * 100)));
                    }
                    $companyKey = \App\Services\AiEngineService::cleanBrandKey($project->company);

                    \App\Models\OverviewStat::updateOrCreate(
                        ['project_id' => $project->id, 'company_key' => $companyKey],
                        [
                            'project_id' => $project->id,
                            'geo_score' => $geoScore,
                            'brand_share' => $brandShare,
                            'citations_total' => $citationsCount,
                            'sentiment_avg' => $liveMentionedPrompts > 0 ? 94 : 0,
                        ]
                    );

                    $project->update([
                        'visibility_index' => $geoScore,
                        'prompts_count' => $actualPromptsCount,
                    ]);
                } catch (\Exception $statErr) {
                    GeoLog::warning("⚠️ [ProcessPromptJob Stats Fout] Project #{$project->id}: {$statErr->getMessage()}");
                }
            }

            GeoLog::info("✅ [ProcessPromptJob] Prompt #{$this->promptId} succesvol verwerkt en opgeslagen.");
        } catch (\Exception $e) {
            GeoLog::error("❌ [ProcessPromptJob Fout] Prompt #{$this->promptId}: {$e->getMessage()}");
            $promptRecord->update([
                'status' => 'failed',
                'logs' => ["[ProcessPromptJob Error] {$e->getMessage()}"],
                'updated_at' => now(),
            ]);
        }
    }

    /**
     * Handle a job failure or timeout gracefully.
     */
    public function failed(?\Throwable $exception): void
    {
        $errorMsg = $exception ? $exception->getMessage() : 'Job timeout overschreden.';
        GeoLog::error("❌ [ProcessPromptJob Worker Failure] Prompt #{$this->promptId}: {$errorMsg}");

        try {
            $promptRecord = Prompt::find($this->promptId);
            if ($promptRecord && $promptRecord->status !== 'completed') {
                $promptRecord->update([
                    'status' => 'failed',
                    'logs' => ["[Worker Timeout/Failure] {$errorMsg}"],
                    'updated_at' => now(),
                ]);
            }
        } catch (\Exception $e) {
            Log::error("Failed to update prompt status on failure: " . $e->getMessage());
        }
    }
}
