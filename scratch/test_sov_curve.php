<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Services\CompetitorScraperService;

function isDirectory(string $dom): bool {
    $dirPatterns = [
        'hovenier.nl', 'hovenier-nu.', 'hoveniergegevens.', 'hovenier-vinder.', 'hoveniernederland.',
        'hoveniersinuwregio.', 'hovenierin.', 'hovenier.in', 'hovenier-in.', 'hovenier.website',
        'hovenier-gigant.', 'hoveniersportaal.', 'all-in-hoveniersbedrijf.', 'zoekhovenier.', 'tuinman-gezocht.',
        'de-hobbykweker.', 'vakblad', 'zoofy.', 'bobex.', 'trustoo.', 'werkspot.', 'homedeal.', 'cylex.',
        'goudengids.', 'telefoongids.', 'telefoonboek.', 'indebuurt.', 'kvk.nl', 'bedrijvenpagina.',
        'openingstijden.', 'beste.nl', 'hetbeste.', '000.nl', 'offerte', 'slimster.', 'bedrijvenkiezer.',
        'aeresmbo.', 'aerestrainingcentre.', 'theartofliving.', 'indeed.', 'jobbird.', 'nationaleberoepengids.'
    ];
    foreach ($dirPatterns as $p) {
        if (str_contains($dom, $p)) return true;
    }
    return false;
}

// Let's test the filtered list
$allFound = [
    'fredbuurman.nl' => ['brand' => 'Fred Buurman Tuinen', 'hits' => 16, 'citations' => 2],
    'vitagroen.nl' => ['brand' => 'Vitagroen', 'hits' => 14, 'citations' => 2],
    'biljoengroen-liemershendriks.nl' => ['brand' => 'Biljoen Groen & Liemers Hendriks', 'hits' => 12, 'citations' => 2],
    'gesselgroen.nl' => ['brand' => 'Gessel Groen', 'hits' => 12, 'citations' => 2],
    'forugreen.nl' => ['brand' => 'For U Green Hoveniersbedrijf', 'hits' => 10, 'citations' => 2],
    'dejongehoveniers.nl' => ['brand' => 'De Jonge Hoveniers', 'hits' => 8, 'citations' => 1],
    'kapona.nl' => ['brand' => 'Kapona Hoveniers', 'hits' => 8, 'citations' => 1],
    'hoveniersbedrijfteunaleven.nl' => ['brand' => 'Teun Aleven Hoveniers', 'hits' => 6, 'citations' => 1],
    'uwtuin.nl' => ['brand' => 'Uw Tuin', 'hits' => 6, 'citations' => 1],
    'langenhuizen.eu' => ['brand' => 'Langenhuizen Hoveniers', 'hits' => 4, 'citations' => 1],
];

echo "Testing real business ranking & proportional SOV:\n";
$totalScore = 0;
foreach ($allFound as &$item) {
    $item['score'] = ($item['hits'] * 3) + ($item['citations'] * 2);
    $totalScore += $item['score'];
}
unset($item);

// Calculate realistic SOV scaled smoothly
$rank = 1;
foreach ($allFound as $dom => $c) {
    $share = round(($c['score'] / $totalScore) * 100);
    // Dynamic top-tier distribution
    $scaledSov = max(2, $share);
    echo "#{$rank}: {$c['brand']} ({$dom}) -> Score: {$c['score']} | SOV: {$scaledSov}% | URLs: {$c['citations']}\n";
    $rank++;
}
