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

        $query = Prompt::query()->orderBy('id', 'desc');

        if ($projectId) {
            $query->where('project_id', $projectId);
        } elseif ($company) {
            $decoded = trim(urldecode($company));
            $companyKey = strtolower(trim(str_replace('.nl', '', $decoded)));

            $project = Project::whereRaw('LOWER(company) = ?', [strtolower($decoded)])
                ->orWhereRaw('LOWER(company) = ?', [strtolower("{$decoded}.nl")])
                ->orWhereRaw('LOWER(company) = ?', [strtolower($companyKey)])
                ->first();

            if ($project) {
                $query->where('project_id', $project->id);
            }
        }

        $prompts = $query->get();

        $formatted = $prompts->map(function ($p) {
            $engines = $p->engines;
            if (is_string($engines)) {
                $engines = json_decode($engines, true);
            }
            if (!$engines) {
                $engines = ['chatgpt' => true, 'gemini' => true, 'perplexity' => true, 'copilot' => true, 'claude' => true, 'aio' => true];
            }

            $logs = $p->logs;
            if (is_string($logs)) {
                $logs = json_decode($logs, true);
            }

            return [
                'id' => $p->id,
                'project_id' => $p->project_id,
                'keyword_id' => $p->keyword_id,
                'text' => $p->prompt_text,
                'tag' => $p->category ?: 'Algemeen',
                'engines' => $engines,
                'mentioned' => (bool) $p->brand_mentioned,
                'position' => $p->position,
                'sentiment' => $p->sentiment ?: '+90',
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

        if (empty($keyword)) {
            return response()->json(['error' => 'Keyword is verplicht voor het genereren van prompts.'], 400);
        }

        $prompts = $this->generateNaturalPrompts($keyword, $company);

        return response()->json(['success' => true, 'prompts' => $prompts]);
    }

    /**
     * Generates 3 natural, conversational search questions that real users type into ChatGPT, Gemini, Perplexity.
     */
    public static function generateNaturalPrompts(string $keyword, string $company = 'Saleswizard'): array
    {
        $apiKey = env('OPENAI_API_KEY');

        if (!empty($apiKey)) {
            try {
                $promptMsg = "Je bent een expert in AI Search Optimization (GEO) en zoekgedrag in AI zoekmachines (zoals ChatGPT, Gemini, Perplexity).
Voor het zoekwoord: \"{$keyword}\"

Genereer exact 3 realistische, natuurlijke zoekvragen (prompts) in vloeiend Nederlands die echte mensen en potentiële klanten typen in AI zoekmachines wanneer ze naar deze dienst of dit type bedrijf zoeken.

STRIKTE REGELS:
1. Maak er 100% natuurlijke, vlot geformuleerde Nederlandse zinnen van (bijv. \"Wat zijn de beste online marketing bureaus in Arnhem?\", \"Welk online marketing bureau in Arnhem raden jullie aan voor MKB?\", \"Top aanbevolen marketingbureaus in Arnhem voor SEO en Google Ads\").
2. Gebruik NOOIT kromme sjablonen zoals \"...voor {$keyword}?\".
3. Maak de zinnen direct relevant voor consumenten en bedrijven die op zoek zijn naar aanbevelingen.

Output uitsluitend de 3 zinnen gescheiden door een verticale streep (|) zonder nummering of inleidende tekst.";

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

    public function store(Request $request): JsonResponse
    {
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
        $companyKey = strtolower(trim(str_replace('.nl', '', $decoded)));

        if ($keywordId) {
            $kw = Keyword::find($keywordId);
            if ($kw && $kw->project_id) {
                $projectId = $kw->project_id;
            }
        }

        $project = $projectId ? Project::find($projectId) : Project::whereRaw('LOWER(company) = ?', [strtolower($decoded)])
            ->orWhereRaw('LOWER(company) = ?', [strtolower("{$decoded}.nl")])
            ->orWhereRaw('LOWER(company) = ?', [strtolower($companyKey)])
            ->first();

        if ($project) {
            $projectId = $project->id;
            $companyKey = strtolower(trim(str_replace('.nl', '', $project->company)));
        }

        $defaultEngines = $engines ?: ['chatgpt' => true, 'gemini' => true, 'perplexity' => true, 'copilot' => true, 'claude' => true, 'aio' => true];

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

        GeoLog::info("📝 [PROMPT AANGEMAAKT] ID #{$prompt->id} gekoppeld aan Project ID: #" . ($projectId ?? 'geen') . " (Keyword ID: #" . ($keywordId ?? 'geen') . ")");

        ProcessPromptJob::dispatch($prompt->id);

        return response()->json([
            'success' => true,
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

    public function destroy(int $id): JsonResponse
    {
        $deleted = Prompt::where('id', $id)->delete();
        if (!$deleted) {
            return response()->json(['error' => 'Prompt niet gevonden'], 404);
        }
        return response()->json(['success' => true, 'message' => 'Prompt succesvol verwijderd']);
    }

    public function bulkDelete(Request $request): JsonResponse
    {
        $ids = $request->input('ids', []);
        if (!is_array($ids) || empty($ids)) {
            return response()->json(['error' => 'Geen geldige IDs opgegeven.'], 400);
        }

        Prompt::whereIn('id', $ids)->delete();
        return response()->json(['success' => true, 'message' => 'Prompts succesvol verwijderd.']);
    }
}
