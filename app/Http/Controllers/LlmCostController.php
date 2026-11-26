<?php

namespace App\Http\Controllers;

use App\Models\Project;
use App\Services\LlmCostService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LlmCostController extends Controller
{
    /**
     * Authorize that only administrators / medewerkers can view or manage DataForSEO costs.
     */
    protected function authorizeMedewerker(Request $request): ?JsonResponse
    {
        $user = $request->user();
        $userId = $user?->id ?? $request->query('userId') ?? $request->input('userId');
        $role = $user?->role;

        if ($userId && !$role) {
            $dbUser = \App\Models\User::find($userId);
            if ($dbUser) {
                $role = $dbUser->role;
            }
        }
        if (!$role) {
            $role = $request->query('role') ?? $request->input('role');
        }

        if ($role === 'klant' || ($user && $user->role === 'klant')) {
            return response()->json([
                'success' => false,
                'error' => 'Geen toegang. DataForSEO inkoopkosten zijn uitsluitend inzichtelijk voor medewerkers en beheerders.',
            ], 403);
        }

        return null;
    }

    /**
     * Get DataForSEO usage, live balance, per-channel breakdown and per-project spend.
     */
    public function index(Request $request): JsonResponse
    {
        if ($deny = $this->authorizeMedewerker($request)) {
            return $deny;
        }

        $projectId = $request->query('project_id');
        $company = $request->query('company');
        $period = $request->query('period', 'all');
        $refreshBalance = $request->boolean('refresh', false);

        if (!$projectId && $company) {
            $decoded = trim(urldecode($company));
            $companyKey = \App\Services\AiEngineService::cleanBrandKey($decoded);

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
            $period,
            $refreshBalance
        );

        return response()->json(array_merge(['success' => true], $analytics));
    }

    /**
     * Store a manual DataForSEO invoice or balance top-up record.
     */
    public function storeInvoice(Request $request): JsonResponse
    {
        if ($deny = $this->authorizeMedewerker($request)) {
            return $deny;
        }

        $validated = $request->validate([
            'amount_eur' => 'required|numeric|min:0.01',
            'description' => 'required|string|max:255',
            'invoice_ref' => 'nullable|string|max:100',
            'date' => 'nullable|string',
            'project_id' => 'nullable|integer',
        ]);

        $log = LlmCostService::recordManualInvoice(
            'dataforseo',
            (float) $validated['amount_eur'],
            $validated['description'],
            $validated['invoice_ref'] ?? null,
            $validated['date'] ?? null,
            $validated['project_id'] ?? null
        );

        return response()->json([
            'success' => true,
            'message' => 'DataForSEO factuur / opwaardering succesvol geregistreerd.',
            'log' => $log,
        ]);
    }

    /**
     * Purge legacy non-DataForSEO logs (old Google AI Studio / direct LLM test logs) from database.
     */
    public function cleanupLegacy(Request $request): JsonResponse
    {
        if ($deny = $this->authorizeMedewerker($request)) {
            return $deny;
        }

        $deleted = LlmCostService::purgeLegacyNonDataForSeoLogs();

        return response()->json([
            'success' => true,
            'deletedCount' => $deleted,
            'message' => $deleted > 0
                ? "{$deleted} oude niet-DataForSEO logregel(s) zijn definitief opgeruimd."
                : 'Database bevat alleen nog schone DataForSEO logs.',
        ]);
    }
}
