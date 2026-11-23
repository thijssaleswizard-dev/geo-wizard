<?php

namespace App\Http\Controllers;

use App\Services\PromptReportService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    protected function parseRequestParams(Request $request): array
    {
        $projectId = $request->query('project_id') ? (int) $request->query('project_id') : null;
        $company = $request->query('company');
        $keywordId = $request->query('keyword_id') ? (int) $request->query('keyword_id') : null;
        $periodLabel = $request->query('period');
        $reportTitle = $request->query('title');

        $sections = [];
        foreach (['kpis', 'highlights', 'timeline', 'prompts', 'engines', 'competitors'] as $sec) {
            if ($request->has("show_{$sec}")) {
                $sections[$sec] = filter_var($request->query("show_{$sec}"), FILTER_VALIDATE_BOOLEAN);
            }
        }

        return compact('projectId', 'company', 'keywordId', 'periodLabel', 'reportTitle', 'sections');
    }

    public function promptReportData(Request $request): JsonResponse
    {
        $params = $this->parseRequestParams($request);
        $report = PromptReportService::buildReport(
            $params['projectId'],
            $params['company'],
            $params['keywordId'],
            $params['periodLabel'],
            $params['reportTitle'],
            $params['sections']
        );

        return response()->json([
            'success' => true,
            'report' => $report,
        ]);
    }

    public function promptReportPdf(Request $request)
    {
        $params = $this->parseRequestParams($request);
        $report = PromptReportService::buildReport(
            $params['projectId'],
            $params['company'],
            $params['keywordId'],
            $params['periodLabel'],
            $params['reportTitle'],
            $params['sections']
        );

        $html = view('reports.prompts-pdf', ['report' => $report])->render();

        // 16:9 widescreen slide paper matching SalesWizard template (960pt x 540pt)
        $pdf = Pdf::loadHTML($html)
            ->setPaper([0, 0, 960, 540])
            ->setOption('defaultFont', 'DejaVu Sans')
            ->setOption('isHtml5ParserEnabled', true)
            ->setOption('isRemoteEnabled', true);

        $slug = preg_replace('/[^a-z0-9\-]+/i', '-', strtolower($report['meta']['companyShort'] ?? 'project'));
        $slug = trim($slug, '-') ?: 'project';
        $filename = "SalesWizard-GEO-Rapportage-{$slug}-" . date('Y-m-d') . ".pdf";

        if ($request->boolean('preview', false)) {
            return $pdf->stream($filename);
        }

        return $pdf->download($filename);
    }
}
