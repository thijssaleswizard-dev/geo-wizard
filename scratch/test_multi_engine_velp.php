<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

function multiEngineExpandedLiveCrawl(string $keyword): array
{
    $queries = [
        $keyword,
        "{$keyword} site:nl",
        "beste {$keyword}",
        "hovenier velp rheden rozendaal",
        "hoveniersbedrijf velp",
        "tuinman velp",
        "tuinaanleg velp",
        "tuinonderhoud velp",
        "hovenier arnhem",
        "tuinontwerp velp"
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
        // 1. Yahoo NL Page 1 & Page 2
        foreach ([1, 11] as $b) {
            try {
                $res = Illuminate\Support\Facades\Http::withHeaders([
                    'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                    'Accept-Language' => 'nl-NL,nl;q=0.9',
                ])->timeout(5)->get("https://nl.search.yahoo.com/search?p=" . urlencode($q) . "&b={$b}");

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

        // 2. Bing NL
        try {
            $res = Illuminate\Support\Facades\Http::withHeaders([
                'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                'Accept-Language' => 'nl-NL,nl;q=0.9',
            ])->timeout(5)->get("https://www.bing.com/search?q=" . urlencode($q) . "&count=30&setlang=nl-nl&cc=NL");

            if ($res->successful()) {
                $crawler = new Symfony\Component\DomCrawler\Crawler($res->body());
                $crawler->filter('li.b_algo')->each(function ($node) use (&$found, $hardcoreSpam) {
                    $h2 = $node->filter('h2');
                    $cite = $node->filter('cite');
                    if ($h2->count() > 0 && $cite->count() > 0) {
                        $title = trim($h2->text());
                        $citeText = trim($cite->text());
                        if (preg_match('/(?:https?:\/\/)?([a-zA-Z0-9\.\-_]+\.[a-zA-Z]{2,6})/i', $citeText, $m)) {
                            $dom = strtolower(str_replace('www.', '', $m[1]));
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
                                        'url' => (str_starts_with($citeText, 'http') ? $citeText : "https://{$dom}/"),
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

echo "=== MULTI-ENGINE EXPANDED LIVE SEARCH FOR 'hovenier velp' ===\n";
$results = multiEngineExpandedLiveCrawl("hovenier velp");
echo "Total unique live entities found: " . count($results) . "\n\n";

foreach ($results as $dom => $data) {
    echo "• " . str_pad($dom, 35) . " (Hits: {$data['hits']}) -> {$data['url']}\n";
}
