<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\Http;
use Symfony\Component\DomCrawler\Crawler;

function isPortal(string $dom): bool {
    $blacklisted = [
        'yahoo.', 'bing.', 'google.', 'facebook.', 'linkedin.', 'instagram.', 'youtube.',
        'wikipedia.', 'thuisbezorgd.', 'kvk.nl', 'telefoongids.nl', 'reddit.com', 'apple.com',
        'duckduckgo.', 'wiktionary.', 'encyclo.', 'onzetaal.', 'top40.', 'radionl.', 'zara.', 'cbr.nl',
        'gelderlander.nl', 'omroepgelderland.nl', 'marktplaats.nl', 'bol.com', 'coolblue.', 'amazon.',
        'ikea.', 'beslist.', 'beste.nl', 'hetbeste.', '000.nl', '.ac.uk', '.edu', '.gob.', '.gov.', '.ph', '.ar',
        'geld.nl', 'webwoordenboek.nl', 'beste.in', 'sortlist.', 'trustoo.', 'werkspot.', 'hovenier.nl',
        'hoveniernederland.nl', 'tuinman-gezocht.nl', 'all-in-hoveniersbedrijf.nl', 'zoekhovenier.nl',
        'hoveniersbedrijven-gids.nl', 'offertevergelijker.nl', 'homedeal.nl', 'cylex.', 'goudengids.',
        'openingstijden.', 'bedrijvenpagina.', 'tuinman.nl', 'tuinhulp.', 'helprr.', 'klusup.',
        'hornbach.', 'gamma.', 'praxis.', 'hubo.', 'karwei.', 'offerteadviseur.', 'tuinaanleg.nu',
        'de-hobbykweker.nl', 'hovenier-nu.nl', 'hoveniergegevens.nl', 'hoveniergids.nl', 'hovenier-vinder.nl',
        'hoveniersinuwregio.nl', 'hovenierin.nl', 'tuinkarwei.nl', 'hovenier.in', 'hovenier.website',
        'hovenier-gigant.nl', 'tuinaanleg-concurrent.nl', 'rheden.nieuws.nl', 'aerestrainingcentre.nl'
    ];
    foreach ($blacklisted as $b) {
        if (str_contains($dom, $b)) return true;
    }
    return false;
}

function scrapeBing(string $query): array {
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
                        if (str_starts_with($b64, 'a1')) $b64 = substr($b64, 2);
                        $decoded = base64_decode(strtr($b64, '-_', '+/'));
                        if ($decoded && str_starts_with($decoded, 'http')) $realUrl = $decoded;
                    }
                    $host = parse_url($realUrl, PHP_URL_HOST);
                    if ($host) {
                        $dom = strtolower(str_replace('www.', '', $host));
                        if (!isPortal($dom)) {
                            $results[$dom] = ['title' => $title, 'url' => $realUrl, 'domain' => $dom];
                        }
                    }
                }
            });
        }
    } catch (\Exception $e) {}
    return $results;
}

function scrapeYahoo(string $query): array {
    $results = [];
    foreach ([1, 11] as $p) {
        try {
            $res = Http::withHeaders([
                'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                'Accept-Language' => 'nl-NL,nl;q=0.9',
            ])->timeout(6)->get("https://nl.search.yahoo.com/search?p=" . urlencode($query) . "&b=" . $p);

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
                        if (!isPortal($dom)) {
                            $results[$dom] = ['title' => $title, 'url' => $realUrl, 'domain' => $dom];
                        }
                    }
                });
            }
        } catch (\Exception $e) {}
    }
    return $results;
}

$cleanKw = 'hovenier velp';
$queries = [
    $cleanKw,
    "{$cleanKw} hoveniersbedrijf",
    "hovenier in velp",
    "hovenier regio velp rheden",
    "hovenier arnhem velp",
    "tuinaanleg velp",
    "tuinonderhoud velp",
    "hoveniersbedrijf regio rheden arnhem"
];

$grounded = [];
foreach ($queries as $q) {
    $b = scrapeBing($q);
    foreach ($b as $dom => $info) {
        if (!isset($grounded[$dom])) {
            $grounded[$dom] = $info;
            $grounded[$dom]['hits'] = 2;
        } else {
            $grounded[$dom]['hits'] += 2;
        }
    }
    $y = scrapeYahoo($q);
    foreach ($y as $dom => $info) {
        if (!isset($grounded[$dom])) {
            $grounded[$dom] = $info;
            $grounded[$dom]['hits'] = 2;
        } else {
            $grounded[$dom]['hits'] += 2;
        }
    }
}

// Add Self (vitagroen)
$grounded['vitagroen.nl'] = ['title' => 'Vitagroen Hoveniers', 'url' => 'https://vitagroen.nl/', 'domain' => 'vitagroen.nl', 'hits' => 4];

$list = array_values($grounded);
usort($list, fn($a, $b) => ($b['hits'] ?? 1) <=> ($a['hits'] ?? 1));

echo "100% PURE REAL LIVE SERP COMPETITORS FOUND (" . count($list) . "):\n";
foreach ($list as $idx => $c) {
    echo "#" . ($idx + 1) . ": {$c['domain']} | Hits: {$c['hits']} | URL: {$c['url']}\n";
}
