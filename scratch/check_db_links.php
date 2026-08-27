<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Prompt;
use App\Models\Keyword;
use App\Models\Citation;
use App\Models\Project;

echo "Total Projects: " . Project::count() . "\n";
echo "Total Prompts: " . Prompt::count() . " (Null project_id: " . Prompt::whereNull('project_id')->count() . ")\n";
echo "Total Keywords: " . Keyword::count() . " (Null project_id: " . Keyword::whereNull('project_id')->count() . ")\n";
echo "Total Citations: " . Citation::count() . " (Null project_id: " . Citation::whereNull('project_id')->count() . ")\n";

// Show prompts summary
$prompts = Prompt::with('project')->get();
foreach ($prompts as $p) {
    $comp = $p->project ? $p->project->company : 'N/A';
    echo "Prompt #{$p->id} | Project ID: #{$p->project_id} ({$comp}) | KW ID: {$p->keyword_id} | \"{$p->prompt_text}\"\n";
}
