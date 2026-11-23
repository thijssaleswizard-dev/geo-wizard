<?php

namespace App\Http\Controllers;

use App\Models\Project;
use App\Services\AiEngineService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $projects = Project::withCount('prompts')->orderBy('id', 'desc')->get()->map(function ($proj) {
            $arr = $proj->toArray();
            $arr['promptsCount'] = $proj->prompts_count ?? $proj->promptsCount ?? 0;
            return $arr;
        });

        return Inertia::render('Dashboard', [
            'auth' => [
                'user' => $user,
            ],
            'projects' => $projects,
            'enabledEngines' => AiEngineService::getEnabledEngines(),
        ]);
    }
}
