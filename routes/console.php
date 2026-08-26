<?php

use App\Models\Project;
use App\Services\ScraperService;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('geo:sync-all', function (ScraperService $scraperService) {
    $this->info('Starting automated daily GEO mention and ranking scan...');
    $projects = Project::all();
    foreach ($projects as $project) {
        $this->line("Syncing {$project->company}...");
        try {
            $companyKey = strtolower(trim(str_replace('.nl', '', $project->company)));
            $prompts = \App\Models\Prompt::where('company_key', $companyKey)->get();
            foreach ($prompts as $p) {
                $scraperService->runScraper($p->prompt_text, $project->company);
            }
            $this->info("Completed {$project->company}");
        } catch (\Exception $e) {
            $this->error("Failed for {$project->company}: {$e->getMessage()}");
        }
    }
})->purpose('Synchronize GEO mentions and scores for all projects');

Schedule::command('geo:sync-all')->dailyAt('00:00');

