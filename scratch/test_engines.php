<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\Http;
use Symfony\Component\DomCrawler\Crawler;

echo "=== TESTING BING NL ===\n";
try {
    $res = Http::withHeaders([
        'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept-Language' => 'nl-NL,nl;q=0.9',
    ])->timeout(6)->get("https://www.bing.com/search?q=" . urlencode("hovenier velp") . "&setlang=nl-nl&cc=nl");

    if ($res->successful()) {
        $crawler = new Crawler($res->body());
        $crawler->filter('li.b_algo h2 a')->each(function (Crawler $a) {
            echo "Bing: " . $a->attr('href') . " -> " . trim($a->text()) . "\n";
        });
    }
} catch (\Exception $e) {
    echo "Bing err: " . $e->getMessage() . "\n";
}

echo "\n=== TESTING DDG LITE ===\n";
try {
    $res2 = Http::withHeaders([
        'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept-Language' => 'nl-NL,nl;q=0.9',
    ])->asForm()->timeout(6)->post("https://lite.duckduckgo.com/lite/", [
        'q' => 'hovenier velp',
        'kl' => 'nl-nl'
    ]);

    if ($res2->successful()) {
        $crawler2 = new Crawler($res2->body());
        $crawler2->filter('a.result-link')->each(function (Crawler $a) {
            echo "DDG Lite: " . $a->attr('href') . " -> " . trim($a->text()) . "\n";
        });
    }
} catch (\Exception $e) {
    echo "DDG Lite err: " . $e->getMessage() . "\n";
}
