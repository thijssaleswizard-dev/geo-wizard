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

        $query = Keyword::query()->with('prompts')->orderBy('id', 'desc');

        if ($projectId) {
            $query->where('project_id', $projectId);
        } elseif ($company) {
            $decoded = trim(urldecode($company));
            $companyKey = strtolower(trim(str_replace('.nl', '', $decoded)));
            $cleanKey = strtolower(preg_replace('/[^a-z0-9]/', '', $companyKey));

            $project = Project::whereRaw('LOWER(company) = ?', [strtolower($decoded)])
                ->orWhereRaw('LOWER(company) = ?', [strtolower("{$decoded}.nl")])
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

        $keywords = $query->get()->map(function ($k) {
            $kwText = $k->keyword;
            $prompts = $k->prompts ?? collect();

            $isCrawling = false;
            $hasPendingPrompts = $prompts->isEmpty() || $prompts->contains(fn($p) => in_array($p->status, ['pending', 'processing', 'crawling']));

            $competitors = is_array($k->competitors_json) ? $k->competitors_json : json_decode($k->competitors_json, true);
            if ((empty($competitors) || count($competitors) < 3) && !$hasPendingPrompts) {
                $isCrawling = true;
                $competitors = $this->competitorScraper->getOrScrapeCompetitors($k->id, $kwText, $k->company_key);
            }

            $selfItem = collect($competitors)->firstWhere('isSelf', true) ?? ($competitors[0] ?? null);
            $calculatedSov = $selfItem ? ($selfItem['sov'] ?? 0) : 0;
            $calculatedPos = $selfItem ? ($selfItem['position'] ?? '-') : '-';

            return [
                'id' => $k->id,
                'project_id' => $k->project_id,
                'company_key' => $k->company_key,
                'keyword' => $k->keyword,
                'keyword_text' => $kwText,
                'rank' => $k->rank ?: '#1',
                'search_engine' => $k->search_engine,
                'sentiment' => $k->sentiment ?: 'N/A',
                'citations_count' => $k->citations_count,
                'monthly_searches' => $k->monthly_searches ?: 100,
                'share_of_voice' => $calculatedSov,
                'average_position' => $calculatedPos,
                'is_crawling' => $isCrawling || $hasPendingPrompts,
                'competitors' => $hasPendingPrompts && empty($k->competitors_json) ? [] : ($competitors ?: []),
                'brands_mentioned' => implode(',', array_map(fn($c) => explode('.', $c['domain'] ?? '')[0], $competitors ?: [])),
                'prompts' => $prompts->map(function ($p) {
                    $resObj = !empty($p->results) ? (is_array($p->results) ? $p->results : json_decode($p->results, true)) : null;
                    $modelMentions = $resObj['modelMentions'] ?? null;
                    $citations = $resObj['citations'] ?? ($resObj['sources'] ?? null);

                    $engines = ['chatgpt', 'gemini', 'perplexity'];
                    if ($modelMentions) {
                        $engines = array_values(array_filter(array_keys($modelMentions), fn($m) => $modelMentions[$m]['mentioned'] ?? false));
                    }

                    $status = $p->status ?: 'pending';
                    if (!empty($p->results)) {
                        $status = $p->brand_mentioned ? 'Cited' : 'Not Cited';
                    }

                    return [
                        'id' => $p->id,
                        'project_id' => $p->project_id,
                        'keyword_id' => $p->keyword_id,
                        'text' => $p->prompt_text,
                        'status' => $status,
                        'engines' => $engines,
                        'brandsCount' => $resObj['totalBrandsCount'] ?? ($p->brand_mentioned ? 1 : 0),
                        'sourcesCount' => $resObj['totalSourcesCount'] ?? ($citations ? count($citations) : 0),
                        'modelMentions' => $modelMentions,
                        'citations' => $citations,
                        'responseSummary' => $p->response_summary ?? '',
                    ];
                }),
            ];
        });

        return response()->json(['success' => true, 'keywords' => $keywords]);
    }

    public function recommend(Request $request): JsonResponse
    {
        $company = trim($request->input('company', 'Saleswizard'));
        if (empty($company)) {
            return response()->json(['error' => 'Geef een geldige bedrijfsnaam of website URL op.'], 400);
        }

        $keywords = $this->websiteCrawler->generateKeywords($company, $company);

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
        $companyKey = strtolower(trim(str_replace('.nl', '', $decoded)));

        $project = $projectId ? Project::find($projectId) : Project::whereRaw('LOWER(company) = ?', [strtolower($decoded)])
            ->orWhereRaw('LOWER(company) = ?', [strtolower("{$decoded}.nl")])
            ->orWhereRaw('LOWER(company) = ?', [strtolower($companyKey)])
            ->first();

        $kw = Keyword::create([
            'project_id' => $project ? $project->id : null,
            'company_key' => $companyKey,
            'keyword' => strtolower($keyword),
            'rank' => 1,
            'search_engine' => 'ChatGPT',
            'sentiment' => 'N/A',
            'citations_count' => 0,
            'monthly_searches' => (int) $volume,
            'competitors_json' => null,
            'brands_mentioned' => $companyKey,
        ]);

        $competitors = $this->competitorScraper->getOrScrapeCompetitors($kw->id, $kw->keyword, $companyKey);
        $selfItem = collect($competitors)->firstWhere('isSelf', true) ?? ($competitors[0] ?? null);
        $sov = $selfItem ? ($selfItem['sov'] ?? 35) : 35;
        $pos = $selfItem ? ($selfItem['position'] ?? '1.7') : '1.7';

        return response()->json([
            'success' => true,
            'keyword' => [
                'id' => $kw->id,
                'project_id' => $kw->project_id,
                'company_key' => $kw->company_key,
                'keyword' => $kw->keyword,
                'keyword_text' => $kw->keyword,
                'rank' => '#1',
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
     * Delete a keyword and cascade delete all associated competitors, prompts and citations via MySQL FK cascade.
     */
    public function destroy(int $id): JsonResponse
    {
        $kw = Keyword::find($id);
        if (!$kw) {
            return response()->json(['error' => 'Keyword niet gevonden.'], 404);
        }

        $keywordText = $kw->keyword;
        // MySQL ON DELETE CASCADE automatically deletes all prompts and citations attached via foreign keys
        $kw->delete();

        return response()->json([
            'success' => true,
            'message' => "Keyword \"{$keywordText}\" en alle bijbehorende data zijn succesvol verwijderd."
        ]);
    }

    /**
     * Bulk delete multiple keywords and all their underlying prompts and citations via MySQL FK cascade.
     */
    public function bulkDelete(Request $request): JsonResponse
    {
        $ids = $request->input('ids', []);
        if (!is_array($ids) || empty($ids)) {
            return response()->json(['success' => true, 'message' => 'Geen actie vereist.']);
        }

        $count = count($ids);
        Keyword::whereIn('id', $ids)->delete();

        return response()->json([
            'success' => true,
            'message' => "{$count} keywords en alle onderliggende data zijn succesvol verwijderd via database cascade."
        ]);
    }
}
