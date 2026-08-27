<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$key = env('GEMINI_API_KEY');
$res = Illuminate\Support\Facades\Http::post("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key={$key}", [
    'contents' => [
        ['parts' => [['text' => 'Hallo, noem 1 goed marketing bureau in Arnhem.']]]
    ],
]);
echo "Status: " . $res->status() . "\n";
echo "Body: " . $res->body() . "\n";
