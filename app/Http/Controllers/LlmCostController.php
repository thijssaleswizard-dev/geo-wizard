<?php

namespace App\Http\Controllers;

use App\Models\Project;
use App\Services\LlmCostService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LlmCostController extends Controller
{
    /**
     * Get LLM usage and cost analytics breakdown.
     */
    public function index(Request $request): JsonResponse
    {
        // Automatically seed historical prompt data if database table is currently empty
        LlmCostService::seedHistoricalPromptCosts();

        $projectId = $request->query('project_id');
        $company = $request->query('company');
        $period = $request->query('period', 'all');

        if (!$projectId && $company) {
            $decoded = trim(urldecode($company));
            $companyKey = strtolower(trim(str_replace('.nl', '', $decoded)));

            $project = Project::whereRaw('LOWER(company) = ?', [strtolower($decoded)])
                ->orWhereRaw('LOWER(company) = ?', [strtolower("{$decoded}.nl")])
                ->orWhereRaw('LOWER(company) = ?', [strtolower($companyKey)])
                ->first();

            if ($project) {
                $projectId = $project->id;
            }
        }

        $analytics = LlmCostService::getSummary(
            $projectId ? (int) $projectId : null,
            $period
        );

        return response()->json(array_merge(['success' => true], $analytics));
    }
}
