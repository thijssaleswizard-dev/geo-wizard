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

