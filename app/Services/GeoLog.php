<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;

class GeoLog
{
    /**
     * Write formatted log to Laravel logs and directly to console/STDOUT
     */
    public static function info(string $message, array $context = []): void
    {
        Log::info($message, $context);
        self::outputToCli("ℹ️  {$message}");
    }

    public static function section(string $title): void
    {
        $line = str_repeat('=', 80);
        $content = "\n{$line}\n🚀 [GEO PIPELINE] {$title}\n{$line}";
        Log::info($content);
        self::outputToCli($content);
    }

    public static function subSection(string $title): void
    {
        $line = str_repeat('-', 70);
        $content = "\n{$line}\n📌 {$title}\n{$line}";
        Log::info($content);
        self::outputToCli($content);
    }

    public static function box(string $title, array $lines = []): void
    {
        $box = "\n┌" . str_repeat('─', 78) . "\n";
        $box .= "│ 🔹 {$title}\n";
        $box .= "├" . str_repeat('─', 78) . "\n";
        foreach ($lines as $line) {
            $box .= "│  " . $line . "\n";
        }
        $box .= "└" . str_repeat('─', 78);

        Log::info($box);
        self::outputToCli($box);
    }

    public static function aiCall(string $modelName, string $modelIdentifier, string $promptPreview, string $status, ?int $latencyMs = null, ?string $extra = null): void
    {
        $statusIcon = match ($status) {
            'START' => '⏳ [REQUEST]',
            'SUCCESS' => '✅ [SUCCESS]',
            'FALLBACK' => '⚠️ [FALLBACK/SIMULATOR]',
            'ERROR' => '❌ [ERROR]',
            default => '🔹 [INFO]',
        };

        $latencyStr = $latencyMs !== null ? " ({$latencyMs}ms)" : '';
        $extraStr = $extra ? " | {$extra}" : '';
        $msg = "🤖 [AI ENGINE] {$statusIcon} {$modelName} ({$modelIdentifier}){$latencyStr}{$extraStr}";
        
        Log::info($msg);
        self::outputToCli($msg);
    }

    public static function error(string $message, array $context = []): void
    {
        Log::error($message, $context);
        self::outputToCli("❌ [ERROR] {$message}");
    }

    public static function warning(string $message, array $context = []): void
    {
        Log::warning($message, $context);
        self::outputToCli("⚠️ [WARNING] {$message}");
    }

    protected static function outputToCli(string $text): void
    {
        $timestamp = date('Y-m-d H:i:s');
        $formatted = "[{$timestamp}] {$text}\n";

        // If running in CLI / Artisan queue:work / dev server, echo directly so it shows in docker logs
        if (defined('STDOUT') && is_resource(STDOUT)) {
            @fwrite(STDOUT, $formatted);
        } else {
            @error_log($text);
        }
    }
}
