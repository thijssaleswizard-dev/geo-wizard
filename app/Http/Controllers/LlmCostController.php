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
        // Automatically ensure Google AI Studio billing data is synchronized
        LlmCostService::syncGoogleAiStudioBilling();

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

    /**
     * Store a manual invoice or payment (e.g. Google AI Studio / Google Cloud).
     */
    public function storeInvoice(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'engine' => 'required|string',
            'amount_eur' => 'required|numeric|min:0.01',
            'description' => 'required|string|max:255',
            'invoice_ref' => 'nullable|string|max:100',
            'date' => 'nullable|string',
            'project_id' => 'nullable|integer',
        ]);

        $log = LlmCostService::recordManualInvoice(
            $validated['engine'],
            (float) $validated['amount_eur'],
            $validated['description'],
            $validated['invoice_ref'] ?? null,
            $validated['date'] ?? null,
            $validated['project_id'] ?? null
        );

        return response()->json([
            'success' => true,
            'message' => 'Factuur / betaling succesvol toegevoegd en verwerkt.',
            'log' => $log,
        ]);
    }

    /**
     * Force synchronize Google AI Studio statement charges (€250,00).
     */
    public function syncAiStudio(): JsonResponse
    {
        LlmCostService::syncGoogleAiStudioBilling(true);

        return response()->json([
            'success' => true,
            'message' => 'Google AI Studio Mastercard afschrijvingen (€ 250,00) succesvol gesynchroniseerd.',
        ]);
    }
}
