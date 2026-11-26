import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText, Download, ExternalLink, RefreshCw, Loader2,
  X, Check, SlidersHorizontal, TrendingUp, TrendingDown, Minus
} from 'lucide-react';

const SalesWizardSlideLogo = ({ white = false, height = 22 }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
    <svg width={height * 0.9} height={height} viewBox="0 0 28 30" fill="none">
      <path d="M11 3 L17 18 L23 15 L18 2 Z" fill={white ? '#ffffff' : '#3E008A'} />
      <path d="M4 16 C5 23, 14 26, 23 22 C25 21, 26 18, 25 16 C22 20, 14 22, 8 17 Z" fill={white ? '#ffffff' : '#3E008A'} />
      <path d="M23 3 L24 6 L27 7 L24 8 L23 11 L22 8 L19 7 L22 6 Z" fill={white ? '#ffffff' : '#3E008A'} />
    </svg>
    <span style={{
      fontSize: `${Math.round(height * 0.82)}px`,
      fontWeight: 800,
      color: white ? '#ffffff' : '#3E008A',
      fontFamily: "'Outfit', 'Inter', sans-serif",
      letterSpacing: '-0.3px'
    }}>
      SalesWizard
    </span>
  </div>
);

const SlideChrome = ({ pageNum, totalPagesLabel, reportTitle, periodLabel, title, subtitle, children }) => (
  <div style={{
    width: '100%',
    maxWidth: '960px',
    aspectRatio: '16 / 9',
    minHeight: '540px',
    backgroundColor: '#ffffff',
    borderRadius: '10px',
    boxShadow: '0 8px 30px rgba(17, 24, 39, 0.09)',
    border: '1px solid #e5e7eb',
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: '22px 54px 18px 54px',
    boxSizing: 'border-box',
    flexShrink: 0
  }}>
    {/* Top Brand Bar */}
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '6px' }}>
        <SalesWizardSlideLogo white={false} height={22} />
      </div>
      <div style={{ width: '100%', height: '2px', backgroundColor: '#3CC896', marginBottom: '16px' }} />

      {/* Title & Accent */}
      <h2 style={{
        fontSize: '26px',
        fontWeight: 800,
        color: '#3E008A',
        margin: 0,
        fontFamily: "'Outfit', 'Inter', sans-serif",
        lineHeight: 1.15
      }}>
        {title}
      </h2>
      <div style={{ width: '68px', height: '4px', backgroundColor: '#3CC896', margin: '8px 0 8px 0' }} />
      <p style={{ fontSize: '12.5px', color: '#6b7280', margin: '0 0 14px 0' }}>{subtitle}</p>
    </div>

    {/* Main Content Area */}
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', minHeight: 0 }}>
      {children}
    </div>

    {/* Bottom Footer */}
    <div style={{
      borderTop: '1px solid #e5e7eb',
      paddingTop: '8px',
      marginTop: '12px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      fontSize: '10px',
      color: '#6b7280'
    }}>
      <span>SalesWizard · {reportTitle} GEO rapportage {periodLabel}</span>
      <span>pagina {pageNum}{totalPagesLabel ? ` / ${totalPagesLabel}` : ''}</span>
    </div>
  </div>
);

export default function PromptReport({
  activeWorkspace,
  currentUser = null,
  initialKeywordId = null,
  keywordsList = [],
  isModal = false,
  onClose = null
}) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [error, setError] = useState(null);

  // Customization options
  const [keywordFilterId, setKeywordFilterId] = useState(initialKeywordId ? String(initialKeywordId) : '');
  const [customTitle, setCustomTitle] = useState('');
  const [customPeriod, setCustomPeriod] = useState('');
  const [availableKeywords, setAvailableKeywords] = useState(keywordsList || []);
  const [showSettings, setShowSettings] = useState(true);
  const [sections, setSections] = useState({
    kpis: true,
    highlights: true,
    timeline: true,
    prompts: true,
    engines: true,
    competitors: true
  });

  useEffect(() => {
    if (keywordsList && keywordsList.length > 0) {
      setAvailableKeywords(keywordsList);
    } else if (activeWorkspace) {
      fetch(`/api/keywords?company=${encodeURIComponent(activeWorkspace)}`)
        .then(r => r.json())
        .then(d => {
          if (d.success && Array.isArray(d.keywords)) {
            setAvailableKeywords(d.keywords.filter(k => !k.is_archived));
          }
        })
        .catch(() => {});
    }
  }, [activeWorkspace, keywordsList]);

  const buildQueryParams = useCallback((extra = {}) => {
    const params = new URLSearchParams();
    if (activeWorkspace) params.set('company', activeWorkspace);
    if (currentUser?.id) params.set('userId', String(currentUser.id));
    if (currentUser?.role) params.set('role', String(currentUser.role));
    if (keywordFilterId) params.set('keyword_id', keywordFilterId);
    if (customTitle.trim()) params.set('title', customTitle.trim());
    if (customPeriod.trim()) params.set('period', customPeriod.trim());
    Object.entries(sections).forEach(([k, v]) => {
      params.set(`show_${k}`, v ? '1' : '0');
    });
    Object.entries(extra).forEach(([k, v]) => {
      params.set(k, String(v));
    });
    return params.toString();
  }, [activeWorkspace, currentUser, keywordFilterId, customTitle, customPeriod, sections]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = buildQueryParams();
      const res = await fetch(`/api/reports/prompts?${qs}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Kon rapportagegegevens niet laden.');
      }
      setReport(data.report);
    } catch (err) {
      setError(err.message || 'Fout bij ophalen van rapportage.');
    } finally {
      setLoading(false);
    }
  }, [buildQueryParams]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleDownloadPdf = async (previewInTab = false) => {
    setDownloadingPdf(true);
    try {
      const qs = buildQueryParams(previewInTab ? { preview: '1' } : {});
      const url = `/api/reports/prompts/pdf?${qs}`;

      if (previewInTab) {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        const res = await fetch(url);
        if (!res.ok) throw new Error('PDF generatie mislukt.');
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const slug = (report?.meta?.companyShort || activeWorkspace || 'project').toLowerCase().replace(/[^a-z0-9]+/g, '-');
        link.href = blobUrl;
        link.setAttribute('download', `SalesWizard-GEO-Rapportage-${slug}-${new Date().toISOString().slice(0, 10)}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(blobUrl);
      }
    } catch (err) {
      alert(err.message || 'Kon PDF niet downloaden.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const toggleSection = (key) => {
    setSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const renderSlideDeck = () => {
    if (!report) return null;
    const { meta, kpis, highlights, timelineSummary, prompts, engines, competitors } = report;
    const activeSec = report.sections || sections;
    const promptChunks = [];
    if (prompts && prompts.length > 0) {
      for (let i = 0; i < prompts.length; i += 6) {
        promptChunks.push(prompts.slice(i, i + 6));
      }
    } else {
      promptChunks.push([]);
    }

    let pageNum = 0;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '28px', width: '100%' }}>
        {/* SLIDE 1: COVER */}
        <div style={{
          width: '100%',
          maxWidth: '960px',
          aspectRatio: '16 / 9',
          minHeight: '540px',
          backgroundColor: '#3E008D',
          borderRadius: '10px',
          boxShadow: '0 10px 35px rgba(62, 0, 141, 0.28)',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          color: '#ffffff',
          flexShrink: 0
        }}>
          <div style={{ padding: '32px 60px 0 60px' }}>
            <SalesWizardSlideLogo white={true} height={26} />
          </div>

          <div style={{ padding: '0 60px' }}>
            <h1 style={{
              fontSize: '42px',
              fontWeight: 800,
              color: '#ffffff',
              margin: 0,
              letterSpacing: '0.5px',
              fontFamily: "'Outfit', 'Inter', sans-serif"
            }}>
              {meta.projectName}
            </h1>
            <div style={{ width: '74px', height: '5px', backgroundColor: '#3CC896', margin: '14px 0 18px 0' }} />
            <p style={{ fontSize: '18px', color: '#F3EEFA', margin: 0 }}>
              AI-Zichtbaarheid &amp; Prompt Rapportage {meta.periodLabel}
              {meta.keywordFilter ? ` · Onderwerp: ${meta.keywordFilter}` : ''}
            </p>
          </div>

          <div style={{
            backgroundColor: '#2B0068',
            padding: '22px 60px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            fontSize: '13px',
            color: '#F3EEFA'
          }}>
            <div><span style={{ display: 'inline-block', width: '105px', color: '#D8C7F5' }}>Cijfers van:</span> {meta.dataTimestamp}</div>
            <div><span style={{ display: 'inline-block', width: '105px', color: '#D8C7F5' }}>Door:</span> {meta.author}</div>
            <div><span style={{ display: 'inline-block', width: '105px', color: '#D8C7F5' }}>Gemaakt:</span> {meta.createdDate}</div>
          </div>
        </div>

        {/* SLIDE 2: KERNCIJFERS */}
        {activeSec.kpis && (() => {
          pageNum++;
          return (
            <SlideChrome
              pageNum={pageNum}
              reportTitle={meta.companyShort}
              periodLabel={meta.periodLabel}
              title="Kerncijfers"
              subtitle={`${meta.periodLabel}${meta.keywordFilter ? ` · Zoekterm: ${meta.keywordFilter}` : ''}`}
            >
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '16px',
                flex: 1
              }}>
                {/* Card 1: Purple */}
                <div style={{
                  backgroundColor: '#3E008A',
                  color: '#ffffff',
                  padding: '22px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  border: '1px solid #3E008A'
                }}>
                  <div style={{ fontSize: '12px', color: '#E9DDFB', marginBottom: '8px' }}>Prompts vermeld in AI</div>
                  <div style={{ fontSize: '36px', fontWeight: 800, lineHeight: 1.1 }}>{kpis.mentionedCount} / {kpis.measuredCount}</div>
                  <div style={{ fontSize: '11px', color: '#D8C7F5', marginTop: '8px' }}>
                    {kpis.mentionRate}% van gemeten prompts
                    {meta.hasMultipleMeasurements && kpis.mentionRateDelta !== 0 ? ` (${kpis.mentionRateDelta > 0 ? '+' : ''}${kpis.mentionRateDelta}% t.o.v. 0-meting)` : ''}
                  </div>
                </div>

                {/* Card 2: Gestegen */}
                <div style={{
                  backgroundColor: '#ffffff',
                  padding: '22px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  border: '1px solid #e5e7eb',
                  borderTop: '4px solid #3CC896'
                }}>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>Gestegen prompts</div>
                  <div style={{ fontSize: '36px', fontWeight: 800, color: '#3E008A', lineHeight: 1.1 }}>{kpis.risenCount}</div>
                  <div style={{ fontSize: '11px', color: '#2E9E6B', fontWeight: 700, marginTop: '8px' }}>
                    {meta.hasMultipleMeasurements ? `${kpis.newlyMentionedCount} nieuw vermeld t.o.v. nulmeting` : 'Eerste meting (nulmeting) actief'}
                  </div>
                </div>

                {/* Card 3: Gedaald */}
                <div style={{
                  backgroundColor: '#ffffff',
                  padding: '22px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  border: '1px solid #e5e7eb',
                  borderTop: '4px solid #3CC896'
                }}>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>Gedaalde prompts</div>
                  <div style={{ fontSize: '36px', fontWeight: 800, color: kpis.declinedCount > 0 ? '#B91C1C' : '#3E008A', lineHeight: 1.1 }}>{kpis.declinedCount}</div>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '8px' }}>
                    {kpis.retainedCount} stabiel vermeld · {kpis.unchangedCount} nog niet vermeld
                  </div>
                </div>

                {/* Card 4: Gem Positie */}
                <div style={{
                  backgroundColor: '#ffffff',
                  padding: '22px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  border: '1px solid #e5e7eb',
                  borderTop: '4px solid #3CC896'
                }}>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>Gem. AI Positie</div>
                  <div style={{ fontSize: '36px', fontWeight: 800, color: '#3E008A', lineHeight: 1.1 }}>{kpis.avgPosition}</div>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '8px' }}>
                    {meta.hasMultipleMeasurements && kpis.positionDelta !== null && Math.abs(kpis.positionDelta) >= 0.1
                      ? (kpis.positionDelta > 0 ? `+${String(kpis.positionDelta).replace('.', ',')} plaatsen gestegen` : `${String(Math.abs(kpis.positionDelta)).replace('.', ',')} plaatsen gedaald`)
                      : 'Gemiddelde plek in AI-antwoorden'}
                  </div>
                </div>

                {/* Card 5: Model-vermeldingen */}
                <div style={{
                  backgroundColor: '#ffffff',
                  padding: '22px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  border: '1px solid #e5e7eb',
                  borderTop: '4px solid #3CC896'
                }}>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>AI Model-vermeldingen</div>
                  <div style={{ fontSize: '36px', fontWeight: 800, color: '#3E008A', lineHeight: 1.1 }}>{kpis.totalModelMentions} / {kpis.totalModelChecks}</div>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '8px' }}>
                    {kpis.modelCoveragePct}% dekking over alle live AI-modellen
                  </div>
                </div>

                {/* Card 6: Mintgreen */}
                <div style={{
                  backgroundColor: '#3CC896',
                  color: '#ffffff',
                  padding: '22px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  border: '1px solid #3CC896'
                }}>
                  <div style={{ fontSize: '12px', color: '#ffffff', marginBottom: '8px' }}>AI Zichtbaarheidsscore</div>
                  <div style={{ fontSize: '36px', fontWeight: 800, lineHeight: 1.1 }}>{kpis.visibilityScore}%</div>
                  <div style={{ fontSize: '11px', color: '#ECFDF5', fontWeight: 700, marginTop: '8px' }}>
                    {meta.hasMultipleMeasurements
                      ? `${kpis.visibilityDelta >= 0 ? '+' : ''}${kpis.visibilityDelta} procentpunt t.o.v. nulmeting (${kpis.baselineVisibilityScore}%)`
                      : 'Startwaarde nulmeting vastgelegd'}
                  </div>
                </div>
              </div>
            </SlideChrome>
          );
        })()}

        {/* SLIDE 3: WAT VRAAGT AANDACHT? */}
        {activeSec.highlights && highlights && highlights.length > 0 && (() => {
          pageNum++;
          return (
            <SlideChrome
              pageNum={pageNum}
              reportTitle={meta.companyShort}
              periodLabel={meta.periodLabel}
              title="Wat vraagt aandacht?"
              subtitle={meta.periodLabel}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {highlights.map((h, i) => (
                  <div key={i} style={{
                    backgroundColor: '#F4F1FA',
                    borderLeft: `5px solid ${h.color}`,
                    padding: '12px 16px',
                    fontSize: '12.5px',
                    color: '#1f2937',
                    lineHeight: 1.45
                  }}>
                    {h.text}
                  </div>
                ))}
              </div>
            </SlideChrome>
          );
        })()}

        {/* SLIDE 4: ZICHTBAARHEID OVER TIJD */}
        {activeSec.timeline && (() => {
          pageNum++;
          return (
            <SlideChrome
              pageNum={pageNum}
              reportTitle={meta.companyShort}
              periodLabel={meta.periodLabel}
              title="Zichtbaarheid over tijd"
              subtitle={`AI-metingen & voortgang t.o.v. nulmeting, ${meta.periodLabel}`}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>Vermelde prompts en zichtbaarheidsscore per meting</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '11px', color: '#374151' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ width: '10px', height: '10px', backgroundColor: '#3E008A', display: 'inline-block' }} /> Vermelde prompts
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ width: '10px', height: '10px', backgroundColor: '#3CC896', display: 'inline-block' }} /> Zichtbaarheidsscore (%)
                  </span>
                </div>
              </div>

              <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                <img
                  src={`data:image/svg+xml;base64,${report.timelineChartSvgBase64}`}
                  alt="Zichtbaarheid grafiek"
                  style={{ width: '100%', maxWidth: '840px', height: 'auto' }}
                />
              </div>

              <div style={{
                backgroundColor: '#F4F1FA',
                borderLeft: '5px solid #3E008A',
                padding: '12px 16px',
                fontSize: '12.5px',
                color: '#111827',
                marginTop: '10px',
                lineHeight: 1.45
              }}>
                {timelineSummary}
              </div>
            </SlideChrome>
          );
        })()}

        {/* SLIDES 5+: PROMPTS & VOORTGANG */}
        {activeSec.prompts && promptChunks.map((chunk, cIdx) => {
          pageNum++;
          const startNr = cIdx * 6;
          return (
            <SlideChrome
              key={`prompts_${cIdx}`}
              pageNum={pageNum}
              reportTitle={meta.companyShort}
              periodLabel={meta.periodLabel}
              title="Prompts & Voortgang"
              subtitle={`${meta.periodLabel}${promptChunks.length > 1 ? ` · Overzicht ${cIdx + 1} van ${promptChunks.length}` : ''}`}
            >
              <div>
                <div style={{
                  backgroundColor: '#3E008A',
                  color: '#ffffff',
                  padding: '10px 16px',
                  fontSize: '13px',
                  fontWeight: 700
                }}>
                  Prompts: nulmeting versus huidige AI-zichtbaarheid ({kpis.risenCount} gestegen, {kpis.declinedCount} gedaald)
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#3CC896', color: '#ffffff', textAlign: 'left' }}>
                      <th style={{ padding: '8px 10px', width: '4%' }}>#</th>
                      <th style={{ padding: '8px 10px', width: '36%' }}>Prompt / Zoekvraag</th>
                      <th style={{ padding: '8px 10px', width: '14%' }}>Zoekterm</th>
                      <th style={{ padding: '8px 10px', width: '14%' }}>Nulmeting</th>
                      <th style={{ padding: '8px 10px', width: '14%' }}>Huidig</th>
                      <th style={{ padding: '8px 10px', width: '18%', textAlign: 'right' }}>Ontwikkeling</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chunk.length > 0 ? chunk.map((pRow, idx) => (
                      <tr key={pRow.id || idx} style={{
                        backgroundColor: idx % 2 === 1 ? '#FAFAFC' : '#ffffff',
                        borderBottom: '1px solid #eceef2'
                      }}>
                        <td style={{ padding: '7px 10px', color: '#6b7280', fontWeight: 700 }}>{startNr + idx + 1}</td>
                        <td style={{ padding: '7px 10px', color: '#111827', fontWeight: 600 }}>{pRow.text}</td>
                        <td style={{ padding: '7px 10px', color: '#4b5563' }}>{pRow.keywordText}</td>
                        <td style={{ padding: '7px 10px', color: '#4b5563', whiteSpace: 'nowrap' }}>{pRow.baselineLabel}</td>
                        <td style={{ padding: '7px 10px', color: '#111827', fontWeight: 700, whiteSpace: 'nowrap' }}>{pRow.currentLabel}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right' }}>
                          {pRow.trend === 'up' && (
                            <span style={{ backgroundColor: '#dcfce7', color: '#15803d', padding: '3px 9px', borderRadius: '12px', fontSize: '10px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                              ↑ Gestegen ({pRow.deltaDetail})
                            </span>
                          )}
                          {pRow.trend === 'down' && (
                            <span style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '3px 9px', borderRadius: '12px', fontSize: '10px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                              ↓ Gedaald ({pRow.deltaDetail})
                            </span>
                          )}
                          {pRow.trend === 'retained' && (
                            <span style={{ backgroundColor: '#ede9fe', color: '#440099', padding: '3px 9px', borderRadius: '12px', fontSize: '10px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                              ✓ {pRow.deltaDetail}
                            </span>
                          )}
                          {pRow.trend === 'pending' && (
                            <span style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', padding: '3px 9px', borderRadius: '12px', fontSize: '10px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                              In wachtrij
                            </span>
                          )}
                          {pRow.trend === 'unchanged' && (
                            <span style={{ backgroundColor: '#f3f4f6', color: '#4b5563', padding: '3px 9px', borderRadius: '12px', fontSize: '10px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                              Niet vermeld
                            </span>
                          )}
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#6b7280' }}>
                          Nog geen prompts beschikbaar in dit project.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '6px' }}>
                  Bron: Live AI zoekmachine metingen ({meta.companyShort}). Posities en modelvermeldingen vergeleken met de vastgelegde nulmeting.
                </div>
              </div>
            </SlideChrome>
          );
        })}

        {/* SLIDE: AI ZOEKMACHINES */}
        {activeSec.engines && engines && engines.length > 0 && (() => {
          pageNum++;
          return (
            <SlideChrome
              pageNum={pageNum}
              reportTitle={meta.companyShort}
              periodLabel={meta.periodLabel}
              title="AI Zoekmachines"
              subtitle={`Zichtbaarheid per AI-platform, ${meta.periodLabel}`}
            >
              <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                <img
                  src={`data:image/svg+xml;base64,${report.enginesChartSvgBase64}`}
                  alt="AI Zoekmachines grafiek"
                  style={{ width: '100%', maxWidth: '840px', height: 'auto' }}
                />
              </div>

              <div style={{ backgroundColor: '#3E008A', color: '#ffffff', padding: '9px 14px', fontSize: '12.5px', fontWeight: 700 }}>
                Resultaten per AI-zoekmachine
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#3CC896', color: '#ffffff', textAlign: 'left' }}>
                    <th style={{ padding: '7px 10px', width: '6%' }}>#</th>
                    <th style={{ padding: '7px 10px', width: '36%' }}>AI Zoekmachine</th>
                    <th style={{ padding: '7px 10px', width: '18%', textAlign: 'right' }}>Prompts vermeld</th>
                    <th style={{ padding: '7px 10px', width: '20%', textAlign: 'right' }}>Zichtbaarheid (%)</th>
                    <th style={{ padding: '7px 10px', width: '20%', textAlign: 'right' }}>Gem. Positie</th>
                  </tr>
                </thead>
                <tbody>
                  {engines.map((eng, idx) => (
                    <tr key={eng.id || idx} style={{
                      backgroundColor: idx % 2 === 1 ? '#FAFAFC' : '#ffffff',
                      borderBottom: '1px solid #eceef2'
                    }}>
                      <td style={{ padding: '7px 10px', color: '#6b7280', fontWeight: 700 }}>{idx + 1}</td>
                      <td style={{ padding: '7px 10px', fontWeight: 700, color: '#111827' }}>{eng.name}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right' }}>{eng.mentionedPrompts} / {eng.measuredPrompts}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: '#3E008A' }}>{eng.mentionPct}%</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700 }}>{eng.avgPosition}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </SlideChrome>
          );
        })()}

        {/* SLIDE: CONCURRENTIE & SHARE OF VOICE */}
        {activeSec.competitors && competitors && competitors.length > 0 && (() => {
          pageNum++;
          return (
            <SlideChrome
              pageNum={pageNum}
              reportTitle={meta.companyShort}
              periodLabel={meta.periodLabel}
              title="Concurrentie & Share of Voice"
              subtitle={`Verdeling van AI-merkaanbevelingen over top aanbieders, ${meta.periodLabel}`}
            >
              <div style={{ backgroundColor: '#3E008A', color: '#ffffff', padding: '10px 14px', fontSize: '12.5px', fontWeight: 700 }}>
                Brand Rankings &amp; Share of Voice overzicht (Top {Math.min(8, competitors.length)})
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#3CC896', color: '#ffffff', textAlign: 'left' }}>
                    <th style={{ padding: '7px 10px', width: '8%' }}>Rank</th>
                    <th style={{ padding: '7px 10px', width: '34%' }}>Merk / Bedrijf</th>
                    <th style={{ padding: '7px 10px', width: '24%' }}>Domein</th>
                    <th style={{ padding: '7px 10px', width: '14%', textAlign: 'right' }}>Share of Voice</th>
                    <th style={{ padding: '7px 10px', width: '10%', textAlign: 'right' }}>Positie</th>
                    <th style={{ padding: '7px 10px', width: '10%', textAlign: 'right' }}>Citaties</th>
                  </tr>
                </thead>
                <tbody>
                  {competitors.slice(0, 8).map((comp, idx) => (
                    <tr key={idx} style={{
                      backgroundColor: comp.isSelf ? '#F4EFFA' : (idx % 2 === 1 ? '#FAFAFC' : '#ffffff'),
                      fontWeight: comp.isSelf ? 700 : 400,
                      borderBottom: '1px solid #eceef2'
                    }}>
                      <td style={{ padding: '7px 10px', color: comp.isSelf ? '#3E008A' : '#6b7280', fontWeight: 700 }}>
                        {comp.rank === '-' ? '-' : `#${comp.rank}`}
                      </td>
                      <td style={{ padding: '7px 10px', color: '#111827' }}>
                        {comp.brand}
                        {comp.isSelf && (
                          <span style={{
                            marginLeft: '8px',
                            backgroundColor: '#ede9fe',
                            color: '#440099',
                            padding: '2px 7px',
                            borderRadius: '10px',
                            fontSize: '9.5px',
                            fontWeight: 700
                          }}>Uw merk</span>
                        )}
                      </td>
                      <td style={{ padding: '7px 10px', color: '#6b7280' }}>{comp.domain}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: '#3E008A' }}>{comp.sov}%</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right' }}>{comp.position}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right' }}>{comp.citations}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '8px' }}>
                Share of Voice toont het relatieve aandeel waarin een merk door AI-modellen wordt aanbevolen t.o.v. het totaal aantal metingen.
              </div>
            </SlideChrome>
          );
        })()}

        {/* LAATSTE SLIDE: BACKCOVER */}
        <div style={{
          width: '100%',
          maxWidth: '960px',
          aspectRatio: '16 / 9',
          minHeight: '540px',
          backgroundColor: '#3E008D',
          borderRadius: '10px',
          boxShadow: '0 10px 35px rgba(62, 0, 141, 0.28)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          flexShrink: 0
        }}>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#ffffff', letterSpacing: '0.4px' }}>
            www.saleswizard.nl
          </div>
          <div style={{ width: '74px', height: '5px', backgroundColor: '#3CC896', marginTop: '14px' }} />
        </div>
      </div>
    );
  };

  const mainContainerStyle = isModal ? {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(17, 24, 39, 0.72)',
    zIndex: 2000,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  } : {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100%',
    backgroundColor: '#f3f4f6'
  };

  return (
    <div style={mainContainerStyle}>
      {/* Sticky Toolbar */}
      <div style={{
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e5e7eb',
        padding: '14px 28px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            backgroundColor: '#f1f5f9',
            color: '#334155',
            border: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <FileText size={17} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a', fontFamily: "'Outfit', sans-serif" }}>
              Rapportage Uitdraai
            </h2>
            <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
              Overzicht van prompts, stijgers t.o.v. nulmeting, AI-zoekmachines &amp; concurrentie ({activeWorkspace || 'Actief project'}).
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setShowSettings(s => !s)}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              backgroundColor: showSettings ? '#f1f5f9' : '#ffffff',
              color: '#334155',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <SlidersHorizontal size={13} style={{ color: '#64748b' }} />
            Instellingen
          </button>

          <button
            type="button"
            onClick={() => handleDownloadPdf(true)}
            disabled={loading || downloadingPdf || !report}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              backgroundColor: '#ffffff',
              color: '#334155',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: (loading || downloadingPdf || !report) ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <ExternalLink size={13} style={{ color: '#64748b' }} />
            Open PDF Preview
          </button>

          <button
            type="button"
            onClick={() => handleDownloadPdf(false)}
            disabled={loading || downloadingPdf || !report}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#440099',
              color: '#ffffff',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: (loading || downloadingPdf || !report) ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px'
            }}
          >
            {downloadingPdf ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
            {downloadingPdf ? 'PDF wordt gegenereerd...' : 'Download PDF Rapport'}
          </button>

          {isModal && onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px',
                borderRadius: '50%',
                border: '1px solid #e5e7eb',
                backgroundColor: '#ffffff',
                color: '#4b5563',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Sluiten"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Config / Filter Panel */}
      {showSettings && (
        <div style={{
          backgroundColor: '#fafafa',
          borderBottom: '1px solid #e5e7eb',
          padding: '14px 28px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          alignItems: 'flex-end'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '180px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#4b5563' }}>Klant- / Covertitel</label>
            <input
              type="text"
              placeholder={report?.meta?.projectName || 'Bijv. BEDRIJFSNAAM'}
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              style={{ padding: '7px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '12px', backgroundColor: '#ffffff' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '210px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#4b5563' }}>Periode omschrijving</label>
            <input
              type="text"
              placeholder={report?.meta?.periodLabel || 'oktober 2026 t/m november 2026'}
              value={customPeriod}
              onChange={(e) => setCustomPeriod(e.target.value)}
              style={{ padding: '7px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '12px', backgroundColor: '#ffffff' }}
            />
          </div>

          {availableKeywords.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '190px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#4b5563' }}>Filter op zoekterm</label>
              <select
                value={keywordFilterId}
                onChange={(e) => setKeywordFilterId(e.target.value)}
                style={{ padding: '7px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '12px', backgroundColor: '#ffffff' }}
              >
                <option value="">Alle prompts (Hele project)</option>
                {availableKeywords.map(k => (
                  <option key={k.id} value={k.id}>{k.keyword_text || k.keyword || k.text}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '260px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#4b5563' }}>Onderdelen in rapportage</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {[
                { key: 'kpis', label: 'Kerncijfers' },
                { key: 'highlights', label: 'Wat vraagt aandacht?' },
                { key: 'timeline', label: 'Zichtbaarheid grafiek' },
                { key: 'prompts', label: 'Prompts & stijgers' },
                { key: 'engines', label: 'AI Zoekmachines' },
                { key: 'competitors', label: 'Concurrentie & SoV' }
              ].map(item => {
                const active = !!sections[item.key];
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => toggleSection(item.key)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '6px',
                      border: `1px solid ${active ? '#0f172a' : '#e2e8f0'}`,
                      backgroundColor: active ? '#0f172a' : '#ffffff',
                      color: active ? '#ffffff' : '#64748b',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {active && <Check size={11} />}
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Slide Canvas Area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        backgroundColor: '#f1f5f9',
        padding: '28px 24px 48px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '360px', gap: '12px' }}>
            <Loader2 size={28} className="spin" style={{ color: '#0f172a' }} />
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>Rapportage wordt samengesteld...</span>
          </div>
        ) : error ? (
          <div style={{
            padding: '20px 24px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '10px',
            color: '#991b1b',
            fontSize: '13px',
            fontWeight: 600
          }}>
            {error}
          </div>
        ) : (
          renderSlideDeck()
        )}
      </div>
    </div>
  );
}
