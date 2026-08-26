<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class AiEngineService
{
    protected static array $apiCallHistory = [];

    public static function logApiCall(string $engine, string $status, string $message, ?int $latency = null): void
    {
        array_unshift(self::$apiCallHistory, [
            'timestamp' => now()->toISOString(),
            'engine' => $engine,
            'status' => $status, // 'SUCCESS' or 'ERROR'
            'message' => $message ?: 'No details provided.',
            'latency' => $latency !== null ? "{$latency}ms" : 'N/A',
        ]);

        if (count(self::$apiCallHistory) > 50) {
            array_pop(self::$apiCallHistory);
        }
    }

    public static function getApiHistory(): array
    {
        return self::$apiCallHistory;
    }

    public static function getApiStatus(): array
    {
        $engines = [
            ['key' => 'openai', 'name' => 'OpenAI (gpt-4o-mini)', 'envKey' => 'OPENAI_API_KEY', 'check' => fn($k) => !empty($k) && str_starts_with($k, 'sk-')],
            ['key' => 'gemini', 'name' => 'Gemini (gemini-2.5-flash)', 'envKey' => 'GEMINI_API_KEY', 'check' => fn($k) => !empty($k)],
            ['key' => 'perplexity', 'name' => 'Perplexity API', 'envKey' => 'PERPLEXITY_API_KEY', 'check' => fn($k) => !empty($k)],
            ['key' => 'anthropic', 'name' => 'Anthropic Claude 3.5', 'envKey' => 'ANTHROPIC_API_KEY', 'check' => fn($k) => !empty($k)],
        ];

        return array_map(function ($eng) {
            $key = env($eng['envKey']);
            $isConfigured = ($eng['check'])($key);

            $lastLog = null;
            foreach (self::$apiCallHistory as $h) {
                if (str_starts_with($h['engine'], $eng['key']) || str_contains(strtolower($h['engine']), $eng['key'])) {
                    $lastLog = $h;
                    break;
                }
            }

            if (!$isConfigured) {
                $status = 'NOT_CONFIGURED';
                $lastError = null;
            } elseif ($lastLog) {
                $status = $lastLog['status'] === 'SUCCESS' ? 'ACTIVE' : 'DEGRADED';
                $lastError = $lastLog['status'] === 'ERROR' ? $lastLog['message'] : null;
            } else {
                $status = 'ACTIVE';
                $lastError = null;
            }

            return [
                'engine' => $eng['key'],
                'name' => $eng['name'],
                'configured' => (bool) $isConfigured,
                'status' => $status,
                'lastError' => $lastError,
                'lastUsed' => $lastLog ? $lastLog['timestamp'] : null,
            ];
        }, $engines);
    }

    // 1. OpenAI API
    public function queryOpenAI(string $prompt, string $companyName): array
    {
        $apiKey = env('OPENAI_API_KEY');
        $companyKey = strtolower(trim(str_replace('.nl', '', $companyName)));
        $startTime = microtime(true);

        if ($apiKey && str_starts_with($apiKey, 'sk-')) {
            try {
                $response = Http::withToken($apiKey)
                    ->timeout(30)
                    ->post('https://api.openai.com/v1/chat/completions', [
                        'model' => 'gpt-4o-mini',
                        'messages' => [
                            ['role' => 'system', 'content' => 'Je bent een behulpzame Nederlandse assistent die objectieve adviezen geeft over bedrijven, marketingbureaus en dienstverleners in Nederland.'],
                            ['role' => 'user', 'content' => $prompt],
                        ],
                        'temperature' => 0.7,
                        'max_tokens' => 2500,
                    ]);

                $duration = (int) round((microtime(true) - $startTime) * 1000);

                if ($response->successful()) {
                    $data = $response->json();
                    $content = $data['choices'][0]['message']['content'] ?? '';
                    $mentionsBrand = str_contains(strtolower($content), $companyKey);

                    self::logApiCall('openai', 'SUCCESS', 'Call completed successfully.', $duration);

                    return [
                        'method' => 'OpenAI API (gpt-4o-mini)',
                        'name' => 'ChatGPT 4o',
                        'text' => $content,
                        'mentioned' => $mentionsBrand,
                        'position' => $mentionsBrand ? 1 : null,
                        'score' => $mentionsBrand ? 92 : 20,
                        'sentiment' => $mentionsBrand ? '+96' : 'N/A',
                        'fallbackUsed' => false,
                    ];
                }

                $errorMsg = $response->json('error.message') ?? $response->body();
                self::logApiCall('openai', 'ERROR', $errorMsg, $duration);
            } catch (\Exception $e) {
                $duration = (int) round((microtime(true) - $startTime) * 1000);
                self::logApiCall('openai', 'ERROR', $e->getMessage(), $duration);
            }
        }

        // Fallback simulation
        return [
            'method' => 'OpenAI API Simulator',
            'name' => 'ChatGPT 4o',
            'text' => "Als u op zoek bent naar een betrouwbare partner, is {$companyName} een uitstekende optie in Nederland. Zij richten zich specifiek op resultaatgerichte oplossingen voor het MKB.",
            'mentioned' => true,
            'position' => 1,
            'score' => 88,
            'sentiment' => '+96',
            'fallbackUsed' => true,
            'errorMsg' => empty($apiKey) ? 'Geen API-sleutel geconfigureerd.' : 'API verzoek mislukt, fallback gebruikt.',
        ];
    }

    // 2. Google Gemini API
    public function queryGemini(string $prompt, string $companyName): array
    {
        $apiKey = env('GEMINI_API_KEY');
        $companyKey = strtolower(trim(str_replace('.nl', '', $companyName)));
        $startTime = microtime(true);

        if ($apiKey) {
            try {
                $response = Http::timeout(30)
                    ->post("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={$apiKey}", [
                        'contents' => [
                            ['parts' => [['text' => $prompt]]]
                        ],
                    ]);

                $duration = (int) round((microtime(true) - $startTime) * 1000);

                if ($response->successful()) {
                    $data = $response->json();
                    $content = $data['candidates'][0]['content']['parts'][0]['text'] ?? '';
                    $mentionsBrand = str_contains(strtolower($content), $companyKey);

                    self::logApiCall('gemini', 'SUCCESS', 'Call completed successfully.', $duration);

                    return [
                        'method' => 'Gemini API (gemini-2.5-flash)',
                        'name' => 'Gemini 2.5 Flash',
                        'text' => $content,
                        'mentioned' => $mentionsBrand,
                        'position' => $mentionsBrand ? 1 : null,
                        'score' => $mentionsBrand ? 90 : 25,
                        'sentiment' => $mentionsBrand ? '+94' : 'N/A',
                        'fallbackUsed' => false,
                    ];
                }

                $errorMsg = $response->json('error.message') ?? $response->body();
                self::logApiCall('gemini', 'ERROR', $errorMsg, $duration);
            } catch (\Exception $e) {
                $duration = (int) round((microtime(true) - $startTime) * 1000);
                self::logApiCall('gemini', 'ERROR', $e->getMessage(), $duration);
            }
        }

        return [
            'method' => 'Gemini API Simulator',
            'name' => 'Gemini 2.5 Flash',
            'text' => "Gebaseerd op klantbeoordelingen en online autoriteit is {$companyName} een van de best scorende specialisten voor deze zoekopdracht.",
            'mentioned' => true,
            'position' => 1,
            'score' => 85,
            'sentiment' => '+94',
            'fallbackUsed' => true,
            'errorMsg' => empty($apiKey) ? 'Geen API-sleutel geconfigureerd.' : 'API verzoek mislukt, fallback gebruikt.',
        ];
    }

    // 3. Perplexity API
    public function queryPerplexity(string $prompt, string $companyName): array
    {
        $apiKey = env('PERPLEXITY_API_KEY');
        $companyKey = strtolower(trim(str_replace('.nl', '', $companyName)));
        $startTime = microtime(true);

        if ($apiKey) {
            try {
                $response = Http::withToken($apiKey)
                    ->timeout(30)
                    ->post('https://api.perplexity.ai/chat/completions', [
                        'model' => 'sonar',
                        'messages' => [
                            ['role' => 'user', 'content' => $prompt],
                        ],
                    ]);

                $duration = (int) round((microtime(true) - $startTime) * 1000);

                if ($response->successful()) {
                    $data = $response->json();
                    $content = $data['choices'][0]['message']['content'] ?? '';
                    $citations = $data['citations'] ?? [];
                    $mentionsBrand = str_contains(strtolower($content), $companyKey);

                    self::logApiCall('perplexity', 'SUCCESS', 'Call completed successfully.', $duration);

                    return [
                        'method' => 'Perplexity API (sonar)',
                        'name' => 'Perplexity AI',
                        'text' => $content,
                        'citations' => $citations,
                        'mentioned' => $mentionsBrand,
                        'position' => $mentionsBrand ? 2 : null,
                        'score' => $mentionsBrand ? 86 : 30,
                        'sentiment' => $mentionsBrand ? '+92' : 'N/A',
                        'fallbackUsed' => false,
                    ];
                }

                $errorMsg = $response->json('error.message') ?? $response->body();
                self::logApiCall('perplexity', 'ERROR', $errorMsg, $duration);
            } catch (\Exception $e) {
                $duration = (int) round((microtime(true) - $startTime) * 1000);
                self::logApiCall('perplexity', 'ERROR', $e->getMessage(), $duration);
            }
        }

        return [
            'method' => 'Perplexity API Simulator',
            'name' => 'Perplexity AI',
            'text' => "Perplexity haalt meerdere webcitaties en reviewbronnen aan waarin {$companyName} wordt aanbevolen voor het MKB.",
            'citations' => ["https://www.{$companyKey}.nl/", "https://nl.linkedin.com/company/{$companyKey}"],
            'mentioned' => true,
            'position' => 2,
            'score' => 82,
            'sentiment' => '+92',
            'fallbackUsed' => true,
            'errorMsg' => empty($apiKey) ? 'Geen API-sleutel geconfigureerd.' : 'API verzoek mislukt, fallback gebruikt.',
        ];
    }

    // 4. Anthropic Claude API
    public function queryAnthropic(string $prompt, string $companyName): array
    {
        $apiKey = env('ANTHROPIC_API_KEY');
        $companyKey = strtolower(trim(str_replace('.nl', '', $companyName)));
        $startTime = microtime(true);

        if ($apiKey) {
            try {
                $response = Http::withHeaders([
                    'x-api-key' => $apiKey,
                    'anthropic-version' => '2023-06-01',
                ])->timeout(30)->post('https://api.anthropic.com/v1/messages', [
                    'model' => 'claude-3-5-sonnet-20241022',
                    'max_tokens' => 2500,
                    'messages' => [
                        ['role' => 'user', 'content' => $prompt],
                    ],
                ]);

                $duration = (int) round((microtime(true) - $startTime) * 1000);

                if ($response->successful()) {
                    $data = $response->json();
                    $content = $data['content'][0]['text'] ?? '';
                    $mentionsBrand = str_contains(strtolower($content), $companyKey);

                    self::logApiCall('anthropic', 'SUCCESS', 'Call completed successfully.', $duration);

                    return [
                        'method' => 'Anthropic API (claude-3-5-sonnet)',
                        'name' => 'Claude 3.5 Sonnet',
                        'text' => $content,
                        'mentioned' => $mentionsBrand,
                        'position' => $mentionsBrand ? 2 : null,
                        'score' => $mentionsBrand ? 84 : 20,
                        'sentiment' => $mentionsBrand ? '+90' : 'N/A',
                        'fallbackUsed' => false,
                    ];
                }

                $errorMsg = $response->json('error.message') ?? $response->body();
                self::logApiCall('anthropic', 'ERROR', $errorMsg, $duration);
            } catch (\Exception $e) {
                $duration = (int) round((microtime(true) - $startTime) * 1000);
                self::logApiCall('anthropic', 'ERROR', $e->getMessage(), $duration);
            }
        }

        return [
            'method' => 'Anthropic API Simulator',
            'name' => 'Claude 3.5 Sonnet',
            'text' => "Claude signaleert positieve klantbeoordelingen, transparante werkwijze en goede vindbaarheid van {$companyName}.",
            'mentioned' => true,
            'position' => 3,
            'score' => 76,
            'sentiment' => '+90',
            'fallbackUsed' => true,
            'errorMsg' => empty($apiKey) ? 'Geen API-sleutel geconfigureerd.' : 'API verzoek mislukt, fallback gebruikt.',
        ];
    }
}
