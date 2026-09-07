<?php

namespace App\Jobs;

use App\Models\Keyword;
use App\Services\CompetitorScraperService;
use App\Services\GeoLog;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;

class ProcessKeywordCompetitorsJob implements ShouldQueue
{
    use Queueable;

    public int $keywordId;
    public string $keywordText;
    public string $companyKey;

    /**
     * The number of seconds the job can run before timing out.
     */
    public int $timeout = 180;

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
    public function __construct(int $keywordId, string $keywordText, string $companyKey)
    {
        $this->keywordId = $keywordId;
        $this->keywordText = $keywordText;
        $this->companyKey = $companyKey;
    }

    /**
     * Execute the job in the background.
     */
    public function handle(CompetitorScraperService $scraperService): void
    {
        GeoLog::box("COMPETITOR SCRAPER JOB GESTART", [
            "Keyword ID: #{$this->keywordId}",
            "Zoekwoord: \"{$this->keywordText}\"",
            "Bedrijf: {$this->companyKey}",
            "Methode: Live Dutch SERP Search",
        ]);

        try {
            $competitors = $scraperService->getOrScrapeCompetitors($this->keywordId, $this->keywordText, $this->companyKey);
            $count = count($competitors);
            GeoLog::info("✅ [ProcessKeywordCompetitorsJob] {$count} concurrenten gevonden en opgeslagen voor Keyword #{$this->keywordId} (\"{$this->keywordText}\").");
        } catch (\Exception $e) {
            GeoLog::error("❌ [ProcessKeywordCompetitorsJob Fout] Keyword #{$this->keywordId}: {$e->getMessage()}");
        }
    }

    /**
     * Handle a job failure.
     */
    public function failed(?\Throwable $exception): void
    {
        $errorMsg = $exception ? $exception->getMessage() : 'Job timeout overschreden.';
        GeoLog::error("❌ [ProcessKeywordCompetitorsJob Failure] Keyword #{$this->keywordId}: {$errorMsg}");
    }
}
