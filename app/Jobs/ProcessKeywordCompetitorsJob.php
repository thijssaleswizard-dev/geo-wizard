<?php

namespace App\Jobs;

use App\Models\Keyword;
use App\Services\CompetitorScraperService;
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
        Log::info("[ProcessKeywordCompetitorsJob] Scraping competitors for keyword #{$this->keywordId} \"{$this->keywordText}\" in the background...");
        try {
            $scraperService->getOrScrapeCompetitors($this->keywordId, $this->keywordText, $this->companyKey);
            Log::info("[ProcessKeywordCompetitorsJob] Successfully saved competitors for keyword #{$this->keywordId}");
        } catch (\Exception $e) {
            Log::error("[ProcessKeywordCompetitorsJob Error] Keyword #{$this->keywordId}: {$e->getMessage()}");
        }
    }
}
