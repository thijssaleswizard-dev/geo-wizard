<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\Http;
use Symfony\Component\DomCrawler\Crawler;

function testScrape(string $q) {
    echo "--- Search: '{$q}' ---\n";
    $res = Http::withHeaders([
        'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept-Language' => 'nl-NL,nl;q=0.9',
    ])->get("https://www.bing.com/search?q=" . urlencode($q) . "&setlang=nl-nl&cc=nl");

    if ($res->successful()) {
        $crawler = new Crawler($res->body());
        $crawler->filter('li.b_algo')->each(function (Crawler $node) {
            $a = $node->filter('h2 a');
            if ($a->count() > 0) {
                $href = $a->attr('href');
                $title = trim($a->text());
                $realUrl = $href;
                if (str_contains($href, '&u=')) {
                    $uPart = explode('&u=', $href)[1];
                    $b64 = explode('&', $uPart)[0];
                    if (str_starts_with($b64, 'a1')) $b64 = substr($b64, 2);
                    $decoded = base64_decode(strtr($b64, '-_', '+/'));
                    if ($decoded && str_starts_with($decoded, 'http')) $realUrl = $decoded;
                }
                echo "  - {$title} -> {$realUrl}\n";
            }
        });
    }
}

testScrape("hovenier velp");
testScrape("hovenier in velp");
testScrape("hoveniersbedrijf velp");
testScrape("fred buurman velp");
