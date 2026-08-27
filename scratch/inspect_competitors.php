<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Keyword;

$kws = Keyword::all();
foreach ($kws as $k) {
    echo "ID #{$k->id} | Project ID: #{$k->project_id} | Keyword: '{$k->keyword}'\n";
    $comps = is_array($k->competitors_json) ? $k->competitors_json : json_decode($k->competitors_json, true);
    echo "Competitors count: " . (is_array($comps) ? count($comps) : 0) . "\n";
    if (is_array($comps)) {
        foreach ($comps as $c) {
            echo "  - {$c['rank']}: {$c['brand']} ({$c['domain']}) | hits: " . ($c['hits'] ?? '?') . " | sov: " . ($c['sov'] ?? '?') . "%\n";
        }
    }
    echo "----------------------------------------\n";
}
