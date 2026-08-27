<?php
require __DIR__ . '/../vendor/autoload.php';
use Illuminate\Support\Facades\Http;
use Symfony\Component\DomCrawler\Crawler;

$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$queries = [
    'hovenier velp',
    'hoveniersbedrijf velp',
    'hovenier regio velp rheden',
    'hovenier arnhem velp',
    'hovenier in velp',
    'tuinonderhoud velp'
];

$allDomains = [];

foreach ($queries as $q) {
    // 1. Yahoo
    try {
        $res = Http::withHeaders([
            'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            'Accept-Language' => 'nl-NL,nl;q=0.9',
        ])->timeout(6)->get("https://nl.search.yahoo.com/search?p=" . urlencode($q));

        if ($res->successful()) {
            $crawler = new Crawler($res->body());
            $crawler->filter('h3.title a')->each(function (Crawler $a) use (&$allDomains) {
                $href = $a->attr('href');
                $title = trim($a->text());
                $realUrl = $href;
                if (str_contains($href, '/RU=')) {
                    $part = explode('/RU=', $href)[1];
                    $realUrl = urldecode(explode('/RK=', $part)[0]);
                }
                $host = parse_url($realUrl, PHP_URL_HOST);
                if ($host) {
                    $dom = strtolower(str_replace('www.', '', $host));
                    $allDomains[$dom] = ($allDomains[$dom] ?? 0) + 1;
                }
            });
        }
    } catch (\Exception $e) {}

    // 2. DuckDuckGo
    try {
        $res2 = Http::withHeaders([
            'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            'Accept-Language' => 'nl-NL,nl;q=0.9',
        ])->asForm()->timeout(6)->post("https://html.duckduckgo.com/html/", ['q' => $q]);

        if ($res2->successful()) {
            $crawler2 = new Crawler($res2->body());
            $crawler2->filter('a.result__url, a.result__title')->each(function (Crawler $a) use (&$allDomains) {
                $href = $a->attr('href');
                if (str_contains($href, 'uddg=')) {
                    $parts = explode('uddg=', $href);
                    $realUrl = urldecode(explode('&', $parts[1])[0]);
                } else {
                    $realUrl = $href;
                }
                $host = parse_url($realUrl, PHP_URL_HOST);
                if ($host) {
                    $dom = strtolower(str_replace('www.', '', $host));
                    $allDomains[$dom] = ($allDomains[$dom] ?? 0) + 1;
                }
            });
        }
    } catch (\Exception $e) {}
}

arsort($allDomains);
echo "Found unique domains (" . count($allDomains) . "):\n";
foreach ($allDomains as $dom => $count) {
    echo "- {$dom}: {$count} hits\n";
}
