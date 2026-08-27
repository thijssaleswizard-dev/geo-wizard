<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Project;
use App\Models\Keyword;
use App\Models\Prompt;
use App\Jobs\ProcessPromptJob;

echo "=== VERIFYING END-TO-END PROJECT & PROMPT SCAN PIPELINE ===\n";

// 1. Check Project
$project = Project::firstOrCreate(
    ['company' => 'vitagroen.nl'],
    [
        'monthly_searches' => 300,
        'setup_status' => 'completed'
    ]
);
echo "1. Project: #{$project->id} - {$project->company}\n";

// 2. Check Keyword
$kw = Keyword::firstOrCreate(
    [
        'project_id' => $project->id,
        'keyword' => 'hovenier velp'
    ],
    [
        'company_key' => 'vitagroen.nl',
        'monthly_searches' => 250,
        'rank' => '#1',
    ]
);
echo "2. Keyword: #{$kw->id} - {$kw->keyword}\n";

// 3. Create Prompt
$promptText = "Waar kan ik een betrouwbare hovenier in Velp vinden die mijn tuin kan aanleggen?";
$prompt = Prompt::create([
    'project_id' => $project->id,
    'keyword_id' => $kw->id,
    'prompt_text' => $promptText,
    'category' => 'Aanleg & Projecten',
    'status' => 'pending',
    'response_summary' => 'Wachtend op achtergrond scan...',
]);
echo "3. Created Prompt: #{$prompt->id} (Status: {$prompt->status})\n";

// 4. Run ProcessPromptJob synchronously to verify the entire pipeline
echo "4. Executing ProcessPromptJob for Prompt #{$prompt->id}...\n";
$job = new ProcessPromptJob($prompt->id);
$job->handle(app(\App\Services\ScraperService::class));

// 5. Inspect database result
$updatedPrompt = Prompt::find($prompt->id);
echo "\n=== FINAL DATABASE RESULT ===\n";
echo "Status: " . $updatedPrompt->status . "\n";
echo "Brand Mentioned: " . ($updatedPrompt->brand_mentioned ? 'YES (TRUE)' : 'NO (FALSE)') . "\n";
echo "Position: " . $updatedPrompt->position . "\n";
echo "Response Summary: " . $updatedPrompt->response_summary . "\n";

$res = json_decode($updatedPrompt->results, true);
echo "ChatGPT Mentioned: " . ($res['modelMentions']['chatgpt']['mentioned'] ? 'YES' : 'NO') . "\n";
echo "Gemini Mentioned: " . ($res['modelMentions']['gemini']['mentioned'] ? 'YES' : 'NO') . "\n";
echo "Total Citations: " . count($res['citations'] ?? []) . "\n";
