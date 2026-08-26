<?php

namespace App\Http\Controllers;

use App\Models\AgentsAnalytic;
use App\Models\Notification;
use App\Models\OverviewStat;
use App\Models\Project;
use App\Models\Prompt;
use App\Models\Recommendation;
use App\Services\ScraperService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OverviewController extends Controller
{
    protected ScraperService $scraperService;

    public function __construct(ScraperService $scraperService)
    {
        $this->scraperService = $scraperService;
    }

    public function stats(Request $request): JsonResponse
    {
        $company = $request->query('company', 'saleswizard');
        $companyKey = strtolower(trim(str_replace('.nl', '', $company)));

        $stats = OverviewStat::where('company_key', $companyKey)->first();
        if (!$stats) {
            $stats = OverviewStat::firstOrCreate(
                ['company_key' => $companyKey],
                [
                    'geo_score' => 74,
                    'brand_share' => 68,
                    'citations_total' => 24,
                    'sentiment_avg' => 94,
                ]
            );
        }

        return response()->json(['success' => true, 'stats' => $stats]);
    }

    public function recommendations(Request $request): JsonResponse
    {
        $company = $request->query('company', 'saleswizard');
        $companyKey = strtolower(trim(str_replace('.nl', '', $company)));

        $recommendations = Recommendation::where('company_key', $companyKey)->get();
        if ($recommendations->isEmpty()) {
            $recommendations = Recommendation::where('company_key', 'saleswizard')->get();
        }

        return response()->json(['success' => true, 'recommendations' => $recommendations]);
    }

    public function notifications(Request $request): JsonResponse
    {
        $company = $request->query('company');
        $projectId = $request->query('project_id');

        $query = Notification::query()->orderBy('id', 'desc');

        if ($projectId) {
            $query->where(function ($q) use ($projectId) {
                $q->where('project_id', $projectId)->orWhereNull('project_id');
            });
        } elseif ($company && $company !== 'all') {
            $project = Project::whereRaw('LOWER(company) = ?', [strtolower($company)])
                ->orWhereRaw('LOWER(company) = ?', [strtolower("{$company}.nl")])
                ->first();
            if ($project) {
                $query->where(function ($q) use ($project) {
                    $q->where('project_id', $project->id)->orWhereNull('project_id');
                });
            }
        }

        $notifications = $query->get();
        return response()->json(['success' => true, 'notifications' => $notifications]);
    }

    public function agentsAnalytics(Request $request): JsonResponse
    {
        $company = $request->query('company', 'saleswizard');
        $companyKey = strtolower(trim(str_replace('.nl', '', $company)));

        $analytics = AgentsAnalytic::where('company_key', $companyKey)->get();
        if ($analytics->isEmpty()) {
            $analytics = AgentsAnalytic::where('company_key', 'saleswizard')->get();
        }

        return response()->json(['success' => true, 'analytics' => $analytics]);
    }

    public function runScraper(Request $request): JsonResponse
    {
        $prompt = $request->input('prompt', '');
        $company = $request->input('company', 'Saleswizard');
        $promptId = $request->input('promptId');

        try {
            $result = $this->scraperService->runScraper($prompt, $company);

            if ($promptId) {
                $totalMentioned = $result['totalMentions'] ?? 0;
                $totalModels = $result['totalModels'] ?? 1;
                $chatgpt = $result['modelMentions']['chatgpt'] ?? null;
                $gemini = $result['modelMentions']['gemini'] ?? null;

                Prompt::where('id', $promptId)->update([
                    'status' => 'completed',
                    'brand_mentioned' => $totalMentioned > 0,
                    'position' => $chatgpt['position'] ?? ($gemini['position'] ?? 1),
                    'response_summary' => strtolower(trim(str_replace('.nl', '', $company))) . " wordt door {$totalMentioned} van de {$totalModels} AI-modellen aanbevolen.",
                    'sentiment' => $chatgpt['sentiment'] ?? '+90',
                    'logs' => $result['logs'] ?? [],
                    'results' => $result,
                    'updated_at' => now(),
                ]);
            }

            return response()->json($result);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'error' => $e->getMessage()], 500);
        }
    }

    public function syncAll(Request $request): JsonResponse
    {
        $company = $request->input('company', 'Saleswizard');
        $companyKey = strtolower(trim(str_replace('.nl', '', $company)));

        try {
            $prompts = Prompt::where('company_key', $companyKey)->get();
            if ($prompts->isEmpty()) {
                $defaultPrompt = 'Zoek een betrouwbaar online marketing bureau voor mijn webshop';
                $this->scraperService->runScraper($defaultPrompt, $company);
            } else {
                foreach ($prompts as $p) {
                    $this->scraperService->runScraper($p->prompt_text, $company);
                }
            }

            $citationsCount = \App\Models\Citation::where('company_key', $companyKey)->count();
            $promptsCount = Prompt::where('company_key', $companyKey)->count() ?: 1;
            $mentionedCount = Prompt::where('company_key', $companyKey)->where('brand_mentioned', true)->count();

            $geoScore = min(98, max(45, (int) round(($mentionedCount / $promptsCount) * 85 + ($citationsCount * 2))));
            $brandShare = min(95, max(35, (int) round(($mentionedCount / $promptsCount) * 75)));

            OverviewStat::updateOrCreate(
                ['company_key' => $companyKey],
                [
                    'geo_score' => $geoScore,
                    'brand_share' => $brandShare,
                    'citations_total' => $citationsCount,
                    'sentiment_avg' => 94,
                ]
            );

            Project::whereRaw('LOWER(company) LIKE ?', ["%{$companyKey}%"])->update([
                'visibility_index' => $geoScore,
                'prompts_count' => $promptsCount,
            ]);

            return response()->json([
                'success' => true,
                'company' => $company,
                'geoScore' => $geoScore,
                'brandShare' => $brandShare,
                'citationsTotal' => $citationsCount,
                'promptsCount' => $promptsCount,
            ]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'error' => $e->getMessage()], 500);
        }
    }
}

