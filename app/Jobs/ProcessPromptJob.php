<?php

namespace App\Jobs;

use App\Models\Prompt;
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
            return;
        }

        $promptRecord->update([
            'status' => 'processing',
            'updated_at' => now(),
        ]);

        try {
            $result = $scraperService->runScraper($promptRecord->prompt_text, $promptRecord->company_key);

            $totalMentioned = $result['totalMentions'] ?? 0;
            $totalModels = $result['totalModels'] ?? 1;

            $chatgptMention = $result['modelMentions']['chatgpt'] ?? null;
            $geminiMention = $result['modelMentions']['gemini'] ?? null;

            $promptRecord->update([
                'status' => 'completed',
                'brand_mentioned' => $totalMentioned > 0,
                'position' => $chatgptMention['position'] ?? ($geminiMention['position'] ?? 1),
                'response_summary' => "{$promptRecord->company_key} wordt door {$totalMentioned} van de {$totalModels} AI-modellen aanbevolen.",
                'sentiment' => $chatgptMention['sentiment'] ?? '+90',
                'logs' => $result['logs'] ?? [],
                'results' => $result,
                'updated_at' => now(),
            ]);

            Log::info("[ProcessPromptJob] Successfully processed prompt #{$this->promptId}");
        } catch (\Exception $e) {
            Log::error("[ProcessPromptJob Error] Prompt #{$this->promptId}: {$e->getMessage()}");
            $promptRecord->update([
                'status' => 'failed',
                'logs' => ["[ProcessPromptJob Error] {$e->getMessage()}"],
                'updated_at' => now(),
            ]);
        }
    }
}
