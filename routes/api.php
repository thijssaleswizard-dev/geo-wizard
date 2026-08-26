<?php

use App\Http\Controllers\AuthApiController;
use App\Http\Controllers\CitationController;
use App\Http\Controllers\KeywordController;
use App\Http\Controllers\OverviewController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\ProjectController;
use App\Http\Controllers\PromptController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// Auth Routes
Route::post('/auth/login', [AuthApiController::class, 'login']);
Route::post('/auth/register', [AuthApiController::class, 'register']);

// Projects Routes
Route::get('/projects', [ProjectController::class, 'index']);
Route::post('/projects', [ProjectController::class, 'store']);
Route::put('/projects/{id}', [ProjectController::class, 'update']);
Route::delete('/projects/{company}', [ProjectController::class, 'destroy']);
Route::get('/projects/api-monitor/status', [ProjectController::class, 'apiMonitorStatus']);

// Keywords Routes
Route::get('/keywords', [KeywordController::class, 'index']);
Route::post('/keywords', [KeywordController::class, 'store']);
Route::post('/keywords/recommend', [KeywordController::class, 'recommend']);
Route::delete('/keywords/{id}', [KeywordController::class, 'destroy']);
Route::post('/keywords/bulk-delete', [KeywordController::class, 'bulkDelete']);

// Prompts Routes
Route::get('/prompts', [PromptController::class, 'index']);
Route::post('/prompts', [PromptController::class, 'store']);
Route::post('/prompts/generate', [PromptController::class, 'generate']);
Route::post('/prompts/{id}/scan', [PromptController::class, 'scan']);
Route::delete('/prompts/{id}', [PromptController::class, 'destroy']);
Route::post('/prompts/bulk-delete', [PromptController::class, 'bulkDelete']);

// Citations & Overview Routes
Route::get('/citations', [CitationController::class, 'index']);
Route::get('/overview-stats', [OverviewController::class, 'stats']);
Route::get('/recommendations', [OverviewController::class, 'recommendations']);
Route::get('/notifications', [OverviewController::class, 'notifications']);
Route::get('/agents-analytics', [OverviewController::class, 'agentsAnalytics']);

// Scraper Routes
Route::post('/scraper/run', [OverviewController::class, 'runScraper']);
Route::post('/scraper/sync-all', [OverviewController::class, 'syncAll']);

// Payments & Invoices Routes
Route::get('/payments/invoices', [PaymentController::class, 'invoices']);
Route::get('/payments/invoices/download/{filename}', [PaymentController::class, 'download']);
Route::post('/payments/webhook', [PaymentController::class, 'webhook']);
Route::post('/payments/simulate-payment', [PaymentController::class, 'simulatePayment']);

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

