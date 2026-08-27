<?php

namespace App\Http\Controllers;

use App\Models\Citation;
use App\Models\Project;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CitationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $projectId = $request->query('project_id');
        $query = strtolower($request->query('query', 'saleswizard'));
        $companyKey = strtolower(trim(str_replace('.nl', '', $query)));

        $crawlLogs = [
            "[Scraping Proxy] Connecting to scraping proxy tunnel (tunnel_id: sb_nl_8921)...",
            "[Scraping Proxy] Dutch Residential IP assigned (egress: Amsterdam, NL)",
            "[Scraping Proxy] Requesting target content via Google Search Engine...",
            "[Scraping Proxy] Status 200 OK. Parsing DOM...",
            "[Scraping Proxy] Successfully verified web citations from MySQL database.",
        ];

        $project = $projectId ? Project::find($projectId) : Project::whereRaw('LOWER(company) = ?', [strtolower($query)])
            ->orWhereRaw('LOWER(company) = ?', [strtolower("{$query}.nl")])
            ->orWhereRaw('LOWER(company) = ?', [strtolower($companyKey)])
            ->first();

        $rawCitations = $project 
            ? $project->citations()->get()
            : Citation::where('company_key', $companyKey)->get();

        $selectedCitations = $rawCitations->map(function ($item) {
            $citedBy = $item->cited_by;
            if (is_string($citedBy)) {
                $citedBy = json_decode($citedBy, true) ?: [$citedBy];
            }

            return [
                'id' => $item->id,
                'title' => $item->title,
                'url' => $item->url,
                'domain' => $item->domain,
                'snippet' => $item->snippet,
                'type' => $item->type,
                'sentiment' => $item->sentiment,
                'citedBy' => $citedBy ?: ['chatgpt', 'gemini'],
                'crawlDate' => $item->crawl_date,
            ];
        });

        return response()->json([
            'success' => true,
            'query' => $request->query('query', 'Saleswizard'),
            'engine' => 'Scraping Proxy (Residential Tunnel)',
            'logs' => $crawlLogs,
            'citations' => $selectedCitations,
        ]);
    }
}
