import React, { useState, useEffect, useCallback } from 'react';
import {
  BookOpen, X, ChevronRight, ChevronLeft,
  Play, CheckCircle2, Sparkles, Layers, FileText, ArrowRight
} from 'lucide-react';

export default function WalkthroughGuide({
  currentUser,
  activeWorkspace,
  activeTab,
  setActiveTab,
  isGuideOpen,
  setIsGuideOpen,
  isTourActive,
  setIsTourActive
}) {
  const isKlant = currentUser?.role === 'klant';
  const [guideSection, setGuideSection] = useState('begrippen');
  const [tourStep, setTourStep] = useState(0);
  const [targetRect, setTargetRect] = useState(null);

  const getTourSteps = useCallback(() => {
    if (isKlant) {
      return [
        {
          target: '[data-tour="sidebar-workspace"]',
          title: 'Uw GEO Dashboard',
          description: 'Hier volgt u hoe vaak en op welke plek uw merk wordt aanbevolen door ChatGPT, Gemini en Perplexity.',
          tab: 'keywords'
        },
        {
          target: '[data-tour="keywords-header"]',
          title: 'Pakket & Export',
          description: 'Bekijk uw actieve prompts en download met één klik een Excel-rapport met uw Nulmeting en actuele cijfers.',
          tab: 'keywords'
        },
        {
          target: '[data-tour="keywords-table"]',
          title: 'Zoekwoorden & Resultaten',
          description: 'Klik op een zoekwoord voor de Nulmeting-grafiek, merkposities en de exacte AI-antwoorden.',
          tab: 'keywords'
        },
        {
          target: '[data-tour="header-guide-btn"]',
          title: 'Uitleg & Begrippen',
          description: 'Klik op "Handleiding" om altijd een korte toelichting op de begrippen en berekeningen te bekijken.'
        }
      ];
    }

    return [
      {
        target: '[data-tour="sidebar-workspace"]',
        title: '1. Klantproject selecteren',
        description: 'Schakel hierboven direct tussen actieve projecten of ga terug naar het algemene overzicht.'
      },
      {
        target: '[data-tour="projects-create-btn"]',
        title: '2. Projecten & Klantaccounts',
        description: 'Beheer pakketten (15, 30 of 60 prompts) en geef klanten direct veilige read-only toegang met een wachtwoord.',
        tab: 'client_admin'
      },
      {
        target: '[data-tour="keywords-header"]',
        title: '3. Prompts & CSV Export',
        description: 'Elk zoekwoord genereert 3 AI-prompts. Rechtsboven zie je het live verbruik en exporteer je alles naar CSV.',
        tab: 'keywords'
      },
      {
        target: '[data-tour="keywords-table"]',
        title: '4. Nulmeting & Grafieken',
        description: 'Klik op een zoekwoord voor de Nulmeting-vergelijking, concurrentierankings en antwoorden per AI-model.',
        tab: 'keywords'
      },
      {
        target: '[data-tour="header-guide-btn"]',
        title: '5. Handleiding & Rondleiding',
        description: 'Gebruik deze knop om begrippen na te slaan of de rondleiding opnieuw te starten.'
      }
    ];
  }, [isKlant]);

  const steps = getTourSteps();
  const currentStepData = steps[tourStep] || steps[0];

  // Auto-switch tab if step requires a specific view
  useEffect(() => {
    if (!isTourActive) return;
    const stepObj = steps[tourStep];
    if (stepObj && stepObj.tab && setActiveTab && activeTab !== stepObj.tab) {
      setActiveTab(stepObj.tab);
    }
  }, [isTourActive, tourStep, steps, activeTab, setActiveTab]);

  useEffect(() => {
    if (!isTourActive) {
      setTargetRect(null);
      return;
    }

    const updatePosition = () => {
      const stepObj = steps[tourStep];
      if (!stepObj) return;
      const el = document.querySelector(stepObj.target);
      if (el) {
        try {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } catch (e) {}
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setTargetRect({
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            bottom: rect.bottom,
            right: rect.right
          });
          return;
        }
      }
      setTargetRect(null);
    };

    updatePosition();
    const t1 = setTimeout(updatePosition, 80);
    const t2 = setTimeout(updatePosition, 220);
    const t3 = setTimeout(updatePosition, 450);

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isTourActive, tourStep, steps, activeTab, activeWorkspace]);

  const handleCloseTour = () => {
    setIsTourActive(false);
    setTourStep(0);
    if (currentUser) {
      const storageKey = `geo_wizard_tour_completed_${currentUser.id || currentUser.email || currentUser.role}`;
      localStorage.setItem(storageKey, 'true');
    }
  };

  const handleNextStep = () => {
    if (tourStep < steps.length - 1) {
      setTourStep(prev => prev + 1);
    } else {
      handleCloseTour();
    }
  };

  const handlePrevStep = () => {
    if (tourStep > 0) {
      setTourStep(prev => prev - 1);
    }
  };

  const handleStartTourFromGuide = () => {
    setIsGuideOpen(false);
    setTourStep(0);
    setIsTourActive(true);
  };

  const getTooltipPositionStyle = () => {
    if (!targetRect) {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
      };
    }

    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const cardW = 340;
    const cardH = 180;

    if (targetRect.left < 280 && targetRect.right < 340) {
      const topPos = Math.max(20, Math.min(viewportH - cardH - 20, targetRect.top));
      const leftPos = Math.min(viewportW - cardW - 20, targetRect.right + 16);
      return {
        top: `${topPos}px`,
        left: `${leftPos}px`,
        transform: 'none'
      };
    }

    const spaceBelow = viewportH - targetRect.bottom;
    const topPos = spaceBelow > cardH + 20
      ? targetRect.bottom + 12
      : Math.max(20, targetRect.top - cardH - 12);

    const leftPos = Math.max(
      20,
      Math.min(viewportW - cardW - 20, targetRect.left)
    );

    return {
      top: `${topPos}px`,
      left: `${leftPos}px`,
      transform: 'none'
    };
  };

  return (
    <>
      {/* 1. INTERACTIVE TOUR POPUP (HUISSTIJL SALESWIZARD) */}
      {isTourActive && currentStepData && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }}>
          <div
            onClick={handleCloseTour}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: targetRect ? 'transparent' : 'rgba(15, 10, 28, 0.45)',
              transition: 'all 0.2s ease'
            }}
          />

          {targetRect && (
            <div
              style={{
                position: 'fixed',
                top: `${targetRect.top - 5}px`,
                left: `${targetRect.left - 5}px`,
                width: `${targetRect.width + 10}px`,
                height: `${targetRect.height + 10}px`,
                borderRadius: '8px',
                border: '2px solid var(--brand-accent, #8b5cf6)',
                boxShadow: '0 0 0 9999px rgba(15, 10, 28, 0.45)',
                pointerEvents: 'none',
                transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                zIndex: 9999
              }}
            />
          )}

          <div
            className="fade-in"
            style={{
              position: 'fixed',
              ...getTooltipPositionStyle(),
              width: '340px',
              maxWidth: 'calc(100vw - 32px)',
              backgroundColor: '#ffffff',
              borderRadius: 'var(--border-radius-md, 10px)',
              padding: '18px 20px',
              boxShadow: 'var(--shadow-premium, 0 20px 25px -5px rgba(68, 0, 153, 0.08))',
              border: '1px solid var(--brand-light-border, #e8d9ff)',
              zIndex: 10000,
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              transition: 'top 0.25s cubic-bezier(0.16, 1, 0.3, 1), left 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--brand-primary, #440099)',
                backgroundColor: 'var(--brand-light, #f5f0ff)',
                padding: '2px 8px',
                borderRadius: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <Sparkles size={11} />
                Stap {tourStep + 1} van {steps.length}
              </span>
              <button
                type="button"
                onClick={handleCloseTour}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted, #94a3b8)',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex'
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div>
              <h4 style={{
                margin: 0,
                fontSize: '15px',
                fontWeight: 800,
                color: 'var(--text-primary, #0f172a)',
                fontFamily: "'Outfit', sans-serif"
              }}>
                {currentStepData.title}
              </h4>
              <p style={{
                margin: '6px 0 0 0',
                fontSize: '13px',
                color: 'var(--text-secondary, #475569)',
                lineHeight: 1.5
              }}>
                {currentStepData.description}
              </p>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: '8px',
              marginTop: '4px',
              borderTop: '1px solid var(--border-light, #f1f5f9)'
            }}>
              <button
                type="button"
                onClick={handleCloseTour}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-muted, #94a3b8)',
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                Overslaan
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {tourStep > 0 && (
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 'var(--border-radius-sm, 6px)',
                      border: '1px solid var(--border-medium, #e2e8f0)',
                      backgroundColor: '#ffffff',
                      color: 'var(--text-secondary, #475569)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <ChevronLeft size={14} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleNextStep}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--border-radius-sm, 6px)',
                    border: 'none',
                    backgroundColor: 'var(--brand-primary, #440099)',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'background-color 0.15s ease'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--brand-primary-hover, #350077)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--brand-primary, #440099)'; }}
                >
                  {tourStep === steps.length - 1 ? (
                    <>
                      <CheckCircle2 size={13} />
                      Klaar
                    </>
                  ) : (
                    <>
                      Volgende
                      <ChevronRight size={13} />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. RUSTIGE HANDLEIDING MODAL (HUISSTIJL SALESWIZARD) */}
      {isGuideOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 10, 28, 0.55)',
            backdropFilter: 'blur(4px)',
            zIndex: 9995,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setIsGuideOpen(false)}
        >
          <div
            className="card fade-in"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '640px',
              backgroundColor: 'var(--bg-card, #ffffff)',
              borderRadius: 'var(--border-radius-lg, 16px)',
              boxShadow: 'var(--shadow-premium, 0 20px 25px -5px rgba(68, 0, 153, 0.08))',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              border: '1px solid var(--border-medium, #e2e8f0)'
            }}
          >
            {/* Header: Saleswizard Brand Header */}
            <div style={{
              padding: '20px 24px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid var(--border-light, #f1f5f9)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--border-radius-sm, 6px)',
                  backgroundColor: 'var(--brand-light, #f5f0ff)',
                  color: 'var(--brand-primary, #440099)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <BookOpen size={18} />
                </div>
                <div>
                  <h2 style={{
                    margin: 0,
                    fontSize: '17px',
                    fontWeight: 800,
                    fontFamily: "'Outfit', sans-serif",
                    color: 'var(--text-primary, #0f172a)'
                  }}>
                    GEO Wizard — Korte Gids
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsGuideOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  borderRadius: 'var(--border-radius-sm, 6px)',
                  padding: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-muted, #94a3b8)',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary, #0f172a)'; e.currentTarget.style.backgroundColor = 'var(--border-light, #f1f5f9)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted, #94a3b8)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Saleswizard Tabs */}
            <div style={{
              display: 'flex',
              gap: '6px',
              padding: '12px 24px 0',
              backgroundColor: '#ffffff',
              borderBottom: '1px solid var(--border-light, #f1f5f9)'
            }}>
              {[
                { id: 'begrippen', label: 'Begrippen' },
                { id: 'pakketten', label: 'Pakketten & Limieten' },
                { id: 'tips', label: 'Tips & Rapportage' }
              ].map(tab => {
                const active = guideSection === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setGuideSection(tab.id)}
                    style={{
                      padding: '8px 14px',
                      borderTop: 'none',
                      borderLeft: 'none',
                      borderRight: 'none',
                      borderBottom: active ? '2px solid var(--brand-primary, #440099)' : '2px solid transparent',
                      backgroundColor: 'transparent',
                      color: active ? 'var(--brand-primary, #440099)' : 'var(--text-secondary, #475569)',
                      fontWeight: active ? 700 : 500,
                      fontSize: '13px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Content Body */}
            <div style={{
              padding: '20px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              {guideSection === 'begrippen' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    {
                      label: 'Keywords & Prompts',
                      text: 'Elk zoekwoord (keyword) maakt 3 natuurlijke zoekvragen (prompts) aan die we testen in ChatGPT, Gemini en Perplexity.'
                    },
                    {
                      label: 'Share of Voice (%)',
                      text: 'Het percentage AI-modellen dat het merk noemt. Noemen 2 van de 4 modellen uw bedrijf? Dan is de Share of Voice 50%.'
                    },
                    {
                      label: 'AI Positie vs. Google Rank',
                      text: 'Google Rank is uw klassieke positie in Google. AI Positie (#1 - #20) is de gemiddelde aanbevelingsplek in het AI-antwoord.'
                    },
                    {
                      label: 'Nulmeting & Citations',
                      text: 'De allereerste scan blijft altijd bewaard als Nulmeting voor de grafiek. Bij Citations/Sources ziet u welke websites de AI als bron gebruikt.'
                    }
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 'var(--border-radius-sm, 6px)',
                        backgroundColor: 'var(--bg-app, #f8fafc)',
                        border: '1px solid var(--border-light, #f1f5f9)'
                      }}
                    >
                      <div style={{
                        fontSize: '13px',
                        fontWeight: 700,
                        color: 'var(--brand-primary, #440099)',
                        marginBottom: '2px',
                        fontFamily: "'Outfit', sans-serif"
                      }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary, #475569)', lineHeight: 1.5 }}>
                        {item.text}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {guideSection === 'pakketten' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  {[
                    { name: 'AI Starter', kws: '5 keywords', prompts: '15 prompts', price: '€195/mnd' },
                    { name: 'AI Pro', kws: '10 keywords', prompts: '30 prompts', price: '€350/mnd' },
                    { name: 'AI Enterprise', kws: '20 keywords', prompts: '60 prompts', price: '€700/mnd' }
                  ].map((pkg, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '16px 14px',
                        borderRadius: 'var(--border-radius-md, 10px)',
                        backgroundColor: 'var(--bg-app, #f8fafc)',
                        border: '1px solid var(--border-medium, #e2e8f0)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '4px',
                        textAlign: 'center'
                      }}
                    >
                      <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--brand-primary, #440099)' }}>
                        {pkg.name}
                      </span>
                      <span style={{
                        fontSize: '20px',
                        fontWeight: 800,
                        color: 'var(--text-primary, #0f172a)',
                        fontFamily: "'Outfit', sans-serif",
                        marginTop: '2px'
                      }}>
                        {pkg.prompts}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)', fontWeight: 600 }}>
                        Max. {pkg.kws}
                      </span>
                      <span style={{
                        fontSize: '12px',
                        color: 'var(--text-secondary, #475569)',
                        fontWeight: 700,
                        marginTop: '4px'
                      }}>
                        {pkg.price}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {guideSection === 'tips' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    {
                      title: 'Metingen & Crawlen',
                      desc: isKlant
                        ? 'De Nulmeting is bij de start vastgelegd. Dagelijkse automatische scans houden uw grafiek en merkaanbevelingen actueel.'
                        : 'De eerste scan is de Nulmeting. Handmatig op "Opnieuw Scrapen" klikken kost AI-tegoed. Afspraak: scan alleen handmatig opnieuw bij de status "Mislukt". Wijzigingen op de website worden vanzelf meegenomen in de eerstvolgende dagelijkse scan.'
                    },
                    {
                      title: 'Excel / CSV Rapportage',
                      desc: 'Klik rechtsboven op "Export CSV" om een overzichtelijke spreadsheet te downloaden met de Nulmeting en alle actuele scores.'
                    },
                    {
                      title: 'Klanttoegang (Read-only)',
                      desc: isKlant
                        ? 'In uw omgeving kunt u alle resultaten, grafieken en AI-antwoorden veilig inzien en exporteren zonder instellingen te wijzigen.'
                        : 'Vul bij Projects een e-mail en wachtwoord in om de klant direct read-only toegang te geven tot zijn eigen dashboard.'
                    }
                  ].map((tip, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 'var(--border-radius-sm, 6px)',
                        backgroundColor: 'var(--bg-app, #f8fafc)',
                        border: '1px solid var(--border-light, #f1f5f9)'
                      }}
                    >
                      <div style={{
                        fontSize: '13px',
                        fontWeight: 700,
                        color: 'var(--brand-primary, #440099)',
                        marginBottom: '2px',
                        fontFamily: "'Outfit', sans-serif"
                      }}>
                        {tip.title}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary, #475569)', lineHeight: 1.5 }}>
                        {tip.desc}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{
              padding: '14px 24px',
              borderTop: '1px solid var(--border-light, #f1f5f9)',
              backgroundColor: '#ffffff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <button
                type="button"
                onClick={handleStartTourFromGuide}
                style={{
                  padding: '7px 14px',
                  borderRadius: '20px',
                  border: '1px solid var(--brand-light-border, #e8d9ff)',
                  backgroundColor: 'var(--brand-light, #f5f0ff)',
                  color: 'var(--brand-primary, #440099)',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Play size={12} />
                Rondleiding starten
              </button>

              <button
                type="button"
                onClick={() => setIsGuideOpen(false)}
                style={{
                  padding: '8px 20px',
                  borderRadius: '20px',
                  border: 'none',
                  backgroundColor: 'var(--brand-primary, #440099)',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--brand-primary-hover, #350077)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--brand-primary, #440099)'; }}
              >
                Sluiten
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
