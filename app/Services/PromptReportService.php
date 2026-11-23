<?php

namespace App\Services;

use App\Models\Keyword;
use App\Models\Project;
use App\Models\Prompt;
use Carbon\Carbon;

class PromptReportService
{
    private const DUTCH_MONTHS = [
        1 => 'januari', 2 => 'februari', 3 => 'maart', 4 => 'april',
        5 => 'mei', 6 => 'juni', 7 => 'juli', 8 => 'augustus',
        9 => 'september', 10 => 'oktober', 11 => 'november', 12 => 'december',
    ];

    private const DUTCH_SHORT_MONTHS = [
        1 => 'jan', 2 => 'feb', 3 => 'mrt', 4 => 'apr',
        5 => 'mei', 6 => 'jun', 7 => 'jul', 8 => 'aug',
        9 => 'sep', 10 => 'okt', 11 => 'nov', 12 => 'dec',
    ];

    private const ENGINE_LABELS = [
        'chatgpt' => 'OpenAI ChatGPT',
        'aimode' => 'Google AI Mode',
        'aioverviews' => 'Google AI Overviews',
        'gemini' => 'Google Gemini',
        'perplexity' => 'Perplexity AI',
        'claude' => 'Anthropic Claude',
        'copilot' => 'Microsoft Copilot',
        'meta' => 'Meta AI',
    ];

    public static function resolveProject(?int $projectId, ?string $company): ?Project
    {
        if ($projectId) {
            $project = Project::find($projectId);
            if ($project) {
                return $project;
            }
        }

        if (!empty($company)) {
            $decoded = trim(urldecode($company));
            $companyKey = AiEngineService::cleanBrandKey($decoded);
            return Project::whereRaw('LOWER(company) = ?', [strtolower($decoded)])
                ->orWhereRaw('LOWER(company) = ?', [strtolower("{$companyKey}.nl")])
                ->orWhereRaw('LOWER(company) = ?', [strtolower("{$companyKey}.com")])
                ->orWhereRaw('LOWER(company) = ?', [strtolower("{$companyKey}.eu")])
                ->orWhereRaw('LOWER(company) = ?', [strtolower($companyKey)])
                ->first();
        }

        return null;
    }

    public static function formatDutchDate(Carbon $date, bool $withTime = false): string
    {
        $month = self::DUTCH_MONTHS[(int) $date->format('n')] ?? $date->format('F');
        $base = (int) $date->format('j') . ' ' . $month . ' ' . $date->format('Y');
        return $withTime ? $base . ', ' . $date->format('H:i') : $base;
    }

    public static function formatShortDutchAxisDate(string $ymd): string
    {
        try {
            $dt = Carbon::parse($ymd);
            $short = self::DUTCH_SHORT_MONTHS[(int) $dt->format('n')] ?? $dt->format('M');
            return $dt->format('j') . ' ' . $short . " '" . $dt->format('y');
        } catch (\Throwable $e) {
            return $ymd;
        }
    }

    public static function buildReport(
        ?int $projectId = null,
        ?string $company = null,
        ?int $keywordId = null,
        ?string $customPeriodLabel = null,
        ?string $customTitle = null,
        array $sections = []
    ): array {
        $project = self::resolveProject($projectId, $company);
        $companyDomain = $project ? $project->company : ($company ?: 'Onbekend project');
        $cleanCompany = AiEngineService::cleanBrandKey($companyDomain);
        $displayTitle = $customTitle ? trim($customTitle) : strtoupper(str_replace(['-', '_'], ' ', $cleanCompany ?: $companyDomain));

        $keywordQuery = Keyword::query()->with('prompts')->orderBy('id', 'desc');
        if ($project) {
            $keywordQuery->where('project_id', $project->id);
        } elseif (!empty($company)) {
            $companyKey = AiEngineService::cleanBrandKey($company);
            $cleanKey = strtolower(preg_replace('/[^a-z0-9]/', '', $companyKey));
            $keywordQuery->where(function ($q) use ($companyKey, $cleanKey, $company) {
                $q->where('company_key', $companyKey)
                    ->orWhere('company_key', $cleanKey)
                    ->orWhere('company_key', strtolower($company));
            });
        }
        $keywordQuery->where(function ($q) {
            $q->where('is_archived', false)->orWhereNull('is_archived');
        });
        if ($keywordId) {
            $keywordQuery->where('id', $keywordId);
        }

        $activeKeywords = $keywordQuery->get();
        $selectedKeywordModel = $keywordId ? $activeKeywords->first() : null;

        // Collect all active prompts (keyword-linked + standalone project prompts unless filtering by specific keyword)
        $promptEntries = [];
        foreach ($activeKeywords as $kw) {
            foreach (($kw->prompts ?? collect()) as $p) {
                $promptEntries[] = ['prompt' => $p, 'keyword' => $kw];
            }
        }
        if (!$keywordId && $project) {
            $standalone = Prompt::where('project_id', $project->id)
                ->whereNull('keyword_id')
                ->orderBy('id', 'desc')
                ->get();
            foreach ($standalone as $sp) {
                $promptEntries[] = ['prompt' => $sp, 'keyword' => null];
            }
        }

        $promptRows = [];
        $engineTotals = [];
        $allValidDates = [];
        $timelinePerPrompt = []; // [promptId => [ymd => snapshot]]
        $hasMultipleMeasurements = false;
        $latestValidTimestamp = null;

        foreach ($promptEntries as $entry) {
            /** @var Prompt $p */
            $p = $entry['prompt'];
            /** @var Keyword|null $kw */
            $kw = $entry['keyword'];

            $resObj = !empty($p->results) ? (is_array($p->results) ? $p->results : json_decode($p->results, true)) : null;
            $liveMetrics = AiEngineService::extractLivePromptMetrics(is_array($resObj) ? $resObj : null);

            $rawHistory = (is_array($resObj) && !empty($resObj['history']) && is_array($resObj['history']))
                ? $resObj['history']
                : [];

            // Keep only valid live points (totalModels > 0), deduping intra-day retries while preserving baseline
            $validPoints = [];
            $seenDayIndices = [];
            foreach ($rawHistory as $h) {
                if (!is_array($h)) {
                    continue;
                }
                $hModels = (int) ($h['totalModels'] ?? 0);
                if ($hModels <= 0) {
                    continue;
                }
                $hDate = (string) ($h['date'] ?? ($p->created_at ? $p->created_at->format('Y-m-d') : date('Y-m-d')));
                $hMentions = (int) ($h['totalMentions'] ?? (!empty($h['mentioned']) ? 1 : 0));
                $hMentioned = !empty($h['mentioned']) || $hMentions > 0;
                $hPos = ($hMentioned && isset($h['position']) && is_numeric($h['position'])) ? (float) $h['position'] : null;
                $hScore = isset($h['overallScore']) ? (int) $h['overallScore'] : (int) round(($hMentions / max(1, $hModels)) * 100);

                $pt = [
                    'date' => $hDate,
                    'displayDate' => $h['displayDate'] ?? self::formatShortDutchAxisDate($hDate),
                    'time' => $h['time'] ?? '',
                    'isBaseline' => !empty($h['isBaseline']) || count($validPoints) === 0,
                    'mentioned' => $hMentioned,
                    'position' => $hPos,
                    'totalMentions' => $hMentions,
                    'totalModels' => $hModels,
                    'overallScore' => $hScore,
                ];

                $isBas = count($validPoints) === 0;
                if ($isBas) {
                    $validPoints[] = $pt;
                } else {
                    if (isset($seenDayIndices[$hDate]) && count($validPoints) > 1 && !$validPoints[$seenDayIndices[$hDate]]['isBaseline']) {
                        $validPoints[$seenDayIndices[$hDate]] = $pt;
                    } else {
                        $seenDayIndices[$hDate] = count($validPoints);
                        $validPoints[] = $pt;
                    }
                }
            }

            // Synthesize baseline from current live data if history was empty
            if (empty($validPoints) && $liveMetrics['hasLiveData']) {
                $pDate = ($p->updated_at ?: ($p->created_at ?: now()))->format('Y-m-d');
                $validPoints[] = [
                    'date' => $pDate,
                    'displayDate' => self::formatShortDutchAxisDate($pDate),
                    'time' => ($p->updated_at ?: now())->format('H:i'),
                    'isBaseline' => true,
                    'mentioned' => $liveMetrics['mentioned'],
                    'position' => $liveMetrics['position'],
                    'totalMentions' => $liveMetrics['totalMentions'],
                    'totalModels' => $liveMetrics['totalModels'],
                    'overallScore' => $liveMetrics['overallScore'],
                ];
            }

            // Determine current state (prefer liveMetrics when live; fall back to latest valid historical point if last retry failed)
            $lastScanFailed = false;
            $currentPt = null;
            if ($liveMetrics['hasLiveData']) {
                $upd = $p->updated_at ?: ($p->created_at ?: now());
                $latestPointDate = !empty($validPoints) ? end($validPoints)['date'] : $upd->format('Y-m-d');
                $currentPt = [
                    'date' => $upd->format('Y-m-d') >= $latestPointDate ? $upd->format('Y-m-d') : $latestPointDate,
                    'displayDate' => self::formatShortDutchAxisDate($upd->format('Y-m-d')),
                    'mentioned' => $liveMetrics['mentioned'],
                    'position' => $liveMetrics['position'],
                    'totalMentions' => $liveMetrics['totalMentions'],
                    'totalModels' => $liveMetrics['totalModels'],
                    'overallScore' => $liveMetrics['overallScore'],
                ];
                if (!$latestValidTimestamp || $upd->gt($latestValidTimestamp)) {
                    $latestValidTimestamp = $upd;
                }
            } elseif (!empty($validPoints)) {
                $lastScanFailed = true;
                $currentPt = end($validPoints);
            }

            $baselinePt = $validPoints[0] ?? null;
            if (count($validPoints) >= 2) {
                $hasMultipleMeasurements = true;
            }

            foreach ($validPoints as $vp) {
                $allValidDates[$vp['date']] = true;
                $timelinePerPrompt[$p->id][$vp['date']] = $vp;
            }
            if ($currentPt) {
                $allValidDates[$currentPt['date']] = true;
                $timelinePerPrompt[$p->id][$currentPt['date']] = $currentPt;
            }

            // Determine trend compared to baseline
            $trend = 'pending';
            $trendText = 'In wachtrij';
            $deltaDetail = 'Nog geen meting';
            $sortWeight = 5;

            if ($currentPt && $baselinePt) {
                $baseMentioned = (bool) $baselinePt['mentioned'];
                $currMentioned = (bool) $currentPt['mentioned'];
                $basePos = $baselinePt['position'];
                $currPos = $currentPt['position'];
                $baseScore = (int) $baselinePt['overallScore'];
                $currScore = (int) $currentPt['overallScore'];
                $baseM = (int) $baselinePt['totalMentions'];
                $currM = (int) $currentPt['totalMentions'];

                if (!$baseMentioned && $currMentioned) {
                    $trend = 'up';
                    $trendText = 'Gestegen';
                    $deltaDetail = $currPos !== null ? ('Nieuw op #' . number_format($currPos, 1, ',', '.')) : 'Nieuw vermeld';
                    $sortWeight = 1;
                } elseif ($baseMentioned && !$currMentioned) {
                    $trend = 'down';
                    $trendText = 'Gedaald';
                    $deltaDetail = 'Niet meer vermeld';
                    $sortWeight = 2;
                } elseif ($baseMentioned && $currMentioned) {
                    $posImprovement = ($basePos !== null && $currPos !== null) ? ($basePos - $currPos) : 0.0;
                    $scoreDiff = $currScore - $baseScore;
                    $mentionDiff = $currM - $baseM;

                    if ($posImprovement >= 0.3) {
                        $trend = 'up';
                        $trendText = 'Gestegen';
                        $deltaDetail = '+' . number_format($posImprovement, 1, ',', '.') . ' pos';
                        $sortWeight = 1;
                    } elseif ($posImprovement <= -0.3) {
                        $trend = 'down';
                        $trendText = 'Gedaald';
                        $deltaDetail = number_format($posImprovement, 1, ',', '.') . ' pos';
                        $sortWeight = 2;
                    } elseif ($scoreDiff >= 10 || $mentionDiff > 0) {
                        $trend = 'up';
                        $trendText = 'Gestegen';
                        $deltaDetail = '+' . max(1, $mentionDiff) . ' AI-' . (max(1, $mentionDiff) === 1 ? 'model' : 'modellen');
                        $sortWeight = 1;
                    } elseif ($scoreDiff <= -10 || $mentionDiff < 0) {
                        $trend = 'down';
                        $trendText = 'Gedaald';
                        $deltaDetail = $mentionDiff . ' AI-' . (abs($mentionDiff) === 1 ? 'model' : 'modellen');
                        $sortWeight = 2;
                    } else {
                        $trend = 'retained';
                        $trendText = 'Behouden';
                        $deltaDetail = count($validPoints) <= 1 ? 'Nulmeting' : 'Stabiel vermeld';
                        $sortWeight = 3;
                    }
                } else {
                    $trend = 'unchanged';
                    $trendText = 'Niet vermeld';
                    $deltaDetail = count($validPoints) <= 1 ? 'Nulmeting' : 'Ongewijzigd';
                    $sortWeight = 4;
                }
            }

            // Aggregate per-engine breakdown for this prompt
            $modelMentions = $liveMetrics['modelMentions'] ?? [];
            $enginesActiveBadges = [];
            if (is_array($modelMentions)) {
                foreach ($modelMentions as $eKey => $eData) {
                    if (!is_array($eData) || AiEngineService::isSimulatedOrFailedModel($eData)) {
                        continue;
                    }
                    if (!isset($engineTotals[$eKey])) {
                        $engineTotals[$eKey] = [
                            'id' => $eKey,
                            'name' => self::ENGINE_LABELS[$eKey] ?? ucfirst($eKey),
                            'measuredPrompts' => 0,
                            'mentionedPrompts' => 0,
                            'positions' => [],
                        ];
                    }
                    $engineTotals[$eKey]['measuredPrompts']++;
                    if (!empty($eData['mentioned'])) {
                        $engineTotals[$eKey]['mentionedPrompts']++;
                        $enginesActiveBadges[] = $eKey;
                        if (!empty($eData['position']) && is_numeric($eData['position'])) {
                            $engineTotals[$eKey]['positions'][] = (float) $eData['position'];
                        }
                    }
                }
            }

            $formatMeasurementLabel = function (?array $pt): string {
                if (!$pt) {
                    return '—';
                }
                if (empty($pt['mentioned'])) {
                    return 'Niet vermeld (0/' . ($pt['totalModels'] ?? 0) . ')';
                }
                $posStr = isset($pt['position']) && $pt['position'] !== null
                    ? '#' . number_format((float) $pt['position'], 1, ',', '.')
                    : 'Vermeld';
                return "{$posStr} (" . ($pt['totalMentions'] ?? 0) . '/' . ($pt['totalModels'] ?? 0) . ')';
            };

            $promptRows[] = [
                'id' => $p->id,
                'text' => $p->prompt_text,
                'keywordId' => $kw?->id,
                'keywordText' => $kw?->keyword ?: 'Losse prompt',
                'baselineMentioned' => (bool) ($baselinePt['mentioned'] ?? false),
                'baselinePos' => $baselinePt['position'] ?? null,
                'baselineScore' => (int) ($baselinePt['overallScore'] ?? 0),
                'baselineMentions' => (int) ($baselinePt['totalMentions'] ?? 0),
                'baselineModels' => (int) ($baselinePt['totalModels'] ?? 0),
                'baselineDate' => $baselinePt['displayDate'] ?? null,
                'baselineLabel' => $formatMeasurementLabel($baselinePt),
                'currentMentioned' => (bool) ($currentPt['mentioned'] ?? false),
                'currentPos' => $currentPt['position'] ?? null,
                'currentScore' => (int) ($currentPt['overallScore'] ?? 0),
                'currentMentions' => (int) ($currentPt['totalMentions'] ?? 0),
                'currentModels' => (int) ($currentPt['totalModels'] ?? 0),
                'currentDate' => $currentPt['displayDate'] ?? null,
                'currentLabel' => $formatMeasurementLabel($currentPt),
                'trend' => $trend,
                'trendText' => $trendText,
                'deltaDetail' => $deltaDetail,
                'measurementsCount' => count($validPoints),
                'lastScanFailed' => $lastScanFailed,
                'enginesMentioned' => $enginesActiveBadges,
                '_sortWeight' => $sortWeight,
                '_currScore' => (int) ($currentPt['overallScore'] ?? 0),
            ];
        }

        // Sort: Stijgers -> Dalers -> Behouden -> Niet vermeld -> Pending
        usort($promptRows, function ($a, $b) {
            if ($a['_sortWeight'] !== $b['_sortWeight']) {
                return $a['_sortWeight'] <=> $b['_sortWeight'];
            }
            return $b['_currScore'] <=> $a['_currScore'];
        });

        // Compute aggregate KPIs
        $totalPromptsCount = count($promptRows);
        $measuredRows = array_values(array_filter($promptRows, fn($r) => $r['trend'] !== 'pending'));
        $measuredCount = count($measuredRows);

        $mentionedRows = array_values(array_filter($measuredRows, fn($r) => $r['currentMentioned']));
        $baselineMentionedRows = array_values(array_filter($measuredRows, fn($r) => $r['baselineMentioned']));

        $risenRows = array_values(array_filter($measuredRows, fn($r) => $r['trend'] === 'up'));
        $declinedRows = array_values(array_filter($measuredRows, fn($r) => $r['trend'] === 'down'));
        $retainedRows = array_values(array_filter($measuredRows, fn($r) => $r['trend'] === 'retained'));
        $unchangedRows = array_values(array_filter($measuredRows, fn($r) => $r['trend'] === 'unchanged'));
        $pendingRows = array_values(array_filter($promptRows, fn($r) => $r['trend'] === 'pending'));

        $newlyMentionedCount = count(array_filter($risenRows, fn($r) => !$r['baselineMentioned'] && $r['currentMentioned']));

        $currPositions = array_values(array_filter(array_map(fn($r) => $r['currentPos'], $mentionedRows), fn($v) => $v !== null));
        $basePositions = array_values(array_filter(array_map(fn($r) => $r['baselinePos'], $baselineMentionedRows), fn($v) => $v !== null));

        $avgCurrPos = !empty($currPositions) ? round(array_sum($currPositions) / count($currPositions), 1) : null;
        $avgBasePos = !empty($basePositions) ? round(array_sum($basePositions) / count($basePositions), 1) : null;
        $posDelta = ($avgBasePos !== null && $avgCurrPos !== null) ? round($avgBasePos - $avgCurrPos, 1) : null;

        $totalModelMentions = array_sum(array_map(fn($r) => $r['currentMentions'], $measuredRows));
        $totalModelChecks = array_sum(array_map(fn($r) => $r['currentModels'], $measuredRows));
        $modelCoveragePct = $totalModelChecks > 0 ? (int) round(($totalModelMentions / $totalModelChecks) * 100) : 0;

        $currVisibilityScore = $measuredCount > 0 ? (int) round(array_sum(array_map(fn($r) => $r['currentScore'], $measuredRows)) / $measuredCount) : 0;
        $baseVisibilityScore = $measuredCount > 0 ? (int) round(array_sum(array_map(fn($r) => $r['baselineScore'], $measuredRows)) / $measuredCount) : 0;
        $visibilityDelta = $currVisibilityScore - $baseVisibilityScore;

        $mentionRate = $measuredCount > 0 ? (int) round((count($mentionedRows) / $measuredCount) * 100) : 0;
        $baseMentionRate = $measuredCount > 0 ? (int) round((count($baselineMentionedRows) / $measuredCount) * 100) : 0;
        $mentionRateDelta = $mentionRate - $baseMentionRate;

        // Build Engine Breakdown list sorted by mentionPct DESC
        $enginesList = [];
        foreach ($engineTotals as $eng) {
            $pct = $eng['measuredPrompts'] > 0 ? (int) round(($eng['mentionedPrompts'] / $eng['measuredPrompts']) * 100) : 0;
            $engAvgPos = !empty($eng['positions']) ? round(array_sum($eng['positions']) / count($eng['positions']), 1) : null;
            $enginesList[] = [
                'id' => $eng['id'],
                'name' => $eng['name'],
                'measuredPrompts' => $eng['measuredPrompts'],
                'mentionedPrompts' => $eng['mentionedPrompts'],
                'mentionPct' => $pct,
                'avgPosition' => $engAvgPos !== null ? '#' . number_format($engAvgPos, 1, ',', '.') : '-',
            ];
        }
        usort($enginesList, fn($a, $b) => $b['mentionPct'] <=> $a['mentionPct'] ?: ($b['mentionedPrompts'] <=> $a['mentionedPrompts']));

        // Build Timeline (Carry-forward across all valid scan dates)
        $sortedDates = array_keys($allValidDates);
        sort($sortedDates);
        if (count($sortedDates) > 12) {
            $sortedDates = array_merge([$sortedDates[0]], array_slice($sortedDates, -11));
        }

        $timeline = [];
        $carryState = [];
        foreach ($sortedDates as $dIdx => $ymd) {
            foreach ($timelinePerPrompt as $pid => $dateMap) {
                if (isset($dateMap[$ymd])) {
                    $carryState[$pid] = $dateMap[$ymd];
                }
            }

            $tMeasured = count($carryState);
            $tMentioned = 0;
            $tScoreSum = 0;
            $tPositions = [];
            foreach ($carryState as $snap) {
                if (!empty($snap['mentioned'])) {
                    $tMentioned++;
                    if (isset($snap['position']) && is_numeric($snap['position'])) {
                        $tPositions[] = (float) $snap['position'];
                    }
                }
                $tScoreSum += (int) ($snap['overallScore'] ?? 0);
            }

            $timeline[] = [
                'date' => $ymd,
                'label' => $dIdx === 0 ? 'Nulmeting (' . self::formatShortDutchAxisDate($ymd) . ')' : self::formatShortDutchAxisDate($ymd),
                'shortLabel' => self::formatShortDutchAxisDate($ymd),
                'isBaseline' => $dIdx === 0,
                'mentionedCount' => $tMentioned,
                'measuredCount' => $tMeasured,
                'mentionRatePct' => $tMeasured > 0 ? (int) round(($tMentioned / $tMeasured) * 100) : 0,
                'avgScorePct' => $tMeasured > 0 ? (int) round($tScoreSum / $tMeasured) : 0,
                'avgPosition' => !empty($tPositions) ? round(array_sum($tPositions) / count($tPositions), 1) : null,
            ];
        }

        // Timeline summary sentence
        if (count($timeline) >= 2) {
            $firstT = $timeline[0];
            $lastT = end($timeline);
            $diffVis = $lastT['avgScorePct'] - $firstT['avgScorePct'];
            $diffLabel = $diffVis > 0 ? "gestegen met +{$diffVis} procentpunt" : ($diffVis < 0 ? 'gedaald met ' . abs($diffVis) . ' procentpunt' : 'stabiel gebleven');
            $timelineSummary = "Ten opzichte van de nulmeting op {$firstT['shortLabel']} is de gemiddelde AI-zichtbaarheid {$diffLabel} (van {$firstT['avgScorePct']}% naar {$lastT['avgScorePct']}%). {$cleanCompany} wordt nu bij {$lastT['mentionedCount']} van de {$lastT['measuredCount']} gemeten prompts genoemd.";
        } elseif (count($timeline) === 1) {
            $onlyT = $timeline[0];
            $timelineSummary = "Nulmeting vastgelegd op {$onlyT['shortLabel']}: {$onlyT['mentionedCount']} van de {$onlyT['measuredCount']} gemeten prompts bevatten een merkvermelding (gemiddelde AI-zichtbaarheid: {$onlyT['avgScorePct']}%).";
        } else {
            $timelineSummary = 'Er zijn nog geen voltooide AI-metingen beschikbaar voor een tijdlijngrafiek.';
        }

        // Determine readable Dutch period string
        if (!empty($customPeriodLabel)) {
            $periodLabel = trim($customPeriodLabel);
        } elseif (count($sortedDates) >= 2) {
            $firstDt = Carbon::parse($sortedDates[0]);
            $lastDt = Carbon::parse(end($sortedDates));
            $m1 = self::DUTCH_MONTHS[(int) $firstDt->format('n')] . ' ' . $firstDt->format('Y');
            $m2 = self::DUTCH_MONTHS[(int) $lastDt->format('n')] . ' ' . $lastDt->format('Y');
            $periodLabel = $m1 === $m2 ? $m1 : "{$m1} t/m {$m2}";
        } elseif (count($sortedDates) === 1) {
            $onlyDt = Carbon::parse($sortedDates[0]);
            $periodLabel = self::DUTCH_MONTHS[(int) $onlyDt->format('n')] . ' ' . $onlyDt->format('Y');
        } else {
            $nowDt = now();
            $periodLabel = self::DUTCH_MONTHS[(int) $nowDt->format('n')] . ' ' . $nowDt->format('Y');
        }

        // Build "Wat vraagt aandacht?" highlights (Page 3)
        $highlights = self::buildHighlights(
            $cleanCompany ?: $companyDomain,
            $promptRows,
            $risenRows,
            $declinedRows,
            $retainedRows,
            $unchangedRows,
            $enginesList,
            $hasMultipleMeasurements,
            $visibilityDelta
        );

        // Aggregate Competitors / Share of Voice across active keywords
        $competitorsList = self::aggregateCompetitors($activeKeywords, $companyDomain);

        $timelineChartSvg = self::buildTimelineChartSvg($timeline, $totalPromptsCount);
        $enginesChartSvg = self::buildEnginesChartSvg($enginesList);

        $nowCarbon = $latestValidTimestamp ?: now();

        $enabledSections = [
            'kpis' => $sections['kpis'] ?? true,
            'highlights' => $sections['highlights'] ?? true,
            'timeline' => $sections['timeline'] ?? true,
            'prompts' => $sections['prompts'] ?? true,
            'engines' => $sections['engines'] ?? true,
            'competitors' => ($sections['competitors'] ?? true) && count($competitorsList) > 0,
        ];

        return [
            'meta' => [
                'projectId' => $project?->id,
                'projectName' => $displayTitle,
                'companyDomain' => $companyDomain,
                'companyShort' => ucfirst($cleanCompany ?: $companyDomain),
                'keywordFilter' => $selectedKeywordModel?->keyword,
                'periodLabel' => $periodLabel,
                'dataTimestamp' => self::formatDutchDate($nowCarbon, true),
                'createdDate' => self::formatDutchDate(now(), false),
                'author' => 'SalesWizard',
                'hasMultipleMeasurements' => $hasMultipleMeasurements,
            ],
            'sections' => $enabledSections,
            'kpis' => [
                'totalPromptsCount' => $totalPromptsCount,
                'measuredCount' => $measuredCount,
                'mentionedCount' => count($mentionedRows),
                'baselineMentionedCount' => count($baselineMentionedRows),
                'mentionRate' => $mentionRate,
                'mentionRateDelta' => $mentionRateDelta,
                'risenCount' => count($risenRows),
                'newlyMentionedCount' => $newlyMentionedCount,
                'declinedCount' => count($declinedRows),
                'retainedCount' => count($retainedRows),
                'unchangedCount' => count($unchangedRows),
                'pendingCount' => count($pendingRows),
                'avgPosition' => $avgCurrPos !== null ? '#' . number_format($avgCurrPos, 1, ',', '.') : '-',
                'baselineAvgPosition' => $avgBasePos !== null ? '#' . number_format($avgBasePos, 1, ',', '.') : '-',
                'positionDelta' => $posDelta,
                'totalModelMentions' => $totalModelMentions,
                'totalModelChecks' => $totalModelChecks,
                'modelCoveragePct' => $modelCoveragePct,
                'visibilityScore' => $currVisibilityScore,
                'baselineVisibilityScore' => $baseVisibilityScore,
                'visibilityDelta' => $visibilityDelta,
            ],
            'highlights' => $highlights,
            'timeline' => $timeline,
            'timelineSummary' => $timelineSummary,
            'timelineChartSvg' => $timelineChartSvg,
            'timelineChartSvgBase64' => base64_encode($timelineChartSvg),
            'prompts' => array_map(function ($r) {
                unset($r['_sortWeight'], $r['_currScore']);
                return $r;
            }, $promptRows),
            'engines' => $enginesList,
            'enginesChartSvg' => $enginesChartSvg,
            'enginesChartSvgBase64' => base64_encode($enginesChartSvg),
            'competitors' => array_slice($competitorsList, 0, 12),
        ];
    }

    protected static function buildHighlights(
        string $company,
        array $promptRows,
        array $risenRows,
        array $declinedRows,
        array $retainedRows,
        array $unchangedRows,
        array $enginesList,
        bool $hasMultipleMeasurements,
        int $visibilityDelta
    ): array {
        $items = [];
        $quoteExamples = function (array $rows, bool $withMove = false): string {
            $slice = array_slice($rows, 0, 2);
            $parts = [];
            foreach ($slice as $r) {
                $short = mb_strlen($r['text']) > 55 ? mb_substr($r['text'], 0, 52) . '…' : $r['text'];
                if ($withMove) {
                    $bPos = $r['baselineMentioned'] ? ($r['baselinePos'] ? '#' . number_format($r['baselinePos'], 1, ',', '.') : "{$r['baselineMentions']}/{$r['baselineModels']}") : 'niet vermeld';
                    $cPos = $r['currentMentioned'] ? ($r['currentPos'] ? '#' . number_format($r['currentPos'], 1, ',', '.') : "{$r['currentMentions']}/{$r['currentModels']}") : 'niet vermeld';
                    $parts[] = "“{$short}” ({$bPos} → {$cPos})";
                } else {
                    $parts[] = "“{$short}”";
                }
            }
            return implode(', ', $parts);
        };

        if (count($risenRows) > 0) {
            $n = count($risenRows);
            $items[] = [
                'color' => '#2E9E6B',
                'type' => 'up',
                'text' => "{$n} " . ($n === 1 ? 'prompt is' : 'prompts zijn') . " gestegen t.o.v. de nulmeting, o.a. " . $quoteExamples($risenRows, true) . '.',
            ];
        } elseif ($hasMultipleMeasurements) {
            $items[] = [
                'color' => '#3E008A',
                'type' => 'insight',
                'text' => "Er zijn ten opzichte van de nulmeting geen extra prompts gestegen; de totale AI-zichtbaarheid veranderde met " . ($visibilityDelta >= 0 ? "+{$visibilityDelta}" : $visibilityDelta) . '%.',
            ];
        } else {
            $mentionedTotal = count($retainedRows) + count($risenRows);
            $measuredTotal = count($promptRows);
            $items[] = [
                'color' => '#2E9E6B',
                'type' => 'insight',
                'text' => "Nulmeting vastgesteld: {$company} wordt momenteel bij {$mentionedTotal} van de {$measuredTotal} prompts actief vermeld door AI zoekmachines.",
            ];
        }

        if (count($declinedRows) > 0) {
            $n = count($declinedRows);
            $items[] = [
                'color' => '#B91C1C',
                'type' => 'down',
                'text' => "{$n} " . ($n === 1 ? 'prompt is' : 'prompts zijn') . " gedaald t.o.v. de nulmeting, o.a. " . $quoteExamples($declinedRows, true) . '.',
            ];
        }

        $weakPartial = array_values(array_filter($promptRows, fn($r) => $r['currentMentioned'] && $r['currentScore'] > 0 && $r['currentScore'] <= 40));
        if (count($weakPartial) > 0) {
            $n = count($weakPartial);
            $items[] = [
                'color' => '#D97706',
                'type' => 'opportunity',
                'text' => "Kans: {$n} " . ($n === 1 ? 'prompt wordt' : 'prompts worden') . " nu alleen door een minderheid van de AI-modellen opgepakt (<=40%), o.a. " . $quoteExamples($weakPartial) . '.',
            ];
        }

        if (count($unchangedRows) > 0) {
            $n = count($unchangedRows);
            $items[] = [
                'color' => '#B91C1C',
                'type' => 'opportunity',
                'text' => "Aandacht: bij {$n} " . ($n === 1 ? 'prompt wordt' : 'prompts worden') . " {$company} nog niet genoemd door AI zoekmachines, o.a. " . $quoteExamples($unchangedRows) . '.',
            ];
        }

        if (!empty($enginesList)) {
            $best = $enginesList[0];
            $worst = end($enginesList);
            $items[] = [
                'color' => '#3E008A',
                'type' => 'insight',
                'text' => "Best zichtbare AI-zoekmachine is {$best['name']} met {$best['mentionPct']}% vermeldingen ({$best['mentionedPrompts']}/{$best['measuredPrompts']} prompts)."
                    . ($worst && $worst['id'] !== $best['id'] ? " Op {$worst['name']} ligt de grootste groeikans ({$worst['mentionPct']}%)." : ''),
            ];
        }

        return array_slice($items, 0, 5);
    }

    protected static function aggregateCompetitors($keywords, string $companyDomain): array
    {
        if ($keywords->isEmpty()) {
            return [];
        }

        $cleanSelf = strtolower(preg_replace('/[^a-z0-9]/', '', AiEngineService::cleanBrandKey($companyDomain)));
        $byDomain = [];
        $kwCount = max(1, $keywords->count());

        foreach ($keywords as $kw) {
            $comps = is_array($kw->competitors_json) ? $kw->competitors_json : json_decode($kw->competitors_json ?? '[]', true);
            if (!is_array($comps)) {
                continue;
            }
            foreach ($comps as $c) {
                if (!is_array($c)) {
                    continue;
                }
                $dom = strtolower(trim((string) ($c['domain'] ?? '')));
                $brand = trim((string) ($c['brand'] ?? $c['name'] ?? ($dom ? explode('.', $dom)[0] : 'Bedrijf')));
                $key = $dom !== '' ? $dom : preg_replace('/[^a-z0-9]/', '', strtolower($brand));
                if ($key === '') {
                    continue;
                }
                $isSelf = !empty($c['isSelf']) || !empty($c['isTarget']) || ($cleanSelf !== '' && str_contains(preg_replace('/[^a-z0-9]/', '', $key), $cleanSelf));

                if (!isset($byDomain[$key])) {
                    $byDomain[$key] = [
                        'brand' => $brand,
                        'domain' => $dom ?: ($key . '.nl'),
                        'isSelf' => $isSelf,
                        'sovSum' => 0,
                        'posList' => [],
                        'citations' => 0,
                    ];
                }
                $byDomain[$key]['sovSum'] += (int) ($c['sov'] ?? 0);
                $byDomain[$key]['citations'] += (int) ($c['citations'] ?? 0);
                if (isset($c['position']) && is_numeric($c['position'])) {
                    $byDomain[$key]['posList'][] = (float) $c['position'];
                }
            }
        }

        $rows = [];
        foreach ($byDomain as $item) {
            $avgSov = (int) min(100, round($item['sovSum'] / $kwCount));
            $avgPos = !empty($item['posList']) ? round(array_sum($item['posList']) / count($item['posList']), 1) : null;
            $rows[] = [
                'brand' => $item['brand'],
                'domain' => $item['domain'],
                'isSelf' => $item['isSelf'],
                'sov' => $avgSov,
                'position' => $avgPos !== null ? number_format($avgPos, 1, ',', '.') : '-',
                'citations' => $item['citations'],
                '_posNum' => $avgPos ?? 999.0,
            ];
        }

        usort($rows, function ($a, $b) {
            if ($a['sov'] !== $b['sov']) {
                return $b['sov'] <=> $a['sov'];
            }
            if (abs($a['_posNum'] - $b['_posNum']) > 0.01) {
                return $a['_posNum'] <=> $b['_posNum'];
            }
            return $b['citations'] <=> $a['citations'];
        });

        $rank = 0;
        foreach ($rows as &$r) {
            unset($r['_posNum']);
            if ($r['sov'] > 0) {
                $rank++;
                $r['rank'] = (string) $rank;
            } else {
                $r['rank'] = '-';
            }
        }
        unset($r);

        return $rows;
    }

    /**
     * Build a clean vector SVG combo bar + line chart matching SalesWizard slide 4 aesthetics.
     */
    public static function buildTimelineChartSvg(array $timeline, int $totalPromptsCount): string
    {
        $width = 840;
        $height = 240;
        $padLeft = 52;
        $padRight = 52;
        $padTop = 20;
        $padBottom = 42;
        $plotW = $width - $padLeft - $padRight;
        $plotH = $height - $padTop - $padBottom;

        $svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' . $width . '" height="' . $height . '" viewBox="0 0 ' . $width . ' ' . $height . '">';
        $svg .= '<rect x="0" y="0" width="' . $width . '" height="' . $height . '" fill="#ffffff"/>';

        $maxLeft = max(4, $totalPromptsCount);
        // Round maxLeft up to nice multiple of 4
        $maxLeft = (int) (ceil($maxLeft / 4) * 4);

        // Gridlines & Y-axes (4 intervals)
        for ($i = 0; $i <= 4; $i++) {
            $y = $padTop + $plotH - ($plotH * ($i / 4));
            $leftVal = (int) round($maxLeft * ($i / 4));
            $rightVal = $i * 25;
            $svg .= '<line x1="' . $padLeft . '" y1="' . $y . '" x2="' . ($width - $padRight) . '" y2="' . $y . '" stroke="#eeeeee" stroke-width="1"/>';
            $svg .= '<text x="' . ($padLeft - 10) . '" y="' . ($y + 4) . '" text-anchor="end" font-family="DejaVu Sans, sans-serif" font-size="10" fill="#888888">' . $leftVal . '</text>';
            $svg .= '<text x="' . ($width - $padRight + 10) . '" y="' . ($y + 4) . '" text-anchor="start" font-family="DejaVu Sans, sans-serif" font-size="10" fill="#888888">' . $rightVal . '%</text>';
        }

        $count = count($timeline);
        if ($count === 0) {
            $svg .= '<text x="' . ($width / 2) . '" y="' . ($height / 2) . '" text-anchor="middle" font-family="DejaVu Sans, sans-serif" font-size="13" fill="#6b7280">Nog geen meetdata beschikbaar voor grafiekweergave.</text>';
            $svg .= '</svg>';
            return $svg;
        }

        $slotW = $plotW / max(1, $count);
        $barW = min(38, max(16, $slotW * 0.38));
        $linePoints = [];

        foreach ($timeline as $idx => $pt) {
            $cx = $padLeft + ($slotW * $idx) + ($slotW / 2);
            $barH = $maxLeft > 0 ? (($pt['mentionedCount'] / $maxLeft) * $plotH) : 0;
            if ($pt['mentionedCount'] > 0 && $barH < 4) {
                $barH = 4;
            }
            $barY = $padTop + $plotH - $barH;
            $barX = $cx - ($barW / 2);

            $svg .= '<rect x="' . round($barX, 1) . '" y="' . round($barY, 1) . '" width="' . round($barW, 1) . '" height="' . round($barH, 1) . '" fill="#3E008A"/>';

            $ly = $padTop + $plotH - (($pt['avgScorePct'] / 100) * $plotH);
            $linePoints[] = [round($cx, 1), round($ly, 1), $pt];

            // X-axis label
            $lbl = htmlspecialchars(!empty($pt['isBaseline']) ? 'Nulmeting' : ($pt['shortLabel'] ?? ''), ENT_XML1, 'UTF-8');
            $svg .= '<text x="' . round($cx, 1) . '" y="' . ($padTop + $plotH + 18) . '" text-anchor="middle" font-family="DejaVu Sans, sans-serif" font-size="10" fill="#666666">' . $lbl . '</text>';
            if (!empty($pt['isBaseline']) && !empty($pt['shortLabel'])) {
                $subLbl = htmlspecialchars($pt['shortLabel'], ENT_XML1, 'UTF-8');
                $svg .= '<text x="' . round($cx, 1) . '" y="' . ($padTop + $plotH + 31) . '" text-anchor="middle" font-family="DejaVu Sans, sans-serif" font-size="9" fill="#9ca3af">(' . $subLbl . ')</text>';
            }
        }

        if (count($linePoints) >= 2) {
            $polyStr = implode(' ', array_map(fn($lp) => "{$lp[0]},{$lp[1]}", $linePoints));
            $svg .= '<polyline points="' . $polyStr . '" fill="none" stroke="#3CC896" stroke-width="2.5"/>';
        }
        foreach ($linePoints as $lp) {
            $svg .= '<circle cx="' . $lp[0] . '" cy="' . $lp[1] . '" r="4" fill="#3CC896" stroke="#ffffff" stroke-width="1"/>';
        }

        $svg .= '</svg>';
        return $svg;
    }

    /**
     * Build a clean vector SVG bar chart comparing mention percentage across AI search engines.
     */
    public static function buildEnginesChartSvg(array $engines): string
    {
        $width = 840;
        $height = 138;
        $padLeft = 46;
        $padRight = 24;
        $padTop = 18;
        $padBottom = 30;
        $plotW = $width - $padLeft - $padRight;
        $plotH = $height - $padTop - $padBottom;

        $svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' . $width . '" height="' . $height . '" viewBox="0 0 ' . $width . ' ' . $height . '">';
        $svg .= '<rect x="0" y="0" width="' . $width . '" height="' . $height . '" fill="#ffffff"/>';

        for ($i = 0; $i <= 4; $i++) {
            $y = $padTop + $plotH - ($plotH * ($i / 4));
            $val = $i * 25;
            $svg .= '<line x1="' . $padLeft . '" y1="' . $y . '" x2="' . ($width - $padRight) . '" y2="' . $y . '" stroke="#eeeeee" stroke-width="1"/>';
            $svg .= '<text x="' . ($padLeft - 8) . '" y="' . ($y + 4) . '" text-anchor="end" font-family="DejaVu Sans, sans-serif" font-size="10" fill="#888888">' . $val . '%</text>';
        }

        $count = count($engines);
        if ($count === 0) {
            $svg .= '<text x="' . ($width / 2) . '" y="' . ($height / 2) . '" text-anchor="middle" font-family="DejaVu Sans, sans-serif" font-size="12" fill="#6b7280">Nog geen AI-zoekmachine data gemeten.</text>';
            $svg .= '</svg>';
            return $svg;
        }

        $slotW = $plotW / max(1, $count);
        $barW = min(58, max(24, $slotW * 0.42));

        foreach ($engines as $idx => $eng) {
            $cx = $padLeft + ($slotW * $idx) + ($slotW / 2);
            $pct = (int) ($eng['mentionPct'] ?? 0);
            $barH = ($pct / 100) * $plotH;
            if ($pct > 0 && $barH < 4) {
                $barH = 4;
            }
            $barY = $padTop + $plotH - $barH;
            $barX = $cx - ($barW / 2);
            $fill = $idx === 0 ? '#3CC896' : '#3E008A';

            $svg .= '<rect x="' . round($barX, 1) . '" y="' . round($barY, 1) . '" width="' . round($barW, 1) . '" height="' . round($barH, 1) . '" fill="' . $fill . '"/>';
            $svg .= '<text x="' . round($cx, 1) . '" y="' . max(12, round($barY - 5, 1)) . '" text-anchor="middle" font-family="DejaVu Sans, sans-serif" font-size="10" font-weight="bold" fill="#111827">' . $pct . '%</text>';

            $nameShort = htmlspecialchars(str_replace(['OpenAI ', 'Google ', 'Anthropic '], '', $eng['name']), ENT_XML1, 'UTF-8');
            $svg .= '<text x="' . round($cx, 1) . '" y="' . ($padTop + $plotH + 18) . '" text-anchor="middle" font-family="DejaVu Sans, sans-serif" font-size="10" fill="#4b5563">' . $nameShort . '</text>';
        }

        $svg .= '</svg>';
        return $svg;
    }
}
