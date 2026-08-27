<?php

namespace App\Http\Controllers;

use App\Jobs\ProcessKeywordCompetitorsJob;
use App\Jobs\ProcessPromptJob;
use App\Models\Citation;
use App\Models\Keyword;
use App\Models\Project;
use App\Models\Prompt;
use App\Models\Role;
use App\Models\User;
use App\Services\AiEngineService;
use App\Services\GeoLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;

class ProjectController extends Controller
{
    protected AiEngineService $aiEngine;

    public function __construct(AiEngineService $aiEngine)
    {
        $this->aiEngine = $aiEngine;
    }

    public function index(Request $request): JsonResponse
    {
        $userId = $request->query('userId');
        $role = $request->query('role');

        $query = Project::query()->withCount(['keywords', 'prompts']);

        if ($role === 'klant' && $userId) {
            $query->whereHas('users', function ($q) use ($userId) {
                $q->where('users.id', $userId);
            });
        }

        $projects = $query->get();

        $projectsWithCounts = $projects->map(function ($proj) {
            $kwCount = $proj->keywords_count;
            $prCount = $proj->prompts_count;

            // Check if there are still pending prompts for this specific project
            $pendingPrompts = $proj->prompts()
                ->whereIn('status', ['pending', 'processing'])
                ->count();

            $status = $proj->setup_status;
            $progress = $proj->setup_progress;

            if ($pendingPrompts > 0 && $prCount > 0) {
                $status = 'processing';
                $completed = $prCount - $pendingPrompts;
                $base = 25;
                $portion = (int) round(($completed / $prCount) * 70);
                $progress = min(96, $base + $portion);
            } elseif ($status === 'processing' && $pendingPrompts === 0) {
                $status = 'completed';
                $progress = 100;
                $proj->update(['setup_status' => 'completed', 'setup_progress' => 100]);
            }

            return [
                'id' => $proj->id,
                'company' => $proj->company,
                'name' => $proj->name,
                'email' => $proj->email,
                'subscription' => $proj->subscription,
                'visibility_index' => $proj->visibility_index,
                'setup_status' => $status,
                'setup_progress' => $progress,
                'keywordsCount' => $kwCount,
                'promptsCount' => $prCount,
            ];
        });

        return response()->json(['success' => true, 'clients' => $projectsWithCounts]);
    }

    public function store(Request $request): JsonResponse
    {
        $company = trim($request->input('company', ''));
        $name = trim($request->input('name', ''));
        $email = strtolower(trim($request->input('email', '')));
        $password = $request->input('password');
        $subscription = $request->input('subscription', 'AI Pro');
        $keywords = $request->input('keywords');

        if (empty($company) || empty($name) || empty($email)) {
            return response()->json(['error' => 'Bedrijfsnaam, klantnaam en e-mailadres zijn verplicht.'], 400);
        }

        if (Project::whereRaw('LOWER(company) = ?', [strtolower($company)])->exists()) {
            return response()->json(['error' => 'Deze bedrijfsnaam/workspace bestaat al.'], 400);
        }

        $hasKeywords = !empty($keywords) && strlen(trim($keywords)) > 0;

        $project = Project::create([
            'company' => $company,
            'name' => $name,
            'email' => $email,
            'subscription' => $subscription,
            'prompts_count' => 0,
            'visibility_index' => 74,
            'setup_status' => $hasKeywords ? 'processing' : 'completed',
            'setup_progress' => $hasKeywords ? 20 : 100,
        ]);

        GeoLog::section("NIEUW PROJECT AANGEMAAKT: {$company}");
        GeoLog::box("PROJECT INFORMATIE", [
            "Project ID: #{$project->id}",
            "Bedrijfsnaam: {$company}",
            "Contactpersoon: {$name} ({$email})",
            "Pakket: {$subscription}",
            "Keywords: " . ($hasKeywords ? $keywords : 'Geen'),
        ]);

        $userId = null;
        if (!empty($password)) {
            $klantRole = Role::firstOrCreate(['name' => 'klant']);
            $user = User::firstOrCreate(
                ['email' => $email],
                [
                    'name' => $name,
                    'password' => Hash::make($password),
                    'role_id' => $klantRole->id,
                    'role' => 'klant',
                    'company_name' => $company,
                    'subscription' => $subscription,
                    'addon_prompts' => 0,
                ]
            );
            $userId = $user->id;
        } else {
            $existingUser = User::where('email', $email)->first();
            if ($existingUser) {
                $userId = $existingUser->id;
            }
        }

        if ($userId) {
            $project->users()->syncWithoutDetaching([$userId]);
        }

        if ($hasKeywords) {
            $this->queueKeywordsSetup($project, $keywords);
        }

        $project->refresh();

        return response()->json([
            'success' => true,
            'client' => [
                'id' => $project->id,
                'company' => $project->company,
                'name' => $project->name,
                'email' => $project->email,
                'subscription' => $project->subscription,
                'promptsCount' => $project->prompts_count,
                'visibilityIndex' => $project->visibility_index,
                'setup_status' => $project->setup_status,
                'setup_progress' => $project->setup_progress,
            ]
        ], 201);
    }

    /**
     * Fast non-blocking keyword & prompt initialization linked to Project via foreign keys.
     */
    protected function queueKeywordsSetup(Project $project, string $keywordsString): void
    {
        $companyKey = strtolower(trim(str_replace('.nl', '', $project->company)));
        $rawKeywords = array_values(array_filter(array_map('trim', explode(',', $keywordsString))));

        if (empty($rawKeywords)) {
            return;
        }

        GeoLog::subSection("KEYWORDS & PROMPT SETUP VOOR PROJECT #{$project->id} ({$project->company})");
        GeoLog::info("Verwerken van " . count($rawKeywords) . " zoekwoorden...");

        foreach ($rawKeywords as $idx => $kw) {
            $cleanKw = strtolower(trim($kw));

            $keyword = Keyword::create([
                'project_id' => $project->id,
                'company_key' => $companyKey,
                'keyword' => $cleanKw,
                'rank' => null,
                'search_engine' => 'ChatGPT',
                'sentiment' => 'N/A',
                'citations_count' => 0,
                'monthly_searches' => 100,
                'competitors_json' => null,
                'brands_mentioned' => $companyKey,
            ]);

            // Dispatch background competitor scraper job
            ProcessKeywordCompetitorsJob::dispatch($keyword->id, $keyword->keyword, $companyKey);

            // Generate 3 natural human search prompts
            GeoLog::info("🤖 Genereren van 3 natuurlijke zoekvragen voor keyword: \"{$cleanKw}\"...");
            $prompts = PromptController::generateNaturalPrompts($cleanKw, $project->company);

            $defaultEngines = ['chatgpt' => true, 'gemini' => true, 'perplexity' => true, 'copilot' => true, 'claude' => true, 'aio' => true];
            $promptLines = [];
            foreach ($prompts as $pIdx => $pText) {
                $promptRecord = Prompt::create([
                    'project_id' => $project->id,
                    'keyword_id' => $keyword->id,
                    'prompt_text' => trim($pText),
                    'category' => 'AI Generated',
                    'response_summary' => 'Wachtend op achtergrond scan...',
                    'brand_mentioned' => false,
                    'position' => null,
                    'sentiment' => 'N/A',
                    'engine' => 'ChatGPT',
                    'status' => 'pending',
                    'engines' => $defaultEngines,
                ]);

                // Asynchronously dispatch prompt scan to the queue
                ProcessPromptJob::dispatch($promptRecord->id);
                $promptLines[] = ($pIdx + 1) . ". [ID #{$promptRecord->id}] \"{$pText}\"";
            }

            GeoLog::box("KEYWORD #{$keyword->id} TOEGEVOEGD (" . ($idx + 1) . "/" . count($rawKeywords) . ")", array_merge([
                "Zoekwoord: \"{$cleanKw}\"",
                "Competitor Scraper Job: Gedispatcht naar queue",
                "Aangemaakte Prompts & Scanjobs:",
            ], $promptLines));
        }
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $name = trim($request->input('name', ''));
        $email = strtolower(trim($request->input('email', '')));
        $subscription = $request->input('subscription');

        if (empty($name) || empty($email)) {
            return response()->json(['error' => 'Projectnaam en e-mailadres zijn verplicht.'], 400);
        }

        $project = Project::find($id);
        if (!$project) {
            return response()->json(['error' => 'Project niet gevonden.'], 404);
        }

        $oldEmail = $project->email;

        $project->update([
            'name' => $name,
            'email' => $email,
            'subscription' => $subscription ?: $project->subscription,
            'updated_at' => now(),
        ]);

        if (!empty($oldEmail)) {
            User::where('email', $oldEmail)->update([
                'name' => $name,
                'email' => $email,
                'subscription' => $subscription ?: $project->subscription,
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Project succesvol bijgewerkt.',
            'client' => [
                'id' => $project->id,
                'company' => $project->company,
                'name' => $project->name,
                'email' => $project->email,
                'subscription' => $project->subscription,
                'promptsCount' => $project->prompts_count,
                'visibilityIndex' => $project->visibility_index,
            ]
        ]);
    }

    /**
     * Complete cascade delete of project. MySQL ON DELETE CASCADE automatically removes
     * all associated keywords, prompts, citations, recommendations, and analytics.
     */
    public function destroy(string $company): JsonResponse
    {
        $decodedCompany = trim(urldecode($company));
        $companyKey = strtolower(trim(str_replace('.nl', '', $decodedCompany)));

        // Find by ID or company name
        $project = is_numeric($decodedCompany) 
            ? Project::find((int) $decodedCompany)
            : Project::whereRaw('LOWER(company) = ?', [strtolower($decodedCompany)])
                ->orWhereRaw('LOWER(company) = ?', [strtolower("{$decodedCompany}.nl")])
                ->orWhereRaw('LOWER(company) = ?', [strtolower($companyKey)])
                ->first();

        if ($project) {
            $companyName = $project->company;
            // Clean junction table and user records
            $project->users()->detach();
            // MySQL ON DELETE CASCADE automatically purges all keywords, prompts, citations, etc.
            $project->delete();

            return response()->json([
                'success' => true,
                'message' => "Project \"{$companyName}\" en alle bijbehorende data zijn succesvol verwijderd via database cascade."
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => "Project reeds verwijderd."
        ]);
    }

    public function apiMonitorStatus(): JsonResponse
    {
        $status = AiEngineService::getApiStatus();
        $history = AiEngineService::getApiHistory();

        return response()->json(['success' => true, 'status' => $status, 'history' => $history]);
    }
}
