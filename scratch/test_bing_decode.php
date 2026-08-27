<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\Http;
use Symfony\Component\DomCrawler\Crawler;

function scrapeBing(string $query): array
{
    $results = [];
    try {
        $res = Http::withHeaders([
            'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            'Accept-Language' => 'nl-NL,nl;q=0.9',
        ])->timeout(6)->get("https://www.bing.com/search?q=" . urlencode($query) . "&setlang=nl-nl&cc=nl");

        if ($res->successful()) {
            $crawler = new Crawler($res->body());
            $crawler->filter('li.b_algo')->each(function (Crawler $node) use (&$results) {
                $a = $node->filter('h2 a');
                if ($a->count() > 0) {
                    $href = $a->attr('href');
                    $title = trim($a->text());
                    $realUrl = $href;

                    if (str_contains($href, '&u=')) {
                        $uPart = explode('&u=', $href)[1];
                        $b64 = explode('&', $uPart)[0];
                        // Strip 'a1' prefix often placed by bing
                        if (str_starts_with($b64, 'a1')) {
                            $b64 = substr($b64, 2);
                        }
                        $decoded = base64_decode(strtr($b64, '-_', '+/'));
                        if ($decoded && str_starts_with($decoded, 'http')) {
                            $realUrl = $decoded;
                        }
                    }

                    $host = parse_url($realUrl, PHP_URL_HOST);
                    if ($host) {
                        $dom = strtolower(str_replace('www.', '', $host));
                        $results[$dom] = [
                            'title' => $title,
                            'url' => $realUrl,
                            'domain' => $dom
                        ];
                    }
                }
            });
        }
    } catch (\Exception $e) {
        echo "Bing Error: " . $e->getMessage() . "\n";
    }
    return $results;
}

$queries = [
    'hovenier velp',
    'hoveniersbedrijf velp',
    'hovenier regio rheden velp',
    'hovenier arnhem velp',
    'tuinaanleg velp'
];

$all = [];
foreach ($queries as $q) {
    $found = scrapeBing($q);
    foreach ($found as $dom => $item) {
        $all[$dom] = $item;
    }
}

echo "Total real Bing domains found across queries (" . count($all) . "):\n";
foreach ($all as $dom => $item) {
    echo "- {$dom}: {$item['title']} ({$item['url']})\n";
}
