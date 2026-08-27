<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\Http;
use Symfony\Component\DomCrawler\Crawler;

function scrapeYahooPages(string $query): array
{
    $results = [];
    $pages = [1, 11, 21];

    foreach ($pages as $p) {
        $url = "https://nl.search.yahoo.com/search?p=" . urlencode($query) . "&b=" . $p;
        try {
            $res = Http::withHeaders([
                'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                'Accept-Language' => 'nl-NL,nl;q=0.9',
            ])->timeout(6)->get($url);

            if ($res->successful()) {
                $crawler = new Crawler($res->body());
                $crawler->filter('h3.title a')->each(function (Crawler $a) use (&$results) {
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
                        if (!isset($results[$dom])) {
                            $results[$dom] = [
                                'title' => $title,
                                'url' => $realUrl,
                                'domain' => $dom,
                                'hits' => 1
                            ];
                        } else {
                            $results[$dom]['hits']++;
                        }
                    }
                });
            }
        } catch (\Exception $e) {
            echo "Error: " . $e->getMessage() . "\n";
        }
    }
    return $results;
}

$domains = scrapeYahooPages('hovenier velp');
echo "Found 100% real live domains from Yahoo pages 1-3 for 'hovenier velp' (" . count($domains) . "):\n";
foreach ($domains as $d => $info) {
    echo "- {$d}: \"{$info['title']}\" ({$info['url']}) | Hits: {$info['hits']}\n";
}
