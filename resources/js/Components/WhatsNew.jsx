import React from 'react';

const RELEASES = [
  {
    version: 'v2.6',
    date: '26 november 2026',
    nieuw: [
      'Gebruikersbeheer toegevoegd: je kunt nu zelf collega\'s (medewerkers) én klantaccounts aanmaken en uitnodigen.',
      'Eigen klantomgeving: klanten die inloggen zien alleen hun eigen project en resultaten, nooit die van andere klanten.',
      'Knop "Alle prompts opnieuw scrapen" toegevoegd: meet in één klik alle prompts van een klant opnieuw door, terwijl de 0-meting en historie gewoon bewaard blijven.',
      'Deze What\'s New-pagina toegevoegd zodat het team direct ziet wat er nieuw is in de tool.'
    ],
    verbeterd: [
      'Rustigere vormgeving door de hele tool heen: minder felle kleuren en drukke blokjes, zodat cijfers en merkvermeldingen prettiger lezen.',
      'Overzichtelijkere historie bij de nulmeting: je ziet nu op één rustige tijdlijn hoe de zichtbaarheid zich per meetmoment ontwikkelt.',
      'Duidelijker kostenoverzicht: je ziet nu precies wat de AI-metingen kosten per klantproject en per AI-kanaal, inclusief het actuele tegoed.'
    ],
    opgelost: [
      'Oude, niet meer gebruikte AI-kostenposten zijn verwijderd uit het kostenoverzicht zodat bedragen weer één-op-één kloppen.'
    ]
  },
  {
    version: 'v2.5',
    date: '26 november 2026',
    nieuw: [
      'Duidelijke voortgangsbalk bij metingen: zodra je prompts laat meten, zie je nu zowel bovenin als per prompt hoe ver de meting is (in procenten).'
    ],
    verbeterd: [
      'Resultaten verversen nu vanzelf op het scherm zolang een meting loopt — je hoeft de pagina tussendoor niet meer zelf te herladen.'
    ],
    opgelost: [
      'Metingen in ChatGPT en Google Gemini lopen niet meer vast bij langere of complexere zoekvragen.',
      'Bij het opnieuw meten van bestaande prompts blijft de voortgangsindicator nu netjes zichtbaar tot alle AI-zoekmachines klaar zijn.'
    ]
  },
  {
    version: 'v2.4',
    date: '24 november 2026',
    nieuw: [
      'Klantklare PDF-rapportage (presentatieformaat): download direct een strakke rapportage met groeicijfers t.o.v. de 0-meting, resultaten per AI-zoekmachine en concurrentievergelijking.'
    ],
    verbeterd: [
      'Het projectenoverzicht toont nu direct hoeveel actieve prompts een klant heeft lopen.',
      'Flexibeler werken met prompts: je kunt nu losse vragen toevoegen zonder verplichte zoekterm en ook boven het standaardpakket doorwerken.'
    ],
    opgelost: [
      'Genoemde bronnen en websites in AI-antwoorden zijn nu direct klikbaar en concurrenten worden nauwkeuriger herkend.'
    ]
  }
];

const SectionBlock = ({ label, items }) => {
  if (!items || items.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{
        fontSize: '12px',
        fontWeight: 600,
        color: '#18181b',
        letterSpacing: '0.1px'
      }}>
        {label}
      </div>
      <ul style={{
        margin: 0,
        paddingLeft: '18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '5px',
        color: '#475569',
        fontSize: '13.5px',
        lineHeight: 1.6
      }}>
        {items.map((text, idx) => (
          <li key={idx}>{text}</li>
        ))}
      </ul>
    </div>
  );
};

export default function WhatsNew({ currentUser }) {
  const isStaff = currentUser?.role === 'medewerker' || currentUser?.role === 'admin';

  if (!isStaff) {
    return (
      <div style={{ padding: '64px 24px', textAlign: 'center', color: '#64748b' }}>
        Deze pagina is uitsluitend beschikbaar voor medewerkers.
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ padding: '40px 48px', backgroundColor: '#ffffff', minHeight: '100%' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '36px' }}>

        {/* Simple Minimal Header */}
        <div style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '20px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
            What&apos;s New
          </h2>
          <p style={{ fontSize: '13.5px', color: '#64748b', margin: '6px 0 0 0' }}>
            Overzicht van nieuwe functies, verbeteringen en opgeloste punten in GEO Wizard.
          </p>
        </div>

        {/* Clean Release List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '36px' }}>
          {RELEASES.map((rel, rIdx) => (
            <div
              key={rel.version}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                paddingBottom: rIdx < RELEASES.length - 1 ? '32px' : 0,
                borderBottom: rIdx < RELEASES.length - 1 ? '1px solid #f1f5f9' : 'none'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                <span style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                  {rel.version}
                </span>
                <span style={{ fontSize: '12.5px', color: '#94a3b8' }}>
                  {rel.date}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <SectionBlock label="Nieuw" items={rel.nieuw} />
                <SectionBlock label="Verbeterd" items={rel.verbeterd} />
                <SectionBlock label="Opgelost" items={rel.opgelost} />
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
