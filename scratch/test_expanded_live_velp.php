<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

function testExpandedLiveCrawl(string $keyword): array
{
    // Generate expanded natural search queries covering the keyword, region & variations
    $queries = [
        $keyword,
        "{$keyword} site:nl",
        "beste {$keyword}",
        "hoveniersbedrijf " . str_replace('hovenier', '', $keyword),
        "tuinman " . str_replace('hovenier', '', $keyword),
        "{$keyword} rheden rozendaal arnhem",
        "tuinaanleg " . str_replace('hovenier', '', $keyword),
        "tuinonderhoud " . str_replace('hovenier', '', $keyword)
    ];

    $hardcoreSpam = [
        'yahoo.', 'bing.', 'google.', 'facebook.', 'linkedin.', 'instagram.', 'youtube.',
        'wikipedia.', 'thuisbezorgd.', 'telefoongids.nl', 'reddit.com', 'apple.com',
        'duckduckgo.', 'wiktionary.', 'encyclo.', 'onzetaal.', 'top40.', 'radionl.', 'zara.', 'cbr.nl',
        'gelderlander.nl', 'omroepgelderland.nl', 'bol.com', 'coolblue.', 'amazon.',
        'ikea.', 'beslist.', '000.nl', '.ac.uk', '.edu', '.gob.', '.gov.', '.ph', '.ar',
        'geld.nl', 'webwoordenboek.nl', 'beste.in', 'openingstijden.nl', 'cylex.',
        'woundedpawproject.', 'adoptapet.', 'petful.', 'petfinder.', 'datesandtimes.', 'timeanddate.',
        '24timezones.', 'time.is', 'outlook.', 'live.com', 'office.com', 'images.search.yahoo', 'nl.images'
    ];

    $found = [];

    foreach ($queries as $q) {
        // Query Yahoo NL
        try {
            $res = Illuminate\Support\Facades\Http::withHeaders([
                'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                'Accept-Language' => 'nl-NL,nl;q=0.9',
            ])->timeout(6)->get("https://nl.search.yahoo.com/search?p=" . urlencode($q) . "&b=1");

            if ($res->successful()) {
                $crawler = new Symfony\Component\DomCrawler\Crawler($res->body());
                $crawler->filter('h3.title')->each(function ($node) use (&$found, $hardcoreSpam) {
                    $a = $node->filter('a');
                    if ($a->count() > 0) {
                        $title = trim($a->text());
                        $href = $a->attr('href');
                        
                        $realUrl = $href;
                        if (str_contains($href, '/RU=')) {
                            $part = explode('/RU=', $href)[1];
                            $realUrl = urldecode(explode('/RK=', $part)[0]);
                        }

                        $host = parse_url($realUrl, PHP_URL_HOST);
                        if ($host) {
                            $dom = strtolower(str_replace('www.', '', $host));
                            $isSpam = false;
                            foreach ($hardcoreSpam as $hs) {
                                if (str_contains($dom, $hs)) {
                                    $isSpam = true;
                                    break;
                                }
                            }

                            if ($dom && !$isSpam && str_contains($dom, '.')) {
                                if (!isset($found[$dom])) {
                                    $found[$dom] = [
                                        'domain' => $dom,
                                        'url' => $realUrl,
                                        'title' => $title,
                                        'hits' => 1
                                    ];
                                } else {
                                    $found[$dom]['hits']++;
                                }
                            }
                        }
                    }
                });
            }
        } catch (\Exception $e) {}
    }

    return $found;
}

echo "=== EXPANDED LIVE SEARCH FOR 'hovenier velp' ===\n";
$results = testExpandedLiveCrawl("hovenier velp");
echo "Total unique live entities found: " . count($results) . "\n\n";

foreach ($results as $dom => $data) {
    echo "• " . str_pad($dom, 35) . " (Hits: {$data['hits']}) -> {$data['url']}\n";
}
