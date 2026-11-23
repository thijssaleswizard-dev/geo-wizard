<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <title>SalesWizard GEO Rapportage - {{ $report['meta']['projectName'] }}</title>
  <style>
    @page {
      size: 960pt 540pt;
      margin: 0;
    }
    * {
      box-sizing: border-box;
    }
    html, body {
      margin: 0;
      padding: 0;
      font-family: 'DejaVu Sans', sans-serif;
      color: #111827;
      background-color: #ffffff;
    }
    .slide {
      width: 960pt;
      height: 539pt;
      position: relative;
      overflow: hidden;
      background-color: #ffffff;
      page-break-after: always;
    }
    .slide-last {
      page-break-after: auto;
    }
    .cover-slide {
      background-color: #3E008D;
      color: #ffffff;
    }
    .cover-logo-wrap {
      position: absolute;
      top: 34pt;
      left: 64pt;
    }
    .cover-main {
      position: absolute;
      top: 190pt;
      left: 64pt;
      right: 64pt;
    }
    .cover-title {
      font-size: 40pt;
      font-weight: bold;
      letter-spacing: 0.4pt;
      color: #ffffff;
      margin: 0;
      line-height: 1.15;
    }
    .cover-accent {
      width: 72pt;
      height: 4.5pt;
      background-color: #3CC896;
      margin: 14pt 0 18pt 0;
    }
    .cover-subtitle {
      font-size: 16pt;
      color: #F3EEFA;
      margin: 0;
      font-weight: normal;
    }
    .cover-footer {
      position: absolute;
      bottom: 0;
      left: 0;
      width: 960pt;
      height: 108pt;
      background-color: #2B0068;
      padding: 24pt 64pt;
    }
    .cover-meta-table td {
      font-size: 11.5pt;
      color: #F3EEFA;
      padding: 3pt 0;
      vertical-align: top;
    }
    .cover-meta-label {
      width: 96pt;
      color: #D8C7F5;
    }

    /* Standard Content Slide Header & Footer */
    .slide-top-logo {
      position: absolute;
      top: 18pt;
      right: 56pt;
    }
    .slide-top-line {
      position: absolute;
      top: 45pt;
      left: 56pt;
      width: 848pt;
      height: 2pt;
      background-color: #3CC896;
    }
    .slide-body {
      position: absolute;
      top: 58pt;
      left: 56pt;
      width: 848pt;
    }
    .slide-h1 {
      font-size: 24pt;
      font-weight: bold;
      color: #3E008A;
      margin: 0;
      line-height: 1.15;
    }
    .slide-h1-accent {
      width: 68pt;
      height: 4pt;
      background-color: #3CC896;
      margin: 7pt 0 8pt 0;
    }
    .slide-sub {
      font-size: 12pt;
      color: #6B7280;
      margin: 0 0 12pt 0;
    }
    .slide-footer {
      position: absolute;
      bottom: 16pt;
      left: 56pt;
      width: 848pt;
      border-top: 1pt solid #E5E7EB;
      padding-top: 7pt;
    }
    .slide-footer-table {
      width: 100%;
      border-collapse: collapse;
    }
    .slide-footer-table td {
      font-size: 9pt;
      color: #6B7280;
    }

    /* Tables (SalesWizard style) */
    .sw-table-banner {
      background-color: #3E008A;
      color: #ffffff;
      font-size: 12pt;
      font-weight: bold;
      padding: 8.5pt 14pt;
    }
    .sw-table {
      width: 100%;
      border-collapse: collapse;
    }
    .sw-table thead th {
      background-color: #3CC896;
      color: #ffffff;
      font-size: 9.5pt;
      font-weight: bold;
      padding: 6.5pt 10pt;
      text-align: left;
    }
    .sw-table tbody td {
      font-size: 9.2pt;
      color: #1F2937;
      padding: 6pt 10pt;
      border-bottom: 0.75pt solid #ECEEF2;
      vertical-align: middle;
    }
    .sw-table tbody tr.alt-row {
      background-color: #FAFAFC;
    }
    .sw-table tbody tr.self-row {
      background-color: #F4EFFA;
      font-weight: bold;
    }
    .table-source-note {
      font-size: 8.5pt;
      color: #6B7280;
      margin-top: 6pt;
    }
    .callout-box {
      width: 100%;
      border-collapse: collapse;
      background-color: #F4EFFA;
      margin-top: 10pt;
    }
    .badge {
      display: inline-block;
      padding: 2pt 7pt;
      border-radius: 10pt;
      font-size: 8.5pt;
      font-weight: bold;
      white-space: nowrap;
    }
    .badge-up {
      background-color: #DCFCE7;
      color: #15803D;
    }
    .badge-down {
      background-color: #FEE2E2;
      color: #B91C1C;
    }
    .badge-retained {
      background-color: #EDE9FE;
      color: #440099;
    }
    .badge-neutral {
      background-color: #F3F4F6;
      color: #4B5563;
    }
    .badge-pending {
      background-color: #EFF6FF;
      color: #1D4ED8;
    }
  </style>
</head>
<body>
@php
  $meta = $report['meta'];
  $kpis = $report['kpis'];
  $sections = $report['sections'];
  $prompts = $report['prompts'] ?? [];
  $engines = $report['engines'] ?? [];
  $competitors = $report['competitors'] ?? [];
  $highlights = $report['highlights'] ?? [];

  // SalesWizard wizard-hat / swoosh brand logo SVG data URI
  $whiteLogoSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="32" viewBox="0 0 180 32">
    <path d="M11 4 L17 19 L23 16 L18 3 Z" fill="#ffffff"/>
    <path d="M5 17 C6 24, 15 27, 23 23 C25 22, 26 19, 25 17 C22 21, 14 23, 9 18 Z" fill="#ffffff"/>
    <path d="M23 4 L24 7 L27 8 L24 9 L23 12 L22 9 L19 8 L22 7 Z" fill="#ffffff"/>
    <text x="33" y="22" font-family="DejaVu Sans, sans-serif" font-size="18" font-weight="bold" fill="#ffffff">SalesWizard</text>
  </svg>';
  $whiteLogoB64 = base64_encode($whiteLogoSvg);

  $purpleLogoSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="142" height="24" viewBox="0 0 180 32">
    <path d="M11 4 L17 19 L23 16 L18 3 Z" fill="#3E008A"/>
    <path d="M5 17 C6 24, 15 27, 23 23 C25 22, 26 19, 25 17 C22 21, 14 23, 9 18 Z" fill="#3E008A"/>
    <path d="M23 4 L24 7 L27 8 L24 9 L23 12 L22 9 L19 8 L22 7 Z" fill="#3E008A"/>
    <text x="33" y="22" font-family="DejaVu Sans, sans-serif" font-size="18" font-weight="bold" fill="#3E008A">SalesWizard</text>
  </svg>';
  $purpleLogoB64 = base64_encode($purpleLogoSvg);

  $pageCounter = 0;
@endphp

{{-- SLIDE 1: COVER --}}
<div class="slide cover-slide">
  <div class="cover-logo-wrap">
    <img src="data:image/svg+xml;base64,{{ $whiteLogoB64 }}" width="180" height="32" alt="SalesWizard"/>
  </div>

  <div class="cover-main">
    <h1 class="cover-title">{{ $meta['projectName'] }}</h1>
    <div class="cover-accent"></div>
    <p class="cover-subtitle">
      AI-Zichtbaarheid &amp; Prompt Rapportage {{ $meta['periodLabel'] }}
      @if(!empty($meta['keywordFilter']))
        · Onderwerp: {{ $meta['keywordFilter'] }}
      @endif
    </p>
  </div>

  <div class="cover-footer">
    <table class="cover-meta-table">
      <tr>
        <td class="cover-meta-label">Cijfers van:</td>
        <td>{{ $meta['dataTimestamp'] }}</td>
      </tr>
      <tr>
        <td class="cover-meta-label">Door:</td>
        <td>{{ $meta['author'] }}</td>
      </tr>
      <tr>
        <td class="cover-meta-label">Gemaakt:</td>
        <td>{{ $meta['createdDate'] }}</td>
      </tr>
    </table>
  </div>
</div>

{{-- SLIDE 2: KERNCIJFERS --}}
@if(!empty($sections['kpis']))
@php $pageCounter++; @endphp
<div class="slide">
  <div class="slide-top-logo"><img src="data:image/svg+xml;base64,{{ $purpleLogoB64 }}" width="142" height="24" alt="SalesWizard"/></div>
  <div class="slide-top-line"></div>

  <div class="slide-body">
    <h1 class="slide-h1">Kerncijfers</h1>
    <div class="slide-h1-accent"></div>
    <p class="slide-sub">
      {{ $meta['periodLabel'] }}
      @if(!empty($meta['keywordFilter'])) · Zoekterm: {{ $meta['keywordFilter'] }} @endif
    </p>

    <table width="100%" cellspacing="14" cellpadding="0" style="margin: -14pt 0 0 -14pt; width: 876pt; border-collapse: separate;">
      <tr>
        <td width="33.33%" valign="top">
          <table width="100%" height="145pt" cellpadding="0" cellspacing="0" style="background-color: #3E008A; border: 1pt solid #3E008A;">
            <tr>
              <td align="center" valign="middle" style="padding: 16pt;">
                <div style="font-size: 11pt; color: #E9DDFB; margin-bottom: 10pt;">Prompts vermeld in AI</div>
                <div style="font-size: 34pt; font-weight: bold; color: #ffffff; line-height: 1.1;">
                  {{ $kpis['mentionedCount'] }} / {{ $kpis['measuredCount'] }}
                </div>
                <div style="font-size: 10pt; color: #D8C7F5; margin-top: 8pt;">
                  {{ $kpis['mentionRate'] }}% van gemeten prompts
                  @if($meta['hasMultipleMeasurements'] && $kpis['mentionRateDelta'] !== 0)
                    ({{ $kpis['mentionRateDelta'] > 0 ? '+' : '' }}{{ $kpis['mentionRateDelta'] }}% t.o.v. 0-meting)
                  @endif
                </div>
              </td>
            </tr>
          </table>
        </td>

        <td width="33.33%" valign="top">
          <table width="100%" height="145pt" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border: 1pt solid #E5E7EB; border-top: 3.5pt solid #3CC896;">
            <tr>
              <td align="center" valign="middle" style="padding: 16pt;">
                <div style="font-size: 11pt; color: #6B7280; margin-bottom: 10pt;">Gestegen prompts</div>
                <div style="font-size: 34pt; font-weight: bold; color: #3E008A; line-height: 1.1;">
                  {{ $kpis['risenCount'] }}
                </div>
                <div style="font-size: 10pt; color: #2E9E6B; font-weight: bold; margin-top: 8pt;">
                  @if($meta['hasMultipleMeasurements'])
                    {{ $kpis['newlyMentionedCount'] }} nieuw vermeld t.o.v. nulmeting
                  @else
                    Eerste meting (nulmeting) actief
                  @endif
                </div>
              </td>
            </tr>
          </table>
        </td>

        <td width="33.33%" valign="top">
          <table width="100%" height="145pt" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border: 1pt solid #E5E7EB; border-top: 3.5pt solid #3CC896;">
            <tr>
              <td align="center" valign="middle" style="padding: 16pt;">
                <div style="font-size: 11pt; color: #6B7280; margin-bottom: 10pt;">Gedaalde prompts</div>
                <div style="font-size: 34pt; font-weight: bold; color: {{ $kpis['declinedCount'] > 0 ? '#B91C1C' : '#3E008A' }}; line-height: 1.1;">
                  {{ $kpis['declinedCount'] }}
                </div>
                <div style="font-size: 10pt; color: #6B7280; margin-top: 8pt;">
                  {{ $kpis['retainedCount'] }} stabiel vermeld · {{ $kpis['unchangedCount'] }} nog niet vermeld
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <tr>
        <td width="33.33%" valign="top">
          <table width="100%" height="145pt" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border: 1pt solid #E5E7EB; border-top: 3.5pt solid #3CC896;">
            <tr>
              <td align="center" valign="middle" style="padding: 16pt;">
                <div style="font-size: 11pt; color: #6B7280; margin-bottom: 10pt;">Gem. AI Positie</div>
                <div style="font-size: 34pt; font-weight: bold; color: #3E008A; line-height: 1.1;">
                  {{ $kpis['avgPosition'] }}
                </div>
                <div style="font-size: 10pt; color: #6B7280; margin-top: 8pt;">
                  @if($meta['hasMultipleMeasurements'] && $kpis['positionDelta'] !== null && abs($kpis['positionDelta']) >= 0.1)
                    {{ $kpis['positionDelta'] > 0 ? '+' . number_format($kpis['positionDelta'], 1, ',', '.') . ' plaatsen gestegen' : number_format(abs($kpis['positionDelta']), 1, ',', '.') . ' plaatsen gedaald' }}
                  @else
                    Gemiddelde plek in AI-antwoorden
                  @endif
                </div>
              </td>
            </tr>
          </table>
        </td>

        <td width="33.33%" valign="top">
          <table width="100%" height="145pt" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border: 1pt solid #E5E7EB; border-top: 3.5pt solid #3CC896;">
            <tr>
              <td align="center" valign="middle" style="padding: 16pt;">
                <div style="font-size: 11pt; color: #6B7280; margin-bottom: 10pt;">AI Model-vermeldingen</div>
                <div style="font-size: 34pt; font-weight: bold; color: #3E008A; line-height: 1.1;">
                  {{ $kpis['totalModelMentions'] }} / {{ $kpis['totalModelChecks'] }}
                </div>
                <div style="font-size: 10pt; color: #6B7280; margin-top: 8pt;">
                  {{ $kpis['modelCoveragePct'] }}% dekking over alle live AI-modellen
                </div>
              </td>
            </tr>
          </table>
        </td>

        <td width="33.33%" valign="top">
          <table width="100%" height="145pt" cellpadding="0" cellspacing="0" style="background-color: #3CC896; border: 1pt solid #3CC896;">
            <tr>
              <td align="center" valign="middle" style="padding: 16pt;">
                <div style="font-size: 11pt; color: #ffffff; margin-bottom: 10pt;">AI Zichtbaarheidsscore</div>
                <div style="font-size: 34pt; font-weight: bold; color: #ffffff; line-height: 1.1;">
                  {{ $kpis['visibilityScore'] }}%
                </div>
                <div style="font-size: 10pt; color: #ECFDF5; margin-top: 8pt; font-weight: bold;">
                  @if($meta['hasMultipleMeasurements'])
                    {{ ($kpis['visibilityDelta'] >= 0 ? '+' : '') . $kpis['visibilityDelta'] }} procentpunt t.o.v. nulmeting ({{ $kpis['baselineVisibilityScore'] }}%)
                  @else
                    Startwaarde nulmeting vastgelegd
                  @endif
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>

  <div class="slide-footer">
    <table class="slide-footer-table">
      <tr>
        <td align="left">SalesWizard · {{ $meta['companyShort'] }} GEO rapportage {{ $meta['periodLabel'] }}</td>
        <td align="right">pagina {{ $pageCounter }}</td>
      </tr>
    </table>
  </div>
</div>
@endif

{{-- SLIDE 3: WAT VRAAGT AANDACHT? --}}
@if(!empty($sections['highlights']) && count($highlights) > 0)
@php $pageCounter++; @endphp
<div class="slide">
  <div class="slide-top-logo"><img src="data:image/svg+xml;base64,{{ $purpleLogoB64 }}" width="142" height="24" alt="SalesWizard"/></div>
  <div class="slide-top-line"></div>

  <div class="slide-body">
    <h1 class="slide-h1">Wat vraagt aandacht?</h1>
    <div class="slide-h1-accent"></div>
    <p class="slide-sub">{{ $meta['periodLabel'] }}</p>

    <div style="margin-top: 4pt;">
      @foreach($highlights as $item)
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 9pt; background-color: #F4F1FA; border-collapse: collapse;">
          <tr>
            <td width="5pt" style="background-color: {{ $item['color'] }};">&nbsp;</td>
            <td style="padding: 10pt 15pt; font-size: 11pt; color: #1F2937; line-height: 1.38;">
              {{ $item['text'] }}
            </td>
          </tr>
        </table>
      @endforeach
    </div>
  </div>

  <div class="slide-footer">
    <table class="slide-footer-table">
      <tr>
        <td align="left">SalesWizard · {{ $meta['companyShort'] }} GEO rapportage {{ $meta['periodLabel'] }}</td>
        <td align="right">pagina {{ $pageCounter }}</td>
      </tr>
    </table>
  </div>
</div>
@endif

{{-- SLIDE 4: ONTWIKKELING OVER TIJD --}}
@if(!empty($sections['timeline']))
@php $pageCounter++; @endphp
<div class="slide">
  <div class="slide-top-logo"><img src="data:image/svg+xml;base64,{{ $purpleLogoB64 }}" width="142" height="24" alt="SalesWizard"/></div>
  <div class="slide-top-line"></div>

  <div class="slide-body">
    <h1 class="slide-h1">Zichtbaarheid over tijd</h1>
    <div class="slide-h1-accent"></div>
    <p class="slide-sub">AI-metingen &amp; voortgang t.o.v. nulmeting, {{ $meta['periodLabel'] }}</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 6pt;">
      <tr>
        <td style="font-size: 12pt; color: #111827; font-weight: bold;">Vermelde prompts en zichtbaarheidsscore per meting</td>
        <td align="right" style="font-size: 10pt; color: #374151;">
          <span style="display: inline-block; width: 9pt; height: 9pt; background-color: #3E008A; vertical-align: middle;"></span>
          <span style="margin-right: 12pt; margin-left: 4pt;">Vermelde prompts</span>
          <span style="display: inline-block; width: 9pt; height: 9pt; background-color: #3CC896; vertical-align: middle;"></span>
          <span style="margin-left: 4pt;">Zichtbaarheidsscore (%)</span>
        </td>
      </tr>
    </table>

    <div style="width: 848pt; text-align: center;">
      <img src="data:image/svg+xml;base64,{{ $report['timelineChartSvgBase64'] }}" width="840" height="236" alt="Zichtbaarheid grafiek" style="display: block;"/>
    </div>

    <table class="callout-box" cellpadding="0" cellspacing="0">
      <tr>
        <td width="5pt" style="background-color: #3E008A;">&nbsp;</td>
        <td style="padding: 12pt 16pt; font-size: 11pt; color: #111827; line-height: 1.4;">
          {{ $report['timelineSummary'] }}
        </td>
      </tr>
    </table>
  </div>

  <div class="slide-footer">
    <table class="slide-footer-table">
      <tr>
        <td align="left">SalesWizard · {{ $meta['companyShort'] }} GEO rapportage {{ $meta['periodLabel'] }}</td>
        <td align="right">pagina {{ $pageCounter }}</td>
      </tr>
    </table>
  </div>
</div>
@endif

{{-- SLIDES 5+: ALLE PROMPTS NULMETING VS HUIDIG (MAX 6 ROWS PER SLIDE VOOR VRIJE WITRUIMTE) --}}
@if(!empty($sections['prompts']))
@php
  $promptChunks = count($prompts) > 0 ? array_chunk($prompts, 6) : [[]];
  $totalPromptPages = count($promptChunks);
@endphp
@foreach($promptChunks as $chunkIndex => $chunk)
@php
  $pageCounter++;
  $startNr = $chunkIndex * 6;
@endphp
<div class="slide">
  <div class="slide-top-logo"><img src="data:image/svg+xml;base64,{{ $purpleLogoB64 }}" width="142" height="24" alt="SalesWizard"/></div>
  <div class="slide-top-line"></div>

  <div class="slide-body">
    <h1 class="slide-h1">Prompts &amp; Voortgang</h1>
    <div class="slide-h1-accent"></div>
    <p class="slide-sub">
      {{ $meta['periodLabel'] }}
      @if($totalPromptPages > 1) · Overzicht {{ $chunkIndex + 1 }} van {{ $totalPromptPages }} @endif
    </p>

    <div class="sw-table-banner">
      Prompts: nulmeting versus huidige AI-zichtbaarheid ({{ $kpis['risenCount'] }} gestegen, {{ $kpis['declinedCount'] }} gedaald)
    </div>
    <table class="sw-table">
      <thead>
        <tr>
          <th width="4%">#</th>
          <th width="34%">Prompt / Zoekvraag</th>
          <th width="14%">Zoekterm</th>
          <th width="15%">Nulmeting</th>
          <th width="15%">Huidig</th>
          <th width="18%" style="text-align: right;">Ontwikkeling</th>
        </tr>
      </thead>
      <tbody>
        @forelse($chunk as $idx => $pRow)
          <tr class="{{ $idx % 2 === 1 ? 'alt-row' : '' }}">
            <td style="color: #6B7280; font-weight: bold;">{{ $startNr + $idx + 1 }}</td>
            <td style="font-weight: bold; color: #111827; line-height: 1.3;">
              {{ mb_strimwidth($pRow['text'], 0, 76, '…') }}
            </td>
            <td style="color: #4B5563;">
              {{ mb_strimwidth($pRow['keywordText'], 0, 22, '…') }}
            </td>
            <td style="color: #4B5563; white-space: nowrap;">{{ $pRow['baselineLabel'] }}</td>
            <td style="font-weight: bold; color: #111827; white-space: nowrap;">{{ $pRow['currentLabel'] }}</td>
            <td style="text-align: right;">
              @if($pRow['trend'] === 'up')
                <span class="badge badge-up">↑ Gestegen ({{ $pRow['deltaDetail'] }})</span>
              @elseif($pRow['trend'] === 'down')
                <span class="badge badge-down">↓ Gedaald ({{ $pRow['deltaDetail'] }})</span>
              @elseif($pRow['trend'] === 'retained')
                <span class="badge badge-retained">✓ {{ $pRow['deltaDetail'] }}</span>
              @elseif($pRow['trend'] === 'pending')
                <span class="badge badge-pending">In wachtrij</span>
              @else
                <span class="badge badge-neutral">Niet vermeld</span>
              @endif
            </td>
          </tr>
        @empty
          <tr>
            <td colspan="6" style="text-align: center; padding: 24pt; color: #6B7280;">
              Nog geen prompts beschikbaar in dit project.
            </td>
          </tr>
        @endforelse
      </tbody>
    </table>
    <div class="table-source-note">
      Bron: Live AI zoekmachine metingen ({{ $meta['companyShort'] }}). Posities en modelvermeldingen vergeleken met de vastgelegde nulmeting.
    </div>
  </div>

  <div class="slide-footer">
    <table class="slide-footer-table">
      <tr>
        <td align="left">SalesWizard · {{ $meta['companyShort'] }} GEO rapportage {{ $meta['periodLabel'] }}</td>
        <td align="right">pagina {{ $pageCounter }}</td>
      </tr>
    </table>
  </div>
</div>
@endforeach
@endif

{{-- SLIDE: AI ZOEKMACHINES VERGELIJKING --}}
@if(!empty($sections['engines']) && count($engines) > 0)
@php $pageCounter++; @endphp
<div class="slide">
  <div class="slide-top-logo"><img src="data:image/svg+xml;base64,{{ $purpleLogoB64 }}" width="142" height="24" alt="SalesWizard"/></div>
  <div class="slide-top-line"></div>

  <div class="slide-body">
    <h1 class="slide-h1">AI Zoekmachines</h1>
    <div class="slide-h1-accent"></div>
    <p class="slide-sub">Zichtbaarheid per AI-platform, {{ $meta['periodLabel'] }}</p>

    <div style="width: 848pt; text-align: center; margin-bottom: 8pt;">
      <img src="data:image/svg+xml;base64,{{ $report['enginesChartSvgBase64'] }}" width="840" height="134" alt="AI Engines grafiek" style="display: block;"/>
    </div>

    <div class="sw-table-banner">Resultaten per AI-zoekmachine</div>
    <table class="sw-table">
      <thead>
        <tr>
          <th width="6%">#</th>
          <th width="36%">AI Zoekmachine</th>
          <th width="18%" style="text-align: right;">Prompts vermeld</th>
          <th width="20%" style="text-align: right;">Zichtbaarheid (%)</th>
          <th width="20%" style="text-align: right;">Gem. Positie</th>
        </tr>
      </thead>
      <tbody>
        @foreach($engines as $eIdx => $eng)
          <tr class="{{ $eIdx % 2 === 1 ? 'alt-row' : '' }}">
            <td style="color: #6B7280; font-weight: bold;">{{ $eIdx + 1 }}</td>
            <td style="font-weight: bold; color: #111827;">{{ $eng['name'] }}</td>
            <td style="text-align: right;">{{ $eng['mentionedPrompts'] }} / {{ $eng['measuredPrompts'] }}</td>
            <td style="text-align: right; font-weight: bold; color: #3E008A;">{{ $eng['mentionPct'] }}%</td>
            <td style="text-align: right; font-weight: bold;">{{ $eng['avgPosition'] }}</td>
          </tr>
        @endforeach
      </tbody>
    </table>
  </div>

  <div class="slide-footer">
    <table class="slide-footer-table">
      <tr>
        <td align="left">SalesWizard · {{ $meta['companyShort'] }} GEO rapportage {{ $meta['periodLabel'] }}</td>
        <td align="right">pagina {{ $pageCounter }}</td>
      </tr>
    </table>
  </div>
</div>
@endif

{{-- SLIDE: CONCURRENTEN & SHARE OF VOICE (MAX 8 ROWS) --}}
@if(!empty($sections['competitors']) && count($competitors) > 0)
@php $pageCounter++; @endphp
<div class="slide">
  <div class="slide-top-logo"><img src="data:image/svg+xml;base64,{{ $purpleLogoB64 }}" width="142" height="24" alt="SalesWizard"/></div>
  <div class="slide-top-line"></div>

  <div class="slide-body">
    <h1 class="slide-h1">Concurrentie &amp; Share of Voice</h1>
    <div class="slide-h1-accent"></div>
    <p class="slide-sub">Verdeling van AI-merkaanbevelingen over top aanbieders, {{ $meta['periodLabel'] }}</p>

    <div class="sw-table-banner">Brand Rankings &amp; Share of Voice overzicht (Top {{ min(8, count($competitors)) }})</div>
    <table class="sw-table">
      <thead>
        <tr>
          <th width="8%">Rank</th>
          <th width="34%">Merk / Bedrijf</th>
          <th width="24%">Domein</th>
          <th width="14%" style="text-align: right;">Share of Voice</th>
          <th width="10%" style="text-align: right;">Positie</th>
          <th width="10%" style="text-align: right;">Citaties</th>
        </tr>
      </thead>
      <tbody>
        @foreach(array_slice($competitors, 0, 8) as $cIdx => $comp)
          <tr class="{{ !empty($comp['isSelf']) ? 'self-row' : ($cIdx % 2 === 1 ? 'alt-row' : '') }}">
            <td style="color: {{ !empty($comp['isSelf']) ? '#3E008A' : '#6B7280' }}; font-weight: bold;">
              {{ $comp['rank'] === '-' ? '-' : '#' . $comp['rank'] }}
            </td>
            <td style="color: #111827;">
              {{ mb_strimwidth($comp['brand'], 0, 32, '…') }}
              @if(!empty($comp['isSelf']))
                <span class="badge badge-retained" style="margin-left: 6pt; font-size: 8pt;">Uw merk</span>
              @endif
            </td>
            <td style="color: #6B7280;">{{ $comp['domain'] }}</td>
            <td style="text-align: right; font-weight: bold; color: #3E008A;">{{ $comp['sov'] }}%</td>
            <td style="text-align: right;">{{ $comp['position'] }}</td>
            <td style="text-align: right;">{{ $comp['citations'] }}</td>
          </tr>
        @endforeach
      </tbody>
    </table>
    <div class="table-source-note">
      Share of Voice toont het relatieve aandeel waarin een merk door AI-modellen wordt aanbevolen t.o.v. het totaal aantal metingen.
    </div>
  </div>

  <div class="slide-footer">
    <table class="slide-footer-table">
      <tr>
        <td align="left">SalesWizard · {{ $meta['companyShort'] }} GEO rapportage {{ $meta['periodLabel'] }}</td>
        <td align="right">pagina {{ $pageCounter }}</td>
      </tr>
    </table>
  </div>
</div>
@endif

{{-- LAATSTE SLIDE: BACKCOVER --}}
<div class="slide slide-last cover-slide">
  <div style="position: absolute; top: 238pt; left: 0; width: 960pt; text-align: center;">
    <div style="font-size: 28pt; font-weight: bold; color: #ffffff; letter-spacing: 0.3pt;">
      www.saleswizard.nl
    </div>
    <div style="width: 72pt; height: 4.5pt; background-color: #3CC896; margin: 16pt auto 0 auto;"></div>
  </div>
</div>

</body>
</html>
