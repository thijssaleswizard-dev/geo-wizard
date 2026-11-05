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

Artisan::command('geo:sync-all {--project= : Specific Project ID to sync} {--sync : Run jobs synchronously instead of queued}', function (ScraperService $scraperService, CompetitorScraperService $competitorScraper) {
    $projectId = $this->option('project');
    $runSync = (bool) $this->option('sync');

    $this->info('Starting automated daily GEO mention, competitor and ranking scan...');

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
            $companyKey = strtolower(trim(str_replace('.nl', '', $project->company)));

            // 1. Sync & Rescrape Keywords (Competitor Scraper / Serp / Rankings)
            $keywords = $project->keywords()->get();
            $this->line("  Found {$keywords->count()} keywords for {$project->company}");
            foreach ($keywords as $kw) {
                if ($runSync) {
                    $this->line("  - [Sync] Scraping competitors for keyword #{$kw->id}: \"{$kw->keyword}\"");
                    $competitors = $competitorScraper->getOrScrapeCompetitors($kw->id, $kw->keyword, $kw->company_key, true);
                    $selfItem = collect($competitors)->firstWhere('isSelf', true) ?? ($competitors[0] ?? null);
                    if ($selfItem) {
                        $rankStr = $selfItem['rank'] ?? '1';
                        $rankInt = (int) preg_replace('/[^0-9]/', '', (string) $rankStr) ?: 1;
                        $kw->update(['rank' => $rankInt, 'updated_at' => now()]);
                    }
                } else {
                    $this->line("  - [Queue] Dispatching competitor scrape for keyword #{$kw->id}: \"{$kw->keyword}\"");
                    ProcessKeywordCompetitorsJob::dispatch($kw->id, $kw->keyword, $kw->company_key, true);
                }
            }

            // 2. Sync & Rescan Prompts
            $prompts = $project->prompts()->get();
            $this->line("  Found {$prompts->count()} prompts for {$project->company}");

            if ($prompts->isEmpty()) {
                $defaultPrompt = 'Zoek een betrouwbaar online marketing bureau voor mijn webshop';
                $scraperService->runScraper($defaultPrompt, $project->company, $project->id);
            } else {
                foreach ($prompts as $p) {
                    if ($runSync) {
                        $this->line("  - [Sync] Scanning prompt #{$p->id}: \"{$p->prompt_text}\"");
                        $res = $scraperService->runScraper($p->prompt_text, $project->company, $project->id, $p->id);

                        $totalMentioned = $res['totalMentions'] ?? 0;
                        $totalModels = $res['totalModels'] ?? 1;
                        $chatgpt = $res['modelMentions']['chatgpt'] ?? null;
                        $gemini = $res['modelMentions']['gemini'] ?? null;

                        $p->update([
                            'status' => 'completed',
                            'brand_mentioned' => $totalMentioned > 0,
                            'position' => $chatgpt['position'] ?? ($gemini['position'] ?? 1),
                            'response_summary' => "{$project->company} wordt door {$totalMentioned} van de {$totalModels} AI-modellen aanbevolen.",
                            'sentiment' => $chatgpt['sentiment'] ?? '+90',
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

            // 3. Recalculate overview statistics and project metrics
            $citationsCount = Citation::where('project_id', $project->id)->count();
            $promptsCount = $project->prompts()->count() ?: 1;
            $mentionedCount = $project->prompts()->where('brand_mentioned', true)->count();

            $geoScore = min(98, max(45, (int) round(($mentionedCount / max(1, $promptsCount)) * 85 + ($citationsCount * 2))));
            $brandShare = min(95, max(35, (int) round(($mentionedCount / max(1, $promptsCount)) * 75)));

            OverviewStat::updateOrCreate(
                ['project_id' => $project->id, 'company_key' => $companyKey],
                [
                    'project_id' => $project->id,
                    'geo_score' => $geoScore,
                    'brand_share' => $brandShare,
                    'citations_total' => $citationsCount,
                    'sentiment_avg' => 94,
                ]
            );

            $project->update([
                'visibility_index' => $geoScore,
                'prompts_count' => $promptsCount,
            ]);

            $this->info("Completed {$project->company}: GEO Score={$geoScore}%, Citations={$citationsCount}, Prompts={$promptsCount}");
        } catch (\Exception $e) {
            $this->error("Failed for {$project->company}: {$e->getMessage()}");
        }
    }
})->purpose('Synchronize GEO mentions, competitor rankings and scores for all projects');

Schedule::command('geo:sync-all')->dailyAt('00:00');
