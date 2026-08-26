<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Symfony\Component\DomCrawler\Crawler;

class WebsiteCrawlerService
{
    protected AiEngineService $aiEngine;

    const STOP_WORDS = [
        'de', 'het', 'een', 'van', 'voor', 'in', 'op', 'met', 'te', 'aan', 'bij', 'uit', 'om', 'door', 'over',
        'en', 'of', 'maar', 'want', 'dus', 'als', 'dan', 'ook', 'nog', 'al', 'niet', 'wel', 'geen',
        'is', 'zijn', 'was', 'waren', 'worden', 'werd', 'hebben', 'heeft', 'hadden', 'kunnen', 'kan',
        'wij', 'we', 'ons', 'onze', 'jij', 'je', 'jouw', 'u', 'uw', 'hij', 'zij', 'ze', 'hun',
        'welkom', 'home', 'contact', 'over', 'ons', 'privacy', 'voorwaarden', 'cookie', 'cookies',
        'lees', 'meer', 'bekijk', 'klik', 'hier', 'volg', 'ons', 'onze', 'meesterwerken', 'recente',
        'wat', 'wie', 'waar', 'wanneer', 'waarom', 'hoe', 'klanten', 'zeggen', 'klaar', 'staat', 'voor',
        'cases', 'portfolio', 'projecten', 'ons werk', 'over ons', 'wat we doen', 'wat wij doen', 'wat we', 'wat wij',
        'wie we zijn', 'diensten', 'reviews', 'vacatures', 'team', 'nieuws', 'blog', 'tarieven',
        'onze cases', 'bekijk ons werk', 'onze diensten', 'onze expertises', 'expertises', 'onze visie',
        'veelgestelde vragen', 'faq', 'partners', 'partnerships', 'succesvolle partnerships', 'overzicht',
    ];

    const GENERIC_NAV_PHRASES = [
        'cases', 'portfolio', 'projecten', 'ons werk', 'over ons', 'wat we doen', 'wat wij doen', 'wat we',
        'wat wij', 'wie we zijn', 'diensten', 'reviews', 'vacatures', 'werken bij', 'team', 'nieuws', 'blog',
        'tarieven', 'onze cases', 'bekijk ons werk', 'onze diensten', 'onze expertises', 'expertises', 'onze visie',
        'veelgestelde vragen', 'faq', 'contact', 'contact opnemen', 'afspraak maken', 'offerte', 'offerte aanvragen',
        'algemene voorwaarden', 'privacyverklaring', 'disclaimer', 'sitemap', 'cookiebeleid', 'inloggen', 'login',
        'platforms', 'menu', 'navigatie', 'zoeken', 'search', 'home', 'succesvolle partnerships',
    ];

    public function __construct(AiEngineService $aiEngine)
    {
        $this->aiEngine = $aiEngine;
    }

    public function crawlWebsite(string $inputUrl): array
    {
        $clean = trim($inputUrl);
        $clean = preg_replace('#^https?://#i', '', $clean);
        $clean = preg_replace('#^www\.#i', '', $clean);
        $clean = trim($clean, '/');

        $candidateUrls = [
            "https://{$clean}",
            "https://www.{$clean}",
            "http://{$clean}",
            "http://www.{$clean}",
        ];

        $html = '';
        $effectiveUrl = '';

        foreach ($candidateUrls as $url) {
            try {
                $res = Http::withoutVerifying()
                    ->timeout(10)
                    ->withHeaders([
                        'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                        'Accept' => 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Accept-Language' => 'nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7',
                    ])
                    ->get($url);

                if ($res->successful() && strlen($res->body()) > 200) {
                    $html = $res->body();
                    $effectiveUrl = $url;
                    break;
                }
            } catch (\Exception $e) {
                // Try next url
            }
        }

        if (empty($html)) {
            return [
                'success' => false,
                'url' => $inputUrl,
                'title' => '',
                'metaDescription' => '',
                'headings' => [],
                'services' => [],
                'locations' => [],
                'rawText' => '',
            ];
        }

        $crawler = new Crawler($html);

        // 1. Title
        $title = $crawler->filter('title')->count() ? trim($crawler->filter('title')->text()) : '';

        // 2. Meta description & keywords
        $metaDescription = '';
        if ($crawler->filter('meta[name="description"]')->count()) {
            $metaDescription = trim($crawler->filter('meta[name="description"]')->attr('content') ?? '');
        } elseif ($crawler->filter('meta[property="og:description"]')->count()) {
            $metaDescription = trim($crawler->filter('meta[property="og:description"]')->attr('content') ?? '');
        }

        $metaKeywords = '';
        if ($crawler->filter('meta[name="keywords"]')->count()) {
            $metaKeywords = trim($crawler->filter('meta[name="keywords"]')->attr('content') ?? '');
        }

        // 3. Headings (h1, h2, h3)
        $headings = [];
        $crawler->filter('h1, h2, h3')->each(function (Crawler $node) use (&$headings) {
            $text = trim(preg_replace('/\s+/', ' ', $node->text()));
            $lower = strtolower($text);
            if (strlen($text) >= 3 && strlen($text) <= 120 && !in_array($lower, self::GENERIC_NAV_PHRASES) && !in_array($text, $headings)) {
                $headings[] = $text;
            }
        });

        // 4. Navigation & Services links
        $services = [];
        $crawler->filter('nav a, header a, .menu a, .nav a, footer a, li a')->each(function (Crawler $node) use (&$services) {
            $text = trim(preg_replace('/\s+/', ' ', $node->text()));
            $lower = strtolower($text);
            if (strlen($text) >= 3 && strlen($text) <= 50 && !in_array($lower, self::GENERIC_NAV_PHRASES) && !in_array($text, $services)) {
                $services[] = $text;
            }
        });

        // 5. Paragraph text snippets
        $paragraphs = [];
        $crawler->filter('p, article, section, main')->each(function (Crawler $node) use (&$paragraphs) {
            $text = trim(preg_replace('/\s+/', ' ', $node->text()));
            if (strlen($text) >= 20 && strlen($text) <= 300 && count($paragraphs) < 15) {
                $paragraphs[] = $text;
            }
        });

        // 6. Location detection (support multiple locations, e.g. Ede & Amsterdam)
        $locations = $this->detectLocations($title . ' ' . $metaDescription . ' ' . implode(' ', $headings) . ' ' . implode(' ', $paragraphs));

        return [
            'success' => true,
            'url' => $effectiveUrl,
            'title' => $title,
            'metaDescription' => $metaDescription,
            'metaKeywords' => $metaKeywords,
            'headings' => array_slice($headings, 0, 15),
            'services' => array_slice($services, 0, 20),
            'paragraphs' => array_slice($paragraphs, 0, 8),
            'locations' => $locations,
            'location' => $locations[0] ?? '',
        ];
    }

    public function generateKeywords(string $inputUrl, ?string $companyName = null): array
    {
        $company = $companyName ?: trim($inputUrl);
        $companyNameClean = trim(preg_replace('#^https?://#i', '', $company), '/');
        $targetUrl = str_starts_with($company, 'http') ? $company : "https://www." . (str_contains($company, '.') ? $company : "{$company}.nl");

        $scrapedContent = '';

        // 1. Direct website scrape (title, meta description, headings, body text)
        try {
            $response = Http::withoutVerifying()
                ->timeout(6)
                ->withHeaders([
                    'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept-Language' => 'nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7',
                ])
                ->get($targetUrl);

            if ($response->successful()) {
                $crawler = new Crawler($response->body());
                $title = $crawler->filter('title')->count() ? trim($crawler->filter('title')->text()) : '';
                $metaDesc = $crawler->filter('meta[name="description"]')->count() ? trim($crawler->filter('meta[name="description"]')->attr('content') ?? '') : '';
                $h1s = implode(' ', $crawler->filter('h1')->each(fn(Crawler $n) => trim($n->text())));
                $h2s = implode(' ', array_slice($crawler->filter('h2')->each(fn(Crawler $n) => trim($n->text())), 0, 5));
                $bodyText = implode(' ', array_slice($crawler->filter('p')->each(fn(Crawler $n) => trim($n->text())), 0, 5));

                $scrapedContent = trim("Titel: {$title}\nMeta Description: {$metaDesc}\nHeadings: {$h1s} {$h2s}\nTekst: {$bodyText}");
            }
        } catch (\Exception $scrapeErr) {
            // Fallback: DuckDuckGo search index
            try {
                $ddgUrl = "https://html.duckduckgo.com/html/?q=" . urlencode("{$companyNameClean} website nederland");
                $ddgRes = Http::withoutVerifying()
                    ->timeout(5)
                    ->withHeaders([
                        'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    ])
                    ->get($ddgUrl);

                if ($ddgRes->successful()) {
                    $crawler = new Crawler($ddgRes->body());
                    $title = $crawler->filter('.result__title')->count() ? trim($crawler->filter('.result__title')->first()->text()) : '';
                    $snippet = $crawler->filter('.result__snippet')->count() ? trim($crawler->filter('.result__snippet')->first()->text()) : '';
                    $scrapedContent = "Titel: {$title}\nSnippet: {$snippet}";
                }
            } catch (\Exception $e) {
                // Log and continue
            }
        }

        // 2. Query Gemini / AI with exact prompt from original version
        $recommended = [];
        $aiPrompt = "Analyseer de volgende gescrapte gegevens van de website van \"{$companyNameClean}\":\n\n--- GESCRAPTE WEBSITE INHOUD ---\n" . ($scrapedContent ?: "Bedrijfsnaam: {$companyNameClean}") . "\n--------------------------------\n\nGenereer exact 5 uiterst relevante, hoog-converterende zoekwoorden (keywords) in het Nederlands.\nBELANGRIJK: Let heel goed op de specifieke vestigingsplaats/regio (bijv. Velp, Arnhem, Nijmegen, Amsterdam) en specifieke diensten die in de gescrapte tekst worden vermeld.\nGeef ALLEEN een komma-gescheiden lijst met 5 zoekwoorden in kleine letters zonder nummering of extra tekst.";

        try {
            $aiRes = $this->aiEngine->queryGemini($aiPrompt, $companyNameClean);
            if (!empty($aiRes['text']) && str_contains($aiRes['text'], ',') && empty($aiRes['fallbackUsed'])) {
                $parsed = array_values(array_filter(array_map(function ($k) {
                    return trim(preg_replace('/[^a-z0-9\s\-]/i', '', strtolower($k)));
                }, explode(',', $aiRes['text']))));

                if (count($parsed) >= 3) {
                    $recommended = array_slice($parsed, 0, 5);
                }
            }
        } catch (\Exception $aiErr) {
            Log::error('Keyword Recommender AI Error: ' . $aiErr->getMessage());
        }

        // 3. If AI response is empty or no API key, use the enhanced NLP extractor
        if (empty($recommended)) {
            $crawlData = $this->crawlWebsite($inputUrl);
            $recommended = $this->extractKeywordsFromCrawlData($crawlData, $companyNameClean);
        }

        return $recommended;
    }

    protected function extractKeywordsFromCrawlData(array $crawl, string $companyName): array
    {
        $keywords = [];
        $locations = array_map('strtolower', $crawl['locations'] ?? []);
        $primaryLocation = $locations[0] ?? '';

        // Noise patterns to strictly exclude
        $noisePatterns = [
            '/\b\d{2,}\b/', // Phone numbers, numbers
            '/\b(085|088|06|010|020|030|040|050)\b/i',
            '/[a-z0-9._%+-]+@[a-z0-9.-]+/i', // Emails
            '/\.nl\b/i', '/\.com\b/i', // Domains in keywords
            '/\b(inloggen|klantportaal|registreren|claim uw domein|bel mij terug|vraag een offerte|offerte aanvragen|lees meer|support|informatie|contact|nieuws|inzichten|tips voor|trends dit jaar)\b/i',
        ];

        // Commercial service semantic mapping
        $semanticDictionary = [
            'webdesign' => ['webdesign bureau', 'webdesign laten maken', 'professionele website laten maken'],
            'online marketing' => ['online marketing bureau', 'digitale marketing', 'zoekmachine optimalisatie'],
            'hosting' => ['webhosting nederland', 'managed hosting'],
            'webhosting' => ['webhosting nederland', 'managed hosting'],
            'vps' => ['vps hosting', 'vps server huren'],
            'virtual private servers' => ['vps hosting', 'vps server nederland'],
            'branding' => ['branding bureau', 'huisstijl ontwerp', 'merkidentiteit'],
            'hovenier' => ['hovenier', 'tuinaanleg', 'tuinonderhoud', 'tuinontwerp'],
            'tuinontwerp' => ['tuinontwerp', 'tuin laten ontwerpen'],
            'tuinaanleg' => ['tuinaanleg', 'tuin laten aanleggen'],
            'tuinonderhoud' => ['tuinonderhoud', 'periodiek tuinonderhoud'],
            'digital agency' => ['digital agency', 'digitaal bureau'],
            'e-commerce' => ['webshop laten maken', 'e-commerce specialist'],
            'webshops' => ['webshop laten maken', 'e-commerce webshop'],
            'webapplicaties' => ['maatwerk webapplicaties', 'webapplicatie laten maken'],
            'software' => ['software ontwikkeling', 'maatwerk software'],
            'dakdekker' => ['dakdekker', 'dakrenovatie', 'daklekkage verhelpen'],
            'loodgieter' => ['loodgieter', 'loodgietersbedrijf', 'cv ketel onderhoud'],
            'schilder' => ['schildersbedrijf', 'binnenschilder', 'buitenschilder'],
            'fysio' => ['fysiotherapie', 'fysiotherapeut', 'manuele therapie'],
        ];

        $allRawPhrases = array_merge(
            !empty($crawl['title']) ? [$crawl['title']] : [],
            $crawl['headings'] ?? [],
            $crawl['services'] ?? []
        );

        // 1. First collect all semantic commercial intent keywords
        $commercialIntentKeywords = [];
        $supportingKeywords = [];

        foreach ($allRawPhrases as $raw) {
            $lower = strtolower(trim($raw));

            // Check against noise patterns
            $isNoise = false;
            foreach ($noisePatterns as $pattern) {
                if (preg_match($pattern, $lower)) {
                    $isNoise = true;
                    break;
                }
            }
            if ($isNoise) {
                continue;
            }

            // Check for matches in semantic dictionary
            foreach ($semanticDictionary as $trigger => $mappedKeywords) {
                if (str_contains($lower, $trigger)) {
                    $added = 0;
                    foreach ($mappedKeywords as $mk) {
                        if (!in_array($mk, $commercialIntentKeywords) && $added < 1) {
                            $commercialIntentKeywords[] = $mk;
                            $added++;
                        }
                    }
                }
            }

            // Also clean and consider original phrase if it's a solid 2-3 word term
            $cleanedPhrase = trim(preg_replace('/[^a-zA-Z0-9\s\-]/', '', $lower));
            $words = explode(' ', $cleanedPhrase);
            $filteredWords = array_values(array_filter($words, fn($w) => !in_array($w, self::STOP_WORDS) && strlen($w) > 2));

            if (count($filteredWords) >= 2 && count($filteredWords) <= 3) {
                $phrase = implode(' ', $filteredWords);
                if (strlen($phrase) >= 6 && strlen($phrase) <= 30 && !in_array($phrase, self::GENERIC_NAV_PHRASES)) {
                    $supportingKeywords[] = $phrase;
                }
            }
        }

        $allCandidates = array_merge($commercialIntentKeywords, $supportingKeywords);

        // Deduplicate and prioritize high-value commercial keywords
        $finalKeywords = [];
        foreach ($allCandidates as $cand) {
            $cand = trim(preg_replace('/\s+/', ' ', strtolower($cand)));

            $isNoise = false;
            foreach ($noisePatterns as $pattern) {
                if (preg_match($pattern, $cand)) {
                    $isNoise = true;
                    break;
                }
            }
            if ($isNoise || strlen($cand) < 4 || in_array($cand, self::GENERIC_NAV_PHRASES)) {
                continue;
            }

            if (!in_array($cand, $finalKeywords)) {
                $finalKeywords[] = $cand;
            }
            if (count($finalKeywords) >= 6) {
                break;
            }
        }

        if (count($finalKeywords) < 3) {
            $cleanName = strtolower(trim(str_replace('.nl', '', $companyName)));
            $finalKeywords = array_unique(array_merge($finalKeywords, [
                $primaryLocation ? "specialist {$primaryLocation}" : "specialist {$cleanName}",
                $primaryLocation ? "bureau {$primaryLocation}" : "expert {$cleanName}",
                "{$cleanName} diensten",
            ]));
        }

        return array_values(array_slice($finalKeywords, 0, 6));
    }

    protected function detectLocations(string $text): array
    {
        $dutchCities = [
            'amsterdam', 'rotterdam', 'den haag', 'utrecht', 'eindhoven', 'tilburg', 'groningen', 'almere', 'breda', 'nijmegen',
            'enschede', 'haarlem', 'arnhem', 'amersfoort', 'apeldoorn', 'den bosch', 's-hertogenbosch', 'hoofddorp', 'maastricht',
            'leiden', 'dordrecht', 'zoetermeer', 'zwolle', 'deventer', 'delft', 'alkmaar', 'heerlen', 'venlo', 'leeuwarden',
            'hilversum', 'hengelo', 'amstelveen', 'roosendaal', 'purmerend', 'oss', 'schiedam', 'spijkenisse', 'helmond', 'vlaardingen',
            'alphen aan den rijn', 'gouda', 'zaanstad', 'hoorn', 'ede', 'velp', 'rheden', 'oosterbeek', 'zevenaar', 'duiven', 'westervoort',
            'dieren', 'doesburg', 'gelderland', 'overijssel', 'brabant', 'noord-brabant', 'zuid-holland', 'noord-holland'
        ];

        $lower = strtolower($text);
        $found = [];

        foreach ($dutchCities as $city) {
            if (preg_match('/\b' . preg_quote($city, '/') . '\b/i', $lower)) {
                $found[] = ucfirst($city);
            }
        }

        return array_values(array_unique($found));
    }
}

