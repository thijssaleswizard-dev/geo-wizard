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
        $authUser = $request->user();
        $userId = $authUser?->id ?? $request->query('userId');
        $dbUser = $authUser ?: ($userId ? \App\Models\User::find((int) $userId) : null);
        $role = strtolower(trim((string) ($dbUser?->role ?? $request->query('role') ?? '')));
        $allowedProjectIds = ($role === 'klant')
            ? ($dbUser ? ($dbUser->getAllowedProjectIds() ?? []) : [])
            : null;

        $project = null;
        $query = Keyword::query()->with('prompts')->orderBy('id', 'desc');

        if ($projectId) {
            $project = Project::find($projectId);
        } elseif ($company) {
            $decoded = trim(urldecode($company));
            $companyKey = \App\Services\AiEngineService::cleanBrandKey($decoded);

            $project = Project::whereRaw('LOWER(company) = ?', [strtolower($decoded)])
                ->orWhereRaw('LOWER(company) = ?', [strtolower("{$companyKey}.nl")])
                ->orWhereRaw('LOWER(company) = ?', [strtolower("{$companyKey}.com")])
                ->orWhereRaw('LOWER(company) = ?', [strtolower("{$companyKey}.eu")])
                ->orWhereRaw('LOWER(company) = ?', [strtolower($companyKey)])
                ->first();
        }

        // Strict tenant isolation: a 'klant' can ONLY ever access their own assigned project(s)
        if ($allowedProjectIds !== null) {
            if (empty($allowedProjectIds)) {
                return response()->json([
                    'success' => true,
                    'project' => null,
                    'totalUsedPrompts' => 0,
                    'keywords' => [],
                    'standalonePrompts' => [],
                ]);
            }
            if (!$project || !in_array((int) $project->id, $allowedProjectIds, true)) {
                $project = Project::find($allowedProjectIds[0]);
            }
            if (!$project) {
                return response()->json([
                    'success' => true,
                    'project' => null,
                    'totalUsedPrompts' => 0,
                    'keywords' => [],
                    'standalonePrompts' => [],
                ]);
            }
            $query->where('project_id', $project->id);
        } elseif ($project) {
            $query->where('project_id', $project->id);
        } elseif ($company) {
            $decoded = trim(urldecode($company));
            $companyKey = \App\Services\AiEngineService::cleanBrandKey($decoded);
            $cleanKey = strtolower(preg_replace('/[^a-z0-9]/', '', $companyKey));
            $query->where(function ($q) use ($companyKey, $cleanKey, $decoded) {
                $q->where('company_key', $companyKey)
                    ->orWhere('company_key', $cleanKey)
                    ->orWhere('company_key', strtolower($decoded));
            });
        }

        // Auto-recover stale prompts: active 'processing'/'crawling' > 10m, queued 'pending' > 30m
        Prompt::where(function ($q) {
            $q->where(function ($sq) {
                $sq->whereIn('status', ['processing', 'crawling'])
                    ->where('updated_at', '<', now()->subMinutes(10));
            })->orWhere(function ($sq) {
                $sq->where('status', 'pending')
                    ->where('updated_at', '<', now()->subMinutes(30));
            });
        })->update([
                    'status' => 'failed',
                    'logs' => ['[Timeout Herstel] Automatisch gemarkeerd als mislukt wegens overschrijding van maximale verwerkingstijd.'],
                    'updated_at' => now(),
                ]);

        $keywords = $query->get()->map(function ($k) {
            $kwText = $k->keyword;
            $prompts = $k->prompts ?? collect();

            $isCrawling = false;
            $hasPendingPrompts = $prompts->isNotEmpty() && $prompts->contains(fn($p) => in_array($p->status, ['pending', 'processing', 'crawling']));

            $competitors = is_array($k->competitors_json) ? $k->competitors_json : json_decode($k->competitors_json, true);
            if ((empty($competitors) || count($competitors) < 5) && !$hasPendingPrompts) {
                try {
                    $competitors = $this->competitorScraper->getOrScrapeCompetitors($k->id, $kwText, $k->company_key, true);
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

                $rawStatus = strtolower(trim((string) ($p->status ?: 'pending')));
                $isActivelyScanning = in_array($rawStatus, ['pending', 'processing', 'crawling'], true);
                $processingElapsedSec = (in_array($rawStatus, ['processing', 'crawling'], true) && $p->updated_at)
                    ? max(1, (int) abs(now()->diffInSeconds($p->updated_at)))
                    : 0;

                if ($isActivelyScanning) {
                    // Preserve active queue/crawl status even when previous scan results exist on the prompt
                    $status = $rawStatus === 'pending' ? 'pending' : 'processing';
                } elseif (!empty($resObj)) {
                    $status = $totalModels === 0 ? 'failed' : ($isMentioned ? 'Cited' : 'Not Cited');
                } else {
                    $status = $rawStatus ?: 'pending';
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
                    'processingElapsedSec' => $processingElapsedSec,
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
                }

                if ($selfIdx !== null) {
                    $competitorsArr[$selfIdx]['sov'] = $calculatedSov;
                    $competitorsArr[$selfIdx]['position'] = $calculatedPos;
                    if ($kwLiveMentions === 0) {
                        $competitorsArr[$selfIdx]['citations'] = 0;
                        $competitorsArr[$selfIdx]['rank'] = '-';
                    }
                }
            } else {
                $calculatedSov = $selfItem ? (int) ($selfItem['sov'] ?? 0) : 0;
                $calculatedPos = $selfItem ? ($selfItem['position'] ?? '-') : '-';
            }

            // Always sort competitors strictly by Share of Voice DESC (and Position ASC on tie) and re-assign #1..#N ranks
            // so the Brand Rankings table and the Keyword overview Rank column are 100% consistent.
            if (!empty($competitorsArr)) {
                usort($competitorsArr, function ($a, $b) {
                    $sovA = (int) ($a['sov'] ?? 0);
                    $sovB = (int) ($b['sov'] ?? 0);
                    if ($sovA !== $sovB) {
                        return $sovB <=> $sovA;
                    }
                    $posA = is_numeric($a['position'] ?? null) ? (float) $a['position'] : 999.0;
                    $posB = is_numeric($b['position'] ?? null) ? (float) $b['position'] : 999.0;
                    if (abs($posA - $posB) > 0.01) {
                        return $posA <=> $posB;
                    }
                    return ((int) ($b['citations'] ?? 0)) <=> ((int) ($a['citations'] ?? 0));
                });

                $rankCounter = 0;
                $selfItem = null;
                foreach ($competitorsArr as &$cEntry) {
                    if (((int) ($cEntry['sov'] ?? 0)) <= 0) {
                        $cEntry['rank'] = '-';
                        $cEntry['position'] = '-';
                        $cEntry['sov'] = 0;
                    } else {
                        $rankCounter++;
                        $cEntry['rank'] = '#' . $rankCounter;
                    }
                    if (!empty($cEntry['isSelf'])) {
                        $selfItem = $cEntry;
                    }
                }
                unset($cEntry);
            }

            if ($kwLiveModelChecks > 0 && $kwLiveMentions === 0) {
                $rankStr = '-';
            } else {
                $rawRank = $selfItem ? ($selfItem['rank'] ?? '-') : ($k->rank ? "#{$k->rank}" : '-');
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

        //Also load standalone prompts (prompts directly linked to the project without a keyword_id)
        $standalonePrompts = collect();
        if ($project) {
            $standalonePrompts = Prompt::where('project_id', $project->id)
                ->whereNull('keyword_id')
                ->orderBy('id', 'desc')
                ->get()
                ->map(function ($p) {
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

                    $rawStatus = strtolower(trim((string) ($p->status ?: 'pending')));
                    $isActivelyScanning = in_array($rawStatus, ['pending', 'processing', 'crawling'], true);
                    $processingElapsedSec = (in_array($rawStatus, ['processing', 'crawling'], true) && $p->updated_at)
                        ? max(1, (int) abs(now()->diffInSeconds($p->updated_at)))
                        : 0;

                    if ($isActivelyScanning) {
                        $status = $rawStatus === 'pending' ? 'pending' : 'processing';
                    } elseif (!empty($resObj)) {
                        $status = $totalModels === 0 ? 'failed' : ($isMentioned ? 'Cited' : 'Not Cited');
                    } else {
                        $status = $rawStatus ?: 'pending';
                    }

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
                        'keyword_id' => null,
                        'keyword_text' => null,
                        'text' => $p->prompt_text,
                        'status' => $status,
                        'processingElapsedSec' => $processingElapsedSec,
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
        }

        $totalPromptsCount = $keywords
            ->filter(fn($k) => empty($k['is_archived']))
            ->sum(fn($k) => count($k['prompts'] ?? [])) + $standalonePrompts->count();

        if ($project) {
            if ((int) $project->prompts_count !== (int) $totalPromptsCount) {
                $project->update(['prompts_count' => (int) $totalPromptsCount]);
            }
        }

        return response()->json([
            'success' => true,
            'keywords' => $keywords,
            'standalonePrompts' => $standalonePrompts->values(),
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

    protected function isStaffOrAdmin(Request $request): bool
    {
        $user = $request->user() ?? auth()->user();
        $role = $user?->role;
        $userId = $user?->id ?? $request->input('userId') ?? $request->query('userId');

        if ($userId && !$role) {
            $dbUser = \App\Models\User::find($userId);
            if ($dbUser) {
                $role = $dbUser->role;
            }
        }
        if (!$role) {
            $role = $request->input('role') ?? $request->query('role');
        }

        if ($role === 'klant') {
            return false;
        }

        // If role is explicitly provided, require admin or medewerker; if stateless internal staff call, allow
        if ($role) {
            return in_array(strtolower((string) $role), ['admin', 'medewerker'], true);
        }

        return true;
    }

    protected function recalculateProjectPromptCount(?int $projectId): int
    {
        if (!$projectId) {
            return 0;
        }

        $activeKeywordIds = Keyword::where('project_id', $projectId)
            ->where(function ($q) {
                $q->where('is_archived', false)->orWhereNull('is_archived');
            })
            ->pluck('id');

        // Delete any orphaned prompts whose keyword was deleted
        $allProjectKeywordIds = Keyword::where('project_id', $projectId)->pluck('id');
        Prompt::where('project_id', $projectId)
            ->whereNotNull('keyword_id')
            ->whereNotIn('keyword_id', $allProjectKeywordIds)
            ->delete();

        $activeCount = Prompt::where('project_id', $projectId)
            ->where(function ($q) use ($activeKeywordIds) {
                $q->whereIn('keyword_id', $activeKeywordIds)
                    ->orWhereNull('keyword_id');
            })
            ->count();

        Project::where('id', $projectId)->update(['prompts_count' => $activeCount]);

        return $activeCount;
    }

    /**
     * Archive a keyword.
     */
    public function archive(Request $request, int $id): JsonResponse
    {
        if (!$this->isStaffOrAdmin($request)) {
            return response()->json(['error' => 'Alleen admins en Saleswizard medewerkers mogen zoekwoorden archiveren.'], 403);
        }

        $kw = Keyword::find($id);
        if (!$kw) {
            return response()->json(['error' => 'Keyword niet gevonden.'], 404);
        }

        $kw->update(['is_archived' => true]);
        $newTotal = $this->recalculateProjectPromptCount($kw->project_id);

        return response()->json([
            'success' => true,
            'message' => "Keyword \"{$kw->keyword}\" is succesvol gearchiveerd.",
            'keyword_id' => $id,
            'totalUsedPrompts' => $newTotal,
        ]);
    }

    /**
     * Restore an archived keyword back to active status.
     */
    public function restore(Request $request, int $id): JsonResponse
    {
        if (!$this->isStaffOrAdmin($request)) {
            return response()->json(['error' => 'Alleen admins en Saleswizard medewerkers mogen zoekwoorden herstellen.'], 403);
        }

        $kw = Keyword::find($id);
        if (!$kw) {
            return response()->json(['error' => 'Keyword niet gevonden.'], 404);
        }

        $kw->update(['is_archived' => false]);
        $newTotal = $this->recalculateProjectPromptCount($kw->project_id);

        return response()->json([
            'success' => true,
            'message' => "Keyword \"{$kw->keyword}\" is succesvol hersteld.",
            'keyword_id' => $id,
            'totalUsedPrompts' => $newTotal,
        ]);
    }

    /**
     * Archive or permanently delete a keyword and its prompts (resetting the prompt limit).
     * Only permitted for admin and Saleswizard medewerkers.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        if (!$this->isStaffOrAdmin($request)) {
            return response()->json(['error' => 'Alleen admins en Saleswizard medewerkers mogen zoekwoorden en prompts verwijderen.'], 403);
        }

        $kw = Keyword::find($id);
        if (!$kw) {
            return response()->json(['error' => 'Keyword niet gevonden.'], 404);
        }

        $keywordText = $kw->keyword;
        $projectId = $kw->project_id;
        $isForce = $request->has('force') ? $request->boolean('force') : true;

        if ($isForce) {
            $promptIds = Prompt::where('keyword_id', $kw->id)->pluck('id');
            if ($promptIds->isNotEmpty()) {
                \App\Models\Citation::whereIn('prompt_id', $promptIds)->delete();
                Prompt::whereIn('id', $promptIds)->delete();
            }
            $kw->delete();
            $newTotal = $this->recalculateProjectPromptCount($projectId);

            return response()->json([
                'success' => true,
                'message' => "Keyword \"{$keywordText}\" en alle bijbehorende prompts zijn definitief verwijderd. De promptlimiet is bijgewerkt.",
                'is_deleted' => true,
                'totalUsedPrompts' => $newTotal,
            ]);
        }

        $kw->update(['is_archived' => true]);
        $newTotal = $this->recalculateProjectPromptCount($projectId);

        return response()->json([
            'success' => true,
            'message' => "Keyword \"{$keywordText}\" is gearchiveerd.",
            'is_archived' => true,
            'totalUsedPrompts' => $newTotal,
        ]);
    }

    /**
     * Bulk archive or permanently delete keywords (resetting prompt limit).
     * Only permitted for admin and Saleswizard medewerkers.
     */
    public function bulkDelete(Request $request): JsonResponse
    {
        if (!$this->isStaffOrAdmin($request)) {
            return response()->json(['error' => 'Alleen admins en Saleswizard medewerkers mogen zoekwoorden en prompts verwijderen.'], 403);
        }

        $ids = $request->input('ids', []);
        if (!is_array($ids) || empty($ids)) {
            return response()->json(['success' => true, 'message' => 'Geen actie vereist.']);
        }

        $count = count($ids);
        $isForce = $request->boolean('force');
        $firstKw = Keyword::whereIn('id', $ids)->first();
        $projectId = $firstKw?->project_id;

        if ($isForce) {
            $promptIds = Prompt::whereIn('keyword_id', $ids)->pluck('id');
            if ($promptIds->isNotEmpty()) {
                \App\Models\Citation::whereIn('prompt_id', $promptIds)->delete();
                Prompt::whereIn('id', $promptIds)->delete();
            }
            Keyword::whereIn('id', $ids)->delete();
            $newTotal = $this->recalculateProjectPromptCount($projectId);

            return response()->json([
                'success' => true,
                'is_deleted' => true,
                'totalUsedPrompts' => $newTotal,
                'message' => "{$count} keywords en bijbehorende prompts zijn definitief verwijderd. De promptlimiet is vrijgegeven.",
            ]);
        }

        Keyword::whereIn('id', $ids)->update(['is_archived' => true]);
        $newTotal = $this->recalculateProjectPromptCount($projectId);

        return response()->json([
            'success' => true,
            'is_archived' => true,
            'totalUsedPrompts' => $newTotal,
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
