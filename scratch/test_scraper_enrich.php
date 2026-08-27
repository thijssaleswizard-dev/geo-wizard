<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Services\CompetitorScraperService;
use App\Services\AiEngineService;
use Illuminate\Support\Facades\Http;
use Symfony\Component\DomCrawler\Crawler;

function scrapeDuckDuckGo(string $query, string $cleanCompany): array
{
    $found = [];
    try {
        $res = Http::withHeaders([
            'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            'Accept-Language' => 'nl-NL,nl;q=0.9',
        ])->asForm()->timeout(6)->post("https://html.duckduckgo.com/html/", ['q' => $query]);

        if ($res->successful()) {
            $crawler = new Crawler($res->body());
            $crawler->filter('div.result__body')->each(function (Crawler $node) use (&$found, $cleanCompany) {
                $a = $node->filter('a.result__url, a.result__title');
                if ($a->count() > 0) {
                    $href = $a->attr('href');
                    $title = trim($node->filter('a.result__title')->text() ?: '');
                    if (str_contains($href, 'uddg=')) {
                        $parts = explode('uddg=', $href);
                        $realUrl = urldecode(explode('&', $parts[1])[0]);
                    } else {
                        $realUrl = $href;
                    }
                    $host = parse_url($realUrl, PHP_URL_HOST);
                    if ($host) {
                        $dom = strtolower(str_replace('www.', '', $host));
                        if ($dom) {
                            $found[$dom] = [
                                'brand' => ucwords(str_replace(['-', '_'], ' ', explode('.', $dom)[0])),
                                'domain' => $dom,
                                'isSelf' => str_contains($dom, $cleanCompany),
                                'sov' => 0,
                                'position' => '3.0',
                                'citations' => 1,
                                'citationUrls' => [$realUrl],
                                'hits' => 2,
                            ];
                        }
                    }
                }
            });
        }
    } catch (\Exception $e) {}
    return $found;
}

$ddgResults = scrapeDuckDuckGo('hoveniersbedrijf regio velp arnhem', 'vitagroen');
echo "DuckDuckGo results: " . count($ddgResults) . "\n";
foreach ($ddgResults as $dom => $item) {
    echo "- {$dom} ({$item['brand']})\n";
}
