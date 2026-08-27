<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\Http;
use Symfony\Component\DomCrawler\Crawler;

// 1. Let's test Google Search via Dutch User-Agent and parameters
function scrapeGoogleNL(string $query): array
{
    $results = [];
    try {
        $url = "https://www.google.nl/search?q=" . urlencode($query) . "&hl=nl&gl=nl&num=20";
        $res = Http::withHeaders([
            'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            'Accept' => 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language' => 'nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7',
            'Cookie' => 'SOCS=CAESHAgBEhJnd3NfMjAyNDA5MTAtMF9SQzIaAm5sIAEaBgiA_L22Bg;',
        ])->timeout(8)->get($url);

        echo "Google HTTP Status: " . $res->status() . "\n";
        if ($res->successful()) {
            $crawler = new Crawler($res->body());
            
            // Extract standard organic results
            $crawler->filter('div.g, div[data-hveid]')->each(function (Crawler $node) use (&$results) {
                $a = $node->filter('a[href^="http"]');
                $h3 = $node->filter('h3');
                if ($a->count() > 0 && $h3->count() > 0) {
                    $href = $a->first()->attr('href');
                    $title = trim($h3->first()->text());
                    if (!str_contains($href, 'google.') && !str_contains($href, '/search?')) {
                        $host = parse_url($href, PHP_URL_HOST);
                        if ($host) {
                            $dom = strtolower(str_replace('www.', '', $host));
                            $results[$dom] = [
                                'title' => $title,
                                'url' => $href,
                                'domain' => $dom
                            ];
                        }
                    }
                }
            });
        }
    } catch (\Exception $e) {
        echo "Google Error: " . $e->getMessage() . "\n";
    }
    return $results;
}

$googleResults = scrapeGoogleNL('online marketing bureau arnhem');
echo "Found via Google NL (" . count($googleResults) . "):\n";
foreach ($googleResults as $dom => $item) {
    echo "- {$dom}: {$item['title']} ({$item['url']})\n";
}
