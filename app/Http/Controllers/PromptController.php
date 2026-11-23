<?php

namespace App\Http\Controllers;

use App\Jobs\ProcessPromptJob;
use App\Models\Keyword;
use App\Models\Project;
use App\Models\Prompt;
use App\Services\AiEngineService;
use App\Services\GeoLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class PromptController extends Controller
{
    protected AiEngineService $aiEngine;

    public function __construct(AiEngineService $aiEngine)
    {
        $this->aiEngine = $aiEngine;
    }

    public function index(Request $request): JsonResponse
    {
        $company = $request->query('company');
        $projectId = $request->query('project_id');
        $user = $request->user();
        $userId = $user?->id ?? $request->query('userId') ?? $request->input('userId');
        $role = $user?->role;

        if ($userId && !$role) {
            $dbUser = \App\Models\User::find($userId);
            if ($dbUser) {
                $role = $dbUser->role;
                $user = $dbUser;
            }
        }
        if (!$role) {
            $role = $request->query('role') ?? $request->input('role');
        }

        $query = Prompt::query()->orderBy('id', 'desc');

        // Tenant protection: Klant accounts may ONLY view prompts of their own project(s)
        $allowedProjectIds = [];
        if ($role === 'klant' && $user) {
            $allowedProjectIds = $user->projects()->pluck('projects.id')->toArray();
            if (empty($allowedProjectIds)) {
                $fallbackProjects = Project::where('email', $user->email)
                    ->orWhere('company', $user->company_name)
                    ->pluck('id')->toArray();
                $allowedProjectIds = array_unique(array_merge($allowedProjectIds, $fallbackProjects));
            }
        }

        if ($projectId) {
            if ($role === 'klant' && !in_array((int) $projectId, $allowedProjectIds)) {
                return response()->json(['error' => 'Geen toegang tot dit project.'], 403);
            }
            $query->where('project_id', $projectId);
        } elseif ($company) {
            $decoded = trim(urldecode($company));
            $companyKey = \App\Services\AiEngineService::cleanBrandKey($decoded);

            $project = Project::whereRaw('LOWER(company) = ?', [strtolower($decoded)])
                ->orWhereRaw('LOWER(company) = ?', [strtolower("{$companyKey}.nl")])
                ->orWhereRaw('LOWER(company) = ?', [strtolower("{$companyKey}.com")])
                ->orWhereRaw('LOWER(company) = ?', [strtolower("{$companyKey}.eu")])
                ->orWhereRaw('LOWER(company) = ?', [strtolower($companyKey)])
                ->first();

            if ($project) {
                if ($role === 'klant' && !in_array($project->id, $allowedProjectIds)) {
                    return response()->json(['error' => 'Geen toegang tot dit project.'], 403);
                }
                $query->where('project_id', $project->id);
            } else {
                // If company does NOT match any project, shield and return empty (NEVER all prompts!)
                $query->whereRaw('1 = 0');
            }
        } else {
            // Neither projectId nor company specified
            if ($role === 'klant') {
                if (!empty($allowedProjectIds)) {
                    $query->whereIn('project_id', $allowedProjectIds);
                } else {
                    $query->whereRaw('1 = 0');
                }
            }
        }

        $prompts = $query->get();

        $formatted = $prompts->map(function ($p) {
            $engines = $p->engines;
            if (is_string($engines)) {
                $engines = json_decode($engines, true);
            }
            if (!$engines) {
                $engines = AiEngineService::getEnabledEngines();
            }

            $logs = $p->logs;
            if (is_string($logs)) {
                $logs = json_decode($logs, true);
            }

            $resObj = !empty($p->results) ? (is_array($p->results) ? $p->results : json_decode($p->results, true)) : null;
            $liveMetrics = !empty($resObj) ? AiEngineService::extractLivePromptMetrics($resObj) : null;

            return [
                'id' => $p->id,
                'project_id' => $p->project_id,
                'keyword_id' => $p->keyword_id,
                'text' => $p->prompt_text,
                'tag' => $p->category ?: 'Algemeen',
                'engines' => $liveMetrics ? $liveMetrics['engines'] : $engines,
                'mentioned' => $liveMetrics ? $liveMetrics['mentioned'] : (bool) $p->brand_mentioned,
                'position' => $liveMetrics ? $liveMetrics['position'] : $p->position,
                'totalMentions' => $liveMetrics ? $liveMetrics['totalMentions'] : 0,
                'totalModels' => $liveMetrics ? $liveMetrics['totalModels'] : 0,
                'sentiment' => ($liveMetrics && !$liveMetrics['mentioned']) ? 'N/A' : ($p->sentiment ?: 'N/A'),
                'status' => $p->status ?: 'completed',
                'logs' => $logs ?: [],
                'dateAdded' => $p->created_at ? $p->created_at->format('Y-m-d') : date('Y-m-d'),
            ];
        });

        return response()->json(['success' => true, 'prompts' => $formatted]);
    }

    public function generate(Request $request): JsonResponse
    {
        $keyword = trim($request->input('keyword', ''));
        $company = trim($request->input('company', 'Saleswizard'));
        $projectId = $request->input('project_id');

        if (empty($keyword)) {
            return response()->json(['error' => 'Keyword is verplicht voor het genereren van prompts.'], 400);
        }

        $prompts = $this->generateNaturalPrompts($keyword, $company, $projectId ? (int) $projectId : null);

        return response()->json(['success' => true, 'prompts' => $prompts]);
    }

    /**
     * Generates 3 natural, conversational search questions that real users type into ChatGPT, Gemini, Perplexity.
     * Accurately takes company context, products, and industry into account.
     */
    public static function generateNaturalPrompts(string $keyword, string $company = 'Saleswizard', ?int $projectId = null): array
    {
        $apiKey = config('services.openai.key') ?: env('OPENAI_API_KEY');

        // Resolve project and existing keywords or business context
        $project = null;
        if ($projectId) {
            $project = Project::find($projectId);
        }
        if (!$project && !empty($company)) {
            $compKey = \App\Services\AiEngineService::cleanBrandKey($company);
            $project = Project::where('company', 'like', "%{$company}%")
                ->orWhere('company', 'like', "%{$compKey}%")
                ->first();
        }

        $businessContext = '';
        if ($project) {
            $kws = $project->keywords()->take(8)->pluck('keyword')->toArray();
            if (!empty($kws)) {
                $otherKws = array_values(array_filter($kws, fn($k) => strtolower(trim($k)) !== strtolower(trim($keyword))));
                if (!empty($otherKws)) {
                    $businessContext = "Relevante diensten, producten en zoekwoorden van {$company}: " . implode(', ', $otherKws) . ".";
                }
            }
        }

        if (!empty($apiKey)) {
            try {
                $promptMsg = "Je bent een expert in AI Search Optimization (GEO) en consumentenzoekgedrag in AI zoekmachines (zoals ChatGPT, Gemini, Perplexity).
Bedrijfsnaam van de klant: \"{$company}\"
{$businessContext}
Zoekwoord: \"{$keyword}\"

Genereer exact 3 realistische, natuurlijke zoekvragen (prompts) in vloeiend Nederlands die echte mensen en potentiële klanten typen in AI zoekmachines wanneer ze naar deze specifieke producten, diensten of dit bedrijf zoeken.

STRIKTE REGELS:
1. Maak er 100% natuurlijke, vlot geformuleerde Nederlandse consumenten- of zakelijke zoekvragen van.
2. Houd rekening met de specifieke branche en diensten van \"{$company}\" (bijv. als het bedrijf personenalarmering/alarmknoppen voor senioren levert, stel vragen over alarmknoppen en alarmering voor ouderen; verzin GEEN online marketing of IT beveiliging tenzij dat expliciet de branche is).
3. Als het zoekwoord de bedrijfsnaam of een merknaam is (zoals \"{$keyword}\"), formuleer dan vragen die consumenten stellen over de betrouwbaarheid, ervaringen, reviews of het specifieke aanbod van dit merk (bijv. \"Wat zijn de ervaringen met {$company}?\", \"Is {$company} een betrouwbare keuze voor senioren alarmering?\", \"Hoe werkt de alarmknop van {$company}?\").
4. Gebruik NOOIT kromme sjablonen zoals \"...voor {$keyword}?\".
5. Output uitsluitend de 3 zinnen gescheiden door een verticale streep (|) zonder nummering of inleidende tekst.";

                $startTime = microtime(true);
                $response = Http::withToken($apiKey)
                    ->timeout(10)
                    ->post('https://api.openai.com/v1/chat/completions', [
                        'model' => 'gpt-4o-mini',
                        'messages' => [['role' => 'user', 'content' => $promptMsg]],
                        'max_tokens' => 300,
                        'temperature' => 0.4,
                    ]);

                $duration = (int) round((microtime(true) - $startTime) * 1000);

                if ($response->successful()) {
                    $text = trim($response->json('choices.0.message.content') ?? '');
                    $usage = $response->json('usage') ?? [];
                    $inTokens = $usage['prompt_tokens'] ?? 110;
                    $outTokens = $usage['completion_tokens'] ?? 45;
                    \App\Services\LlmCostService::recordUsage(
                        'openai',
                        'gpt-4o-mini',
                        'prompt_generation',
                        $inTokens,
                        $outTokens,
                        'SUCCESS',
                        $duration,
                        $project?->id,
                        null,
                        false,
                        ['keyword' => $keyword, 'company' => $company]
                    );

                    if (str_contains($text, '|')) {
                        $parts = array_values(array_filter(array_map('trim', explode('|', $text))));
                        if (count($parts) >= 2) {
                            $resPrompts = array_slice($parts, 0, 3);
                            GeoLog::info("✅ [AI Prompt Gen] 3 prompts gegenereerd via OpenAI gpt-4o-mini in {$duration}ms voor keyword \"{$keyword}\"");
                            return $resPrompts;
                        }
                    }
                }
            } catch (\Exception $e) {
                GeoLog::warning("⚠️ [AI Prompt Gen Waarschuwing] {$e->getMessage()}");
            }
        }

        $kwLower = strtolower(trim($keyword));
        $fallback = [
            "Wat zijn de beste {$kwLower} opties?",
            "Welke partij gespecialiseerd in {$kwLower} raden jullie aan?",
            "Top aanbevolen specialisten voor {$kwLower}",
        ];
        GeoLog::info("ℹ️ [AI Prompt Gen] Standaard prompt templates gebruikt voor keyword \"{$keyword}\"");
        return $fallback;
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

        $activeCount = Prompt::where('project_id', $projectId)
            ->where(function ($q) use ($activeKeywordIds) {
                $q->whereIn('keyword_id', $activeKeywordIds)
                  ->orWhereNull('keyword_id');
            })
            ->count();

        Project::where('id', $projectId)->update(['prompts_count' => $activeCount]);

        return $activeCount;
    }

    public function store(Request $request): JsonResponse
    {
        if (!$this->isStaffOrAdmin($request)) {
            return response()->json(['error' => 'Alleen admins en Saleswizard medewerkers kunnen prompts toevoegen.'], 403);
        }

        $company = $request->input('company', 'saleswizard');
        $projectId = $request->input('project_id');
        $text = trim($request->input('text', ''));
        $tag = $request->input('tag', 'Algemeen');
        $engines = $request->input('engines');
        $keywordId = $request->input('keyword_id');

        if (empty($text)) {
            return response()->json(['error' => 'Prompt tekst is verplicht.'], 400);
        }

        $decoded = trim(urldecode($company));
        $companyKey = \App\Services\AiEngineService::cleanBrandKey($decoded);

        if ($keywordId) {
            $kw = Keyword::find($keywordId);
            if ($kw && $kw->project_id) {
                $projectId = $kw->project_id;
            }
        }

        $project = $projectId ? Project::find($projectId) : Project::whereRaw('LOWER(company) = ?', [strtolower($decoded)])
            ->orWhereRaw('LOWER(company) = ?', [strtolower("{$companyKey}.nl")])
            ->orWhereRaw('LOWER(company) = ?', [strtolower("{$companyKey}.com")])
            ->orWhereRaw('LOWER(company) = ?', [strtolower("{$companyKey}.eu")])
            ->orWhereRaw('LOWER(company) = ?', [strtolower($companyKey)])
            ->first();

        if ($project) {
            $projectId = $project->id;
            $companyKey = \App\Services\AiEngineService::cleanBrandKey($project->company);
        }

        $defaultEngines = $engines ?: AiEngineService::getEnabledEngines();

        $prompt = Prompt::create([
            'project_id' => $projectId,
            'keyword_id' => $keywordId ? (int) $keywordId : null,
            'prompt_text' => $text,
            'category' => $tag,
            'response_summary' => 'Wachtend op achtergrond scan...',
            'brand_mentioned' => false,
            'position' => null,
            'sentiment' => 'N/A',
            'engine' => 'ChatGPT',
            'status' => 'pending',
            'engines' => $defaultEngines,
        ]);

        $newTotal = $this->recalculateProjectPromptCount($projectId);

        GeoLog::info("📝 [PROMPT AANGEMAAKT] ID #{$prompt->id} gekoppeld aan Project ID: #" . ($projectId ?? 'geen') . " (Keyword ID: #" . ($keywordId ?? 'geen') . ")");

        ProcessPromptJob::dispatch($prompt->id);

        return response()->json([
            'success' => true,
            'totalUsedPrompts' => $newTotal,
            'prompt' => [
                'id' => $prompt->id,
                'project_id' => $prompt->project_id,
                'keyword_id' => $prompt->keyword_id,
                'text' => $prompt->prompt_text,
                'tag' => $prompt->category,
                'engines' => $defaultEngines,
                'mentioned' => false,
                'position' => null,
                'sentiment' => 'N/A',
                'status' => 'pending',
                'dateAdded' => date('Y-m-d'),
            ]
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        if (!$this->isStaffOrAdmin($request)) {
            return response()->json(['error' => 'Alleen admins en Saleswizard medewerkers kunnen prompts bewerken.'], 403);
        }

        $prompt = Prompt::find($id);
        if (!$prompt) {
            return response()->json(['error' => 'Prompt niet gevonden.'], 404);
        }

        $text = trim((string) $request->input('text', $prompt->prompt_text));
        if ($text === '') {
            return response()->json(['error' => 'Prompt tekst mag niet leeg zijn.'], 400);
        }

        $resetNulmeting = $request->boolean('reset_nulmeting', false);
        $rescan = $request->boolean('rescan', $resetNulmeting);

        $updateData = [
            'prompt_text' => $text,
            'updated_at' => now(),
        ];

        if ($request->has('keyword_id')) {
            $kwId = $request->input('keyword_id');
            $updateData['keyword_id'] = $kwId ? (int) $kwId : null;
        }

        if ($resetNulmeting) {
            $resObj = is_array($prompt->results) ? $prompt->results : json_decode($prompt->results ?? '[]', true);
            if (is_array($resObj)) {
                $resObj['history'] = [];
                $updateData['results'] = $resObj;
            }
            $updateData['created_at'] = now();
        }

        if ($rescan) {
            $updateData['status'] = 'pending';
        }

        $prompt->update($updateData);

        if ($rescan) {
            ProcessPromptJob::dispatch($prompt->id);
        }

        return response()->json([
            'success' => true,
            'message' => $resetNulmeting
                ? 'Prompt bijgewerkt en nieuwe 0-meting gestart.'
                : 'Prompt succesvol bijgewerkt.',
            'prompt' => [
                'id' => $prompt->id,
                'project_id' => $prompt->project_id,
                'keyword_id' => $prompt->keyword_id,
                'text' => $prompt->prompt_text,
                'status' => $prompt->status,
            ],
        ]);
    }

    /**
     * Start a new 0-meting (Baseline reset) for specific prompt(s), a keyword, or an entire project.
     * Clears historical measurement points so the current/new scan becomes the fresh Nulmeting.
     */
    public function resetNulmeting(Request $request): JsonResponse
    {
        if (!$this->isStaffOrAdmin($request)) {
            return response()->json(['error' => 'Alleen admins en Saleswizard medewerkers kunnen een nieuwe 0-meting starten.'], 403);
        }

        $projectId = $request->input('project_id');
        $company = $request->input('company');
        $keywordId = $request->input('keyword_id');
        $promptIds = $request->input('prompt_ids', []);
        $rescan = $request->has('rescan') ? $request->boolean('rescan') : true;

        $project = null;
        if ($projectId) {
            $project = Project::find($projectId);
        } elseif ($company) {
            $decoded = trim(urldecode((string) $company));
            $companyKey = AiEngineService::cleanBrandKey($decoded);
            $project = Project::whereRaw('LOWER(company) = ?', [strtolower($decoded)])
                ->orWhereRaw('LOWER(company) = ?', [strtolower("{$companyKey}.nl")])
                ->orWhereRaw('LOWER(company) = ?', [strtolower("{$companyKey}.com")])
                ->orWhereRaw('LOWER(company) = ?', [strtolower("{$companyKey}.eu")])
                ->orWhereRaw('LOWER(company) = ?', [strtolower($companyKey)])
                ->first();
        }

        $promptQuery = Prompt::query();
        $keywordQuery = Keyword::query();

        if (!empty($promptIds) && is_array($promptIds)) {
            $promptQuery->whereIn('id', $promptIds);
            $kwIdsFromPrompts = Prompt::whereIn('id', $promptIds)->whereNotNull('keyword_id')->pluck('keyword_id')->unique()->toArray();
            if (!empty($kwIdsFromPrompts)) {
                $keywordQuery->whereIn('id', $kwIdsFromPrompts);
            } else {
                $keywordQuery->whereRaw('1 = 0');
            }
        } elseif ($keywordId) {
            $promptQuery->where('keyword_id', (int) $keywordId);
            $keywordQuery->where('id', (int) $keywordId);
        } elseif ($project) {
            $promptQuery->where('project_id', $project->id);
            $keywordQuery->where('project_id', $project->id)
                ->where(function ($q) {
                    $q->where('is_archived', false)->orWhereNull('is_archived');
                });
        } else {
            return response()->json(['error' => 'Geef een geldig project, zoekterm of prompt op voor de nieuwe 0-meting.'], 400);
        }

        $promptsToReset = $promptQuery->get();
        $keywordsToReset = $keywordQuery->get();

        $nowStr = now()->format('Y-m-d');
        $displayDate = now()->format('d M Y');
        $timeStr = now()->format('H:i');

        foreach ($promptsToReset as $p) {
            $resObj = !empty($p->results) ? (is_array($p->results) ? $p->results : json_decode($p->results, true)) : [];
            if (!is_array($resObj)) {
                $resObj = [];
            }

            if ($rescan) {
                // Clear history so the incoming fresh scan becomes history[0] (isBaseline = true, label = Nulmeting)
                $resObj['history'] = [];
                $p->update([
                    'results' => $resObj,
                    'status' => 'pending',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                ProcessPromptJob::dispatch($p->id);
            } else {
                // Immediately set current live result as the sole new Nulmeting snapshot
                $liveMetrics = AiEngineService::extractLivePromptMetrics($resObj);
                $resObj['history'] = [[
                    'date' => $nowStr,
                    'displayDate' => $displayDate,
                    'time' => $timeStr,
                    'isBaseline' => true,
                    'label' => 'Nulmeting',
                    'mentioned' => $liveMetrics['mentioned'],
                    'position' => $liveMetrics['mentioned'] ? (float) ($liveMetrics['position'] ?: 1) : null,
                    'totalMentions' => (int) $liveMetrics['totalMentions'],
                    'totalModels' => (int) $liveMetrics['totalModels'],
                    'overallScore' => (int) $liveMetrics['overallScore'],
                ]];
                $p->update([
                    'results' => $resObj,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }

        foreach ($keywordsToReset as $kw) {
            $comps = is_array($kw->competitors_json) ? $kw->competitors_json : json_decode($kw->competitors_json ?? '[]', true);
            if (is_array($comps) && !empty($comps)) {
                foreach ($comps as &$cItem) {
                    if (!empty($cItem['isSelf'])) {
                        $rankDigits = preg_replace('/[^0-9]/', '', (string) ($cItem['rank'] ?? ''));
                        $cItem['history'] = [[
                            'date' => $nowStr,
                            'displayDate' => $displayDate,
                            'time' => $timeStr,
                            'isBaseline' => true,
                            'label' => 'Nulmeting',
                            'rank' => $rankDigits !== '' ? (int) $rankDigits : null,
                            'position' => is_numeric($cItem['position'] ?? null) ? (float) $cItem['position'] : null,
                            'sov' => (int) ($cItem['sov'] ?? 0),
                            'citations' => (int) ($cItem['citations'] ?? 0),
                        ]];
                    } else {
                        unset($cItem['history']);
                    }
                }
                unset($cItem);
                $kw->competitors_json = $comps;
            }
            $kw->created_at = now();
            $kw->updated_at = now();
            $kw->save();

            if ($rescan) {
                \App\Jobs\ProcessKeywordCompetitorsJob::dispatch($kw->id, $kw->keyword, $kw->company_key, true);
            }
        }

        GeoLog::info("🎯 [NIEUWE 0-METING] Nieuwe nulmeting gestart voor " . $promptsToReset->count() . " prompt(s) en " . $keywordsToReset->count() . " zoekterm(en).");

        return response()->json([
            'success' => true,
            'promptsCount' => $promptsToReset->count(),
            'keywordsCount' => $keywordsToReset->count(),
            'rescan' => $rescan,
            'baselineDate' => $displayDate,
            'message' => $rescan
                ? "Nieuwe 0-meting gestart! {$promptsToReset->count()} prompt(s) worden nu opnieuw gescand als nieuw startpunt ({$displayDate})."
                : "Nieuwe 0-meting vastgelegd op {$displayDate} voor {$promptsToReset->count()} prompt(s).",
        ]);
    }

    public function scan(int $id): JsonResponse
    {
        $promptRecord = Prompt::find($id);
        if (!$promptRecord) {
            return response()->json(['error' => 'Prompt niet gevonden'], 404);
        }

        GeoLog::info("🔄 [HANDMATIGE SCAN] Handmatige scan gestart voor Prompt #{$id}: \"{$promptRecord->prompt_text}\"");

        $promptRecord->update([
            'status' => 'pending',
            'updated_at' => now(),
        ]);

        ProcessPromptJob::dispatch($id);

        return response()->json(['success' => true, 'message' => 'Scan gestart op de achtergrond.']);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        if (!$this->isStaffOrAdmin($request)) {
            return response()->json(['error' => 'Alleen admins en Saleswizard medewerkers mogen prompts verwijderen en de limiet resetten.'], 403);
        }

        $prompt = Prompt::find($id);
        if (!$prompt) {
            return response()->json(['error' => 'Prompt niet gevonden'], 404);
        }

        $projectId = $prompt->project_id;
        \App\Models\Citation::where('prompt_id', $prompt->id)->delete();
        $prompt->delete();

        $newTotal = $this->recalculateProjectPromptCount($projectId);

        return response()->json([
            'success' => true,
            'message' => 'Prompt succesvol verwijderd en promptlimiet vrijgegeven.',
            'totalUsedPrompts' => $newTotal,
        ]);
    }

    public function bulkDelete(Request $request): JsonResponse
    {
        if (!$this->isStaffOrAdmin($request)) {
            return response()->json(['error' => 'Alleen admins en Saleswizard medewerkers mogen prompts verwijderen en de limiet resetten.'], 403);
        }

        $ids = $request->input('ids', []);
        if (!is_array($ids) || empty($ids)) {
            return response()->json(['error' => 'Geen geldige IDs opgegeven.'], 400);
        }

        $firstPrompt = Prompt::whereIn('id', $ids)->first();
        $projectId = $firstPrompt?->project_id;

        \App\Models\Citation::whereIn('prompt_id', $ids)->delete();
        Prompt::whereIn('id', $ids)->delete();

        $newTotal = $this->recalculateProjectPromptCount($projectId);

        return response()->json([
            'success' => true,
            'message' => 'Prompts succesvol verwijderd en promptlimiet vrijgegeven.',
            'totalUsedPrompts' => $newTotal,
        ]);
    }
}
