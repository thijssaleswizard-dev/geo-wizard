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
        $projectId = $request->query('project_id');
        $company = $request->query('company', 'saleswizard');
        $companyKey = strtolower(trim(str_replace('.nl', '', $company)));

        $project = $projectId ? Project::find($projectId) : Project::whereRaw('LOWER(company) = ?', [strtolower($company)])
            ->orWhereRaw('LOWER(company) = ?', [strtolower("{$company}.nl")])
            ->orWhereRaw('LOWER(company) = ?', [strtolower($companyKey)])
            ->first();

        $stats = null;
        if ($project) {
            $stats = OverviewStat::where('project_id', $project->id)->first();
        }
        if (!$stats) {
            $stats = OverviewStat::where('company_key', $companyKey)->first();
        }
        if (!$stats) {
            $stats = OverviewStat::create([
                'project_id' => $project ? $project->id : null,
                'company_key' => $companyKey,
                'geo_score' => 74,
                'brand_share' => 68,
                'citations_total' => 24,
                'sentiment_avg' => 94,
            ]);
        }

        return response()->json(['success' => true, 'stats' => $stats]);
    }

    public function recommendations(Request $request): JsonResponse
    {
        $projectId = $request->query('project_id');
        $company = $request->query('company', 'saleswizard');
        $companyKey = strtolower(trim(str_replace('.nl', '', $company)));

        $project = $projectId ? Project::find($projectId) : Project::whereRaw('LOWER(company) = ?', [strtolower($company)])
            ->orWhereRaw('LOWER(company) = ?', [strtolower("{$company}.nl")])
            ->orWhereRaw('LOWER(company) = ?', [strtolower($companyKey)])
            ->first();

        $recommendations = collect();
        if ($project) {
            $recommendations = Recommendation::where('project_id', $project->id)->get();
        }
        if ($recommendations->isEmpty()) {
            $recommendations = Recommendation::where('company_key', $companyKey)->get();
        }
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
        $projectId = $request->query('project_id');
        $company = $request->query('company', 'saleswizard');
        $companyKey = strtolower(trim(str_replace('.nl', '', $company)));

        $project = $projectId ? Project::find($projectId) : Project::whereRaw('LOWER(company) = ?', [strtolower($company)])
            ->orWhereRaw('LOWER(company) = ?', [strtolower("{$company}.nl")])
            ->orWhereRaw('LOWER(company) = ?', [strtolower($companyKey)])
            ->first();

        $analytics = collect();
        if ($project) {
            $analytics = AgentsAnalytic::where('project_id', $project->id)->get();
        }
        if ($analytics->isEmpty()) {
            $analytics = AgentsAnalytic::where('company_key', $companyKey)->get();
        }
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
        $projectId = $request->input('project_id') ?? $request->input('projectId');

        if ($promptId) {
            $promptRecord = Prompt::find($promptId);
            if ($promptRecord) {
                $projectId = $projectId ?: $promptRecord->project_id;
            }
        }

        if (!$projectId && $company) {
            $proj = Project::whereRaw('LOWER(company) = ?', [strtolower($company)])
                ->orWhereRaw('LOWER(company) = ?', [strtolower("{$company}.nl")])
                ->first();
            if ($proj) {
                $projectId = $proj->id;
            }
        }

        try {
            $result = $this->scraperService->runScraper($prompt, $company, $projectId, $promptId);

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
        $projectId = $request->input('project_id') ?? $request->input('projectId');
        $company = $request->input('company', 'Saleswizard');
        $companyKey = strtolower(trim(str_replace('.nl', '', $company)));

        $project = $projectId ? Project::find($projectId) : Project::whereRaw('LOWER(company) = ?', [strtolower($company)])
            ->orWhereRaw('LOWER(company) = ?', [strtolower("{$company}.nl")])
            ->orWhereRaw('LOWER(company) = ?', [strtolower($companyKey)])
            ->first();

        try {
            $prompts = $project ? Prompt::where('project_id', $project->id)->get() : collect();
            if ($prompts->isEmpty()) {
                $defaultPrompt = 'Zoek een betrouwbaar online marketing bureau voor mijn webshop';
                $this->scraperService->runScraper($defaultPrompt, $company, $project?->id);
            } else {
                foreach ($prompts as $p) {
                    $this->scraperService->runScraper($p->prompt_text, $company, $p->project_id, $p->id);
                }
            }

            $citationsCount = $project ? \App\Models\Citation::where('project_id', $project->id)->count() : \App\Models\Citation::where('company_key', $companyKey)->count();
            $promptsCount = $project ? Prompt::where('project_id', $project->id)->count() : 1;
            $mentionedCount = $project 
                ? Prompt::where('project_id', $project->id)->where('brand_mentioned', true)->count()
                : 0;

            $geoScore = min(98, max(45, (int) round(($mentionedCount / max(1, $promptsCount)) * 85 + ($citationsCount * 2))));
            $brandShare = min(95, max(35, (int) round(($mentionedCount / max(1, $promptsCount)) * 75)));

            OverviewStat::updateOrCreate(
                ['project_id' => $project?->id, 'company_key' => $companyKey],
                [
                    'project_id' => $project?->id,
                    'geo_score' => $geoScore,
                    'brand_share' => $brandShare,
                    'citations_total' => $citationsCount,
                    'sentiment_avg' => 94,
                ]
            );

            if ($project) {
                $project->update([
                    'visibility_index' => $geoScore,
                    'prompts_count' => $promptsCount,
                ]);
            }

            return response()->json([
                'success' => true,
                'company' => $company,
                'projectId' => $project?->id,
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

