<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Services\CompetitorScraperService;
use App\Services\AiEngineService;
use Illuminate\Support\Facades\Http;
use Symfony\Component\DomCrawler\Crawler;

function isPortal(string $dom): bool {
    $blacklisted = [
        'online.nl', 'kpn.nl', 'ziggo.nl', 'odido.nl', 't-mobile.', 'vodafone.', 'overstappen.nl', 'nederland.fm',
        'onlinebibliotheek.nl', 'wikipedia.org', 'wiktionary.', 'encyclo.', 'onzetaal.', 'woorden.org', 'vandale.', 'mijnwoordenboek.', 'vertalen.nu',
        'moz.com', 'searchengineland.com', 'seo.com', 'seobility.net', 'developers.google.com', 'github.', 'gitlab.',
        'microsoft.', 'apple.', 'google.', 'mozilla.', 'stackoverflow.', 'quora.', 'reddit.com', 'zhihu.', 'deepl.com', 'translate.',
        'facebook.', 'linkedin.', 'instagram.', 'youtube.', 'tiktok.', 'twitter.', 'x.com', 'pinterest.',
        'bol.com', 'coolblue.', 'amazon.', 'ikea.', 'marktplaats.nl', 'beslist.', 'ebay.',
        'sortlist.', 'trustoo.', 'werkspot.', 'homedeal.', 'cylex.', 'goudengids.', 'telefoongids.', 'telefoonboek.',
        'indebuurt.', 'kvk.nl', 'bedrijvenpagina.', 'openingstijden.', 'beste.nl', 'hetbeste.', '000.nl',
        'offertevergelijker.', 'offerteadviseur.', 'zoekdienst.', 'bedrijvenkiezer.', 'slimster.', 'zoofy.', 'bobex.',
        'hovenier.nl', 'hovenier-nu.', 'hoveniergegevens.', 'hovenier-vinder.', 'hoveniernederland.', 'hoveniersinuwregio.',
        'hovenierin.', 'hovenier.in', 'hovenier-in.', 'hovenier.website', 'hovenier-gigant.', 'hoveniersportaal.',
        'all-in-hoveniersbedrijf.', 'zoekhovenier.', 'tuinman-gezocht.', 'de-hobbykweker.', 'vakblad', 'aeresmbo.',
        'aerestrainingcentre.', 'theartofliving.', 'indeed.', 'jobbird.', 'nationaleberoepengids.',
        'yahoo.', 'bing.', 'duckduckgo.', 'gelderlander.nl', 'omroepgelderland.nl', 'nieuws.nl', 'top40.', 'radionl.',
        'funda.nl', 'huislijn.nl', 'huispedia.nl', 'pararius.nl', 'jaap.nl', 'thuispoort.nl', 'onshuiz.nl', 'buurtje.nl',
        'ah.nl', 'jumbo.com', 'lidl.', 'aldi.', 'hornbach.', 'gamma.', 'praxis.', 'hubo.', 'karwei.', 'offen.net', 'morrisons.', 'racingpost.'
    ];

    foreach ($blacklisted as $b) {
        if (str_contains($dom, $b)) return true;
    }
    return false;
}

$ai = app(AiEngineService::class);
$grounded = [];

// Perplexity grounding
$prompt = "Welke Nederlandse bedrijven, bureaus, praktijken, specialisten en aanbieders zijn actief en ranken in Nederland voor de zoekterm: \"hovenier velp\"? Geef de actuele websites, landingspagina's en live bronnen.";
$res = $ai->queryPerplexity($prompt, "vitagroen");
foreach ($res['citations'] ?? [] as $url) {
    $host = parse_url($url, PHP_URL_HOST);
    if ($host) {
        $dom = strtolower(str_replace('www.', '', $host));
        if (!isPortal($dom)) {
            $grounded[$dom] = [
                'brand' => ucwords(str_replace(['-', '_'], ' ', explode('.', $dom)[0])),
                'domain' => $dom,
                'hits' => 10,
                'citations' => 1,
                'urls' => [$url]
            ];
        }
    }
}

// Bing NL scrape
$bingRes = Http::withHeaders([
    'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Accept-Language' => 'nl-NL,nl;q=0.9',
])->get("https://www.bing.com/search?q=" . urlencode("hovenier velp") . "&setlang=nl-nl&cc=nl");

if ($bingRes->successful()) {
    $crawler = new Crawler($bingRes->body());
    $crawler->filter('li.b_algo')->each(function (Crawler $node) use (&$grounded) {
        $a = $node->filter('h2 a');
        if ($a->count() > 0) {
            $href = $a->attr('href');
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
                    if (!isset($grounded[$dom])) {
                        $grounded[$dom] = [
                            'brand' => ucwords(str_replace(['-', '_'], ' ', explode('.', $dom)[0])),
                            'domain' => $dom,
                            'hits' => 6,
                            'citations' => 1,
                            'urls' => [$realUrl]
                        ];
                    } else {
                        $grounded[$dom]['hits'] += 6;
                        if (!in_array($realUrl, $grounded[$dom]['urls'])) {
                            $grounded[$dom]['urls'][] = $realUrl;
                            $grounded[$dom]['citations'] = count($grounded[$dom]['urls']);
                        }
                    }
                }
            }
        }
    });
}

// Add Self
if (!isset($grounded['vitagroen.nl'])) {
    $grounded['vitagroen.nl'] = ['brand' => 'Vitagroen', 'domain' => 'vitagroen.nl', 'hits' => 8, 'citations' => 2, 'urls' => ['https://vitagroen.nl/']];
}

$list = array_values($grounded);
usort($list, function($a, $b) {
    $sA = ($a['hits'] * 3) + ($a['citations'] * 2);
    $sB = ($b['hits'] * 3) + ($b['citations'] * 2);
    return $sB <=> $sA;
});

echo "=== Grounded Competitors for 'hovenier velp' (" . count($list) . ") ===\n";
foreach ($list as $idx => $c) {
    $score = ($c['hits'] * 3) + ($c['citations'] * 2);
    echo "#" . ($idx + 1) . ": {$c['brand']} ({$c['domain']}) | Score: {$score} | Hits: {$c['hits']} | URLs: " . count($c['urls']) . " (" . $c['urls'][0] . ")\n";
}
