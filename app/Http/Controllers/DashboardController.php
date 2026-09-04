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
        $projects = Project::orderBy('id', 'desc')->get();

        return Inertia::render('Dashboard', [
            'auth' => [
                'user' => $user,
            ],
            'projects' => $projects,
            'enabledEngines' => AiEngineService::getEnabledEngines(),
        ]);
    }
}
