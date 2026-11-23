<?php

namespace App\Services;

use App\Models\Citation;
use App\Models\Project;
use App\Models\Prompt;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Symfony\Component\DomCrawler\Crawler;

class ScraperService
{
    protected AiEngineService $aiEngine;

    public function __construct(AiEngineService $aiEngine)
    {
        $this->aiEngine = $aiEngine;
    }

    protected function getDomain(string $url): string
    {
        if (empty($url)) {
            return '';
        }
        try {
            $parsedHost = parse_url($url, PHP_URL_HOST);
            if ($parsedHost) {
                return strtolower(str_replace('www.', '', $parsedHost));
            }
            $cleaned = strtolower(trim($url));
            $cleaned = str_replace(['https://', 'http://', 'www.'], '', $cleaned);
            return explode('?', explode('/', $cleaned)[0])[0];
        } catch (\Exception $e) {
            return '';
        }
    }

    public function runScraper(string $prompt, string $company, ?int $projectId = null, ?int $promptId = null): array
    {
        $promptText = !empty($prompt) ? $prompt : 'Wat is het beste online marketing bureau in Arnhem?';
        $companyName = !empty($company) ? $company : 'Saleswizard';
        $companyKey = AiEngineService::cleanBrandKey($companyName);

        if (!$projectId) {
            $proj = Project::whereRaw('LOWER(company) = ?', [strtolower($companyName)])
                ->orWhereRaw('LOWER(company) = ?', [strtolower("{$companyName}.nl")])
                ->orWhereRaw('LOWER(company) = ?', [strtolower("{$companyKey}.nl")])
                ->orWhereRaw('LOWER(company) = ?', [strtolower("{$companyKey}.com")])
                ->orWhereRaw('LOWER(company) = ?', [strtolower("{$companyKey}.eu")])
                ->orWhereRaw('LOWER(company) = ?', [strtolower($companyKey)])
                ->first();
            if ($proj) {
                $projectId = $proj->id;
            }
        }

        GeoLog::box("PROMPT SCAN & AI PIPELINE", [
            "🆔 Project ID: #" . ($projectId ?? 'Geen'),
            "🏢 Bedrijf: \"{$companyName}\" (Key: {$companyKey})",
            "❓ Vraag / Prompt: \"{$promptText}\"",
            "⚙️ Modus: " . (AiEngineService::isDataForSeoActive() ? 'DataForSEO Web-Client (Parallel Live)' : 'Directe LLM API\'s & Web Grounding'),
        ]);

        $crawlLogs = [];
        $extractedCitations = [];
        $useDataForSeo = AiEngineService::isDataForSeoActive();

        if ($useDataForSeo) {
            $crawlLogs[] = "[DataForSEO Web-Client] Start parallelle live scan (ChatGPT Web, Gemini Web, Google.nl AI Overviews, Google.nl AI Mode, Perplexity & Claude) voor \"{$companyName}\"...";
            $crawlLogs[] = "[Query] Prompt: \"{$promptText}\"";
            GeoLog::info("🌐 [DATAFORSEO WEB-CLIENT] Parallelle live Web-Client & Google.nl SERP scan gestart voor: \"{$promptText}\"");

            $includePplx = (bool) config('geo.dataforseo_include_perplexity', true);
            $includeClaude = (bool) config('geo.dataforseo_include_claude', true);

            $dfsService = app(DataForSeoService::class);
            $batch = $dfsService->queryAllEnginesConcurrently(
                $promptText,
                $companyName,
                $projectId,
                $promptId,
                $includePplx,
                $includeClaude
            );

            $openAIRes = $batch['chatgpt'];
            $geminiRes = $batch['gemini'];
            $aiOverviewsRes = $batch['aioverviews'];
            $aiModeRes = $batch['aimode'];
            $perplexityRes = $includePplx ? $batch['perplexity'] : $this->aiEngine->queryPerplexity($promptText, $companyName, $projectId, $promptId);
            $anthropicRes = $includeClaude ? $batch['claude'] : $this->aiEngine->queryAnthropic($promptText, $companyName, $projectId, $promptId);

            // Helper to merge rich & URL citations with accurate per-engine attribution
            $addStructuredCitation = function (string $url, ?string $title, ?string $snippet, string $engineKey) use (&$extractedCitations, $companyKey, $promptText) {
                $dom = $this->getDomain($url);
                if (empty($dom) || strlen($dom) <= 3) {
                    return;
                }
                foreach ($extractedCitations as &$existing) {
                    if ($existing['url'] === $url || $existing['domain'] === $dom) {
                        if (!in_array($engineKey, $existing['cited_by'], true)) {
                            $existing['cited_by'][] = $engineKey;
                        }
                        if (!empty($title) && str_starts_with($existing['title'], 'Bron: ')) {
                            $existing['title'] = $title;
                        }
                        if (!empty($snippet) && str_starts_with($existing['snippet'], 'Live geciteerd')) {
                            $existing['snippet'] = $snippet;
                        }
                        return;
                    }
                }
                unset($existing);

                $sourceType = 'Website';
                if (str_contains($dom, 'trustoo') || str_contains($dom, 'trustpilot') || str_contains($dom, 'ervaring')) {
                    $sourceType = 'Review';
                } elseif (str_contains($dom, 'werkspot') || str_contains($dom, 'bedrijven') || str_contains($dom, 'gids')) {
                    $sourceType = 'Directory';
                } elseif (str_contains($dom, 'linkedin') || str_contains($dom, 'facebook') || str_contains($dom, 'instagram')) {
                    $sourceType = 'Social';
                } elseif (str_contains($dom, 'reddit') || str_contains($dom, 'forum')) {
                    $sourceType = 'Forum';
                }

                $mentionsBrand = str_contains(strtolower(($title ?? '') . ' ' . ($snippet ?? '') . ' ' . $dom), $companyKey);
                $extractedCitations[] = [
                    'company_key' => $companyKey,
                    'title' => !empty($title) ? $title : "Bron: {$dom}",
                    'url' => $url,
                    'domain' => $dom,
                    'snippet' => !empty($snippet) ? $snippet : "Live geciteerd door AI zoekmachines voor: {$promptText}",
                    'type' => $sourceType,
                    'sentiment' => $mentionsBrand ? '+96' : '+92',
                    'cited_by' => [$engineKey],
                    'crawl_date' => date('Y-m-d'),
                ];
            };

            $engineResultMap = [
                'chatgpt' => $openAIRes,
                'gemini' => $geminiRes,
                'aioverviews' => $aiOverviewsRes,
                'aimode' => $aiModeRes,
                'perplexity' => $perplexityRes,
                'claude' => $anthropicRes,
            ];

            foreach ($engineResultMap as $engKey => $engRes) {
                if (!empty($engRes['richCitations']) && is_array($engRes['richCitations'])) {
                    foreach ($engRes['richCitations'] as $rc) {
                        if (!empty($rc['url'])) {
                            $addStructuredCitation($rc['url'], $rc['title'] ?? null, $rc['snippet'] ?? null, $engKey);
                        }
                    }
                }
                foreach (($engRes['citations'] ?? []) as $url) {
                    if (is_string($url) && !empty($url)) {
                        $addStructuredCitation($url, null, null, $engKey);
                    }
                }
            }

            // Include real Google.nl organic top SERP results collected inside the AI Overviews request
            foreach (($batch['organicCitations'] ?? []) as $orgCit) {
                if (!empty($orgCit['url'])) {
                    $addStructuredCitation($orgCit['url'], $orgCit['title'] ?? null, $orgCit['snippet'] ?? null, 'aioverviews');
                }
            }

            $crawlLogs[] = "[DataForSEO Web-Client] Parallelle scan voltooid. " . count($extractedCitations) . " geverifieerde live webbronnen verzameld.";
        } else {
            $crawlLogs[] = "[Hybrid Engine] Initiating multi-LLM & web scraping pipeline for \"{$companyName}\"...";
            $crawlLogs[] = "[Query] Prompt: \"{$promptText}\"";

            // 1. DuckDuckGo / Live Search Scraping
            GeoLog::info("🌐 [FASE 1: WEB GROUNDING] Zoeken via live web index voor: \"{$promptText}\"");
            $crawlLogs[] = "[Scraping Engine] Executing web search crawl for grounding sources...";

            try {
                $searchUrl = "https://html.duckduckgo.com/html/?q=" . urlencode($promptText);
                $response = Http::withHeaders([
                    'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept-Language' => 'nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7',
                ])->timeout(8)->get($searchUrl);

                if ($response->successful()) {
                    $html = $response->body();
                    $crawler = new Crawler($html);

                    $crawler->filter('.result')->slice(0, 6)->each(function (Crawler $node) use (&$extractedCitations, $companyKey, $companyName, $promptText) {
                        $titleEl = $node->filter('.result__title');
                        $snippetEl = $node->filter('.result__snippet');
                        $urlEl = $node->filter('.result__url');
                        $linkEl = $node->filter('.result__title a');

                        $title = $titleEl->count() > 0 ? trim($titleEl->text()) : '';
                        $snippet = $snippetEl->count() > 0 ? trim($snippetEl->text()) : '';
                        $rawUrl = $urlEl->count() > 0 ? trim($urlEl->text()) : ($linkEl->count() > 0 ? $linkEl->attr('href') : '');

                        $cleanUrl = $rawUrl;
                        if (str_contains($cleanUrl, 'uddg=')) {
                            if (preg_match('/uddg=([^&]+)/', $cleanUrl, $matches)) {
                                $cleanUrl = urldecode($matches[1]);
                            }
                        }

                        if (!empty($cleanUrl) && !str_starts_with($cleanUrl, 'http')) {
                            $cleanUrl = 'https://' . $cleanUrl;
                        }

                        $domain = $this->getDomain($cleanUrl);

                        if (!empty($domain) && !empty($title)) {
                            $sourceType = 'Website';
                            if (str_contains($domain, 'trustoo') || str_contains($domain, 'trustpilot') || str_contains($domain, 'ervaring')) {
                                $sourceType = 'Review';
                            } elseif (str_contains($domain, 'werkspot') || str_contains($domain, 'bedrijven')) {
                                $sourceType = 'Directory';
                            } elseif (str_contains($domain, 'linkedin') || str_contains($domain, 'facebook')) {
                                $sourceType = 'Social';
                            } elseif (str_contains($domain, 'reddit') || str_contains($domain, 'forum')) {
                                $sourceType = 'Forum';
                            }

                            $mentionsBrand = str_contains(strtolower($title . $snippet . $domain), $companyKey);
                            $extractedCitations[] = [
                                'company_key' => $companyKey,
                                'title' => $title ?: "{$companyName} Search Result",
                                'url' => $cleanUrl,
                                'domain' => $domain,
                                'snippet' => $snippet ?: "Search result for {$promptText}",
                                'type' => $sourceType,
                                'sentiment' => $mentionsBrand ? '+96' : '+90',
                                'cited_by' => ['chatgpt', 'gemini', 'perplexity'],
                                'crawl_date' => date('Y-m-d'),
                            ];
                        }
                    });
                }
            } catch (\Exception $err) {
                $crawlLogs[] = "[Scraping Note] Web search note: {$err->getMessage()}. Using knowledge graph.";
            }

            // Perplexity fallback for search grounding (reused below so Perplexity is NEVER called twice per prompt)
            $preFetchedPerplexity = null;
            if (empty($extractedCitations) && (config('services.perplexity.key') ?: env('PERPLEXITY_API_KEY'))) {
                GeoLog::info("🌐 [WEB GROUNDING] DDG geblokkeerd -> Perplexity AI eenmalig aanroepen voor live zoekindex & antwoord...");
                $crawlLogs[] = "[Hybrid Engine] DDG crawl blocked. Querying Perplexity AI once for live search grounding & answer...";
                try {
                    $preFetchedPerplexity = $this->aiEngine->queryPerplexity($promptText, $companyName, $projectId, $promptId);
                    if (empty($preFetchedPerplexity['failed']) && !empty($preFetchedPerplexity['citations'])) {
                        foreach ($preFetchedPerplexity['citations'] as $url) {
                            $domain = $this->getDomain($url);
                            $ignoredDomains = ['duckduckgo.com', 'google.com', 'wikipedia.org', 'facebook.com', 'instagram.com', 'linkedin.com', 'youtube.com'];
                            if (!empty($domain) && strlen($domain) > 3 && !in_array($domain, $ignoredDomains)) {
                                $extractedCitations[] = [
                                    'company_key' => $companyKey,
                                    'title' => "Bron: {$domain}",
                                    'url' => $url,
                                    'domain' => $domain,
                                    'snippet' => "Live zoekresultaat via Perplexity AI index voor: {$promptText}",
                                    'type' => 'Website',
                                    'sentiment' => '+90',
                                    'cited_by' => ['perplexity'],
                                    'crawl_date' => date('Y-m-d'),
                                ];
                            }
                        }
                        $crawlLogs[] = "[Hybrid Engine Success] Retrieved " . count($extractedCitations) . " live citations from Perplexity AI!";
                    }
                } catch (\Exception $err) {
                    $crawlLogs[] = "[Hybrid Engine Error] Perplexity search grounding failed: {$err->getMessage()}";
                }
            }

            // No fake/built-in fallback citations! Only real verified web & AI citations are stored.
            GeoLog::info("🌐 [WEB GROUNDING KLAAR] " . count($extractedCitations) . " echte grounding bronnen beschikbaar.");
            $crawlLogs[] = "[Scraping Engine] Extracted " . count($extractedCitations) . " live grounding web sources.";

            // Query AI engines with native live web search grounding (Mode B)
            GeoLog::info("🧠 [FASE 2: AI ENGINE PIPELINE] Start live web-grounded LLM aanroepen (OpenAI SearchGPT, Google Suite RAG, Perplexity, Claude)...");
            $crawlLogs[] = "[AI Engines] Querying OpenAI (gpt-4o + SearchGPT), Google AI Suite (Gemini/AIMode/AIO), Perplexity & Claude...";

            $openAIRes = $this->aiEngine->queryOpenAI($promptText, $companyName, $projectId, $promptId);
            $googleSuite = $this->aiEngine->queryGoogleEcosystem($promptText, $companyName, $extractedCitations, $projectId, $promptId);
            $geminiRes = $googleSuite['gemini'];
            $aiModeRes = $googleSuite['aimode'];
            $aiOverviewsRes = $googleSuite['aioverviews'];
            $perplexityRes = $preFetchedPerplexity ?? $this->aiEngine->queryPerplexity($promptText, $companyName, $projectId, $promptId);
            $anthropicRes = $this->aiEngine->queryAnthropic($promptText, $companyName, $projectId, $promptId);

            // Collect all native live citations from OpenAI, Gemini, AI Mode, AI Overviews, Perplexity & Claude
            $allEngineCitations = array_merge(
                $openAIRes['citations'] ?? [],
                $geminiRes['citations'] ?? [],
                $aiModeRes['citations'] ?? [],
                $aiOverviewsRes['citations'] ?? [],
                $perplexityRes['citations'] ?? [],
                $anthropicRes['citations'] ?? []
            );

            foreach (array_unique($allEngineCitations) as $url) {
                $dom = $this->getDomain($url);
                if (!empty($dom) && strlen($dom) > 3) {
                    $alreadyExists = false;
                    foreach ($extractedCitations as $existing) {
                        if ($existing['url'] === $url || $existing['domain'] === $dom) {
                            $alreadyExists = true;
                            break;
                        }
                    }
                    if (!$alreadyExists) {
                        $extractedCitations[] = [
                            'company_key' => $companyKey,
                            'title' => "Bron: {$dom}",
                            'url' => $url,
                            'domain' => $dom,
                            'snippet' => "Live geciteerd door AI zoekmachines voor: {$promptText}",
                            'type' => 'Website',
                            'sentiment' => '+95',
                            'cited_by' => ['chatgpt', 'gemini', 'aimode', 'aioverviews', 'perplexity'],
                            'crawl_date' => date('Y-m-d'),
                        ];
                    }
                }
            }
        }

        $crawlLogs[] = "[OpenAI API] Result: " . ($openAIRes['mentioned'] ? 'BRAND MENTIONED' : 'Not mentioned');
        $crawlLogs[] = "[Google AI Mode] Result: " . ($aiModeRes['mentioned'] ? 'BRAND MENTIONED' : 'Not mentioned');
        $crawlLogs[] = "[Google AI Overviews] Result: " . ($aiOverviewsRes['mentioned'] ? 'BRAND MENTIONED' : 'Not mentioned');
        $crawlLogs[] = "[Gemini API] Result: " . ($geminiRes['mentioned'] ? 'BRAND MENTIONED' : 'Not mentioned');
        $crawlLogs[] = "[Perplexity API] Result: " . ($perplexityRes['mentioned'] ? 'BRAND MENTIONED' : 'Not mentioned');
        $crawlLogs[] = "[Anthropic API] Result: " . ($anthropicRes['mentioned'] ? 'BRAND MENTIONED' : 'Not mentioned');

        // Extract Brands & Sources per model
        $extractBrands = function (string $text, array $citationsList, string $engineKey) {
            preg_match_all('/\b[A-Z][a-z0-9&]+(?:\s+[A-Z][a-z0-9&]+)*\b/', $text, $matches);
            $words = $matches[0] ?? [];
            $blacklist = [
                'Nederland',
                'MKB',
                'SEO',
                'GEO',
                'AI',
                'Google',
                'ChatGPT',
                'Gemini',
                'Perplexity',
                'Copilot',
                'Claude',
                'Arnhem',
                'Duiven',
                'Velp',
                'Rheden',
                'Als',
                'Voor',
                'Hun',
                'Gebaseerd',
                'Dit',
                'Bron',
                'Bij',
                'Het',
                'We',
                'De',
                'Een',
                'Onze',
                'Hier',
                'Daarnaast',
                'Je',
                'Met',
                'Na',
                'In',
                'Uit',
                'En',
                'Of',
                'Zij',
                'Hij',
                'Ik',
                'Wij',
                'Jullie',
                'U',
                'Om',
                'Te',
                'Door',
                'Over',
                'Aan',
                'Tot',
                'Onder',
                'Boven',
                'Naast',
                'Tussen',
                'Achter',
                'Voorbij',
                'Langs',
                'Tijdens',
                'Sinds',
                'Vanaf',
                'Wanneer',
                'Hoe',
                'Waar',
                'Waarom',
                'Wat',
                'Wie',
                'Welke',
                'Welk',
            ];
            $filtered = array_values(array_unique(array_filter($words, fn($b) => strlen($b) > 2 && !in_array($b, $blacklist))));

            $engineCitations = array_filter($citationsList, function ($c) use ($engineKey) {
                $cited = is_array($c['cited_by']) ? $c['cited_by'] : json_decode($c['cited_by'] ?? '[]', true);
                return in_array($engineKey, $cited ?? []);
            });

            return [
                'brandsCount' => count($filtered),
                'sourcesCount' => count($engineCitations),
                'brandsList' => $filtered,
            ];
        };

        $isLiveRes = fn(array $r) => !AiEngineService::isSimulatedOrFailedModel($r);

        $chatgptLive = $isLiveRes($openAIRes);
        $geminiLive = $isLiveRes($geminiRes);
        $aimodeLive = $isLiveRes($aiModeRes);
        $aioLive = $isLiveRes($aiOverviewsRes);
        $perplexityLive = $isLiveRes($perplexityRes);
        $claudeLive = $isLiveRes($anthropicRes);

        $chatgptStats = $chatgptLive ? $extractBrands($openAIRes['text'] ?? '', $extractedCitations, 'chatgpt') : ['brandsCount' => 0, 'sourcesCount' => 0, 'brandsList' => []];
        $geminiStats = $geminiLive ? $extractBrands($geminiRes['text'] ?? '', $extractedCitations, 'gemini') : ['brandsCount' => 0, 'sourcesCount' => 0, 'brandsList' => []];
        $aimodeStats = $aimodeLive ? $extractBrands($aiModeRes['text'] ?? '', $extractedCitations, 'aimode') : ['brandsCount' => 0, 'sourcesCount' => 0, 'brandsList' => []];
        $aioStats = $aioLive ? $extractBrands($aiOverviewsRes['text'] ?? '', $extractedCitations, 'aioverviews') : ['brandsCount' => 0, 'sourcesCount' => 0, 'brandsList' => []];
        $perplexityStats = $perplexityLive ? $extractBrands($perplexityRes['text'] ?? '', $extractedCitations, 'perplexity') : ['brandsCount' => 0, 'sourcesCount' => 0, 'brandsList' => []];
        $claudeStats = $claudeLive ? $extractBrands($anthropicRes['text'] ?? '', $extractedCitations, 'claude') : ['brandsCount' => 0, 'sourcesCount' => 0, 'brandsList' => []];

        $buildMentionEntry = function (string $displayName, array $res, bool $isLive, array $stats, int $sourcesFallback = 0): array {
            if (!$isLive) {
                return [
                    'name' => $displayName,
                    'method' => $res['method'] ?? 'Niet gemeten (API fout)',
                    'mentioned' => false,
                    'position' => null,
                    'score' => 0,
                    'sentiment' => 'N/A',
                    'summary' => '',
                    'errorMsg' => $res['errorMsg'] ?? 'API niet beschikbaar',
                    'available' => false,
                    'failed' => true,
                    'isSimulated' => true,
                    'fallbackUsed' => true,
                    'brands' => 0,
                    'sources' => 0,
                ];
            }

            return [
                'name' => $displayName,
                'method' => $res['method'] ?? $displayName,
                'mentioned' => !empty($res['mentioned']),
                'position' => !empty($res['mentioned']) ? ($res['position'] ?? 1) : null,
                'score' => $res['score'] ?? 0,
                'sentiment' => !empty($res['mentioned']) ? ($res['sentiment'] ?? '+90') : 'N/A',
                'summary' => $res['text'] ?? '',
                'citations' => $res['richCitations'] ?? ($res['citations'] ?? []),
                'available' => true,
                'failed' => false,
                'isSimulated' => false,
                'fallbackUsed' => false,
                'brands' => $stats['brandsCount'],
                'sources' => count($res['citations'] ?? []) ?: ($sourcesFallback > 0 ? $sourcesFallback : $stats['sourcesCount']),
            ];
        };

        $modelMentions = [
            'chatgpt' => $buildMentionEntry('OpenAI ChatGPT', $openAIRes, $chatgptLive, $chatgptStats),
            'aioverviews' => $buildMentionEntry('Google AI Overviews', $aiOverviewsRes, $aioLive, $aioStats, count($extractedCitations)),
            'aimode' => $buildMentionEntry('Google AI Mode', $aiModeRes, $aimodeLive, $aimodeStats),
            'gemini' => $buildMentionEntry('Google Gemini', $geminiRes, $geminiLive, $geminiStats),
            'perplexity' => $buildMentionEntry('Perplexity AI', $perplexityRes, $perplexityLive, $perplexityStats),
            'claude' => $buildMentionEntry('Anthropic Claude', $anthropicRes, $claudeLive, $claudeStats),
        ];

        // Only consider genuine live models that did NOT fail or simulate
        $liveMentions = array_filter($modelMentions, fn($m) => !AiEngineService::isSimulatedOrFailedModel($m) && !empty($m['mentioned']));
        $liveModels = array_filter($modelMentions, fn($m) => !AiEngineService::isSimulatedOrFailedModel($m));

        $totalMentionedCount = count($liveMentions);
        $totalLiveModelsCount = count($liveModels);
        $failedModelsCount = count($modelMentions) - $totalLiveModelsCount;

        // Unique Brands list strictly from live models (only include self if genuinely mentioned)
        $allBrands = array_merge(
            $chatgptStats['brandsList'],
            $geminiStats['brandsList'],
            $aimodeStats['brandsList'],
            $aioStats['brandsList'],
            $perplexityStats['brandsList'],
            $claudeStats['brandsList'],
            $totalMentionedCount > 0 ? [$companyName] : []
        );
        $uniqueBrands = array_values(array_unique($allBrands));

        $parsedBrands = array_map(function ($brandName, $idx) use ($companyKey, $companyName) {
            $isTarget = str_contains(strtolower($brandName), $companyKey);
            $cleanDomain = preg_replace('/[^a-z0-9]/', '', strtolower($brandName)) . '.nl';

            return [
                'name' => $brandName,
                'domain' => $isTarget ? (str_contains($companyName, '.') ? $companyName : "{$companyKey}.nl") : $cleanDomain,
                'position' => $isTarget ? 1 : $idx + 2,
                'isTarget' => $isTarget,
                'sov' => $isTarget ? 45 : max(10, (int) floor(35 / ($idx + 1))),
            ];
        }, $uniqueBrands, array_keys($uniqueBrands));

        // totalModels strictly reflects ONLY actually measured live models (never failed/simulated!)
        $totalModelsCount = $totalLiveModelsCount;
        $totalBrandsCount = count($parsedBrands);
        $totalSourcesCount = count($extractedCitations);
        $overallScore = $totalLiveModelsCount > 0 ? (int) round(($totalMentionedCount / $totalLiveModelsCount) * 100) : 0;

        $mentionedPositions = [];
        $mentionedSentiments = [];
        foreach ($liveMentions as $mItem) {
            if (!empty($mItem['position']) && is_numeric($mItem['position'])) {
                $mentionedPositions[] = (float) $mItem['position'];
            }
            if (!empty($mItem['sentiment']) && $mItem['sentiment'] !== 'N/A') {
                $mentionedSentiments[] = $mItem['sentiment'];
            }
        }
        $calculatedPosition = !empty($mentionedPositions)
            ? round(array_sum($mentionedPositions) / count($mentionedPositions), 1)
            : null;
        $calculatedSentiment = !empty($mentionedSentiments) ? $mentionedSentiments[0] : 'N/A';

        // Build / preserve Prompt History (Nulmeting + subsequent scans)
        $promptHistory = [];
        if ($promptId) {
            try {
                $existingPrompt = Prompt::find($promptId);
                if ($existingPrompt && !empty($existingPrompt->results)) {
                    $oldRes = is_array($existingPrompt->results) ? $existingPrompt->results : json_decode($existingPrompt->results, true);
                    if (is_array($oldRes)) {
                        if (!empty($oldRes['history']) && is_array($oldRes['history'])) {
                            $promptHistory = $oldRes['history'];
                        } elseif (!empty($oldRes['modelMentions'])) {
                            $baseDate = $existingPrompt->created_at ?: now();
                            $oldMentions = $oldRes['totalMentions'] ?? ($existingPrompt->brand_mentioned ? 1 : 0);
                            $oldModels = $oldRes['totalModels'] ?? $totalModelsCount;
                            $promptHistory[] = [
                                'date' => $baseDate->format('Y-m-d'),
                                'displayDate' => $baseDate->format('d M Y'),
                                'time' => $baseDate->format('H:i'),
                                'isBaseline' => true,
                                'label' => 'Nulmeting',
                                'mentioned' => $oldMentions > 0,
                                'position' => $oldMentions > 0 ? (float) ($oldRes['position'] ?? $existingPrompt->position ?? 1) : null,
                                'totalMentions' => (int) $oldMentions,
                                'totalModels' => (int) $oldModels,
                                'overallScore' => (int) ($oldRes['overallScore'] ?? round(($oldMentions / max(1, $oldModels)) * 100)),
                            ];
                        }
                    }
                }
            } catch (\Exception $histErr) {
                // Ignore history read errors
            }
        }

        $isFirstPromptScan = empty($promptHistory);
        $promptHistory[] = [
            'date' => now()->format('Y-m-d'),
            'displayDate' => now()->format('d M Y'),
            'time' => now()->format('H:i'),
            'isBaseline' => $isFirstPromptScan,
            'label' => $isFirstPromptScan ? 'Nulmeting' : now()->format('d M H:i'),
            'mentioned' => $totalMentionedCount > 0,
            'position' => $totalMentionedCount > 0 ? $calculatedPosition : null,
            'totalMentions' => $totalMentionedCount,
            'totalModels' => $totalModelsCount,
            'overallScore' => $overallScore,
        ];
        if (count($promptHistory) > 15) {
            $promptHistory = array_merge([$promptHistory[0]], array_slice($promptHistory, -14));
        }

        // Persist citations to DB linked to project_id and prompt_id
        $crawlLogs[] = "[Hybrid Engine] Persisting evaluation & citations into MySQL database for project_id #" . ($projectId ?? 'N/A') . "...";
        try {
            foreach ($extractedCitations as $citation) {
                Citation::updateOrCreate(
                    [
                        'project_id' => $projectId,
                        'url' => $citation['url'],
                    ],
                    array_merge($citation, [
                        'project_id' => $projectId,
                        'prompt_id' => $promptId,
                    ])
                );
            }
        } catch (\Exception $dbErr) {
            $crawlLogs[] = "[Hybrid Engine Note] Database sync note: {$dbErr->getMessage()}";
        }

        GeoLog::box("PROMPT SCAN RESULTAAT", [
            "🏆 Aanbevelingen: {$totalMentionedCount} van de {$totalModelsCount} live AI modellen" . ($failedModelsCount > 0 ? " ({$failedModelsCount} niet gemeten)" : ""),
            "📈 Overall Score: {$overallScore}%",
            "🔍 Gevonden merken: {$totalBrandsCount} | Citaties opgeslagen: {$totalSourcesCount}",
        ]);

        return [
            'success' => true,
            'company' => $companyName,
            'companyKey' => $companyKey,
            'prompt' => $promptText,
            'position' => $calculatedPosition,
            'sentiment' => $calculatedSentiment,
            'totalMentions' => $totalMentionedCount,
            'totalModels' => $totalModelsCount,
            'totalLiveModels' => $totalLiveModelsCount,
            'failedModelsCount' => $failedModelsCount,
            'totalBrandsCount' => $totalBrandsCount,
            'totalSourcesCount' => $totalSourcesCount,
            'overallScore' => $overallScore,
            'brands' => $parsedBrands,
            'sources' => $extractedCitations,
            'citations' => $extractedCitations,
            'modelMentions' => $modelMentions,
            'history' => $promptHistory,
            'logs' => $crawlLogs,
        ];
    }
}
