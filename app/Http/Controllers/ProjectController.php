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

        // Auto-recover stale prompts that timed out or got interrupted (> 5 minutes)
        \App\Models\Prompt::whereIn('status', ['pending', 'processing', 'crawling'])
            ->where('updated_at', '<', now()->subMinutes(5))
            ->update([
                'status' => 'failed',
                'logs' => ['[Timeout Herstel] Automatisch gemarkeerd als mislukt na 5 minuten inactiviteit.'],
                'updated_at' => now(),
            ]);

        $projects = $query->with(['prompts:id,project_id,results,status'])->get();

        $projectsWithCounts = $projects->map(function ($proj) {
            $kwCount = $proj->keywords_count;
            $prCount = $proj->prompts_count;

            // Check if there are still pending prompts for this specific project
            $pendingPrompts = $proj->prompts
                ->whereIn('status', ['pending', 'processing'])
                ->count();

            // Compute live-only visibility_index (strictly excluding simulated/failed models)
            $liveMeasured = 0;
            $liveMentioned = 0;
            foreach ($proj->prompts as $pItem) {
                $pRes = is_array($pItem->results) ? $pItem->results : json_decode($pItem->results ?? '[]', true);
                $lm = AiEngineService::extractLivePromptMetrics(is_array($pRes) ? $pRes : null);
                if ($lm['hasLiveData']) {
                    $liveMeasured++;
                    if ($lm['mentioned']) {
                        $liveMentioned++;
                    }
                }
            }
            $liveVisibility = ($liveMeasured > 0 && $liveMentioned > 0)
                ? (int) round(($liveMentioned / $liveMeasured) * 100)
                : 0;

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
                'promptsLimit' => Project::getPromptLimit($proj->subscription),
                'visibility_index' => $liveVisibility,
                'setup_status' => $status,
                'setup_progress' => $progress,
                'keywordsCount' => $kwCount,
                'promptsCount' => $prCount,
            ];
        });

        return response()->json(['success' => true, 'clients' => $projectsWithCounts]);
    }

    protected function isStaffOrAdmin(Request $request): bool
    {
        $user = $request->user();
        $role = $user?->role;
        $userId = $user?->id ?? $request->input('userId') ?? $request->query('userId');

        if ($userId && !$role) {
            $dbUser = User::find($userId);
            if ($dbUser) {
                $role = $dbUser->role;
            }
        }
        if (!$role) {
            $role = $request->input('role') ?? $request->query('role');
        }

        // Default for project admin actions when called by staff dashboard
        if (!$role) {
            return true;
        }

        return in_array(strtolower((string) $role), ['admin', 'medewerker'], true);
    }

    public function store(Request $request): JsonResponse
    {
        if (!$this->isStaffOrAdmin($request)) {
            return response()->json(['error' => 'Alleen admins en Saleswizard medewerkers kunnen projecten aanmaken.'], 403);
        }

        $company = trim($request->input('company', ''));
        $name = trim($request->input('name', ''));
        $email = strtolower(trim($request->input('email', '')));
        $password = $request->input('password');
        $subscription = $request->input('subscription', 'AI Pro');
        $keywords = $request->input('keywords');
        $generateAiPrompts = $request->has('generate_ai_prompts')
            ? $request->boolean('generate_ai_prompts')
            : true;
        $customPromptsInput = $request->input('custom_prompts', []);

        if (empty($company) || empty($name) || empty($email)) {
            return response()->json(['error' => 'Bedrijfsnaam, klantnaam en e-mailadres zijn verplicht.'], 400);
        }

        if (Project::whereRaw('LOWER(company) = ?', [strtolower($company)])->exists()) {
            return response()->json(['error' => 'Deze bedrijfsnaam/workspace bestaat al.'], 400);
        }

        // Normalize custom prompts: can be array/map per keyword or newline-separated string / flat array
        $customPromptsByKeyword = [];
        $flatCustomPrompts = [];
        if (is_string($customPromptsInput)) {
            $flatCustomPrompts = array_values(array_filter(array_map('trim', preg_split('/\r\n|\r|\n/', $customPromptsInput))));
        } elseif (is_array($customPromptsInput)) {
            $isAssoc = array_keys($customPromptsInput) !== range(0, count($customPromptsInput) - 1);
            if ($isAssoc) {
                foreach ($customPromptsInput as $kwKey => $pVal) {
                    $cleanKey = strtolower(trim((string) $kwKey));
                    if (is_string($pVal)) {
                        $lines = array_values(array_filter(array_map('trim', preg_split('/\r\n|\r|\n/', $pVal))));
                    } elseif (is_array($pVal)) {
                        $lines = array_values(array_filter(array_map('trim', $pVal)));
                    } else {
                        $lines = [];
                    }
                    if (!empty($lines)) {
                        $customPromptsByKeyword[$cleanKey] = $lines;
                    }
                }
            } else {
                $flatCustomPrompts = array_values(array_filter(array_map('trim', $customPromptsInput)));
            }
        }

        $totalCustomPromptsCount = count($flatCustomPrompts);
        foreach ($customPromptsByKeyword as $pList) {
            $totalCustomPromptsCount += count($pList);
        }

        $hasKeywords = !empty($keywords) && strlen(trim($keywords)) > 0;
        $rawKeywordsCheck = $hasKeywords
            ? array_values(array_filter(array_map('trim', explode(',', $keywords))))
            : [];

        // If user did not enter keywords but did enter custom prompts, create a default keyword from company name
        if (empty($rawKeywordsCheck) && $totalCustomPromptsCount > 0) {
            $defaultKw = AiEngineService::cleanBrandKey($company) ?: strtolower($company);
            $rawKeywordsCheck = [$defaultKw];
            $keywords = $defaultKw;
            $hasKeywords = true;
        }

        $maxPrompts = Project::getPromptLimit($subscription);
        $maxKeywordsWithAi = (int) floor($maxPrompts / 3);

        if ($hasKeywords) {
            if ($generateAiPrompts && count($rawKeywordsCheck) > $maxKeywordsWithAi) {
                return response()->json([
                    'error' => "Het gekozen pakket ({$subscription}) staat bij automatische AI-generatie maximaal {$maxKeywordsWithAi} zoekwoorden ({$maxPrompts} prompts) toe. U heeft er " . count($rawKeywordsCheck) . " opgegeven."
                ], 400);
            }
            if (!$generateAiPrompts && count($rawKeywordsCheck) > $maxPrompts) {
                return response()->json([
                    'error' => "Het gekozen pakket ({$subscription}) staat maximaal {$maxPrompts} zoekwoorden/prompts toe. U heeft er " . count($rawKeywordsCheck) . " opgegeven."
                ], 400);
            }
        }

        $expectedTotalPrompts = ($generateAiPrompts ? (count($rawKeywordsCheck) * 3) : 0) + $totalCustomPromptsCount;
        if ($expectedTotalPrompts > $maxPrompts) {
            return response()->json([
                'error' => "Het totaal aantal prompts ({$expectedTotalPrompts}) overschrijdt de pakketlimiet van {$maxPrompts} prompts voor {$subscription}."
            ], 400);
        }

        $willProcessPrompts = $expectedTotalPrompts > 0;

        $project = Project::create([
            'company' => $company,
            'name' => $name,
            'email' => $email,
            'subscription' => $subscription,
            'prompts_count' => $expectedTotalPrompts,
            'visibility_index' => 0,
            'setup_status' => $willProcessPrompts ? 'processing' : 'completed',
            'setup_progress' => $willProcessPrompts ? 20 : 100,
        ]);

        GeoLog::section("NIEUW PROJECT AANGEMAAKT: {$company}");
        GeoLog::box("PROJECT INFORMATIE", [
            "Project ID: #{$project->id}",
            "Bedrijfsnaam: {$company}",
            "Contactpersoon: {$name} ({$email})",
            "Pakket: {$subscription} (Max {$maxPrompts} prompts)",
            "Keywords: " . ($hasKeywords ? $keywords : 'Geen'),
            "AI Prompts Genereren: " . ($generateAiPrompts ? 'Ja' : 'Nee (Uitgeschakeld)'),
            "Eigen Prompts Opgegeven: {$totalCustomPromptsCount}",
        ]);

        $userId = null;
        if (!empty($password)) {
            $klantRole = Role::firstOrCreate(['name' => 'klant']);
            $user = User::updateOrCreate(
                ['email' => $email],
                [
                    'name' => $name,
                    'password' => Hash::make($password),
                    'role_id' => $klantRole->id,
                    'role' => 'klant',
                    'company_name' => $company,
                    'subscription' => $subscription,
                    'addon_prompts' => 0,
                    'payment_status' => 'paid',
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
            $this->queueKeywordsSetup($project, $keywords, $generateAiPrompts, $customPromptsByKeyword, $flatCustomPrompts);
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
                'promptsLimit' => $maxPrompts,
                'promptsCount' => $project->prompts_count,
                'keywordsCount' => count($rawKeywordsCheck),
                'visibilityIndex' => $project->visibility_index,
                'setup_status' => $project->setup_status,
                'setup_progress' => $project->setup_progress,
            ]
        ], 201);
    }

    /**
     * Fast non-blocking keyword & prompt initialization linked to Project via foreign keys.
     */
    protected function queueKeywordsSetup(
        Project $project,
        string $keywordsString,
        bool $generateAiPrompts = true,
        array $customPromptsByKeyword = [],
        array $flatCustomPrompts = []
    ): void {
        $companyKey = \App\Services\AiEngineService::cleanBrandKey($project->company);
        $rawKeywords = array_values(array_filter(array_map('trim', explode(',', $keywordsString))));

        if (empty($rawKeywords)) {
            return;
        }

        GeoLog::subSection("KEYWORDS & PROMPT SETUP VOOR PROJECT #{$project->id} ({$project->company})");
        GeoLog::info("Verwerken van " . count($rawKeywords) . " zoekwoorden (AI prompts: " . ($generateAiPrompts ? 'AAN' : 'UIT') . ")...");

        $defaultEngines = AiEngineService::getEnabledEngines();
        $createdKeywords = [];
        $totalCreatedPrompts = 0;

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
            $createdKeywords[] = $keyword;

            // Dispatch background competitor scraper job
            ProcessKeywordCompetitorsJob::dispatch($keyword->id, $keyword->keyword, $companyKey);

            $promptEntries = [];

            if ($generateAiPrompts) {
                GeoLog::info("🤖 Genereren van 3 natuurlijke zoekvragen voor keyword: \"{$cleanKw}\"...");
                $aiPrompts = PromptController::generateNaturalPrompts($cleanKw, $project->company);
                foreach ($aiPrompts as $pText) {
                    $promptEntries[] = ['text' => $pText, 'category' => 'AI Generated'];
                }
            }

            if (!empty($customPromptsByKeyword[$cleanKw])) {
                foreach ($customPromptsByKeyword[$cleanKw] as $cpText) {
                    $promptEntries[] = ['text' => $cpText, 'category' => 'Custom'];
                }
            }

            $promptLines = [];
            foreach ($promptEntries as $pIdx => $entry) {
                $pText = trim($entry['text']);
                if ($pText === '') {
                    continue;
                }
                $promptRecord = Prompt::create([
                    'project_id' => $project->id,
                    'keyword_id' => $keyword->id,
                    'prompt_text' => $pText,
                    'category' => $entry['category'],
                    'response_summary' => 'Wachtend op achtergrond scan...',
                    'brand_mentioned' => false,
                    'position' => null,
                    'sentiment' => 'N/A',
                    'engine' => 'ChatGPT',
                    'status' => 'pending',
                    'engines' => $defaultEngines,
                ]);

                $totalCreatedPrompts++;
                ProcessPromptJob::dispatch($promptRecord->id);
                $promptLines[] = ($pIdx + 1) . ". [ID #{$promptRecord->id} | {$entry['category']}] \"{$pText}\"";
            }

            GeoLog::box("KEYWORD #{$keyword->id} TOEGEVOEGD (" . ($idx + 1) . "/" . count($rawKeywords) . ")", array_merge([
                "Zoekwoord: \"{$cleanKw}\"",
                "Competitor Scraper Job: Gedispatcht naar queue",
                "Aangemaakte Prompts & Scanjobs: " . (empty($promptLines) ? 'Geen (handmatig toevoegen)' : count($promptLines)),
            ], $promptLines));
        }

        // Attach any flat/general custom prompts across the created keywords (round-robin or to first keyword)
        if (!empty($flatCustomPrompts) && !empty($createdKeywords)) {
            foreach ($flatCustomPrompts as $fIdx => $cpText) {
                $pText = trim($cpText);
                if ($pText === '') {
                    continue;
                }
                $targetKw = $createdKeywords[$fIdx % count($createdKeywords)];
                $promptRecord = Prompt::create([
                    'project_id' => $project->id,
                    'keyword_id' => $targetKw->id,
                    'prompt_text' => $pText,
                    'category' => 'Custom',
                    'response_summary' => 'Wachtend op achtergrond scan...',
                    'brand_mentioned' => false,
                    'position' => null,
                    'sentiment' => 'N/A',
                    'engine' => 'ChatGPT',
                    'status' => 'pending',
                    'engines' => $defaultEngines,
                ]);
                $totalCreatedPrompts++;
                ProcessPromptJob::dispatch($promptRecord->id);
            }
        }

        $project->update([
            'prompts_count' => $totalCreatedPrompts,
            'setup_status' => $totalCreatedPrompts > 0 ? 'processing' : 'completed',
            'setup_progress' => $totalCreatedPrompts > 0 ? 20 : 100,
        ]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $name = trim($request->input('name', ''));
        $email = strtolower(trim($request->input('email', '')));
        $subscription = $request->input('subscription');
        $password = $request->input('password');
        $companyInput = trim($request->input('company', ''));

        if (empty($name) || empty($email)) {
            return response()->json(['error' => 'Contactpersoon en e-mailadres zijn verplicht.'], 400);
        }

        $project = Project::find($id);
        if (!$project) {
            return response()->json(['error' => 'Project niet gevonden.'], 404);
        }

        $oldCompany = $project->company;
        if (!empty($companyInput)) {
            if (str_starts_with($companyInput, 'http://') || str_starts_with($companyInput, 'https://')) {
                $companyInput = preg_replace('#^https?://(www\.)?#i', '', $companyInput);
                $companyInput = explode('/', $companyInput)[0];
            } elseif (str_starts_with(strtolower($companyInput), 'www.')) {
                $companyInput = substr($companyInput, 4);
            }
            $company = trim($companyInput);
        } else {
            $company = $oldCompany;
        }

        if (empty($company)) {
            return response()->json(['error' => 'Projectnaam / domein mag niet leeg zijn.'], 400);
        }

        if (strtolower($company) !== strtolower($oldCompany)) {
            if (Project::whereRaw('LOWER(company) = ?', [strtolower($company)])->where('id', '!=', $project->id)->exists()) {
                return response()->json(['error' => 'Deze projectnaam / dit domein bestaat al bij een ander project.'], 400);
            }
        }

        $oldEmail = $project->email;
        $newSubscription = $subscription ?: $project->subscription;

        $project->update([
            'company' => $company,
            'name' => $name,
            'email' => $email,
            'subscription' => $newSubscription,
            'updated_at' => now(),
        ]);

        if ($company !== $oldCompany) {
            $newCompanyKey = AiEngineService::cleanBrandKey($company);
            Keyword::where('project_id', $project->id)->update(['company_key' => $newCompanyKey]);
            Citation::where('project_id', $project->id)->update(['company_key' => $newCompanyKey]);
            \App\Models\Recommendation::where('project_id', $project->id)->update(['company_key' => $newCompanyKey]);
            \App\Models\AgentAnalytic::where('project_id', $project->id)->update(['company_key' => $newCompanyKey]);
            if (!\App\Models\OverviewStat::where('company_key', $newCompanyKey)->where('project_id', '!=', $project->id)->exists()) {
                \App\Models\OverviewStat::where('project_id', $project->id)->update(['company_key' => $newCompanyKey]);
            }
        }

        if (!empty($password)) {
            $klantRole = Role::firstOrCreate(['name' => 'klant']);
            $user = User::updateOrCreate(
                ['email' => $email],
                [
                    'name' => $name,
                    'password' => Hash::make($password),
                    'role_id' => $klantRole->id,
                    'role' => 'klant',
                    'company_name' => $company,
                    'subscription' => $newSubscription,
                    'payment_status' => 'paid',
                ]
            );
            $project->users()->syncWithoutDetaching([$user->id]);
        } elseif (!empty($oldEmail)) {
            User::where('email', $oldEmail)->update([
                'name' => $name,
                'email' => $email,
                'company_name' => $company,
                'subscription' => $newSubscription,
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
                'promptsLimit' => Project::getPromptLimit($project->subscription),
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
        $companyKey = \App\Services\AiEngineService::cleanBrandKey($decodedCompany);

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
        $enabledEngines = AiEngineService::getEnabledEngines();
        $costData = \App\Services\LlmCostService::getSummary();

        return response()->json([
            'success' => true,
            'aiDriver' => AiEngineService::getActiveDriver(),
            'dataforseo' => \App\Services\DataForSeoService::getAccountSummary(),
            'status' => $status,
            'history' => $history,
            'enabledEngines' => $enabledEngines,
            'costSummary' => $costData['summary'] ?? null,
            'costByEngine' => $costData['byEngine'] ?? [],
        ]);
    }

    public function apiMonitorReset(): JsonResponse
    {
        AiEngineService::clearCircuitBreakers();

        $status = AiEngineService::getApiStatus();
        $history = AiEngineService::getApiHistory();
        $enabledEngines = AiEngineService::getEnabledEngines();
        $costData = \App\Services\LlmCostService::getSummary();

        return response()->json([
            'success' => true,
            'message' => 'Alle API circuit breakers zijn gereset. Engines worden bij de volgende scan weer live geprobeerd.',
            'aiDriver' => AiEngineService::getActiveDriver(),
            'dataforseo' => \App\Services\DataForSeoService::getAccountSummary(true),
            'status' => $status,
            'history' => $history,
            'enabledEngines' => $enabledEngines,
            'costSummary' => $costData['summary'] ?? null,
            'costByEngine' => $costData['byEngine'] ?? [],
        ]);
    }
}
