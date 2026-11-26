<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'openai' => [
        'key' => env('OPENAI_API_KEY'),
    ],

    'gemini' => [
        'key' => env('GEMINI_API_KEY'),
    ],

    'perplexity' => [
        'key' => env('PERPLEXITY_API_KEY'),
    ],

    'anthropic' => [
        'key' => env('ANTHROPIC_API_KEY'),
    ],

    'copilot' => [
        'key' => env('COPILOT_API_KEY'),
    ],

    'meta' => [
        'key' => env('META_API_KEY'),
    ],

    'mollie' => [
        'key' => env('MOLLIE_KEY') ?: env('MOLLIE_API_KEY'),
        'webhook_url' => env('MOLLIE_WEBHOOK_URL'),
    ],

    'dataforseo' => [
        'login' => env('DATAFORSEO_LOGIN'),
        'password' => env('DATAFORSEO_PASSWORD'),
        'base_url' => env('DATAFORSEO_BASE_URL', 'https://api.dataforseo.com/v3'),
        'location_code' => (int) env('DATAFORSEO_LOCATION_CODE', 2528),
        'language_code' => env('DATAFORSEO_LANGUAGE_CODE', 'nl'),
        'country_iso' => env('DATAFORSEO_COUNTRY_ISO', 'NL'),
        'timeout' => (int) env('DATAFORSEO_TIMEOUT', 125),
        'fallback_timeout' => (int) env('DATAFORSEO_FALLBACK_TIMEOUT', 45),
    ],

];
