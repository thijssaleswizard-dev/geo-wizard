<?php

namespace App\Http\Controllers;

use App\Models\Keyword;
use App\Models\Project;
use App\Models\Prompt;
use App\Services\CompetitorScraperService;
use App\Services\WebsiteCrawlerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class KeywordController extends Controller
{
    protected WebsiteCrawlerService $websiteCrawler;
    protected CompetitorScraperService $competitorScraper;

    public function __construct(WebsiteCrawlerService $websiteCrawler, CompetitorScraperService $competitorScraper)
    {
        $this->websiteCrawler = $websiteCrawler;
        $this->competitorScraper = $competitorScraper;
    }

    public function index(Request $request): JsonResponse
    {
        $company = $request->query('company');
        $projectId = $request->query('project_id');
        $project = null;

        $query = Keyword::query()->with('prompts')->orderBy('id', 'desc');

        if ($projectId) {
            $project = Project::find($projectId);
            $query->where('project_id', $projectId);
        } elseif ($company) {
            $decoded = trim(urldecode($company));
            $companyKey = \App\Services\AiEngineService::cleanBrandKey($decoded);
            $cleanKey = strtolower(preg_replace('/[^a-z0-9]/', '', $companyKey));

            $project = Project::whereRaw('LOWER(company) = ?', [strtolower($decoded)])
                ->orWhereRaw('LOWER(company) = ?', [strtolower("{$companyKey}.nl")])
                ->orWhereRaw('LOWER(company) = ?', [strtolower("{$companyKey}.com")])
                ->orWhereRaw('LOWER(company) = ?', [strtolower("{$companyKey}.eu")])
                ->orWhereRaw('LOWER(company) = ?', [strtolower($companyKey)])
                ->first();

            if ($project) {
                $query->where('project_id', $project->id);
            } else {
                $query->where(function ($q) use ($companyKey, $cleanKey, $decoded) {
                    $q->where('company_key', $companyKey)
                      ->orWhere('company_key', $cleanKey)
                      ->orWhere('company_key', strtolower($decoded));
                });
            }
        }

        // Auto-recover stale prompts that timed out or got interrupted (> 5 minutes)
        Prompt::whereIn('status', ['pending', 'processing', 'crawling'])
            ->where('updated_at', '<', now()->subMinutes(5))
            ->update([
                'status' => 'failed',
                'logs' => ['[Timeout Herstel] Automatisch gemarkeerd als mislukt na 5 minuten inactiviteit.'],
                'updated_at' => now(),
            ]);

        $keywords = $query->get()->map(function ($k) {
            $kwText = $k->keyword;
            $prompts = $k->prompts ?? collect();

            $isCrawling = false;
            $hasPendingPrompts = $prompts->isNotEmpty() && $prompts->contains(fn($p) => in_array($p->status, ['pending', 'processing', 'crawling']));

            $competitors = is_array($k->competitors_json) ? $k->competitors_json : json_decode($k->competitors_json, true);
            if ((empty($competitors) || count($competitors) < 3) && !$hasPendingPrompts) {
                try {
                    $competitors = $this->competitorScraper->getOrScrapeCompetitors($k->id, $kwText, $k->company_key);
                } catch (\Throwable $e) {
                    \Illuminate\Support\Facades\Log::warning("[Keyword Index Competitor Warning] {$e->getMessage()}");
                    $cleanComp = \App\Services\AiEngineService::cleanBrandKey($k->company_key);
                    $compDom = str_contains($k->company_key ?? '', '.') ? $k->company_key : "{$cleanComp}.nl";
                    $competitors = [
                        [
                            'brand' => ucwords(str_replace(['-', '_'], ' ', $cleanComp)),
                            'domain' => $compDom,
                            'isSelf' => true,
                            'rank' => '-',
                            'position' => '-',
                            'sov' => 0,
                            'citations' => 0,
                            'citationUrls' => [],
                        ]
                    ];
                }
            }

            // First sanitize and compute strictly LIVE (non-simulated, non-failed) metrics for all prompts of this keyword
            $kwLiveModelChecks = 0;
            $kwLiveMentions = 0;
            $kwLivePositions = [];

            $mappedPrompts = $prompts->map(function ($p) use (&$kwLiveModelChecks, &$kwLiveMentions, &$kwLivePositions) {
                $resObj = !empty($p->results) ? (is_array($p->results) ? $p->results : json_decode($p->results, true)) : null;
                $liveMetrics = \App\Services\AiEngineService::extractLivePromptMetrics($resObj);
                $modelMentions = $liveMetrics['modelMentions'];
                $citations = $resObj['citations'] ?? ($resObj['sources'] ?? null);

                $totalMentions = $liveMetrics['totalMentions'];
                $totalModels = $liveMetrics['totalModels'];
                $isMentioned = $liveMetrics['mentioned'];
                $overallScore = $liveMetrics['overallScore'];
                $promptPosition = $liveMetrics['position'];
                $engines = $liveMetrics['engines'];

                if ($liveMetrics['hasLiveData']) {
                    $kwLiveModelChecks += $liveMetrics['liveModelsCount'];
                    $kwLiveMentions += $totalMentions;
                    if ($promptPosition !== null) {
                        $kwLivePositions[] = (float) $promptPosition;
                    }
                }

                $status = $p->status ?: 'pending';
                if (!empty($resObj)) {
                    if ($totalModels === 0) {
                        $status = 'failed';
                    } else {
                        $status = $isMentioned ? 'Cited' : 'Not Cited';
                    }
                }

                // Prompt History (Nulmeting + subsequent scans)
                $pHistory = ($resObj && !empty($resObj['history']) && is_array($resObj['history'])) ? $resObj['history'] : [];
                if (empty($pHistory) && !empty($resObj) && $totalModels > 0) {
                    $pCreated = $p->created_at ?: now();
                    $pHistory[] = [
                        'date' => $pCreated->format('Y-m-d'),
                        'displayDate' => $pCreated->format('d M Y'),
                        'time' => $pCreated->format('H:i'),
                        'isBaseline' => true,
                        'label' => 'Nulmeting',
                        'mentioned' => $isMentioned,
                        'position' => $isMentioned ? (float) ($promptPosition ?: 1) : null,
                        'totalMentions' => (int) $totalMentions,
                        'totalModels' => (int) $totalModels,
                        'overallScore' => (int) $overallScore,
                    ];
                }

                $summaryText = $totalModels > 0
                    ? "Aanbevolen door {$totalMentions} van de {$totalModels} live AI-modellen" . ($liveMetrics['failedModelsCount'] > 0 ? " ({$liveMetrics['failedModelsCount']} niet gemeten)" : "") . "."
                    : (!empty($resObj) ? 'Geen live AI-modellen beschikbaar tijdens deze scan.' : ($p->response_summary ?? ''));

                return [
                    'id' => $p->id,
                    'project_id' => $p->project_id,
                    'keyword_id' => $p->keyword_id,
                    'text' => $p->prompt_text,
                    'status' => $status,
                    'mentioned' => $isMentioned,
                    'position' => $promptPosition,
                    'totalMentions' => $totalMentions,
                    'totalModels' => $totalModels,
                    'failedModelsCount' => $liveMetrics['failedModelsCount'],
                    'overallScore' => $overallScore,
                    'engines' => $engines,
                    'brandsCount' => $totalModels > 0 ? ($resObj['totalBrandsCount'] ?? ($isMentioned ? 1 : 0)) : 0,
                    'sourcesCount' => $totalModels > 0 ? ($resObj['totalSourcesCount'] ?? ($citations ? count($citations) : 0)) : 0,
                    'modelMentions' => $modelMentions,
                    'citations' => $citations,
                    'responseSummary' => $summaryText,
                    'history' => $pHistory,
                    'baseline' => $pHistory[0] ?? null,
                    'lastUpdated' => ($p->updated_at ?: ($p->created_at ?: now()))->format('d M Y H:i'),
                ];
            });

            // Reconcile keyword Share of Voice, Position, and Rank strictly with live (non-simulated) AI mentions
            $competitorsArr = is_array($competitors) ? $competitors : [];
            $selfIdx = null;
            foreach ($competitorsArr as $cIdx => $cItem) {
                if (!empty($cItem['isSelf'])) {
                    $selfIdx = $cIdx;
                    break;
                }
            }
            $selfItem = $selfIdx !== null ? $competitorsArr[$selfIdx] : null;

            if ($kwLiveModelChecks > 0) {
                $calculatedSov = (int) round(($kwLiveMentions / $kwLiveModelChecks) * 100);
                if ($kwLiveMentions === 0) {
                    $calculatedPos = '-';
                    $rankStr = '-';
                } else {
                    $calculatedPos = !empty($kwLivePositions)
                        ? number_format(array_sum($kwLivePositions) / count($kwLivePositions), 1)
                        : ($selfItem['position'] ?? '1.0');
                    $rawRank = $selfItem['rank'] ?? ($k->rank ? "#{$k->rank}" : '#1');
                    $rankStr = ($rawRank === '-' || empty($rawRank)) ? '#1' : (str_starts_with((string) $rawRank, '#') ? (string) $rawRank : '#' . $rawRank);
                }

                if ($selfIdx !== null) {
                    $competitorsArr[$selfIdx]['sov'] = $calculatedSov;
                    $competitorsArr[$selfIdx]['position'] = $calculatedPos;
                    $competitorsArr[$selfIdx]['rank'] = $rankStr;
                    if ($kwLiveMentions === 0) {
                        $competitorsArr[$selfIdx]['citations'] = 0;
                    }
                    $selfItem = $competitorsArr[$selfIdx];
                }
            } else {
                $calculatedSov = $selfItem ? (int) ($selfItem['sov'] ?? 0) : 0;
                $calculatedPos = $selfItem ? ($selfItem['position'] ?? '-') : '-';
                $rawRank = $selfItem ? ($selfItem['rank'] ?? ($k->rank ? "#{$k->rank}" : '-')) : ($k->rank ? "#{$k->rank}" : '-');
                $rankStr = ($rawRank === '-' || empty($rawRank)) ? '-' : (str_starts_with((string) $rawRank, '#') ? (string) $rawRank : '#' . $rawRank);
            }
            $rankDigits = preg_replace('/[^0-9]/', '', (string) $rankStr);
            $rankNum = $rankDigits !== '' ? (int) $rankDigits : null;

            // Keyword Position & SoV History (Nulmeting + subsequent scans)
            $kwHistory = ($selfItem && !empty($selfItem['history']) && is_array($selfItem['history'])) ? $selfItem['history'] : [];
            if (empty($kwHistory) && $calculatedPos !== '-' && $rankNum !== null) {
                $createdDate = $k->created_at ?: now();
                $kwHistory[] = [
                    'date' => $createdDate->format('Y-m-d'),
                    'displayDate' => $createdDate->format('d M Y'),
                    'time' => $createdDate->format('H:i'),
                    'isBaseline' => true,
                    'label' => 'Nulmeting',
                    'rank' => $rankNum,
                    'position' => (float) $calculatedPos,
                    'sov' => (int) $calculatedSov,
                    'citations' => (int) ($selfItem['citations'] ?? $k->citations_count ?? 0),
                ];
            }

            $lastUpdated = ($k->updated_at ?: ($k->created_at ?: now()))->format('d M Y H:i');

            return [
                'id' => $k->id,
                'project_id' => $k->project_id,
                'company_key' => $k->company_key,
                'keyword' => $k->keyword,
                'keyword_text' => $kwText,
                'rank' => $rankStr,
                'search_engine' => $k->search_engine,
                'sentiment' => $kwLiveMentions > 0 ? ($k->sentiment ?: '+90') : 'N/A',
                'citations_count' => $k->citations_count,
                'monthly_searches' => $k->monthly_searches ?: 100,
                'share_of_voice' => $calculatedSov,
                'average_position' => $calculatedPos,
                'is_crawling' => $isCrawling || $hasPendingPrompts,
                'is_archived' => (bool) ($k->is_archived ?? false),
                'last_updated' => $lastUpdated,
                'history' => $kwHistory,
                'baseline' => $kwHistory[0] ?? null,
                'competitors' => $hasPendingPrompts && empty($k->competitors_json) ? [] : $competitorsArr,
                'brands_mentioned' => implode(',', array_map(fn($c) => explode('.', $c['domain'] ?? '')[0], $competitorsArr)),
                'prompts' => $mappedPrompts,
            ];
        });

        $totalPromptsCount = $keywords->sum(fn($k) => count($k['prompts'] ?? []));

        return response()->json([
            'success' => true,
            'keywords' => $keywords,
            'totalUsedPrompts' => $totalPromptsCount,
            'project' => $project ? [
                'id' => $project->id,
                'company' => $project->company,
                'subscription' => $project->subscription ?: 'AI Pro',
                'promptsLimit' => Project::getPromptLimit($project->subscription),
            ] : null,
        ]);
    }

    public function recommend(Request $request): JsonResponse
    {
        $company = trim($request->input('company', 'Saleswizard'));
        $projectId = $request->input('project_id');
        if (empty($company)) {
            return response()->json(['error' => 'Geef een geldige bedrijfsnaam of website URL op.'], 400);
        }

        if (!$projectId) {
            $companyKey = \App\Services\AiEngineService::cleanBrandKey($company);
            $proj = Project::whereRaw('LOWER(company) = ?', [strtolower($company)])
                ->orWhereRaw('LOWER(company) = ?', [strtolower("{$companyKey}.nl")])
                ->orWhereRaw('LOWER(company) = ?', [strtolower("{$companyKey}.com")])
                ->orWhereRaw('LOWER(company) = ?', [strtolower("{$companyKey}.eu")])
                ->orWhereRaw('LOWER(company) = ?', [strtolower($companyKey)])
                ->first();
            $projectId = $proj?->id;
        }

        $keywords = $this->websiteCrawler->generateKeywords($company, $company, $projectId ? (int) $projectId : null);

        return response()->json([
            'success' => true,
            'company' => $company,
            'keywords' => $keywords,
            'formatted' => implode(', ', $keywords),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $company = $request->input('company', 'saleswizard');
        $projectId = $request->input('project_id');
        $keyword = trim($request->input('keyword', ''));
        $volume = $request->input('volume', 100);

        if (empty($keyword)) {
            return response()->json(['error' => 'Keyword is verplicht.'], 400);
        }

        $decoded = trim(urldecode($company));
        $companyKey = \App\Services\AiEngineService::cleanBrandKey($decoded);

        $project = $projectId ? Project::find($projectId) : Project::whereRaw('LOWER(company) = ?', [strtolower($decoded)])
            ->orWhereRaw('LOWER(company) = ?', [strtolower("{$companyKey}.nl")])
            ->orWhereRaw('LOWER(company) = ?', [strtolower("{$companyKey}.com")])
            ->orWhereRaw('LOWER(company) = ?', [strtolower("{$companyKey}.eu")])
            ->orWhereRaw('LOWER(company) = ?', [strtolower($companyKey)])
            ->first();

        $kw = Keyword::create([
            'project_id' => $project ? $project->id : null,
            'company_key' => $companyKey,
            'keyword' => strtolower($keyword),
            'rank' => null,
            'search_engine' => 'ChatGPT',
            'sentiment' => 'N/A',
            'citations_count' => 0,
            'monthly_searches' => (int) $volume,
            'competitors_json' => null,
            'brands_mentioned' => [$companyKey],
        ]);

        $competitors = [];
        try {
            $competitors = $this->competitorScraper->getOrScrapeCompetitors($kw->id, $kw->keyword, $companyKey);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error("[Keyword Store Competitor Scrape Error] {$e->getMessage()}");
            $compDom = str_contains($decoded, '.') ? $decoded : "{$companyKey}.nl";
            $competitors = [
                [
                    'brand' => ucwords(str_replace(['-', '_'], ' ', $companyKey)),
                    'domain' => $compDom,
                    'isSelf' => true,
                    'rank' => '-',
                    'position' => '-',
                    'sov' => 0,
                    'citations' => 0,
                    'citationUrls' => [],
                ]
            ];
            $kw->update(['competitors_json' => $competitors]);
        }
        $selfItem = collect($competitors)->firstWhere('isSelf', true) ?? ($competitors[0] ?? null);
        $sov = $selfItem ? (int) ($selfItem['sov'] ?? 0) : 0;
        $pos = $selfItem ? ($selfItem['position'] ?? '-') : '-';
        $rankStr = $selfItem ? ($selfItem['rank'] ?? '-') : '-';

        return response()->json([
            'success' => true,
            'keyword' => [
                'id' => $kw->id,
                'project_id' => $kw->project_id,
                'company_key' => $kw->company_key,
                'keyword' => $kw->keyword,
                'keyword_text' => $kw->keyword,
                'rank' => $rankStr,
                'search_engine' => $kw->search_engine,
                'sentiment' => $kw->sentiment,
                'citations_count' => $kw->citations_count,
                'monthly_searches' => $kw->monthly_searches,
                'share_of_voice' => $sov,
                'average_position' => $pos,
                'is_crawling' => true,
                'competitors' => $competitors,
                'brands_mentioned' => $kw->brands_mentioned,
            ]
        ], 201);
    }

    /**
     * Archive a keyword (prompts and historical data remain safely preserved).
     */
    public function archive(int $id): JsonResponse
    {
        $kw = Keyword::find($id);
        if (!$kw) {
            return response()->json(['error' => 'Keyword niet gevonden.'], 404);
        }

        $kw->update(['is_archived' => true]);

        return response()->json([
            'success' => true,
            'message' => "Keyword \"{$kw->keyword}\" is succesvol gearchiveerd. De prompts blijven bewaard.",
            'keyword_id' => $id,
        ]);
    }

    /**
     * Restore an archived keyword back to active status.
     */
    public function restore(int $id): JsonResponse
    {
        $kw = Keyword::find($id);
        if (!$kw) {
            return response()->json(['error' => 'Keyword niet gevonden.'], 404);
        }

        $kw->update(['is_archived' => false]);

        return response()->json([
            'success' => true,
            'message' => "Keyword \"{$kw->keyword}\" is succesvol hersteld.",
            'keyword_id' => $id,
        ]);
    }

    /**
     * Archive or delete a keyword.
     * Standard requests and clients archive the keyword so prompt quotas cannot be bypassed.
     * Hard-delete is only permitted if force=true is passed by an administrator (medewerker).
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $kw = Keyword::find($id);
        if (!$kw) {
            return response()->json(['error' => 'Keyword niet gevonden.'], 404);
        }

        $keywordText = $kw->keyword;
        $isForce = $request->boolean('force');
        $userRole = auth()->user()?->role;

        if ($isForce && $userRole === 'medewerker') {
            $kw->delete();
            return response()->json([
                'success' => true,
                'message' => "Keyword \"{$keywordText}\" en alle bijbehorende data zijn definitief verwijderd.",
                'is_deleted' => true,
            ]);
        }

        $kw->update(['is_archived' => true]);

        return response()->json([
            'success' => true,
            'message' => "Keyword \"{$keywordText}\" is gearchiveerd. De prompts blijven bewaard om limieten te waarborgen.",
            'is_archived' => true,
        ]);
    }

    /**
     * Bulk archive keywords (or delete if forced by admin).
     */
    public function bulkDelete(Request $request): JsonResponse
    {
        $ids = $request->input('ids', []);
        if (!is_array($ids) || empty($ids)) {
            return response()->json(['success' => true, 'message' => 'Geen actie vereist.']);
        }

        $count = count($ids);
        $isForce = $request->boolean('force');
        $userRole = auth()->user()?->role;

        if ($isForce && $userRole === 'medewerker') {
            Keyword::whereIn('id', $ids)->delete();
            return response()->json([
                'success' => true,
                'message' => "{$count} keywords zijn definitief verwijderd via database cascade.",
            ]);
        }

        Keyword::whereIn('id', $ids)->update(['is_archived' => true]);

        return response()->json([
            'success' => true,
            'message' => "{$count} keywords zijn succesvol gearchiveerd.",
        ]);
    }

    /**
     * Re-scrape competitors and re-run all AI prompt checks for a keyword.
     */
    public function rescrape(int $id): JsonResponse
    {
        $kw = Keyword::with('prompts')->find($id);
        if (!$kw) {
            return response()->json(['error' => 'Keyword niet gevonden.'], 404);
        }

        \App\Services\GeoLog::info("🔄 [KEYWORD RESCRAPE] Handmatige rescrape gestart voor Keyword #{$id}: \"{$kw->keyword}\"");

        // 1. Live scrape competitors with force = true
        $competitors = $this->competitorScraper->getOrScrapeCompetitors($kw->id, $kw->keyword, $kw->company_key, true);

        $selfItem = collect($competitors)->firstWhere('isSelf', true) ?? ($competitors[0] ?? null);
        $calculatedSov = $selfItem ? ($selfItem['sov'] ?? 0) : 0;
        $calculatedPos = $selfItem ? ($selfItem['position'] ?? '-') : '-';
        $rankStr = $selfItem ? ($selfItem['rank'] ?? '-') : '-';
        $rankDigits = preg_replace('/[^0-9]/', '', (string) $rankStr);
        $rankInt = $rankDigits !== '' ? (int) $rankDigits : null;

        $kw->update([
            'rank' => $rankInt,
            'updated_at' => now(),
        ]);

        // 2. Trigger fresh scans for all associated prompts
        $prompts = $kw->prompts ?? collect();
        foreach ($prompts as $prompt) {
            $prompt->update([
                'status' => 'pending',
                'updated_at' => now(),
            ]);
            \App\Jobs\ProcessPromptJob::dispatch($prompt->id);
        }

        return response()->json([
            'success' => true,
            'message' => "Keyword \"{$kw->keyword}\" rankings en " . count($prompts) . " prompts worden opnieuw gescand.",
            'keyword' => [
                'id' => $kw->id,
                'share_of_voice' => $calculatedSov,
                'average_position' => $calculatedPos,
                'rank' => $rankInt !== null ? '#' . $rankInt : '-',
                'competitors' => $competitors,
                'history' => $selfItem['history'] ?? [],
                'baseline' => ($selfItem['history'][0] ?? null),
                'last_updated' => now()->format('d M Y H:i'),
                'is_crawling' => count($prompts) > 0,
            ]
        ]);
    }

    /**
     * Bulk re-scrape multiple keywords.
     */
    public function bulkRescrape(Request $request): JsonResponse
    {
        $ids = $request->input('ids', []);
        if (!is_array($ids) || empty($ids)) {
            return response()->json(['error' => 'Geen keyword IDs opgegeven.'], 400);
        }

        $count = 0;
        foreach ($ids as $id) {
            $kw = Keyword::with('prompts')->find($id);
            if ($kw) {
                $count++;
                $this->competitorScraper->getOrScrapeCompetitors($kw->id, $kw->keyword, $kw->company_key, true);
                foreach ($kw->prompts as $prompt) {
                    $prompt->update(['status' => 'pending']);
                    \App\Jobs\ProcessPromptJob::dispatch($prompt->id);
                }
            }
        }

        return response()->json([
            'success' => true,
            'message' => "{$count} keywords en bijbehorende prompts worden opnieuw gescand."
        ]);
    }
}
