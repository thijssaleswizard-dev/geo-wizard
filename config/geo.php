<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Prompt scan strategy
    |--------------------------------------------------------------------------
    |
    | 'adaptive' : prompts whose AI results stay unchanged are scanned less
    |              often (1 → 2 → 3 → 5 → 7 days). As soon as a result changes,
    |              or the client's website content changes, the prompt goes
    |              back to a daily scan.
    | 'daily'    : every prompt is scanned every night (most expensive).
    |
    */
    'scan_mode' => env('GEO_SCAN_MODE', 'adaptive'),

    // Interval (in days) per number of consecutive unchanged scans.
    'scan_backoff_days' => [1, 2, 3, 5, 7],

    // Hard maximum interval so every prompt is re-checked at least this often.
    'scan_max_interval_days' => (int) env('GEO_SCAN_MAX_INTERVAL_DAYS', 7),

    // Re-scan all prompts of a project when the client's homepage content changes.
    'website_change_detection' => (bool) env('GEO_WEBSITE_CHANGE_DETECTION', true),

    /*
    |--------------------------------------------------------------------------
    | AI Scan Driver ('auto' | 'dataforseo' | 'api')
    |--------------------------------------------------------------------------
    |
    | 'auto'       : Uses DataForSEO Web-Client automatically when DATAFORSEO_LOGIN
    |                and DATAFORSEO_PASSWORD are set; otherwise falls back to direct APIs.
    | 'dataforseo' : Forces DataForSEO Web-Client (ChatGPT Web UI, Gemini Web UI,
    |                real Google.nl AI Overviews, Google.nl AI Mode, Perplexity & Claude).
    | 'api'        : Forces direct developer LLM APIs (OpenAI, Gemini, Perplexity, Anthropic).
    |
    */
    'ai_driver' => env('GEO_AI_DRIVER', 'auto'),
    'dataforseo_prefer_fast_responses' => (bool) env('DATAFORSEO_PREFER_FAST_RESPONSES', false),
    'dataforseo_chatgpt_model' => env('DATAFORSEO_CHATGPT_MODEL', 'gpt-4.1-mini'),
    'dataforseo_gemini_model' => env('DATAFORSEO_GEMINI_MODEL', 'gemini-2.5-flash'),
    'dataforseo_include_perplexity' => (bool) env('DATAFORSEO_INCLUDE_PERPLEXITY', true),
    'dataforseo_include_claude' => (bool) env('DATAFORSEO_INCLUDE_CLAUDE', true),
    'dataforseo_perplexity_model' => env('DATAFORSEO_PERPLEXITY_MODEL', 'sonar'),
    'dataforseo_claude_model' => env('DATAFORSEO_CLAUDE_MODEL', 'claude-haiku-4-5'),
    'dataforseo_claude_web_search' => (bool) env('DATAFORSEO_CLAUDE_WEB_SEARCH', true),

    /*
    |--------------------------------------------------------------------------
    | Provider pricing extras (USD)
    |--------------------------------------------------------------------------
    */
    'openai_web_search_fee_usd' => (float) env('OPENAI_WEB_SEARCH_FEE_USD', 0.025),

    /*
    |--------------------------------------------------------------------------
    | Provider admin keys (only needed to pull real billed costs)
    |--------------------------------------------------------------------------
    |
    | OpenAI : an Admin key, or a key with the "api.usage.read" scope.
    | Anthropic : an Admin API key (sk-ant-admin...).
    |
    */
    'openai_admin_key' => env('OPENAI_ADMIN_KEY'),
    'anthropic_admin_key' => env('ANTHROPIC_ADMIN_KEY'),
];

