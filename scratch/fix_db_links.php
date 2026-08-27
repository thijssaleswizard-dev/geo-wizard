<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Citation;
use App\Models\Keyword;
use App\Models\Project;
use App\Models\Prompt;

echo "=== FIXING DB FOREIGN KEYS & PROJECT_ID LINKS ===\n";

$projects = Project::all();
foreach ($projects as $p) {
    $companyKey = strtolower(trim(str_replace('.nl', '', $p->company)));
    $cleanKey = strtolower(preg_replace('/[^a-z0-9]/', '', $companyKey));

    // Link keywords
    $kwUpdated = Keyword::whereNull('project_id')
        ->where(function($q) use ($companyKey, $cleanKey, $p) {
            $q->where('company_key', $companyKey)
              ->orWhere('company_key', $cleanKey)
              ->orWhere('company_key', strtolower($p->company));
        })
        ->update(['project_id' => $p->id]);
    echo "Project #{$p->id} ({$p->company}): linked {$kwUpdated} keywords\n";

    // Link prompts
    $prUpdated = Prompt::whereNull('project_id')
        ->where(function($q) use ($companyKey, $cleanKey, $p) {
            $q->where('company_key', $companyKey)
              ->orWhere('company_key', $cleanKey)
              ->orWhere('company_key', strtolower($p->company));
        })
        ->update(['project_id' => $p->id]);
    echo "Project #{$p->id} ({$p->company}): linked {$prUpdated} prompts\n";

    // Link citations
    $citUpdated = Citation::whereNull('project_id')
        ->where(function($q) use ($companyKey, $cleanKey, $p) {
            $q->where('company_key', $companyKey)
              ->orWhere('company_key', $cleanKey)
              ->orWhere('company_key', strtolower($p->company));
        })
        ->update(['project_id' => $p->id]);
    echo "Project #{$p->id} ({$p->company}): linked {$citUpdated} citations\n";
}

echo "\n--- Verification ---\n";
echo "Keywords with null project_id: " . Keyword::whereNull('project_id')->count() . "\n";
echo "Prompts with null project_id: " . Prompt::whereNull('project_id')->count() . "\n";
echo "Citations with null project_id: " . Citation::whereNull('project_id')->count() . "\n";
