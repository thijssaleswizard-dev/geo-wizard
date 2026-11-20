<?php

use App\Jobs\ProcessKeywordCompetitorsJob;
use App\Jobs\ProcessPromptJob;
use App\Models\Citation;
use App\Models\OverviewStat;
use App\Models\Project;
use App\Models\Prompt;
use App\Services\CompetitorScraperService;
use App\Services\ScraperService;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('geo:sync-all {--project= : Specific Project ID to sync} {--sync : Run jobs synchronously instead of queued} {--force : Force full AI re-scan even when rankings have not changed}', function (ScraperService $scraperService, CompetitorScraperService $competitorScraper) {
    $projectId = $this->option('project');
    $runSync = (bool) $this->option('sync');
    $forceFull = (bool) $this->option('force') || (config('geo.scan_mode', 'adaptive') === 'daily');

    $this->info('Starting automated daily GEO scan (' . ($forceFull ? 'FULL mode' : 'SMART CHANGE-DETECTION mode') . ')...');

    $query = Project::query();
    if ($projectId) {
        $query->where('id', $projectId);
    }
    $projects = $query->get();

    if ($projects->isEmpty()) {
        $this->info('No projects found to sync.');
        return;
    }

    foreach ($projects as $project) {
        $this->line("Syncing project #{$project->id} ({$project->company})...");
        try {
            $companyKey = \App\Services\AiEngineService::cleanBrandKey($project->company);

            // 1. Check each Keyword via lightweight SERP Canary check
            $keywords = $project->keywords()->with('prompts')->get();
            $this->line("  Found {$keywords->count()} keywords for {$project->company}");

            foreach ($keywords as $kw) {
                $needsFullScan = $forceFull || $competitorScraper->hasSignificantSerpChange($kw);

                if (!$needsFullScan) {
                    $this->line("  - [Cached €0.00] No ranking shift for keyword #{$kw->id} (\"{$kw->keyword}\") -> carrying forward daily snapshot");
                    $competitorScraper->recordDailySnapshotFromCache($kw);
                    continue;
                }

                if ($runSync) {
                    $this->line("  - [Sync] Scraping competitors for keyword #{$kw->id}: \"{$kw->keyword}\"");
                    $competitors = $competitorScraper->getOrScrapeCompetitors($kw->id, $kw->keyword, $kw->company_key, true);
                    $selfItem = collect($competitors)->firstWhere('isSelf', true) ?? ($competitors[0] ?? null);
                    if ($selfItem) {
                        $rankStr = $selfItem['rank'] ?? '-';
                        $rankDigits = preg_replace('/[^0-9]/', '', (string) $rankStr);
                        $rankInt = $rankDigits !== '' ? (int) $rankDigits : null;
                        $kw->update(['rank' => $rankInt, 'updated_at' => now()]);
                    }
                } else {
                    $this->line("  - [Queue] Change detected -> dispatching competitor scrape for keyword #{$kw->id}: \"{$kw->keyword}\"");
                    ProcessKeywordCompetitorsJob::dispatch($kw->id, $kw->keyword, $kw->company_key, true);
                }

                // Only rescan prompts belonging to keywords where a change was detected (or when forced)
                foreach ($kw->prompts as $p) {
                    if ($runSync) {
                        $this->line("  - [Sync] Scanning prompt #{$p->id}: \"{$p->prompt_text}\"");
                        $res = $scraperService->runScraper($p->prompt_text, $project->company, $project->id, $p->id);

                        $totalMentioned = $res['totalMentions'] ?? 0;
                        $totalModels = $res['totalLiveModels'] ?? $res['totalModels'] ?? 0;
                        $failedModelsCount = $res['failedModelsCount'] ?? 0;

                        $p->update([
                            'status' => $totalModels > 0 ? 'completed' : 'failed',
                            'brand_mentioned' => $totalMentioned > 0,
                            'position' => $totalMentioned > 0 ? ($res['position'] ?? null) : null,
                            'response_summary' => $totalModels > 0
                                ? "{$project->company} wordt door {$totalMentioned} van de {$totalModels} live AI-modellen aanbevolen." . ($failedModelsCount > 0 ? " ({$failedModelsCount} niet gemeten)" : "")
                                : "Geen live AI-modellen beschikbaar tijdens deze scan.",
                            'sentiment' => $totalMentioned > 0 ? ($res['sentiment'] ?? '+90') : 'N/A',
                            'logs' => $res['logs'] ?? [],
                            'results' => $res,
                            'updated_at' => now(),
                        ]);
                    } else {
                        $this->line("  - [Queue] Dispatching scan for prompt #{$p->id}: \"{$p->prompt_text}\"");
                        $p->update([
                            'status' => 'pending',
                            'updated_at' => now(),
                        ]);
                        ProcessPromptJob::dispatch($p->id);
                    }
                }
            }

            // 2. Recalculate overview statistics and project metrics strictly from LIVE (non-simulated) mentions
            $citationsCount = Citation::where('project_id', $project->id)->count();
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

            OverviewStat::updateOrCreate(
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

            $this->info("Completed {$project->company}: GEO Score={$geoScore}%, Citations={$citationsCount}, Prompts={$actualPromptsCount}");
        } catch (\Exception $e) {
            $this->error("Failed for {$project->company}: {$e->getMessage()}");
        }
    }
})->purpose('Synchronize GEO mentions, competitor rankings and scores for all projects');

Schedule::command('geo:sync-all')->dailyAt('00:00');
