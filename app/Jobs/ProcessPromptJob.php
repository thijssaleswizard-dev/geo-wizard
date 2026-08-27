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
            $totalModels = $result['totalModels'] ?? 1;

            $chatgptMention = $result['modelMentions']['chatgpt'] ?? null;
            $geminiMention = $result['modelMentions']['gemini'] ?? null;

            $promptRecord->update([
                'status' => 'completed',
                'brand_mentioned' => $totalMentioned > 0,
                'position' => $chatgptMention['position'] ?? ($geminiMention['position'] ?? 1),
                'response_summary' => "{$companyName} wordt door {$totalMentioned} van de {$totalModels} AI-modellen aanbevolen.",
                'sentiment' => $chatgptMention['sentiment'] ?? '+90',
                'logs' => $result['logs'] ?? [],
                'results' => $result,
                'updated_at' => now(),
            ]);

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
}
