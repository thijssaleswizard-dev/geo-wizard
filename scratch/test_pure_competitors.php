<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Services\AiEngineService;
use App\Services\CompetitorScraperService;

function isGarbageDomain(string $dom): bool {
    $blacklisted = [
        'online.nl', 'overstappen.nl', 'onlinebibliotheek.nl', 'nederland.fm',
        'moz.com', 'searchengineland.com', 'seo.com', 'seobility.net', 'seo.nl',
        'rankingmasters.nl', 'developers.google.com', 'wikipedia.org', 'forbes.com',
        'ama.org', 'b2bmarketeers.nl', 'marketingfacts.nl', 'marketingtribune.nl',
        'sortlist.', 'trustoo.', 'werkspot.', 'homedeal.', 'cylex.', 'goudengids.',
        'telefoongids.', 'telefoonboek.', 'indebuurt.', 'kvk.nl', 'reddit.com',
        'deepl.com', 'hornbach.nl', 'gamma.nl', 'praxis.nl', 'hubo.nl', 'karwei.nl',
        'marktplaats.nl', 'bol.com', 'coolblue.nl', 'amazon.', 'ikea.nl',
        'rheden.nieuws.nl', 'aerestrainingcentre.nl', 'aeresmbo.nl', 'studiegids.nl',
        'care.com', 'edestad.nl', 'tuincentrumoverzicht.nl', 'tuinstudentaanhuis.nl',
        'de-hobbykweker.nl', 'hovenier-nu.nl', 'hoveniergegevens.nl', 'hovenier-vinder.nl',
        'hovenier.nl', 'hoveniernederland.nl', 'tuinman-gezocht.nl', 'all-in-hoveniersbedrijf.nl',
        'hoveniersbedrijven-gids.nl', 'hoveniersinuwregio.nl', 'hovenierin.nl', 'tuinkarwei.nl',
        'hovenier.in', 'hovenier-in.nl', 'hovenier.website', 'hovenier-gigant.nl', 'tuinaanleg-concurrent.nl',
        'offen.net', 'ah.nl', 'jumbo.com', 'lidl.com', 'aldi.nl'
    ];

    foreach ($blacklisted as $b) {
        if (str_contains($dom, $b)) return true;
    }
    return false;
}

function scrapePureLiveCompetitors(string $keywordText, string $companyKey): array
{
    $ai = app(AiEngineService::class);
    $grounded = [];

    // 1. Live Web Grounded Search via Perplexity Live Index
    try {
        $prompt = "Welke bedrijven, bureaus en specialisten zijn actief en ranken in Nederland voor de zoekterm \"{$keywordText}\"? Geef de URL's en bedrijfsnamen.";
        $res = $ai->queryPerplexity($prompt, $companyKey);
        $citations = $res['citations'] ?? [];

        foreach ($citations as $url) {
            $host = parse_url($url, PHP_URL_HOST);
            if ($host) {
                $dom = strtolower(str_replace('www.', '', $host));
                if (!isGarbageDomain($dom) && !str_contains($dom, 'linkedin.com') && !str_contains($dom, 'facebook.com')) {
                    $brand = ucwords(str_replace(['-', '_'], ' ', explode('.', $dom)[0]));
                    $grounded[$dom] = [
                        'brand' => $brand,
                        'domain' => $dom,
                        'url' => $url,
                        'hits' => 4
                    ];
                }
            }
        }
    } catch (\Exception $e) {
        echo "Perplexity error: " . $e->getMessage() . "\n";
    }

    return $grounded;
}

$results = scrapePureLiveCompetitors('online marketing bureau arnhem', 'saleswizard');
echo "Found real competitors for 'online marketing bureau arnhem' (" . count($results) . "):\n";
foreach ($results as $dom => $item) {
    echo "- {$item['brand']} ({$dom}) -> {$item['url']}\n";
}
