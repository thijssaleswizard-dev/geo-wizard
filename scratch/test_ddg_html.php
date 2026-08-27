<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\Http;
use Symfony\Component\DomCrawler\Crawler;

$res = Http::withHeaders([
    'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Accept-Language' => 'nl-NL,nl;q=0.9',
])->get("https://html.duckduckgo.com/html/?q=" . urlencode("online marketing bureau arnhem"));

if ($res->successful()) {
    $crawler = new Crawler($res->body());
    $crawler->filter('a.result__a, h2 a')->each(function (Crawler $a) {
        $href = $a->attr('href');
        $title = trim($a->text());
        if (str_contains($href, 'uddg=')) {
            $part = explode('uddg=', $href)[1];
            $realUrl = urldecode(explode('&', $part)[0]);
        } else {
            $realUrl = $href;
        }
        $host = parse_url($realUrl, PHP_URL_HOST);
        if ($host) {
            $dom = strtolower(str_replace('www.', '', $host));
            echo "DDG Found: {$dom} | Title: {$title} | URL: {$realUrl}\n";
        }
    });
}
