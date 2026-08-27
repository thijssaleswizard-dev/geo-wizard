<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\Http;

$res = Http::withHeaders([
    'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Accept-Language' => 'nl-NL,nl;q=0.9',
])->get("https://html.duckduckgo.com/html/?q=" . urlencode("online marketing bureau arnhem"));

echo "Status: " . $res->status() . "\n";
echo substr($res->body(), 0, 1500) . "\n";
