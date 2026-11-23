import React, { useState, useEffect } from 'react';
import {
  ChevronRight, ChevronDown, ChevronUp, Plus, Search, Trash2, Archive, RotateCcw,
  Sparkles, Play, Edit2, X, AlertTriangle, Loader2,
  ArrowLeft, Download, Share2, RotateCw, RefreshCw
} from 'lucide-react';

const FaviconImage = ({ domain, fallbackLabel, fallbackBg, fallbackColor, size = 20, style = {} }) => {
  const [error, setError] = useState(false);
  const cleanDomain = (domain || '')
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .split('?')[0]
    .trim();

  useEffect(() => {
    setError(false);
  }, [cleanDomain]);

  if (error || !cleanDomain) {
    return (
      <span style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: size > 22 ? '6px' : '4px',
        backgroundColor: fallbackBg || '#64748b',
        color: fallbackColor || 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size > 22 ? '11px' : '9px',
        fontWeight: 800,
        ...style
      }}>
        {fallbackLabel ? fallbackLabel[0]?.toUpperCase() : '?'}
      </span>
    );
  }

  const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(cleanDomain)}&sz=${size * 2}`;

  return (
    <img
      src={faviconUrl}
      alt={fallbackLabel || cleanDomain}
      referrerPolicy="no-referrer"
      onError={() => setError(true)}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: size > 22 ? '6px' : '4px',
        objectFit: 'contain',
        ...style
      }}
    />
  );
};

const normalizeExternalUrl = (rawUrl) => {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  let u = rawUrl.trim().replace(/^<|>$/g, '');
  // Strip optional markdown title at the end: https://example.com "Title"
  const spaceQuoteIdx = u.search(/\s+["']/);
  if (spaceQuoteIdx > 0) {
    u = u.slice(0, spaceQuoteIdx).trim();
  }
  if (u.startsWith('/url?q=') || u.includes('google.com/url?q=') || u.includes('google.nl/url?q=')) {
    try {
      const qPart = u.split('url?q=')[1]?.split('&')[0];
      if (qPart) return decodeURIComponent(qPart);
    } catch (e) {}
  }
  if (u.startsWith('//')) return `https:${u}`;
  if (u.startsWith('/search?') || u.startsWith('/maps') || u.startsWith('/th?')) return `https://www.google.nl${u}`;
  if (u.startsWith('www.')) return `https://${u}`;
  return u;
};

const extractDomainFromUrl = (rawUrl) => {
  try {
    const norm = normalizeExternalUrl(rawUrl);
    if (!norm) return '';
    const parsed = new URL(norm);
    return parsed.hostname.replace(/^www\./i, '').toLowerCase();
  } catch (e) {
    return String(rawUrl || '')
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      .split('?')[0]
      .trim();
  }
};

const isSpacerOrInvalidImage = (url) => {
  if (!url) return true;
  const u = url.trim();
  if (u.includes('R0lGODlhAQAB')) return true; // 1x1 transparent tracking gif
  if (u.startsWith('data:image/svg') || u === 'about:blank' || u === '#') return true;
  return !(u.startsWith('http://') || u.startsWith('https://') || u.startsWith('data:image/'));
};

const RichImageItem = ({ src, alt, href }) => {
  const [hidden, setHidden] = useState(false);
  const cleanSrc = normalizeExternalUrl(src);
  if (hidden || isSpacerOrInvalidImage(cleanSrc)) return null;

  const imgEl = (
    <img
      src={cleanSrc}
      alt={alt && alt !== 'image' ? alt : 'AI Resultaat afbeelding'}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setHidden(true)}
      onLoad={(e) => {
        if (e.currentTarget.naturalWidth <= 2 && e.currentTarget.naturalHeight <= 2) {
          setHidden(true);
        }
      }}
      style={{
        maxWidth: '220px',
        maxHeight: '140px',
        width: 'auto',
        height: 'auto',
        borderRadius: '8px',
        border: '1px solid #e2e8f0',
        objectFit: 'cover',
        backgroundColor: '#ffffff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        display: 'block'
      }}
    />
  );

  const cleanHref = href ? normalizeExternalUrl(href) : '';
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: '4px', margin: '6px 8px 6px 0', verticalAlign: 'middle' }}>
      {cleanHref && cleanHref.startsWith('http') ? (
        <a href={cleanHref} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'inline-block' }}>
          {imgEl}
        </a>
      ) : imgEl}
      {alt && alt !== 'image' && alt !== 'Afbeelding' && alt.length <= 60 && (
        <span style={{ fontSize: '10px', color: '#64748b', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {alt}
        </span>
      )}
    </span>
  );
};

const renderInlineRichTokens = (text, targetCompany, citationsList = [], keyPrefix = 'tok') => {
  if (!text) return null;
  let cleanedText = String(text);

  // Combined tokenizer for:
  // 1. Linked Markdown Image: [![alt](imgUrl)](linkUrl)
  // 2. Markdown Image: ![alt](imgUrl)
  // 3. Markdown Link: [label](url)
  // 4. Citation reference: [1], [2]
  // 5. Bold text: **bold**
  // 6. Bare URL: https://... or http://...
  const tokenRegex = /(\[!\[([^\]]*)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)|!\[([^\]]*)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)|\[([^\]]+)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)|\[(\d{1,2})\]|\*\*([^*]+)\*\*|(?:https?:\/\/|www\.)[^\s<)\]]+)/gi;

  const nodes = [];
  let lastIndex = 0;
  let match;
  let partIdx = 0;

  const pushPlainWithBrandHighlight = (plainStr, pKey) => {
    if (!plainStr) return;
    const cleanTarget = (targetCompany || '').replace(/\.(nl|com|eu|de|be|org|net|io)$/i, '').trim();
    if (!cleanTarget || cleanTarget.length < 2) {
      nodes.push(<React.Fragment key={pKey}>{plainStr}</React.Fragment>);
      return;
    }
    const escaped = cleanTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const brandRegex = new RegExp(`(${escaped}(?:\\.[a-z]{2,4})?)`, 'gi');
    const splits = plainStr.split(brandRegex);
    splits.forEach((s, sIdx) => {
      if (!s) return;
      if (s.match(brandRegex)) {
        nodes.push(
          <strong key={`${pKey}_b_${sIdx}`} style={{
            backgroundColor: 'rgba(68, 0, 153, 0.10)',
            color: '#440099',
            padding: '1px 5px',
            borderRadius: '4px',
            fontWeight: 800
          }}>
            {s}
          </strong>
        );
      } else {
        nodes.push(<React.Fragment key={`${pKey}_t_${sIdx}`}>{s}</React.Fragment>);
      }
    });
  };

  while ((match = tokenRegex.exec(cleanedText)) !== null) {
    if (match.index > lastIndex) {
      pushPlainWithBrandHighlight(cleanedText.slice(lastIndex, match.index), `${keyPrefix}_plain_${partIdx++}`);
    }

    const fullMatch = match[0];

    if (match[2] !== undefined && match[3] !== undefined && match[4] !== undefined) {
      // 1. Linked Markdown Image [![alt](img)](href)
      nodes.push(
        <RichImageItem
          key={`${keyPrefix}_limg_${partIdx++}`}
          alt={match[2]}
          src={match[3]}
          href={match[4]}
        />
      );
    } else if (match[5] !== undefined && match[6] !== undefined) {
      // 2. Standalone Markdown Image ![alt](img)
      nodes.push(
        <RichImageItem
          key={`${keyPrefix}_img_${partIdx++}`}
          alt={match[5]}
          src={match[6]}
        />
      );
    } else if (match[7] !== undefined && match[8] !== undefined) {
      // 3. Markdown Link [label](url)
      const rawLabel = match[7].replace(/^\*\*|\*\*$/g, '').trim();
      const resolvedUrl = normalizeExternalUrl(match[8]);
      const dom = extractDomainFromUrl(resolvedUrl);
      if (resolvedUrl && (resolvedUrl.startsWith('http://') || resolvedUrl.startsWith('https://'))) {
        nodes.push(
          <a
            key={`${keyPrefix}_lnk_${partIdx++}`}
            href={resolvedUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
              color: '#2563eb',
              fontWeight: 600,
              textDecoration: 'none',
              backgroundColor: '#eff6ff',
              border: '1px solid #bfdbfe',
              padding: '1px 7px',
              borderRadius: '6px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px',
              margin: '0 2px',
              verticalAlign: 'baseline'
            }}
          >
            {dom && <FaviconImage domain={dom} fallbackLabel={dom} size={13} />}
            <span>{rawLabel || dom || resolvedUrl}</span>
            <span style={{ fontSize: '10px', opacity: 0.75 }}>↗</span>
          </a>
        );
      } else {
        pushPlainWithBrandHighlight(rawLabel, `${keyPrefix}_lbl_${partIdx++}`);
      }
    } else if (match[9] !== undefined) {
      // 4. Citation reference number [1]
      const refNum = parseInt(match[9], 10);
      const citObj = Array.isArray(citationsList) && citationsList[refNum - 1] ? citationsList[refNum - 1] : null;
      const citUrl = citObj ? normalizeExternalUrl(typeof citObj === 'string' ? citObj : citObj.url) : '';
      if (citUrl && citUrl.startsWith('http')) {
        const citDom = extractDomainFromUrl(citUrl);
        nodes.push(
          <a
            key={`${keyPrefix}_ref_${partIdx++}`}
            href={citUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            title={citObj?.title || citUrl}
            style={{
              fontSize: '10px',
              fontWeight: 800,
              color: '#440099',
              backgroundColor: '#f3e8ff',
              border: '1px solid #d8b4fe',
              borderRadius: '10px',
              padding: '1px 6px',
              margin: '0 2px',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              verticalAlign: 'super'
            }}
          >
            {citDom && <FaviconImage domain={citDom} fallbackLabel={String(refNum)} size={11} />}
            [{refNum}]
          </a>
        );
      } else {
        nodes.push(
          <span key={`${keyPrefix}_refplain_${partIdx++}`} style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, verticalAlign: 'super' }}>
            [{refNum}]
          </span>
        );
      }
    } else if (match[10] !== undefined) {
      // 5. Bold **text**
      nodes.push(
        <strong key={`${keyPrefix}_bold_${partIdx++}`} style={{ fontWeight: 700, color: '#0f172a' }}>
          {renderInlineRichTokens(match[10], targetCompany, citationsList, `${keyPrefix}_bsub_${partIdx}`)}
        </strong>
      );
    } else {
      // 6. Bare URL
      let rawBare = fullMatch;
      let trailingPunct = '';
      while (/[.,;:!?)]$/.test(rawBare)) {
        trailingPunct = rawBare.slice(-1) + trailingPunct;
        rawBare = rawBare.slice(0, -1);
      }
      const normBare = normalizeExternalUrl(rawBare);
      const isImgUrl = /\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(normBare) || normBare.includes('encrypted-tbn0.gstatic.com/images');
      if (isImgUrl) {
        nodes.push(<RichImageItem key={`${keyPrefix}_bimg_${partIdx++}`} src={normBare} alt="" />);
      } else {
        const dom = extractDomainFromUrl(normBare);
        nodes.push(
          <a
            key={`${keyPrefix}_blnk_${partIdx++}`}
            href={normBare}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
              color: '#2563eb',
              fontWeight: 600,
              textDecoration: 'underline',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              margin: '0 2px'
            }}
          >
            {dom && <FaviconImage domain={dom} fallbackLabel={dom} size={13} />}
            <span>{dom || normBare}</span>
            <span style={{ fontSize: '10px' }}>↗</span>
          </a>
        );
      }
      if (trailingPunct) {
        nodes.push(<React.Fragment key={`${keyPrefix}_punct_${partIdx++}`}>{trailingPunct}</React.Fragment>);
      }
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < cleanedText.length) {
    pushPlainWithBrandHighlight(cleanedText.slice(lastIndex), `${keyPrefix}_end_${partIdx++}`);
  }

  return nodes;
};

const RichAiMarkdownView = ({ content, targetCompany, citations = [] }) => {
  if (!content) return null;

  const lines = String(content).replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let idx = 0;

  while (idx < lines.length) {
    const line = lines[idx];
    const trimmed = line.trim();

    if (!trimmed) {
      idx++;
      continue;
    }

    // 1. Markdown Table Block
    if (trimmed.startsWith('|') && trimmed.split('|').length >= 3) {
      const tableLines = [];
      while (idx < lines.length && lines[idx].trim().startsWith('|')) {
        tableLines.push(lines[idx].trim());
        idx++;
      }
      const parsedRows = tableLines
        .map(tl => tl.replace(/^\||\|$/g, '').split('|').map(c => c.trim()))
        .filter(cells => !cells.every(c => /^[\s:-]*$/.test(c)));

      if (parsedRows.length > 0) {
        const headerRow = parsedRows[0];
        const bodyRows = parsedRows.slice(1);
        blocks.push(
          <div key={`tbl_${idx}`} style={{ overflowX: 'auto', margin: '10px 0', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                  {headerRow.map((hCell, hIdx) => (
                    <th key={hIdx} style={{ padding: '8px 12px', fontWeight: 700, color: '#1e293b' }}>
                      {renderInlineRichTokens(hCell, targetCompany, citations, `th_${idx}_${hIdx}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              {bodyRows.length > 0 && (
                <tbody>
                  {bodyRows.map((bRow, rIdx) => (
                    <tr key={rIdx} style={{ borderBottom: rIdx < bodyRows.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                      {bRow.map((bCell, cIdx) => (
                        <td key={cIdx} style={{ padding: '8px 12px', color: '#334155', verticalAlign: 'top' }}>
                          {renderInlineRichTokens(bCell, targetCompany, citations, `td_${idx}_${rIdx}_${cIdx}`)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              )}
            </table>
          </div>
        );
        continue;
      }
    }

    // 2. Markdown Headings (#, ##, ###, ####)
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const fontSize = level === 1 ? '16px' : level === 2 ? '15px' : '14px';
      blocks.push(
        <div key={`h_${idx}`} style={{ fontSize, fontWeight: 800, color: '#0f172a', marginTop: '10px', marginBottom: '4px', fontFamily: "'Outfit', sans-serif" }}>
          {renderInlineRichTokens(headingMatch[2], targetCompany, citations, `h_${idx}`)}
        </div>
      );
      idx++;
      continue;
    }

    // 3. Unordered / Ordered List Items
    const listMatch = trimmed.match(/^(\d{1,2}[.)]|[-*•])\s+(.+)$/);
    if (listMatch) {
      const listItems = [];
      while (idx < lines.length) {
        const lTrim = lines[idx].trim();
        const m = lTrim.match(/^(\d{1,2}[.)]|[-*•])\s+(.+)$/);
        if (!m) break;
        listItems.push({ marker: m[1], body: m[2], lineIdx: idx });
        idx++;
      }
      blocks.push(
        <div key={`list_${idx}`} style={{ display: 'flex', flexDirection: 'column', gap: '6px', margin: '6px 0' }}>
          {listItems.map((li, lIdx) => (
            <div key={lIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', paddingLeft: '4px' }}>
              <span style={{ fontWeight: 700, color: '#440099', minWidth: '18px', flexShrink: 0 }}>
                {li.marker.length > 1 ? li.marker : '•'}
              </span>
              <div style={{ flex: 1, lineHeight: '1.6' }}>
                {renderInlineRichTokens(li.body, targetCompany, citations, `li_${li.lineIdx}`)}
              </div>
            </div>
          ))}
        </div>
      );
      continue;
    }

    // 4. Standard Paragraph Line
    blocks.push(
      <div key={`p_${idx}`} style={{ marginBottom: '8px', lineHeight: '1.65' }}>
        {renderInlineRichTokens(trimmed, targetCompany, citations, `p_${idx}`)}
      </div>
    );
    idx++;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      {blocks}
    </div>
  );
};

const EngineLogos = {
  chatgpt: (
    <img
      src="https://www.google.com/s2/favicons?domain=openai.com&sz=48"
      alt="ChatGPT"
      style={{ width: 22, height: 22, borderRadius: '4px', objectFit: 'contain' }}
    />
  ),
  aioverviews: (
    <img
      src="https://www.google.com/s2/favicons?domain=google.com&sz=48"
      alt="AI Overviews"
      style={{ width: 22, height: 22, borderRadius: '4px', objectFit: 'contain' }}
    />
  ),
  aimode: (
    <img
      src="https://www.google.com/s2/favicons?domain=google.com&sz=48"
      alt="AI Mode"
      style={{ width: 22, height: 22, borderRadius: '4px', objectFit: 'contain' }}
    />
  ),
  gemini: (
    <img
      src="https://www.google.com/s2/favicons?domain=gemini.google.com&sz=48"
      alt="Gemini"
      style={{ width: 22, height: 22, borderRadius: '4px', objectFit: 'contain' }}
    />
  ),
  perplexity: (
    <img
      src="https://www.google.com/s2/favicons?domain=perplexity.ai&sz=48"
      alt="Perplexity"
      style={{ width: 22, height: 22, borderRadius: '4px', objectFit: 'contain' }}
    />
  ),
  claude: (
    <img
      src="https://www.google.com/s2/favicons?domain=claude.ai&sz=48"
      alt="Claude"
      style={{ width: 22, height: 22, borderRadius: '4px', objectFit: 'contain' }}
    />
  ),
  copilot: (
    <img
      src="https://www.google.com/s2/favicons?domain=copilot.microsoft.com&sz=48"
      alt="Copilot"
      style={{ width: 22, height: 22, borderRadius: '4px', objectFit: 'contain' }}
    />
  ),
  meta: (
    <img
      src="https://www.google.com/s2/favicons?domain=meta.ai&sz=48"
      alt="Meta AI"
      style={{ width: 22, height: 22, borderRadius: '4px', objectFit: 'contain' }}
    />
  )
};

export default function Keywords({ currentUser, activeWorkspace, activeClient, enabledEngines, onUpdateAddonPrompts }) {
  const isStaffOrAdmin = currentUser?.role === 'medewerker' || currentUser?.role === 'admin';
  const isReadOnly = !isStaffOrAdmin;
  const [keywords, setKeywords] = useState([]);
  const [projectInfo, setProjectInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedKeyword, setSelectedKeyword] = useState(null);
  const [detailTab, setDetailTab] = useState('rankings');
  const [editPromptModes, setEditPromptModes] = useState({});
  const [customPromptInputs, setCustomPromptInputs] = useState({});
  const [generatingPromptsForKw, setGeneratingPromptsForKw] = useState({});
  const [recommending, setRecommending] = useState(false);
  const [keywordInput, setKeywordInput] = useState('');
  const [generateAiPromptsOnAdd, setGenerateAiPromptsOnAdd] = useState(true);
  const [customPromptsOnAdd, setCustomPromptsOnAdd] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isArchivedOpen, setIsArchivedOpen] = useState(false);
  const [totalUsedPrompts, setTotalUsedPrompts] = useState(0);
  const [scanningPrompts, setScanningPrompts] = useState({});
  const [expandedPrompts, setExpandedPrompts] = useState({});
  const [expandedEngines, setExpandedEngines] = useState({});
  const [selectedKeywordIds, setSelectedKeywordIds] = useState([]);
  const [limitAlert, setLimitAlert] = useState(null);
  const [crawlingStatus, setCrawlingStatus] = useState(null);
  const [shareCopied, setShareCopied] = useState(false);

  const formatKeywordFromApi = (k) => ({
    id: k.id,
    text: k.keyword_text || k.keyword || '',
    rank: k.rank_google || k.rank || '-',
    sov: k.share_of_voice ?? (k.competitors && k.competitors[0] ? k.competitors[0].sov : 0),
    position: k.average_position || (k.competitors && k.competitors[0] ? k.competitors[0].position : '-'),
    volume: k.search_volume || k.monthly_searches || '-',
    is_crawling: !!k.is_crawling,
    is_archived: Boolean(k.is_archived),
    brands: k.brands_mentioned ? String(k.brands_mentioned).split(',').map(b => b.trim()).filter(Boolean) : [],
    competitors: k.competitors || [],
    history: Array.isArray(k.history) ? k.history : [],
    baseline: k.baseline || (Array.isArray(k.history) && k.history.length > 0 ? k.history[0] : null),
    last_updated: k.last_updated || null,
    prompts: (k.prompts || []).map(p => ({
      id: p.id,
      text: p.prompt_text || p.text || '',
      status: p.status || (p.results ? (p.brand_mentioned ? 'Cited' : 'Not Cited') : 'pending'),
      mentioned: Boolean(p.mentioned ?? p.brand_mentioned ?? (p.status === 'Cited')),
      position: p.position || '-',
      totalMentions: p.totalMentions ?? 0,
      totalModels: p.totalModels ?? 0,
      failedModelsCount: p.failedModelsCount ?? 0,
      overallScore: p.overallScore ?? 0,
      engines: Array.isArray(p.engines) ? p.engines : [],
      brandsCount: p.brandsCount || 0,
      sourcesCount: p.sourcesCount || 0,
      modelMentions: p.modelMentions || null,
      responseSummary: p.responseSummary || '',
      citations: p.citations || null,
      history: Array.isArray(p.history) ? p.history : [],
      baseline: p.baseline || (Array.isArray(p.history) && p.history.length > 0 ? p.history[0] : null),
      lastUpdated: p.lastUpdated || null
    }))
  });

  const handleSelectAllKeywords = (e) => {
    if (e.target.checked) {
      setSelectedKeywordIds(filteredKeywords.map(k => k.id));
    } else {
      setSelectedKeywordIds([]);
    }
  };

  const handleSelectKeyword = (id, checked) => {
    if (checked) {
      setSelectedKeywordIds(prev => [...prev, id]);
    } else {
      setSelectedKeywordIds(prev => prev.filter(x => x !== id));
    }
  };

  const handleBulkArchiveKeywords = async () => {
    if (!isStaffOrAdmin || selectedKeywordIds.length === 0) return;
    if (!window.confirm(`Weet u zeker dat u de ${selectedKeywordIds.length} geselecteerde zoekwoorden wilt archiveren?`)) return;

    try {
      const response = await fetch('/api/keywords/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: selectedKeywordIds,
          force: false,
          userId: currentUser?.id,
          role: currentUser?.role
        })
      });
      const data = await response.json();
      if (data.success) {
        setKeywords(prev => {
          const next = prev.map(k => selectedKeywordIds.includes(k.id) ? { ...k, is_archived: true } : k);
          const activeCount = next.filter(k => !k.is_archived).reduce((acc, k) => acc + (k.prompts || []).length, 0);
          setTotalUsedPrompts(typeof data.totalUsedPrompts === 'number' ? data.totalUsedPrompts : activeCount);
          return next;
        });
        setSelectedKeywordIds([]);
      } else {
        alert(data.error || 'Fout bij archiveren van keywords.');
      }
    } catch (err) {
      console.error(err);
      alert('Kan geen verbinding maken met de server.');
    }
  };

  const handleBulkDeleteKeywords = async () => {
    if (!isStaffOrAdmin || selectedKeywordIds.length === 0) return;
    if (!window.confirm(`Weet u zeker dat u de ${selectedKeywordIds.length} geselecteerde zoekwoorden en alle bijbehorende prompts definitief wilt verwijderen? Hiermee wordt de promptlimiet direct vrijgegeven.`)) return;

    try {
      const response = await fetch('/api/keywords/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: selectedKeywordIds,
          force: true,
          userId: currentUser?.id,
          role: currentUser?.role
        })
      });
      const data = await response.json();
      if (data.success) {
        setKeywords(prev => {
          const next = prev.filter(k => !selectedKeywordIds.includes(k.id));
          const activeCount = next.filter(k => !k.is_archived).reduce((acc, k) => acc + (k.prompts || []).length, 0);
          setTotalUsedPrompts(typeof data.totalUsedPrompts === 'number' ? data.totalUsedPrompts : activeCount);
          return next;
        });
        setSelectedKeywordIds([]);
      } else {
        alert(data.error || 'Fout bij verwijderen van keywords.');
      }
    } catch (err) {
      console.error(err);
      alert('Kan geen verbinding maken met de server.');
    }
  };

  const [rescrapingKeywords, setRescrapingKeywords] = useState({});

  const handleRescrapeKeyword = async (kwId, e) => {
    if (e) e.stopPropagation();
    setRescrapingKeywords(prev => ({ ...prev, [kwId]: true }));
    try {
      const response = await fetch(`/api/keywords/${kwId}/rescrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
        if ( data.success) {
        setKeywords(prev => prev.map(k => {
          if (k.id === kwId) {
            return {
              ...k,
              is_crawling: true,
              rank: data.keyword?.rank ?? k.rank,
              sov: data.keyword?.share_of_voice ?? k.sov,
              position: data.keyword?.average_position ?? k.position,
              competitors: data.keyword?.competitors ?? k.competitors,
              history: data.keyword?.history ?? k.history,
              baseline: data.keyword?.baseline ?? k.baseline,
              last_updated: data.keyword?.last_updated ?? k.last_updated,
              prompts: (k.prompts || []).map(p => ({ ...p, status: 'pending' }))
            };
          }
          return k;
        }));

        if (selectedKeyword && selectedKeyword.id === kwId) {
          setSelectedKeyword(prev => ({
            ...prev,
            is_crawling: true,
            rank: data.keyword?.rank ?? prev.rank,
            sov: data.keyword?.share_of_voice ?? prev.sov,
            position: data.keyword?.average_position ?? prev.position,
            competitors: data.keyword?.competitors ?? prev.competitors,
            history: data.keyword?.history ?? prev.history,
            baseline: data.keyword?.baseline ?? prev.baseline,
            last_updated: data.keyword?.last_updated ?? prev.last_updated,
            prompts: (prev.prompts || []).map(p => ({ ...p, status: 'pending' }))
          }));
        }

        setCrawlingStatus({
          active: true,
          message: data.message || 'Keyword rankings en AI-prompts worden opnieuw gescand...'
        });
      } else {
        alert(data.error || 'Fout bij opnieuw scrapen van keyword.');
      }
    } catch (err) {
      console.error('Rescrape error:', err);
      alert('Kan geen verbinding maken met de server.');
    } finally {
      setRescrapingKeywords(prev => ({ ...prev, [kwId]: false }));
    }
  };

  const handleBulkRescrapeKeywords = async () => {
    if (selectedKeywordIds.length === 0) return;
    try {
      const response = await fetch('/api/keywords/bulk-rescrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedKeywordIds })
      });
      const data = await response.json();
      if (data.success) {
        setKeywords(prev => prev.map(k => {
          if (selectedKeywordIds.includes(k.id)) {
            return {
              ...k,
              is_crawling: true,
              prompts: (k.prompts || []).map(p => ({ ...p, status: 'pending' }))
            };
          }
          return k;
        }));
        setSelectedKeywordIds([]);
        setCrawlingStatus({
          active: true,
          message: data.message || 'Geselecteerde keywords worden opnieuw gescand...'
        });
      } else {
        alert(data.error || 'Fout bij opnieuw scrapen van geselecteerde keywords.');
      }
    } catch (err) {
      console.error('Bulk rescrape error:', err);
      alert('Kan geen verbinding maken met de server.');
    }
  };

  const toggleExpandedPrompt = (pId) => {
    setExpandedPrompts(prev => ({ ...prev, [pId]: !prev[pId] }));
  };

  const toggleExpandedEngine = (promptId, engineId) => {
    const key = `${promptId}_${engineId}`;
    setExpandedEngines(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleRunPromptScan = async (promptId, promptText) => {
    setScanningPrompts(prev => ({ ...prev, [promptId]: true }));
    try {
      const response = await fetch('/api/scraper/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptText, company: activeWorkspace || 'Saleswizard.nl', promptId: promptId })
      });
      const data = await response.json();
      if (data.success) {
        const liveTotalModels = data.totalLiveModels ?? data.totalModels ?? 0;
        const updatedStatus = liveTotalModels === 0 ? 'failed' : (data.totalMentions > 0 ? 'Cited' : 'Not Cited');
        const newSummary = liveTotalModels > 0
          ? `${data.company} wordt door ${data.totalMentions} van de ${liveTotalModels} live AI-modellen aanbevolen.`
          : 'Geen live AI-modellen beschikbaar tijdens deze scan.';

        const updatePromptObj = (p) => {
          if (p.id === promptId) {
            const updatedHistory = Array.isArray(data.history) ? data.history : (p.history || []);
            return {
              ...p,
              status: updatedStatus,
              mentioned: data.totalMentions > 0,
              position: data.totalMentions > 0 ? (data.position || '-') : '-',
              totalMentions: data.totalMentions ?? 0,
              totalModels: liveTotalModels,
              failedModelsCount: data.failedModelsCount ?? 0,
              overallScore: data.overallScore ?? 0,
              brandsCount: data.totalBrandsCount ?? 0,
              sourcesCount: data.totalSourcesCount ?? (data.citations ? data.citations.length : 0),
              modelMentions: data.modelMentions || {},
              engines: Object.keys(data.modelMentions || {}).filter(m => {
                const entry = data.modelMentions[m];
                return entry && entry.mentioned && !entry.isSimulated && !entry.fallbackUsed && !entry.failed && entry.available !== false;
              }),
              responseSummary: newSummary,
              citations: data.citations,
              history: updatedHistory,
              baseline: updatedHistory.length > 0 ? updatedHistory[0] : p.baseline
            };
          }
          return p;
        };

        setKeywords(prev => prev.map(k => {
          if (k.id === selectedKeyword?.id) {
            return { ...k, prompts: (k.prompts || []).map(updatePromptObj) };
          }
          return k;
        }));

        if (selectedKeyword) {
          setSelectedKeyword(prev => ({
            ...prev,
            prompts: (prev.prompts || []).map(updatePromptObj)
          }));
        }
      }
    } catch (err) {
      console.error('Scan error:', err);
    } finally {
      setScanningPrompts(prev => ({ ...prev, [promptId]: false }));
    }
  };

  const handleRecommendKeywords = async () => {
    setRecommending(true);
    const workspace = activeWorkspace || 'Saleswizard.nl';
    try {
      const response = await fetch('/api/keywords/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company: workspace })
      });
      const data = await response.json();
      if (data.success && data.formatted) {
        if (keywordInput.trim()) {
          setKeywordInput(prev => `${prev}, ${data.formatted}`);
        } else {
          setKeywordInput(data.formatted);
        }
      }
    } catch (err) {
      console.error('Failed to recommend keywords:', err);
    } finally {
      setRecommending(false);
    }
  };

  // Smart background polling when prompts are being crawled / analyzed
  useEffect(() => {
    let interval = null;
    const hasPending = (keywords || []).some(k => k.is_crawling || (k.prompts || []).some(p => p.status === 'pending' || p.status === 'processing' || p.status === 'crawling' || scanningPrompts[p.id]));

    if (hasPending) {
      let pendingCount = 0;
      let totalCount = 0;
      keywords.forEach(k => {
        (k.prompts || []).forEach(p => {
          totalCount++;
          if (p.status === 'pending' || p.status === 'processing' || p.status === 'crawling' || scanningPrompts[p.id]) {
            pendingCount++;
          }
        });
      });

      setCrawlingStatus({
        active: true,
        pending: pendingCount,
        completed: Math.max(0, totalCount - pendingCount),
        total: totalCount,
        message: `${pendingCount || 'Zoek'} prompt(s) worden gecrawld over ChatGPT, Gemini en Perplexity...`
      });

      let pollCount = 0;
      const maxPolls = 60; // Max 90s safety timeout

      interval = setInterval(() => {
        pollCount++;
        if (pollCount > maxPolls) {
          clearInterval(interval);
          setCrawlingStatus(null);
          return;
        }

        const workspace = activeWorkspace || 'Saleswizard.nl';
        fetch(`/api/keywords?company=${encodeURIComponent(workspace)}`)
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              if (data.project) {
                setProjectInfo(data.project);
              }
              const formatted = (data.keywords || []).map(formatKeywordFromApi);
              setKeywords(formatted);
              setSelectedKeyword(prev => prev ? (formatted.find(f => f.id === prev.id) || prev) : null);
              const activeCount = formatted.filter(f => !f.is_archived).reduce((acc, f) => acc + (f.prompts || []).length, 0);
              setTotalUsedPrompts(typeof data.totalUsedPrompts === 'number' ? data.totalUsedPrompts : activeCount);
            }
          })
          .catch(err => console.error('Polling error:', err));
      }, 1500);
    } else if (crawlingStatus?.active) {
      setCrawlingStatus({
        active: false,
        done: true,
        message: 'Alle AI zoekmachine scans zijn succesvol voltooid!'
      });
      setTimeout(() => setCrawlingStatus(null), 4000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [keywords, scanningPrompts, activeWorkspace]);


  // Fetch active keywords from DB
  useEffect(() => {
    setLoading(true);
    setSelectedKeyword(null);
    const workspace = activeWorkspace || 'Saleswizard.nl';
    fetch(`/api/keywords?company=${encodeURIComponent(workspace)}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          if (data.project) {
            setProjectInfo(data.project);
          }
          const formatted = (data.keywords || []).map(formatKeywordFromApi);
          setKeywords(formatted);

          const activeCount = formatted.filter(f => !f.is_archived).reduce((acc, f) => acc + (f.prompts || []).length, 0);
          setTotalUsedPrompts(typeof data.totalUsedPrompts === 'number' ? data.totalUsedPrompts : activeCount);
        }
      })
      .catch(err => console.error('Fetch keywords error:', err))
      .finally(() => {
        setLoading(false);
      });
  }, [activeWorkspace]);

  const getActivePlanName = () => {
    const rawSub = projectInfo?.subscription || activeClient?.subscription || currentUser?.subscription || 'AI Pro';
    const normalized = String(rawSub).toLowerCase();
    if (normalized.includes('starter') || normalized.includes('lite')) return 'AI Starter';
    if (normalized.includes('enterprise') || normalized.includes('top')) return 'AI Enterprise';
    return 'AI Pro';
  };

  const getPlanLimit = () => {
    const addon = currentUser?.addonPrompts || 0;
    if (projectInfo?.promptsLimit) {
      return Number(projectInfo.promptsLimit) + addon;
    }
    if (activeClient?.promptsLimit) {
      return Number(activeClient.promptsLimit) + addon;
    }
    const sub = String(projectInfo?.subscription || activeClient?.subscription || currentUser?.subscription || 'AI Pro').toLowerCase();
    let base = 30;
    if (sub.includes('starter') || sub.includes('lite')) base = 15;
    else if (sub.includes('enterprise') || sub.includes('top')) base = 60;
    else if (sub.includes('pro')) base = 30;
    return base + addon;
  };

  const activeLimit = getPlanLimit();
  const activePlanName = getActivePlanName();
  const isLimitReached = totalUsedPrompts >= activeLimit;

  const downloadCsvFile = (filename, rows) => {
    const escapeCell = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/\r?\n/g, ' ').trim();
      return `"${str.replace(/"/g, '""')}"`;
    };
    const csvContent = '\uFEFF' + rows.map(row => row.map(escapeCell).join(';')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportKeywordCsv = (kw) => {
    if (!kw) return;
    const workspace = activeWorkspace || 'Saleswizard.nl';
    const safeName = String(kw.text || 'keyword').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const dateStr = new Date().toISOString().slice(0, 10);
    const kwBaseline = kw.baseline || (Array.isArray(kw.history) && kw.history.length > 0 ? kw.history[0] : null);
    const kwHistory = Array.isArray(kw.history) ? kw.history : [];
    const brandRankings = getBrandRankings(kw);

    const rows = [
      ['GEO Rapportage - Keyword Export'],
      ['Project / Domein', workspace, 'Pakket', activePlanName, 'Exportdatum', dateStr],
      [],
      ['1. KEYWORD NULMETING VS. HUIDIGE METING'],
      [
        'Keyword',
        'Zoekvolume',
        'Nulmeting Datum',
        'Nulmeting Google Rank',
        'Nulmeting AI Positie',
        'Nulmeting Share of Voice (%)',
        'Huidige Datum',
        'Huidige Google Rank',
        'Huidige AI Positie',
        'Huidige Share of Voice (%)'
      ],
      [
        kw.text,
        kw.volume,
        kwBaseline?.displayDate || kwBaseline?.date || '-',
        kwBaseline?.rank || kw.rank || '-',
        kwBaseline?.position || kw.position || '-',
        `${kwBaseline?.sov ?? kw.sov ?? 0}%`,
        kw.last_updated || dateStr,
        kw.rank || '-',
        kw.position || '-',
        `${kw.sov ?? 0}%`
      ],
      [],
      ['2. HISTORISCHE MEETPUNTEN (KEYWORD POSITIE & SHARE OF VOICE)'],
      ['Datum', 'Type Meting', 'Google Rank', 'Gemiddelde AI Positie', 'Share of Voice (%)', 'Citaties'],
      ...(kwHistory.length > 0
        ? kwHistory.map((h, idx) => [
            h.displayDate || h.date || '-',
            h.isBaseline || idx === 0 ? 'Nulmeting' : (h.label || `Meting #${idx + 1}`),
            h.rank || kw.rank || '-',
            h.position || '-',
            `${h.sov ?? 0}%`,
            h.citations ?? 0
          ])
        : [[kw.last_updated || dateStr, 'Nulmeting', kw.rank || '-', kw.position || '-', `${kw.sov ?? 0}%`, 0]]),
      [],
      ['3. MERKRANGSCHIKKING & CONCURRENTIE'],
      ['Rank', 'Merk', 'Domein', 'Eigen Merk', 'Share of Voice (%)', 'Gemiddelde Positie', 'Aantal Citaties'],
      ...brandRankings.map(r => [
        r.rank,
        r.brand,
        r.domain,
        r.isSelf ? 'Ja' : 'Nee',
        `${r.sov}%`,
        r.position,
        r.citations
      ]),
      [],
      ['4. PROMPTS OVERZICHT (NULMETING VS. HUIDIG PER ZOEKVRAAG)'],
      [
        'Prompt',
        'Status',
        'Nulmeting Datum',
        'Nulmeting Vermeld',
        'Nulmeting Positie',
        'Nulmeting AI Modellen',
        'Huidig Vermeld',
        'Huidige Positie',
        'Huidige AI Modellen',
        'ChatGPT',
        'Google AI Overviews',
        'Gemini',
        'Perplexity',
        'Aantal Merken',
        'Aantal Bronnen'
      ],
      ...(kw.prompts || []).map(p => {
        const pb = p.baseline || (Array.isArray(p.history) && p.history.length > 0 ? p.history[0] : null);
        const m = p.modelMentions || {};
        const isMentioned = p.status === 'Cited' || p.mentioned;
        return [
          p.text,
          p.status,
          pb?.displayDate || pb?.date || '-',
          pb ? (pb.mentioned ? 'Ja' : 'Nee') : (isMentioned ? 'Ja' : 'Nee'),
          pb?.position || p.position || '-',
          pb ? `${pb.totalMentions ?? 0}/${pb.totalModels ?? 4}` : `${p.totalMentions ?? 0}/${p.totalModels ?? 4}`,
          isMentioned ? 'Ja' : 'Nee',
          p.position || '-',
          `${p.totalMentions ?? 0}/${p.totalModels ?? 4}`,
          m.chatgpt?.mentioned ? 'Vermeld' : 'Niet vermeld',
          m.aioverviews?.mentioned ? 'Vermeld' : 'Niet vermeld',
          m.gemini?.mentioned ? 'Vermeld' : 'Niet vermeld',
          m.perplexity?.mentioned ? 'Vermeld' : 'Niet vermeld',
          p.brandsCount || 0,
          p.sourcesCount || 0
        ];
      }),
      [],
      ['5. HISTORISCHE MEETPUNTEN PER PROMPT'],
      ['Prompt', 'Datum', 'Type Meting', 'Merk Vermeld', 'Gemiddelde Positie', 'AI Modellen Vermeld', 'Score (%)'],
      ...(kw.prompts || []).flatMap(p => {
        const ph = Array.isArray(p.history) && p.history.length > 0 ? p.history : [];
        if (ph.length === 0) {
          const isMentioned = p.status === 'Cited' || p.mentioned;
          return [[
            p.text,
            p.lastUpdated || kw.last_updated || dateStr,
            'Nulmeting',
            isMentioned ? 'Ja' : 'Nee',
            p.position || '-',
            `${p.totalMentions ?? 0}/${p.totalModels ?? 4}`,
            `${p.overallScore ?? 0}%`
          ]];
        }
        return ph.map((h, idx) => [
          p.text,
          h.displayDate || h.date || '-',
          h.isBaseline || idx === 0 ? 'Nulmeting' : (h.label || `Meting #${idx + 1}`),
          h.mentioned ? 'Ja' : 'Nee',
          h.position || '-',
          `${h.totalMentions ?? 0}/${h.totalModels ?? 4}`,
          `${h.overallScore ?? 0}%`
        ]);
      })
    ];

    downloadCsvFile(`geo-rapport-${workspace.replace(/[^a-z0-9]+/gi, '-')}-${safeName}-${dateStr}.csv`, rows);
  };

  const handleExportProjectCsv = () => {
    const workspace = activeWorkspace || 'Saleswizard.nl';
    const dateStr = new Date().toISOString().slice(0, 10);

    const rows = [
      ['GEO Totaalrapportage - Alle Keywords & Prompts'],
      ['Project / Domein', workspace, 'Pakket', activePlanName, 'Prompts Verbruik', `${totalUsedPrompts}/${activeLimit}`, 'Exportdatum', dateStr],
      [],
      ['1. OVERZICHT KEYWORDS (NULMETING VS. HUIDIGE RESULTATEN)'],
      [
        'Keyword',
        'Zoekvolume',
        'Nulmeting Datum',
        'Nulmeting Google Rank',
        'Nulmeting AI Positie',
        'Nulmeting Share of Voice (%)',
        'Huidige Datum',
        'Huidige Google Rank',
        'Huidige AI Positie',
        'Huidige Share of Voice (%)',
        'Aantal Prompts'
      ],
      ...keywords.map(kw => {
        const b = kw.baseline || (Array.isArray(kw.history) && kw.history.length > 0 ? kw.history[0] : null);
        return [
          kw.text,
          kw.volume,
          b?.displayDate || b?.date || '-',
          b?.rank || kw.rank || '-',
          b?.position || kw.position || '-',
          `${b?.sov ?? kw.sov ?? 0}%`,
          kw.last_updated || dateStr,
          kw.rank || '-',
          kw.position || '-',
          `${kw.sov ?? 0}%`,
          (kw.prompts || []).length
        ];
      }),
      [],
      ['2. ALLE PROMPTS & AI ENGINE RESULTATEN (NULMETING VS. HUIDIG)'],
      [
        'Keyword',
        'Prompt',
        'Status',
        'Nulmeting Datum',
        'Nulmeting Vermeld',
        'Nulmeting Positie',
        'Nulmeting AI Modellen',
        'Huidig Vermeld',
        'Huidige Positie',
        'Huidige AI Modellen',
        'ChatGPT',
        'Google AI Overviews',
        'Gemini',
        'Perplexity'
      ],
      ...keywords.flatMap(kw =>
        (kw.prompts || []).map(p => {
          const pb = p.baseline || (Array.isArray(p.history) && p.history.length > 0 ? p.history[0] : null);
          const m = p.modelMentions || {};
          const isMentioned = p.status === 'Cited' || p.mentioned;
          return [
            kw.text,
            p.text,
            p.status,
            pb?.displayDate || pb?.date || '-',
            pb ? (pb.mentioned ? 'Ja' : 'Nee') : (isMentioned ? 'Ja' : 'Nee'),
            pb?.position || p.position || '-',
            pb ? `${pb.totalMentions ?? 0}/${pb.totalModels ?? 4}` : `${p.totalMentions ?? 0}/${p.totalModels ?? 4}`,
            isMentioned ? 'Ja' : 'Nee',
            p.position || '-',
            `${p.totalMentions ?? 0}/${p.totalModels ?? 4}`,
            m.chatgpt?.mentioned ? 'Vermeld' : 'Niet vermeld',
            m.aioverviews?.mentioned ? 'Vermeld' : 'Niet vermeld',
            m.gemini?.mentioned ? 'Vermeld' : 'Niet vermeld',
            m.perplexity?.mentioned ? 'Vermeld' : 'Niet vermeld'
          ];
        })
      ),
      [],
      ['3. HISTORISCHE REEKS PER KEYWORD'],
      ['Keyword', 'Datum', 'Type Meting', 'Google Rank', 'Gemiddelde AI Positie', 'Share of Voice (%)'],
      ...keywords.flatMap(kw => {
        const kh = Array.isArray(kw.history) && kw.history.length > 0 ? kw.history : [];
        if (kh.length === 0) {
          return [[kw.text, kw.last_updated || dateStr, 'Nulmeting', kw.rank || '-', kw.position || '-', `${kw.sov ?? 0}%`]];
        }
        return kh.map((h, idx) => [
          kw.text,
          h.displayDate || h.date || '-',
          h.isBaseline || idx === 0 ? 'Nulmeting' : (h.label || `Meting #${idx + 1}`),
          h.rank || kw.rank || '-',
          h.position || '-',
          `${h.sov ?? 0}%`
        ]);
      })
    ];

    downloadCsvFile(`geo-totaalrapport-${workspace.replace(/[^a-z0-9]+/gi, '-')}-${dateStr}.csv`, rows);
  };

  const handleShareKeyword = (kw) => {
    if (!kw) return;
    const workspace = activeWorkspace || 'Saleswizard.nl';
    const b = kw.baseline || (Array.isArray(kw.history) && kw.history.length > 0 ? kw.history[0] : null);
    const summaryText = [
      `GEO Rapport - ${workspace} | Keyword: "${kw.text}"`,
      `• Huidig: AI Positie ${kw.position || '-'} | Share of Voice: ${kw.sov ?? 0}% | Google Rank: ${kw.rank || '-'}`,
      b ? `• Nulmeting (${b.displayDate || b.date}): AI Positie ${b.position || '-'} | Share of Voice: ${b.sov ?? 0}%` : null,
      `• Link: ${window.location.href}`
    ].filter(Boolean).join('\n');

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(summaryText).catch(() => {});
    }
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2500);
  };

  const getEditPromptMode = (kwId) => !!editPromptModes[kwId];
  const toggleEditPromptMode = (kwId) => {
    setEditPromptModes(prev => ({ ...prev, [kwId]: !prev[kwId] }));
  };

  const getCustomPromptInput = (kwId) => customPromptInputs[kwId] || '';
  const setCustomPromptInput = (kwId, val) => {
    setCustomPromptInputs(prev => ({ ...prev, [kwId]: val }));
  };

    const handleAddKeywords = async (e) => {
    e.preventDefault();
    if (!isStaffOrAdmin || !keywordInput.trim()) return;

    const rawKeywords = keywordInput.split(',').map(k => k.trim()).filter(Boolean);
    const customLines = customPromptsOnAdd
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean);
    const aiPromptsCount = generateAiPromptsOnAdd ? rawKeywords.length * 3 : 0;
    const promptsToGenerateCount = aiPromptsCount + customLines.length;
    const remainingPrompts = Math.max(0, activeLimit - totalUsedPrompts);

    if (promptsToGenerateCount > 0 && (totalUsedPrompts + promptsToGenerateCount > activeLimit)) {
      setLimitAlert({
        type: 'error',
        title: 'Onvoldoende prompts limiet over',
        promptsToGenerate: promptsToGenerateCount,
        keywordsCount: rawKeywords.length,
        currentUsed: totalUsedPrompts,
        maxLimit: activeLimit,
        available: remainingPrompts
      });
      return;
    }

    setLimitAlert(null);
    const workspace = activeWorkspace || 'Saleswizard.nl';

    try {
      setIsAdding(false);
      setKeywordInput('');
      setCustomPromptsOnAdd('');

      let totalCreatedPromptsCount = 0;

      for (let kwIdx = 0; kwIdx < rawKeywords.length; kwIdx++) {
        const kwText = rawKeywords[kwIdx];
        const kwResponse = await fetch('/api/keywords', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ company: workspace, keyword: kwText, volume: 100 })
        });
        const kwData = await kwResponse.json();

        if (kwData.success) {
          const insertedKw = kwData.keyword;
          const promptsToSave = [];

          if (generateAiPromptsOnAdd) {
            // Generate 3 natural AI prompts
            const genResponse = await fetch('/api/prompts/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ company: workspace, keyword: kwText })
            });
            const genData = await genResponse.json();
            const aiPrompts = genData.success && genData.prompts ? genData.prompts : [
              `Wat zijn de beste ${kwText} opties?`,
              `Welke ${kwText} partij raden jullie aan?`,
              `Top aanbevolen specialisten voor ${kwText}`
            ];
            aiPrompts.forEach(pText => promptsToSave.push({ text: pText, tag: 'AI Generated' }));
          }

          // Distribute or attach custom prompts
          customLines.forEach((cLine, cIdx) => {
            if (rawKeywords.length === 1 || (cIdx % rawKeywords.length) === kwIdx) {
              promptsToSave.push({ text: cLine, tag: 'Custom' });
            }
          });

          const savedPrompts = [];
          for (const pEntry of promptsToSave) {
            const pResponse = await fetch('/api/prompts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                company: workspace,
                text: pEntry.text,
                tag: pEntry.tag,
                keyword_id: insertedKw.id,
                userId: currentUser?.id,
                role: currentUser?.role
              })
            });
            const pData = await pResponse.json();
            if (pData.success) {
              savedPrompts.push(pData.prompt);
              totalCreatedPromptsCount++;
            }
          }

          const newKw = {
            id: insertedKw.id,
            text: kwText,
            rank: insertedKw.rank || '-',
            sov: insertedKw.share_of_voice ?? 0,
            position: insertedKw.average_position || '-',
            volume: 100,
            is_crawling: savedPrompts.length > 0,
            brands: [workspace.replace(/\.(nl|com|eu|de|be|org|net|io|co|info|biz|[a-z]{2,8})$/i, '').toLowerCase()],
            competitors: insertedKw.competitors || [],
            prompts: savedPrompts.map(p => ({
              id: p.id,
              text: p.text,
              status: 'pending',
              engines: ['chatgpt', 'gemini', 'perplexity'],
              brandsCount: 0,
              sourcesCount: 0
            }))
          };

          setKeywords(prev => [newKw, ...prev]);
        }
      }

      if (totalCreatedPromptsCount > 0) {
        setTotalUsedPrompts(prev => prev + totalCreatedPromptsCount);
      }
    } catch (err) {
      console.error('Failed to add keywords and prompts:', err);
    }
  };

  const handleArchiveKeyword = async (kw) => {
    if (!isStaffOrAdmin) return;
    if (!window.confirm(`Weet u zeker dat u zoekwoord "${kw.text}" wilt archiveren?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/keywords/${kw.id}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ userId: currentUser?.id, role: currentUser?.role })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setKeywords(prev => {
          const next = prev.map(k => k.id === kw.id ? { ...k, is_archived: true } : k);
          const activeCount = next.filter(k => !k.is_archived).reduce((acc, k) => acc + (k.prompts || []).length, 0);
          setTotalUsedPrompts(typeof data.totalUsedPrompts === 'number' ? data.totalUsedPrompts : activeCount);
          return next;
        });
        if (selectedKeyword && selectedKeyword.id === kw.id) {
          setSelectedKeyword(null);
        }
      } else {
        alert(data.error || 'Fout bij archiveren van keyword.');
      }
    } catch (err) {
      console.error('Failed to archive keyword:', err);
    }
  };

  const handleDeleteKeyword = async (kw) => {
    if (!isStaffOrAdmin) return;
    const pCount = (kw.prompts || []).length;
    if (!window.confirm(`Weet u zeker dat u zoekwoord "${kw.text}" en de ${pCount} bijbehorende prompt(s) definitief wilt verwijderen? Hiermee wordt uw promptlimiet direct gereset/vrijgegeven.`)) {
      return;
    }

    try {
      const params = new URLSearchParams({
        force: 'true',
        userId: String(currentUser?.id || ''),
        role: String(currentUser?.role || 'medewerker')
      });
      const response = await fetch(`/api/keywords/${kw.id}?${params.toString()}`, {
        method: 'DELETE',
        headers: { 'Accept': 'application/json' }
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setKeywords(prev => {
          const next = prev.filter(k => k.id !== kw.id);
          const activeCount = next.filter(k => !k.is_archived).reduce((acc, k) => acc + (k.prompts || []).length, 0);
          setTotalUsedPrompts(typeof data.totalUsedPrompts === 'number' ? data.totalUsedPrompts : activeCount);
          return next;
        });
        if (selectedKeyword && selectedKeyword.id === kw.id) {
          setSelectedKeyword(null);
        }
      } else {
        alert(data.error || 'Fout bij verwijderen van keyword.');
      }
    } catch (err) {
      console.error('Failed to delete keyword:', err);
    }
  };

  const handleRestoreKeyword = async (kw) => {
    if (!isStaffOrAdmin) return;
    const kwPromptCount = (kw.prompts || []).length;
    if (totalUsedPrompts + kwPromptCount > activeLimit) {
      setLimitAlert({
        type: 'error',
        title: 'Onvoldoende prompts limiet om te herstellen',
        promptsToGenerate: kwPromptCount,
        keywordsCount: 1,
        currentUsed: totalUsedPrompts,
        maxLimit: activeLimit,
        available: Math.max(0, activeLimit - totalUsedPrompts)
      });
      return;
    }

    try {
      const response = await fetch(`/api/keywords/${kw.id}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ userId: currentUser?.id, role: currentUser?.role })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setKeywords(prev => {
          const next = prev.map(k => k.id === kw.id ? { ...k, is_archived: false } : k);
          const activeCount = next.filter(k => !k.is_archived).reduce((acc, k) => acc + (k.prompts || []).length, 0);
          setTotalUsedPrompts(typeof data.totalUsedPrompts === 'number' ? data.totalUsedPrompts : activeCount);
          return next;
        });
      } else {
        alert(data.error || 'Fout bij herstellen van keyword.');
      }
    } catch (err) {
      console.error('Failed to restore keyword:', err);
    }
  };

  const getBrandLogo = (brandKey) => {
    if (!brandKey) return { label: '?', color: '#64748b', text: 'white', domain: '' };
    const key = String(brandKey).toLowerCase();
    const brandMap = {
      saleswizard: { label: 'S', color: '#440099', text: 'white', domain: 'saleswizard.nl' },
      doublesmart: { label: 'D', color: '#06b6d4', text: 'white', domain: 'doublesmart.nl' },
      perplexity: { label: 'P', color: '#139ea5', text: 'white', domain: 'perplexity.ai' },
      google: { label: 'G', color: '#ea4335', text: 'white', domain: 'google.com' },
      chatgpt: { label: 'C', color: '#10a37f', text: 'white', domain: 'openai.com' },
      gemini: { label: 'G', color: '#1a73e8', text: 'white', domain: 'google.com' },
      inoma: { label: 'I', color: '#22c55e', text: 'white', domain: 'inoma.nl' },
      trafficbuilders: { label: 'T', color: '#f97316', text: 'white', domain: 'trafficbuilders.nl' },
      emerce: { label: 'E', color: '#ec4899', text: 'white', domain: 'emerce.nl' }
    };
    return brandMap[key] || { label: String(brandKey)[0]?.toUpperCase() || '?', color: '#64748b', text: 'white', domain: `${key}.nl` };
  };

  const parseNumericPos = (posStr) => {
    if (!posStr || posStr === '-') return null;
    const m = String(posStr).match(/\d+/);
    return m ? parseInt(m[0], 10) : null;
  };

  const formatCompactDate = (dStr) => {
    if (!dStr) return '';
    try {
      const d = new Date(dStr);
      if (!isNaN(d.getTime())) {
        const day = d.getDate();
        const monthNames = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
        return `${day} ${monthNames[d.getMonth()]}`;
      }
    } catch (e) {}
    return String(dStr).slice(5, 10);
  };

  const getBrandRankings = (kwParam) => {
    if (!kwParam) return [];

    let comps = [];
    if (kwParam && typeof kwParam === 'object' && Array.isArray(kwParam.competitors) && kwParam.competitors.length > 0) {
      comps = kwParam.competitors;
    } else if (selectedKeyword && Array.isArray(selectedKeyword.competitors) && selectedKeyword.competitors.length > 0) {
      comps = selectedKeyword.competitors;
    }

    if (comps && comps.length > 0) {
      let activeRank = 0;
      return comps.map((c) => {
        const sovVal = typeof c.sov === 'number' ? c.sov : 0;
        if (sovVal > 0) activeRank++;
        const resolvedRank = c.rank ? String(c.rank) : (sovVal > 0 ? `#${activeRank}` : '-');
        return {
          rank: resolvedRank,
          brand: c.brand || c.name || (c.domain ? c.domain.split('.')[0].toUpperCase() : 'BEDRIJF'),
          domain: c.domain || `${(c.name || 'bedrijf').toLowerCase().replace(/[^a-z0-9]/g, '')}.nl`,
          isSelf: Boolean(c.isSelf || c.isTarget || (c.domain && c.domain.toLowerCase().replace(/[^a-z0-9]/g, '').includes((activeWorkspace || '').toLowerCase().replace(/\.(nl|com|eu|de|be|org|net|io|co|info|biz|[a-z]{2,8})$/i, '').replace(/[^a-z0-9]/g, '')))),
          sov: sovVal,
          position: sovVal > 0 ? (c.position || '-') : '-',
          citations: typeof c.citations === 'number' ? c.citations : (typeof c.citationsCount === 'number' ? c.citationsCount : 0),
          citationUrls: (c.citationUrls && c.citationUrls.length > 0) ? c.citationUrls : (c.domain ? [`https://${c.domain}/`] : [])
        };
      });
    }

    return [];
  };

  const handleAddCustomPrompt = async (kwId) => {
    if (!isStaffOrAdmin) return;
    const input = getCustomPromptInput(kwId);
    const lines = input.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    if (lines.length === 0) return;

    const remainingPrompts = Math.max(0, activeLimit - totalUsedPrompts);
    if (totalUsedPrompts + lines.length > activeLimit) {
      setLimitAlert({
        type: 'error',
        title: 'Onvoldoende prompts limiet over',
        promptsToGenerate: lines.length,
        keywordsCount: 1,
        currentUsed: totalUsedPrompts,
        maxLimit: activeLimit,
        available: remainingPrompts
      });
      return;
    }
    setLimitAlert(null);

    const workspace = activeWorkspace || 'Saleswizard.nl';
    try {
      const newPromptObjs = [];
      let latestTotal = null;

      for (const pLine of lines) {
        const response = await fetch('/api/prompts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            company: workspace,
            text: pLine,
            tag: 'Custom',
            keyword_id: kwId,
            userId: currentUser?.id,
            role: currentUser?.role
          })
        });
        const data = await response.json();

        if (data.success) {
          if (typeof data.totalUsedPrompts === 'number') {
            latestTotal = data.totalUsedPrompts;
          }
          newPromptObjs.push({
            id: data.prompt.id,
            text: data.prompt.prompt_text || data.prompt.text || pLine,
            status: 'pending',
            engines: ['chatgpt', 'gemini', 'perplexity'],
            brandsCount: 0,
            sourcesCount: 0
          });
        }
      }

      if (newPromptObjs.length > 0) {
        setKeywords(prev => prev.map(k => {
          if (k.id === kwId) {
            return {
              ...k,
              is_crawling: true,
              prompts: [
                ...(k.prompts || []),
                ...newPromptObjs
              ]
            };
          }
          return k;
        }));

        if (selectedKeyword && selectedKeyword.id === kwId) {
          setSelectedKeyword(prev => ({
            ...prev,
            is_crawling: true,
            prompts: [
              ...(prev.prompts || []),
              ...newPromptObjs
            ]
          }));
        }

        setCustomPromptInput(kwId, '');
        setTotalUsedPrompts(prev => latestTotal !== null ? latestTotal : (prev + newPromptObjs.length));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleGenerateAiPromptsForKeyword = async (kw) => {
    if (!isStaffOrAdmin || !kw) return;
    const remainingPrompts = Math.max(0, activeLimit - totalUsedPrompts);
    if (totalUsedPrompts + 3 > activeLimit) {
      setLimitAlert({
        type: 'error',
        title: 'Onvoldoende prompts limiet over',
        promptsToGenerate: 3,
        keywordsCount: 1,
        currentUsed: totalUsedPrompts,
        maxLimit: activeLimit,
        available: remainingPrompts
      });
      return;
    }
    setLimitAlert(null);
    setGeneratingPromptsForKw(prev => ({ ...prev, [kw.id]: true }));
    const workspace = activeWorkspace || 'Saleswizard.nl';

    try {
      const genResponse = await fetch('/api/prompts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company: workspace, keyword: kw.text })
      });
      const genData = await genResponse.json();
      const prompts = genData.success && genData.prompts ? genData.prompts : [
        `Wat zijn de beste ${kw.text} opties?`,
        `Welke ${kw.text} partij raden jullie aan?`,
        `Top aanbevolen specialisten voor ${kw.text}`
      ];

      const newPromptObjs = [];
      let latestTotal = null;
      for (const pText of prompts) {
        const pResponse = await fetch('/api/prompts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            company: workspace,
            text: pText,
            tag: 'AI Generated',
            keyword_id: kw.id,
            userId: currentUser?.id,
            role: currentUser?.role
          })
        });
        const pData = await pResponse.json();
        if (pData.success) {
          if (typeof pData.totalUsedPrompts === 'number') {
            latestTotal = pData.totalUsedPrompts;
          }
          newPromptObjs.push({
            id: pData.prompt.id,
            text: pData.prompt.text || pText,
            status: 'pending',
            engines: ['chatgpt', 'gemini', 'perplexity'],
            brandsCount: 0,
            sourcesCount: 0
          });
        }
      }

      if (newPromptObjs.length > 0) {
        setKeywords(prev => prev.map(k => {
          if (k.id === kw.id) {
            return {
              ...k,
              is_crawling: true,
              prompts: [...(k.prompts || []), ...newPromptObjs]
            };
          }
          return k;
        }));
        if (selectedKeyword && selectedKeyword.id === kw.id) {
          setSelectedKeyword(prev => ({
            ...prev,
            is_crawling: true,
            prompts: [...(prev.prompts || []), ...newPromptObjs]
          }));
        }
        setTotalUsedPrompts(prev => latestTotal !== null ? latestTotal : (prev + newPromptObjs.length));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setGeneratingPromptsForKw(prev => ({ ...prev, [kw.id]: false }));
    }
  };

  const handleDeletePrompt = async (kwId, promptId) => {
    if (!isStaffOrAdmin) return;
    if (!window.confirm('Weet u zeker dat u deze prompt wilt verwijderen? Uw promptlimiet wordt direct met 1 verlaagd/vrijgegeven.')) return;

    try {
      const params = new URLSearchParams({
        userId: String(currentUser?.id || ''),
        role: String(currentUser?.role || 'medewerker')
      });
      const res = await fetch(`/api/prompts/${promptId}?${params.toString()}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setKeywords(prev => {
          const next = prev.map(k => {
            if (k.id === kwId) {
              return {
                ...k,
                prompts: (k.prompts || []).filter(p => p.id !== promptId)
              };
            }
            return k;
          });
          const activeCount = next.filter(k => !k.is_archived).reduce((acc, k) => acc + (k.prompts || []).length, 0);
          setTotalUsedPrompts(typeof data.totalUsedPrompts === 'number' ? data.totalUsedPrompts : activeCount);
          return next;
        });

        if (selectedKeyword && selectedKeyword.id === kwId) {
          setSelectedKeyword(prev => ({
            ...prev,
            prompts: (prev.prompts || []).filter(p => p.id !== promptId)
          }));
        }
      } else {
        alert(data.error || 'Fout bij verwijderen van prompt.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteAllPromptsForKeyword = async (kw) => {
    if (!isStaffOrAdmin || !kw || !(kw.prompts || []).length) return;
    const promptIds = (kw.prompts || []).map(p => p.id).filter(Boolean);
    if (promptIds.length === 0) return;

    if (!window.confirm(`Weet u zeker dat u alle ${promptIds.length} prompts van zoekwoord "${kw.text}" wilt verwijderen? Hiermee wordt de promptlimiet direct vrijgegeven.`)) {
      return;
    }

    try {
      const res = await fetch('/api/prompts/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: promptIds,
          userId: currentUser?.id,
          role: currentUser?.role
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setKeywords(prev => {
          const next = prev.map(k => k.id === kw.id ? { ...k, is_crawling: false, prompts: [] } : k);
          const activeCount = next.filter(k => !k.is_archived).reduce((acc, k) => acc + (k.prompts || []).length, 0);
          setTotalUsedPrompts(typeof data.totalUsedPrompts === 'number' ? data.totalUsedPrompts : activeCount);
          return next;
        });
        if (selectedKeyword && selectedKeyword.id === kw.id) {
          setSelectedKeyword(prev => ({ ...prev, is_crawling: false, prompts: [] }));
        }
      } else {
        alert(data.error || 'Fout bij verwijderen van prompts.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredKeywords = keywords.filter(kw =>
    !kw.is_archived && (kw && kw.text ? String(kw.text).toLowerCase().includes((searchQuery || '').toLowerCase()) : false)
  );

  const archivedKeywords = keywords.filter(kw =>
    kw.is_archived && (kw && kw.text ? String(kw.text).toLowerCase().includes((searchQuery || '').toLowerCase()) : false)
  );


  const renderPromptLimitAlert = () => {
    if (!limitAlert) return null;

    return (
      <div style={{
        backgroundColor: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: '12px',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '16px',
        boxShadow: '0 4px 12px rgba(239, 68, 68, 0.08)',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
          <div style={{
            backgroundColor: '#fee2e2',
            color: '#dc2626',
            borderRadius: '10px',
            padding: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <AlertTriangle size={20} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#991b1b' }}>
              {limitAlert.title || 'Onvoldoende prompts limiet over'}
            </h4>
            <p style={{ margin: 0, fontSize: '13px', color: '#7f1d1d', lineHeight: '1.5' }}>
              U probeert <strong>{limitAlert.promptsToGenerate} {limitAlert.promptsToGenerate === 1 ? 'prompt' : 'prompts'}</strong> te genereren{limitAlert.keywordsCount > 0 ? ` voor ${limitAlert.keywordsCount} keyword(s)` : ''}.
              U gebruikt momenteel al <strong>{limitAlert.currentUsed}</strong> van uw maximaal <strong>{limitAlert.maxLimit}</strong> prompts (nog <strong>{limitAlert.available}</strong> beschikbaar).
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px', flexWrap: 'wrap' }}>
              <span style={{
                fontSize: '12px',
                padding: '3px 10px',
                backgroundColor: '#ffffff',
                color: '#991b1b',
                borderRadius: '6px',
                fontWeight: 700,
                border: '1px solid #fecaca'
              }}>
                Huidig verbruik: {limitAlert.currentUsed} / {limitAlert.maxLimit} prompts
              </span>
              <span style={{ fontSize: '12px', color: '#b91c1c', fontWeight: 500 }}>
                Verhoog uw prompts limiet of abonnement om verder te gaan.
              </span>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setLimitAlert(null)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#991b1b',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.7,
            transition: 'opacity 0.15s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
          title="Melding sluiten"
        >
          <X size={18} />
        </button>
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '16px' }}>
        <Loader2 className="spin" size={32} style={{ color: 'var(--brand-primary)' }} />
        <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 600 }}>Keywords en prompts laden...</span>
      </div>
    );
  }

  // --- DEDICATED KEYWORD DETAIL PAGE VIEW ---
  if (selectedKeyword) {
    const kw = selectedKeyword;
    const isEditMode = getEditPromptMode(kw.id);

    return (
      <div className="fade-in" style={{
        padding: '40px 48px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        backgroundColor: '#ffffff',
        minHeight: '100%',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        flex: 1
      }}>
        {renderPromptLimitAlert()}

        {/* Detail Top Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setSelectedKeyword(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                border: 'none',
                background: 'none',
                fontSize: '20px',
                fontWeight: 800,
                color: '#111827',
                cursor: 'pointer',
                fontFamily: "'Outfit', sans-serif"
              }}
            >
              <ArrowLeft size={20} />
              Keyword: {kw.text}
            </button>
            <span style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>
              Laatst bijgewerkt: {kw.last_updated || 'Recent'}
            </span>
            {kw.baseline && (
              <span style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: '12px',
                backgroundColor: '#f3e8ff',
                color: '#6b21a8',
                border: '1px solid #d8b4fe'
              }}>
                Nulmeting: {kw.baseline.displayDate || kw.baseline.date}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {!isReadOnly && (
              <button
                type="button"
                onClick={(e) => handleRescrapeKeyword(kw.id, e)}
                disabled={rescrapingKeywords[kw.id]}
                title="Alleen handmatig scannen bij status 'Mislukt'. Reguliere scans draaien dagelijks automatisch."
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: '1px solid #bfdbfe',
                  backgroundColor: rescrapingKeywords[kw.id] ? '#eff6ff' : '#f0f7ff',
                  color: '#1d4ed8',
                  fontSize: '12px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: rescrapingKeywords[kw.id] ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => { if (!rescrapingKeywords[kw.id]) e.currentTarget.style.backgroundColor = '#dbeafe'; }}
                onMouseLeave={(e) => { if (!rescrapingKeywords[kw.id]) e.currentTarget.style.backgroundColor = '#f0f7ff'; }}
              >
                <RotateCw size={13} className={rescrapingKeywords[kw.id] ? 'spin' : ''} />
                {rescrapingKeywords[kw.id] ? 'Scrapen bezig...' : 'Opnieuw Scrapen'}
              </button>
            )}
            <button
              type="button"
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                border: '1px solid #e5e7eb',
                backgroundColor: '#ffffff',
                fontSize: '12px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                color: '#374151'
              }}
              onClick={() => handleExportKeywordCsv(kw)}
              title="Exporteer nulmeting, historie, rankings en prompts naar CSV (Excel)"
            >
              <Download size={12} />
              Export CSV
            </button>
            <button
              type="button"
              style={{
                padding: '6px 16px',
                borderRadius: '20px',
                backgroundColor: shareCopied ? '#16a34a' : '#000000',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                border: 'none',
                transition: 'background-color 0.15s ease'
              }}
              onClick={() => handleShareKeyword(kw)}
            >
              <Share2 size={12} />
              {shareCopied ? 'Gekopieerd!' : 'Share'}
            </button>
          </div>
        </div>

        {/* Subtabs Header */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', gap: '8px' }}>
          {(() => {
            const kwCrawlingCount = (kw.prompts || []).filter(p => !!scanningPrompts[p.id] || p.status === 'processing' || p.status === 'pending' || p.status === 'crawling').length;
            return [
              { id: 'rankings', label: 'Rankings & Historie' },
              { id: 'nulmeting', label: 'Nulmeting' },
              { id: 'prompts', label: kwCrawlingCount > 0 ? `Prompts (${(kw.prompts || []).length}) ⏳ (${kwCrawlingCount} bezig...)` : `Prompts (${(kw.prompts || []).length})` },
              { id: 'sources', label: 'Sources' }
            ];
          })().map(t => (
            <button
              key={t.id}
              onClick={() => setDetailTab(t.id)}
              style={{
                padding: '12px 20px',
                fontSize: '13px',
                fontWeight: detailTab === t.id ? 700 : 500,
                color: detailTab === t.id ? '#440099' : '#6b7280',
                borderBottom: detailTab === t.id ? '2px solid #440099' : '2px solid transparent',
                cursor: 'pointer',
                backgroundColor: 'transparent',
                borderTop: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                transition: 'all 0.15s ease'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* TAB: RANKINGS */}
        {detailTab === 'rankings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#111827' }}>Brand rankings</h3>
                <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                  Overview of all brands & visibility for this keyword
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: '#6b7280' }}>
                <span>AI Search Engines</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[
                    { id: 'chatgpt', domain: 'openai.com', name: 'ChatGPT' },
                    { id: 'gemini', domain: 'gemini.google.com', name: 'Gemini' },
                    { id: 'perplexity', domain: 'perplexity.ai', name: 'Perplexity' },
                    { id: 'copilot', domain: 'copilot.microsoft.com', name: 'Copilot' }
                  ].filter(e => !enabledEngines || enabledEngines[e.id] !== false).map((e, idx) => (
                    <img
                      key={idx}
                      src={`https://www.google.com/s2/favicons?domain=${e.domain}&sz=48`}
                      alt={e.name}
                      title={e.name}
                      style={{ width: '18px', height: '18px', borderRadius: '4px', objectFit: 'contain' }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Compact Position & Share of Voice History Candle Chart */}
            {(() => {
              const rawHistory = Array.isArray(kw.history) && kw.history.length > 0
                ? kw.history
                : [{
                    date: new Date().toISOString().slice(0, 10),
                    displayDate: kw.last_updated || 'Nulmeting',
                    isBaseline: true,
                    label: 'Nulmeting',
                    rank: kw.rank || '-',
                    position: kw.position || '-',
                    sov: typeof kw.sov === 'number' ? kw.sov : 0,
                    citations: 0
                  }];

              return (
                <div style={{
                  padding: '16px 20px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px',
                  backgroundColor: '#fafafa',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: '#111827' }}>
                        Position & Share of Voice Historie
                      </span>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '12px',
                        backgroundColor: '#f3e8ff',
                        color: '#440099'
                      }}>
                        {rawHistory.length} {rawHistory.length === 1 ? 'meetpunt' : 'meetpunten'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '11px', color: '#6b7280', fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#440099', display: 'inline-block' }} />
                        <span>Nulmeting</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#2563eb', display: 'inline-block' }} />
                        <span>Vervolgmeting</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDetailTab('nulmeting')}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#440099',
                          fontWeight: 700,
                          fontSize: '11px',
                          cursor: 'pointer',
                          padding: 0,
                          textDecoration: 'underline'
                        }}
                      >
                        Bekijk Nulmeting details →
                      </button>
                    </div>
                  </div>

                  {/* Compact Candle Strip */}
                  <div style={{
                    minHeight: '105px',
                    width: '100%',
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: '6px',
                    padding: '12px 10px 8px 10px',
                    backgroundColor: '#ffffff',
                    borderRadius: '10px',
                    border: '1px solid #e5e7eb',
                    overflowX: 'auto'
                  }}>
                    {rawHistory.map((item, i) => {
                      const isFirst = i === 0 || !!item.isBaseline;
                      const posNum = parseNumericPos(item.position);
                      const itemSov = Number(item.sov ?? 0);
                      let scorePct = 20;
                      if (posNum !== null && posNum > 0) {
                        scorePct = Math.max(15, Math.min(100, Math.round(((21 - Math.min(posNum, 20)) / 20) * 100)));
                      } else if (itemSov > 0) {
                        scorePct = Math.max(18, Math.min(100, itemSov));
                      }
                      const barHeightPx = Math.max(14, Math.round((scorePct / 100) * 58));

                      return (
                        <div
                          key={i}
                          style={{
                            flex: '0 0 auto',
                            width: '32px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            gap: '4px'
                          }}
                        >
                          {/* Value above candle */}
                          <span style={{ fontSize: '9px', fontWeight: 800, color: '#111827', whiteSpace: 'nowrap' }}>
                            {item.position && item.position !== '-' ? item.position : `${itemSov}%`}
                          </span>

                          {/* Candle Stick */}
                          <div
                            title={`${isFirst ? 'Nulmeting' : `Meting #${i + 1}`}: ${item.displayDate || item.date}\nAI Positie: ${item.position || '-'}\nShare of Voice: ${itemSov}%\nGoogle Rank: ${item.rank || '-'}`}
                            style={{
                              width: '12px',
                              height: `${barHeightPx}px`,
                              background: isFirst
                                ? 'linear-gradient(180deg, #7c3aed 0%, #440099 100%)'
                                : 'linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%)',
                              borderRadius: '4px 4px 2px 2px',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                              cursor: 'pointer',
                              transition: 'height 0.25s ease'
                            }}
                          />

                          {/* Date below candle */}
                          <span style={{ fontSize: '9px', fontWeight: 600, color: '#6b7280', whiteSpace: 'nowrap' }}>
                            {formatCompactDate(item.displayDate || item.date)}
                          </span>

                          {/* Metric tag */}
                          <span style={{
                            fontSize: '8px',
                            fontWeight: 800,
                            padding: '1px 3px',
                            borderRadius: '3px',
                            backgroundColor: isFirst ? '#f3e8ff' : '#eff6ff',
                            color: isFirst ? '#6b21a8' : '#1d4ed8',
                            lineHeight: 1
                          }}>
                            {isFirst ? 'NUL' : `#${i + 1}`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Competitor Table or Crawling Placeholder */}
            {(() => {
              const isKwScanning = kw.is_crawling || (kw.prompts || []).some(p => p.status === 'pending' || p.status === 'processing' || p.status === 'crawling' || scanningPrompts[p.id]);
              const brandRankings = getBrandRankings(kw);

              if (brandRankings.length === 0 || (isKwScanning && brandRankings.length <= 1)) {
                return (
                  <div style={{
                    padding: '48px 24px',
                    textAlign: 'center',
                    backgroundColor: '#ffffff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '16px'
                  }}>
                    <div style={{
                      width: '52px',
                      height: '52px',
                      borderRadius: '50%',
                      backgroundColor: '#eff6ff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid #bfdbfe'
                    }}>
                      <Loader2 size={26} className="spin" style={{ color: '#2563eb' }} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', margin: 0 }}>
                        {isKwScanning ? 'AI Zoekmachines worden live gecrawld...' : 'Wachten op analyse van zoekvragen...'}
                      </h4>
                      <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '6px', maxWidth: '440px', lineHeight: 1.5 }}>
                        De merkrangschikking, gemiddelde posities en Share of Voice worden berekend en zichtbaar zodra de AI-zoekvragen zijn voltooid.
                      </p>
                    </div>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 16px',
                      backgroundColor: '#f8fafc',
                      borderRadius: '20px',
                      border: '1px solid #e2e8f0',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#475569'
                    }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#2563eb', display: 'inline-block' }}></span>
                      Live multi-engine evaluatie (ChatGPT, Gemini, Perplexity)
                    </div>
                  </div>
                );
              }

              return (
                <div style={{ overflow: 'visible', border: '1px solid #e5e7eb', borderRadius: '12px', backgroundColor: '#ffffff' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                        <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 600, color: '#4b5563', textTransform: 'uppercase' }}>Rank</th>
                        <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 600, color: '#4b5563', textTransform: 'uppercase' }}>Brand</th>
                        <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 600, color: '#4b5563', textTransform: 'uppercase' }}>Share of Voice</th>
                        <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 600, color: '#4b5563', textTransform: 'uppercase' }}>Position</th>
                        <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 600, color: '#4b5563', textTransform: 'uppercase' }}>Citations</th>
                      </tr>
                    </thead>
                    <tbody>
                      {brandRankings.map((r, rIdx) => {
                        const colors = [
                          { bg: '#fee2e2', text: '#ef4444' },
                          { bg: '#e0e7ff', text: '#6366f1' },
                          { bg: '#dcfce7', text: '#22c55e' },
                          { bg: '#fef9c3', text: '#eab308' },
                          { bg: '#f3e8ff', text: '#a855f7' }
                        ];
                        const avatarColor = colors[r.brand.charCodeAt(0) % colors.length];

                        return (
                          <tr
                            key={rIdx}
                            style={{
                              borderBottom: '1px solid #f3f4f6',
                              backgroundColor: r.isSelf ? '#fffbebf0' : 'transparent',
                              fontWeight: r.isSelf ? 700 : 400
                            }}
                          >
                            <td style={{ padding: '14px 16px', fontWeight: 700, color: '#111827' }}>{r.rank}</td>
                            <td style={{ padding: '14px 16px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <FaviconImage
                                  domain={r.domain}
                                  fallbackLabel={r.brand}
                                  fallbackBg={avatarColor.bg}
                                  fallbackColor={avatarColor.text}
                                  size={26}
                                />
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ color: '#111827', fontWeight: 600 }}>{r.brand}</span>
                                  <span style={{ fontSize: '11px', color: '#6b7280' }}>{r.domain}</span>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '14px 16px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <span style={{ fontWeight: 700, color: '#111827' }}>{r.sov}%</span>
                                <div style={{ width: '100px', height: '4px', borderRadius: '2px', backgroundColor: '#e5e7eb', overflow: 'hidden' }}>
                                  <div style={{ width: `${r.sov}%`, height: '100%', backgroundColor: '#f59e0b', borderRadius: '2px' }}></div>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '14px 16px', fontWeight: 600, color: '#374151' }}>{r.position}</td>
                            <td style={{ padding: '14px 16px', position: 'relative' }}>
                              {r.citationUrls && r.citationUrls.length > 0 ? (
                                <div className="tooltip-container" style={{ display: 'inline-block' }}>
                                  <span style={{
                                    fontSize: '11px',
                                    padding: '4px 10px',
                                    borderRadius: '12px',
                                    backgroundColor: '#fef3c7',
                                    color: '#b45309',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    border: '1px solid rgba(180, 83, 9, 0.15)'
                                  }}>
                                    {r.citations} {r.citations === 1 ? 'URL' : 'URLs'}
                                  </span>
                                  <div className="tooltip-content" style={{
                                    position: 'absolute',
                                    bottom: '100%',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    marginBottom: '8px',
                                    backgroundColor: '#1e1b4b',
                                    color: '#ffffff',
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3), 0 4px 6px -2px rgba(0,0,0,0.05)',
                                    zIndex: 100,
                                    width: 'max-content',
                                    maxWidth: '320px',
                                    pointerEvents: 'none',
                                    opacity: 0,
                                    visibility: 'hidden',
                                    transition: 'all 0.15s ease',
                                    fontSize: '11px',
                                    fontWeight: 500,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '4px',
                                    border: '1px solid rgba(255,255,255,0.1)'
                                  }}>
                                    <div style={{ fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '4px', marginBottom: '2px', color: '#fbbf24' }}>Geciteerde Bronnen:</div>
                                    {r.citationUrls.map((url, uIdx) => (
                                      <a 
                                        key={uIdx} 
                                        href={url} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        style={{ color: '#60a5fa', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {url}
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <span style={{
                                  fontSize: '11px',
                                  padding: '4px 10px',
                                  borderRadius: '12px',
                                  backgroundColor: '#f3f4f6',
                                  color: '#6b7280',
                                  fontWeight: 700
                                }}>
                                  0 URLs
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        )}

        {/* TAB: NULMETING */}
        {detailTab === 'nulmeting' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {(() => {
              const rawHistory = Array.isArray(kw.history) && kw.history.length > 0
                ? kw.history
                : [{
                    date: new Date().toISOString().slice(0, 10),
                    displayDate: kw.last_updated || 'Nulmeting',
                    isBaseline: true,
                    label: 'Nulmeting',
                    rank: kw.rank || '-',
                    position: kw.position || '-',
                    sov: typeof kw.sov === 'number' ? kw.sov : 0,
                    citations: 0
                  }];

              const baselinePoint = kw.baseline || rawHistory[0];
              const latestPoint = rawHistory[rawHistory.length - 1] || baselinePoint;

              const basePosNum = parseNumericPos(baselinePoint?.position);
              const currPosNum = parseNumericPos(kw.position !== '-' ? kw.position : latestPoint?.position);
              const posDiff = (basePosNum !== null && currPosNum !== null) ? (basePosNum - currPosNum) : null;

              const baseSov = Number(baselinePoint?.sov ?? kw.sov ?? 0);
              const currSov = Number(kw.sov ?? latestPoint?.sov ?? 0);
              const sovDiff = currSov - baseSov;

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Header Card */}
                  <div style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '12px',
                    padding: '20px 24px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '16px'
                  }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#111827', margin: 0 }}>
                          Nulmeting & Voortgangsanalyse
                        </h3>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          color: '#440099',
                          backgroundColor: '#f5f0ff',
                          border: '1px solid #e8d9ff',
                          padding: '2px 10px',
                          borderRadius: '12px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.4px'
                        }}>
                          Vastgelegd Startpunt
                        </span>
                      </div>
                      <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px', maxWidth: '640px', lineHeight: 1.5 }}>
                        Het initiële startpunt van <strong>{kw.text}</strong> bij aanvang. Alle scans en AI-optimalisaties worden afgezet tegen deze referentiedatum.
                      </p>
                    </div>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      backgroundColor: '#fafafa',
                      border: '1px solid #e5e7eb',
                      padding: '10px 18px',
                      borderRadius: '10px'
                    }}>
                      <div>
                        <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600 }}>Startdatum Nulmeting</div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>
                          {baselinePoint?.displayDate || baselinePoint?.date || '-'}
                        </div>
                      </div>
                      <div style={{ width: '1px', height: '24px', backgroundColor: '#e5e7eb' }} />
                      <div>
                        <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600 }}>Totaal Scans</div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#440099' }}>
                          {rawHistory.length} {rawHistory.length === 1 ? 'meting' : 'metingen'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* KPI Comparison Grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '16px'
                  }}>
                    {/* Nulmeting Card */}
                    <div style={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e9d5ff',
                      borderRadius: '12px',
                      padding: '20px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '14px',
                      boxShadow: '0 1px 3px rgba(68, 0, 153, 0.04)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          color: '#440099',
                          backgroundColor: '#f3e8ff',
                          padding: '3px 10px',
                          borderRadius: '12px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.3px'
                        }}>
                          Nulmeting (Start)
                        </span>
                        <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 600 }}>
                          {baselinePoint?.displayDate || baselinePoint?.date || '-'}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', paddingTop: '4px' }}>
                        <div>
                          <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600 }}>AI Positie</div>
                          <div style={{ fontSize: '24px', fontWeight: 800, color: '#111827', fontFamily: "'Outfit', sans-serif" }}>
                            {baselinePoint?.position && baselinePoint.position !== '-' ? baselinePoint.position : (kw.position || '-')}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600 }}>Share of Voice</div>
                          <div style={{ fontSize: '24px', fontWeight: 800, color: '#111827', fontFamily: "'Outfit', sans-serif" }}>
                            {baseSov}%
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600 }}>Google Rank</div>
                          <div style={{ fontSize: '20px', fontWeight: 700, color: '#4b5563', paddingTop: '2px' }}>
                            {baselinePoint?.rank || kw.rank || '-'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Current Measurement Card */}
                    <div style={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                      padding: '20px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '14px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          color: '#1e40af',
                          backgroundColor: '#dbeafe',
                          padding: '3px 10px',
                          borderRadius: '12px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.3px'
                        }}>
                          Huidige Meting
                        </span>
                        <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 600 }}>
                          {latestPoint?.displayDate || kw.last_updated || 'Actueel'}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', paddingTop: '4px' }}>
                        <div>
                          <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600 }}>AI Positie</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '24px', fontWeight: 800, color: '#111827', fontFamily: "'Outfit', sans-serif" }}>
                              {kw.position || latestPoint?.position || '-'}
                            </span>
                            {posDiff !== null && posDiff !== 0 && (
                              <span style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '1px 6px',
                                borderRadius: '8px',
                                backgroundColor: posDiff > 0 ? '#dcfce7' : '#fee2e2',
                                color: posDiff > 0 ? '#15803d' : '#dc2626'
                              }}>
                                {posDiff > 0 ? `+${posDiff}` : `${posDiff}`}
                              </span>
                            )}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600 }}>Share of Voice</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '24px', fontWeight: 800, color: '#111827', fontFamily: "'Outfit', sans-serif" }}>
                              {currSov}%
                            </span>
                            {sovDiff !== 0 && (
                              <span style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '1px 6px',
                                borderRadius: '8px',
                                backgroundColor: sovDiff > 0 ? '#dcfce7' : '#fee2e2',
                                color: sovDiff > 0 ? '#15803d' : '#dc2626'
                              }}>
                                {sovDiff > 0 ? `+${sovDiff}%` : `${sovDiff}%`}
                              </span>
                            )}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600 }}>Google Rank</div>
                          <div style={{ fontSize: '20px', fontWeight: 700, color: '#4b5563', paddingTop: '2px' }}>
                            {kw.rank || latestPoint?.rank || '-'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Compact Historical Timeline since Nulmeting */}
                  <div style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '12px',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 800, color: '#111827' }}>
                        Historisch Verloop sinds Nulmeting
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: '#6b7280', fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#440099', display: 'inline-block' }} />
                          <span>Nulmeting</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#2563eb', display: 'inline-block' }} />
                          <span>Vervolgmeting</span>
                        </div>
                      </div>
                    </div>

                    <div style={{
                      minHeight: '105px',
                      width: '100%',
                      display: 'flex',
                      alignItems: 'flex-end',
                      gap: '6px',
                      padding: '12px 10px 8px 10px',
                      backgroundColor: '#fafafa',
                      borderRadius: '10px',
                      border: '1px solid #e5e7eb',
                      overflowX: 'auto'
                    }}>
                      {rawHistory.map((item, i) => {
                        const isFirst = i === 0 || !!item.isBaseline;
                        const posNum = parseNumericPos(item.position);
                        const itemSov = Number(item.sov ?? 0);
                        let scorePct = 20;
                        if (posNum !== null && posNum > 0) {
                          scorePct = Math.max(15, Math.min(100, Math.round(((21 - Math.min(posNum, 20)) / 20) * 100)));
                        } else if (itemSov > 0) {
                          scorePct = Math.max(18, Math.min(100, itemSov));
                        }
                        const barHeightPx = Math.max(14, Math.round((scorePct / 100) * 58));

                        return (
                          <div
                            key={i}
                            style={{
                              flex: '0 0 auto',
                              width: '32px',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'flex-end',
                              gap: '4px'
                            }}
                          >
                            <span style={{ fontSize: '9px', fontWeight: 800, color: '#111827', whiteSpace: 'nowrap' }}>
                              {item.position && item.position !== '-' ? item.position : `${itemSov}%`}
                            </span>
                            <div
                              title={`${isFirst ? 'Nulmeting' : `Meting #${i + 1}`}: ${item.displayDate || item.date}\nAI Positie: ${item.position || '-'}\nShare of Voice: ${itemSov}%\nGoogle Rank: ${item.rank || '-'}`}
                              style={{
                                width: '12px',
                                height: `${barHeightPx}px`,
                                background: isFirst
                                  ? 'linear-gradient(180deg, #7c3aed 0%, #440099 100%)'
                                  : 'linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%)',
                                borderRadius: '4px 4px 2px 2px',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                                cursor: 'pointer',
                                transition: 'height 0.25s ease'
                              }}
                            />
                            <span style={{ fontSize: '9px', fontWeight: 600, color: '#6b7280', whiteSpace: 'nowrap' }}>
                              {formatCompactDate(item.displayDate || item.date)}
                            </span>
                            <span style={{
                              fontSize: '8px',
                              fontWeight: 800,
                              padding: '1px 3px',
                              borderRadius: '3px',
                              backgroundColor: isFirst ? '#f3e8ff' : '#eff6ff',
                              color: isFirst ? '#6b21a8' : '#1d4ed8',
                              lineHeight: 1
                            }}>
                              {isFirst ? 'NUL' : `#${i + 1}`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Prompts Nulmeting vs Huidig overzicht */}
                  <div style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '12px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      padding: '16px 20px',
                      borderBottom: '1px solid #e5e7eb',
                      backgroundColor: '#f9fafb',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#111827', margin: 0 }}>
                          Zoekvragen (Prompts) – Nulmeting vs. Huidig
                        </h4>
                        <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0 0' }}>
                          Vergelijking van merkvermeldingen per zoekvraag tussen het startpunt en actueel.
                        </p>
                      </div>
                      <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 600 }}>
                        {(kw.prompts || []).length} zoekvragen
                      </span>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#fafafa', borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
                            <th style={{ padding: '10px 16px', fontWeight: 700, color: '#4b5563' }}>Prompt / Zoekvraag</th>
                            <th style={{ padding: '10px 16px', fontWeight: 700, color: '#4b5563', width: '170px' }}>Bij Nulmeting</th>
                            <th style={{ padding: '10px 16px', fontWeight: 700, color: '#4b5563', width: '170px' }}>Huidige Status</th>
                            <th style={{ padding: '10px 16px', fontWeight: 700, color: '#4b5563', width: '130px' }}>Voortgang</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(kw.prompts || []).map((p, pIdx) => {
                            const pHistory = Array.isArray(p.history) && p.history.length > 0 ? p.history : [];
                            const pBase = p.baseline || pHistory[0];
                            const baseMentioned = Boolean(pBase?.mentioned);
                            const currMentioned = Boolean(p.brand_mentioned || p.status === 'Cited' || p.mentioned);

                            let statusBadge = (
                              <span style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', backgroundColor: '#f3f4f6', padding: '2px 8px', borderRadius: '10px' }}>
                                Gelijk
                              </span>
                            );
                            if (!baseMentioned && currMentioned) {
                              statusBadge = (
                                <span style={{ fontSize: '11px', fontWeight: 700, color: '#15803d', backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: '10px' }}>
                                  ↑ Gewonnen
                                </span>
                              );
                            } else if (baseMentioned && !currMentioned) {
                              statusBadge = (
                                <span style={{ fontSize: '11px', fontWeight: 700, color: '#b91c1c', backgroundColor: '#fee2e2', padding: '2px 8px', borderRadius: '10px' }}>
                                  ↓ Aandacht
                                </span>
                              );
                            } else if (baseMentioned && currMentioned) {
                              statusBadge = (
                                <span style={{ fontSize: '11px', fontWeight: 700, color: '#15803d', backgroundColor: '#f0fdf4', padding: '2px 8px', borderRadius: '10px' }}>
                                  ✓ Behouden
                                </span>
                              );
                            }

                            return (
                              <tr key={pIdx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                <td style={{ padding: '12px 16px', fontWeight: 600, color: '#111827' }}>
                                  {p.text}
                                </td>
                                <td style={{ padding: '12px 16px' }}>
                                  <span style={{
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    padding: '2px 8px',
                                    borderRadius: '10px',
                                    backgroundColor: baseMentioned ? '#f3e8ff' : '#f3f4f6',
                                    color: baseMentioned ? '#6b21a8' : '#6b7280'
                                  }}>
                                    {baseMentioned ? `Vermeld (${pBase?.position || '#1'})` : 'Niet vermeld'}
                                  </span>
                                </td>
                                <td style={{ padding: '12px 16px' }}>
                                  <span style={{
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    padding: '2px 8px',
                                    borderRadius: '10px',
                                    backgroundColor: currMentioned ? '#dcfce7' : '#fee2e2',
                                    color: currMentioned ? '#15803d' : '#991b1b'
                                  }}>
                                    {currMentioned ? `Vermeld (${p.position && p.position !== '-' ? p.position : 'AI'})` : 'Niet vermeld'}
                                  </span>
                                </td>
                                <td style={{ padding: '12px 16px' }}>
                                  {statusBadge}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* TAB: PROMPTS */}
        {detailTab === 'prompts' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>Prompt explorer & Historie per prompt</h4>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>
                  Klik op een zoekvraag om de nulmeting, resultaten-grafiek en antwoorden per AI-zoekmachine te bekijken
                </span>
              </div>
              {!isReadOnly && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    disabled={!!generatingPromptsForKw[kw.id] || isLimitReached}
                    onClick={() => handleGenerateAiPromptsForKeyword(kw)}
                    title="Laat AI automatisch 3 zoekvragen bedenken voor dit zoekwoord"
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: 700,
                      borderRadius: '6px',
                      border: '1px solid #d8b4fe',
                      backgroundColor: '#faf5ff',
                      color: '#440099',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: (generatingPromptsForKw[kw.id] || isLimitReached) ? 'not-allowed' : 'pointer',
                      opacity: (generatingPromptsForKw[kw.id] || isLimitReached) ? 0.6 : 1
                    }}
                  >
                    {generatingPromptsForKw[kw.id] ? <Loader2 size={13} className="spin" /> : <Sparkles size={13} />}
                    Genereer 3 AI Prompts
                  </button>
                  {(kw.prompts || []).length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteAllPromptsForKeyword(kw)}
                      title="Verwijder alle prompts van dit zoekwoord en geef de promptlimiet direct vrij"
                      style={{
                        padding: '6px 12px',
                        fontSize: '12px',
                        fontWeight: 700,
                        borderRadius: '6px',
                        border: '1px solid #fecaca',
                        backgroundColor: '#fef2f2',
                        color: '#dc2626',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      <Trash2 size={13} />
                      Verwijder alle prompts (Reset limiet)
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleEditPromptMode(kw.id)}
                    style={{
                      padding: '6px 14px',
                      fontSize: '12px',
                      fontWeight: 700,
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      backgroundColor: isEditMode ? '#f3f4f6' : 'transparent',
                      color: '#111827',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    {isEditMode ? <X size={14} /> : <Edit2 size={14} />}
                    {isEditMode ? 'Klaar met bewerken' : 'Edit prompts'}
                  </button>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {(() => {
                const kwCrawlingCount = (kw.prompts || []).filter(p => !!scanningPrompts[p.id] || p.status === 'processing' || p.status === 'pending' || p.status === 'crawling').length;
                return kwCrawlingCount > 0 ? (
                  <div style={{
                    backgroundColor: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: '10px',
                    padding: '12px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Loader2 size={18} className="spin" style={{ color: '#2563eb' }} />
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e40af' }}>
                        AI Zoekmachines doorzoeken... ({kwCrawlingCount} prompt{kwCrawlingCount === 1 ? '' : 's'} actief aan het crawlen)
                      </span>
                    </div>
                    <span style={{ fontSize: '11px', color: '#2563eb', fontWeight: 700, backgroundColor: '#ffffff', padding: '4px 10px', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
                      Live Scannen
                    </span>
                  </div>
                ) : null;
              })()}

              {(kw.prompts || []).map((p, pIdx) => {
                const promptKey = p.id || pIdx;
                const isOpen = !!expandedPrompts[promptKey];
                const isCrawling = !!scanningPrompts[p.id] || p.status === 'processing' || p.status === 'pending' || p.status === 'crawling';
                const isMentioned = p.status === 'Cited' || p.mentioned;
                const brandsCount = p.brandsCount || (isMentioned ? (p.citations ? p.citations.length + 3 : 5) : 0);
                const sourcesCount = p.sourcesCount || (p.citations ? p.citations.length : 0);
                const mData = p.modelMentions || {};

                const isModelUnavailable = (entry) => {
                  if (!entry) return true;
                  const methodLower = String(entry.method || '').toLowerCase();
                  const summaryLower = String(entry.summary || '').toLowerCase().trim();
                  return Boolean(
                    entry.isSimulated ||
                    entry.fallbackUsed ||
                    entry.failed ||
                    entry.available === false ||
                    methodLower.includes('simulator') ||
                    methodLower.includes('niet gemeten') ||
                    summaryLower.startsWith('[simulator]')
                  );
                };

                const buildEngineRow = (id, name) => {
                  const entry = mData[id];
                  const unavailable = isModelUnavailable(entry);
                  const engCitations = Array.isArray(entry?.citations) && entry.citations.length > 0
                    ? entry.citations
                    : (Array.isArray(p.citations) ? p.citations.filter(c => {
                        if (!c || typeof c !== 'object') return true;
                        if (Array.isArray(c.cited_by)) return c.cited_by.includes(id);
                        if (c.sourceEngine) return c.sourceEngine === id;
                        return true;
                      }) : []);
                  return {
                    id,
                    name,
                    unavailable,
                    mentioned: !unavailable && Boolean(entry?.mentioned),
                    brands: unavailable ? 0 : (entry?.brands || 0),
                    sources: unavailable ? 0 : (entry?.sources || 0),
                    summary: unavailable ? '' : (entry?.summary || ''),
                    citations: unavailable ? [] : engCitations,
                    errorMsg: entry?.errorMsg || (unavailable ? (entry?.method || 'Niet gemeten (API fout)') : null),
                    method: entry?.method || null,
                  };
                };

                const enginesList = [
                  buildEngineRow('chatgpt', 'OpenAI ChatGPT'),
                  buildEngineRow('aioverviews', 'Google AI Overviews'),
                  buildEngineRow('aimode', 'Google AI Mode'),
                  buildEngineRow('gemini', 'Google Gemini'),
                  buildEngineRow('perplexity', 'Perplexity AI'),
                  buildEngineRow('claude', 'Anthropic Claude'),
                  buildEngineRow('copilot', 'Microsoft Copilot'),
                  buildEngineRow('meta', 'Meta AI')
                ].filter(e => {
                  if (enabledEngines && enabledEngines[e.id] === false && !(p.modelMentions && e.id in p.modelMentions)) return false;
                  if (p.modelMentions && !(e.id in p.modelMentions)) return false;
                  if (!p.modelMentions && (e.id === 'copilot' || e.id === 'meta')) return false;
                  return true;
                });

                const promptHistory = Array.isArray(p.history) && p.history.length > 0
                  ? p.history
                  : [{
                      date: new Date().toISOString().slice(0, 10),
                      displayDate: p.lastUpdated || kw.last_updated || 'Nulmeting',
                      isBaseline: true,
                      label: 'Nulmeting',
                      mentioned: isMentioned,
                      position: p.position && p.position !== '-' ? p.position : (isMentioned ? kw.position || '#1' : '-'),
                      totalMentions: p.totalMentions ?? (isMentioned ? 2 : 0),
                      totalModels: p.totalModels ?? Math.max(1, enginesList.length || 4),
                      overallScore: p.overallScore ?? (isMentioned ? 50 : 0)
                    }];
                const promptBaseline = p.baseline || promptHistory[0];

                return (
                  <div
                    key={pIdx}
                    style={{
                      backgroundColor: '#ffffff',
                      border: isCrawling ? '1px solid #93c5fd' : '1px solid #e5e7eb',
                      borderRadius: '10px',
                      overflow: 'hidden',
                      boxShadow: isCrawling ? '0 2px 8px rgba(37, 99, 235, 0.08)' : '0 1px 3px rgba(0,0,0,0.02)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {/* LLMRefs Prompt Card Header */}
                    <div
                      style={{
                        padding: '14px 20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: isCrawling ? '#f0f7ff' : '#f9fafb',
                        cursor: 'pointer',
                        userSelect: 'none'
                      }}
                      onClick={() => toggleExpandedPrompt(promptKey)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, paddingRight: '12px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>
                          {p.text}
                        </span>
                        {isCrawling && (
                          <span style={{
                            fontSize: '11px',
                            padding: '3px 10px',
                            borderRadius: '16px',
                            backgroundColor: '#dbeafe',
                            color: '#1d4ed8',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            border: '1px solid #bfdbfe'
                          }}>
                            <Loader2 size={11} className="spin" /> AI Crawl & Grounding actief
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        {isCrawling ? (
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: '#2563eb',
                            backgroundColor: '#eff6ff',
                            padding: '3px 12px',
                            borderRadius: '16px',
                            border: '1px solid #bfdbfe'
                          }}>
                            Wachten op AI modellen...
                          </span>
                        ) : (
                          <>
                            {p.status === 'failed' ? (
                              <span style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                color: '#dc2626',
                                backgroundColor: '#fee2e2',
                                padding: '3px 10px',
                                borderRadius: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}>
                                ✕ Mislukt
                              </span>
                            ) : isMentioned ? (
                              <span style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                color: '#16a34a',
                                backgroundColor: '#dcfce7',
                                padding: '3px 10px',
                                borderRadius: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}>
                                ✓ Mentioned {p.position && p.position !== '-' ? `(${p.position})` : ''}
                              </span>
                            ) : (
                              <span style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                color: '#6b7280',
                                backgroundColor: '#f3f4f6',
                                padding: '3px 10px',
                                borderRadius: '16px'
                              }}>
                                Not Mentioned
                              </span>
                            )}

                            <span style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              color: '#6b21a8',
                              backgroundColor: '#f3e8ff',
                              padding: '3px 10px',
                              borderRadius: '16px'
                            }}>
                              Nulmeting: {promptBaseline?.mentioned ? (promptBaseline?.position && promptBaseline.position !== '-' ? promptBaseline.position : 'Vermeld') : 'Niet vermeld'}
                            </span>

                            <span style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              color: '#2563eb',
                              backgroundColor: '#eff6ff',
                              padding: '3px 10px',
                              borderRadius: '16px'
                            }}>
                              • {brandsCount} Brands
                            </span>

                            <span style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              color: '#ea580c',
                              backgroundColor: '#fff7ed',
                              padding: '3px 10px',
                              borderRadius: '16px'
                            }}>
                              • {sourcesCount} Sources
                            </span>
                          </>
                        )}

                        {!isReadOnly && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {!isEditMode && (
                              <button
                                type="button"
                                disabled={isCrawling}
                                onClick={(e) => { e.stopPropagation(); handleRunPromptScan(p.id, p.text); }}
                                style={{
                                  padding: '5px 12px',
                                  borderRadius: '6px',
                                  backgroundColor: isCrawling ? '#93c5fd' : '#000000',
                                  color: '#ffffff',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  cursor: isCrawling ? 'not-allowed' : 'pointer',
                                  border: 'none',
                                  opacity: isCrawling ? 0.8 : 1,
                                  marginLeft: '4px'
                                }}
                              >
                                {isCrawling ? <Loader2 size={12} className="spin" /> : <Play size={10} />}
                                {isCrawling ? 'Crawling...' : 'Crawl'}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleDeletePrompt(kw.id, p.id); }}
                              title="Verwijder prompt en geef promptlimiet vrij"
                              style={{
                                padding: '6px',
                                borderRadius: '6px',
                                color: '#ef4444',
                                cursor: 'pointer',
                                backgroundColor: isEditMode ? '#fef2f2' : 'transparent',
                                border: isEditMode ? '1px solid #fecaca' : 'none',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        )}

                        <div style={{ color: '#9ca3af', marginLeft: '2px', display: 'flex', alignItems: 'center' }}>
                          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                      </div>
                    </div>

                    {/* LLMRefs Engine Breakdown Rows + Per-Prompt History */}
                    {isOpen && (
                      <div style={{ borderTop: '1px solid #e5e7eb', backgroundColor: '#ffffff', padding: '4px 0' }}>
                        {/* Per-Prompt Nulmeting & Results History Graph */}
                        <div style={{
                          margin: '12px 20px',
                          padding: '16px',
                          backgroundColor: '#fafafa',
                          border: '1px solid #e5e7eb',
                          borderRadius: '10px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '12px', fontWeight: 800, color: '#111827' }}>
                                Nulmeting & Resultaten Historie (Prompt)
                              </span>
                              <span style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: '10px',
                                backgroundColor: '#f3e8ff',
                                color: '#6b21a8'
                              }}>
                                Nulmeting ({promptBaseline?.displayDate || promptBaseline?.date}): {promptBaseline?.mentioned ? `Vermeld (${promptBaseline?.position && promptBaseline.position !== '-' ? promptBaseline.position : `${promptBaseline.totalMentions || 1}/${promptBaseline.totalModels || 4} AI`})` : 'Niet vermeld'}
                              </span>
                            </div>
                            <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600 }}>
                              Huidig: {isMentioned ? `Vermeld (${p.position && p.position !== '-' ? p.position : `${p.totalMentions || 1}/${p.totalModels || 4} AI`})` : 'Niet vermeld'}
                            </span>
                          </div>

                          <div style={{
                            minHeight: '100px',
                            display: 'flex',
                            alignItems: 'flex-end',
                            gap: '6px',
                            padding: '10px 8px 6px 8px',
                            backgroundColor: '#ffffff',
                            borderRadius: '8px',
                            border: '1px solid #e5e7eb',
                            overflowX: 'auto'
                          }}>
                            {promptHistory.map((hItem, hIdx) => {
                              const isBase = hIdx === 0 || !!hItem.isBaseline;
                              const scoreVal = typeof hItem.overallScore === 'number' && hItem.overallScore > 0
                                ? hItem.overallScore
                                : (hItem.mentioned ? 65 : 12);
                              const barPx = Math.max(14, Math.round((Math.min(100, Math.max(15, scoreVal)) / 100) * 54));

                              return (
                                <div
                                  key={hIdx}
                                  style={{
                                    flex: '0 0 auto',
                                    width: '32px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'flex-end',
                                    gap: '3px'
                                  }}
                                >
                                  <span style={{ fontSize: '9px', fontWeight: 800, color: hItem.mentioned ? '#15803d' : '#9ca3af', whiteSpace: 'nowrap' }}>
                                    {hItem.position && hItem.position !== '-' ? hItem.position : (hItem.mentioned ? '✓' : '✕')}
                                  </span>
                                  <div
                                    title={`${isBase ? 'Nulmeting' : `Meting #${hIdx + 1}`}: ${hItem.displayDate || hItem.date}\nStatus: ${hItem.mentioned ? 'Vermeld' : 'Niet vermeld'}\nPositie: ${hItem.position || '-'}\nModellen: ${hItem.totalMentions ?? (hItem.mentioned ? 1 : 0)}/${hItem.totalModels ?? 4} AI`}
                                    style={{
                                      width: '12px',
                                      height: `${barPx}px`,
                                      borderRadius: '4px 4px 2px 2px',
                                      background: isBase
                                        ? 'linear-gradient(180deg, #7c3aed 0%, #440099 100%)'
                                        : (hItem.mentioned
                                            ? 'linear-gradient(180deg, #22c55e 0%, #16a34a 100%)'
                                            : '#e5e7eb'),
                                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                      cursor: 'pointer'
                                    }}
                                  />
                                  <span style={{ fontSize: '8px', fontWeight: 600, color: '#6b7280', whiteSpace: 'nowrap' }}>
                                    {formatCompactDate(hItem.displayDate || hItem.date)}
                                  </span>
                                  <span style={{
                                    fontSize: '7px',
                                    fontWeight: 800,
                                    padding: '1px 3px',
                                    borderRadius: '3px',
                                    backgroundColor: isBase ? '#f3e8ff' : '#f3f4f6',
                                    color: isBase ? '#6b21a8' : '#6b7280',
                                    lineHeight: 1
                                  }}>
                                    {isBase ? 'NUL' : `#${hIdx + 1}`}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {isCrawling && !p.modelMentions ? (
                          <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', backgroundColor: '#f8fafc' }}>
                            <Loader2 size={24} className="spin" style={{ color: '#2563eb' }} />
                            <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
                              Prompt wordt momenteel live uitgevoerd in AI zoekmachines...
                            </span>
                            <span style={{ fontSize: '12px', color: '#64748b', textAlign: 'center', maxWidth: '480px' }}>
                              OpenAI SearchGPT, Google AI Mode, Gemini en Perplexity analyseren het web op zoek naar actuele citaties, reviews en merkvermeldingen. Resultaten verschijnen automatisch zodra de scan gereed is.
                            </span>
                          </div>
                        ) : (
                          enginesList.map((eng, engIdx) => {
                            const engKey = `${promptKey}_${eng.id}`;
                            const isEngExpanded = !!expandedEngines[engKey];
                            return (
                              <div
                                key={engIdx}
                                style={{
                                  borderBottom: engIdx < enginesList.length - 1 ? '1px solid #f3f4f6' : 'none'
                                }}
                              >
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '10px 20px',
                                    cursor: eng.summary ? 'pointer' : 'default',
                                    userSelect: 'none',
                                    backgroundColor: isEngExpanded ? '#f9fafb' : 'transparent'
                                  }}
                                  onClick={() => eng.summary && toggleExpandedEngine(promptKey, eng.id)}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    {EngineLogos[eng.id]}
                                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                                      {eng.name}
                                    </span>
                                    {eng.summary && (
                                      <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 500 }}>
                                        {isEngExpanded ? '(klik om antwoord te verbergen)' : '(klik om antwoord te tonen)'}
                                      </span>
                                    )}
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    {eng.unavailable ? (
                                      <span
                                        title={eng.errorMsg || 'Engine niet beschikbaar tijdens deze scan; telt niet mee in scores.'}
                                        style={{
                                          fontSize: '11px',
                                          fontWeight: 700,
                                          color: '#b45309',
                                          backgroundColor: '#fef3c7',
                                          border: '1px solid #fde68a',
                                          padding: '2px 10px',
                                          borderRadius: '12px',
                                          cursor: 'help'
                                        }}
                                      >
                                        Niet gemeten (telt niet mee)
                                      </span>
                                    ) : (
                                      <>
                                        {eng.mentioned && (
                                          <span style={{
                                            fontSize: '11px',
                                            fontWeight: 800,
                                            color: '#16a34a',
                                            backgroundColor: '#dcfce7',
                                            padding: '2px 8px',
                                            borderRadius: '12px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '2px'
                                          }}>
                                            ✓
                                          </span>
                                        )}
                                        <span style={{
                                          fontSize: '11px',
                                          fontWeight: 700,
                                          color: '#2563eb',
                                          backgroundColor: '#eff6ff',
                                          padding: '2px 8px',
                                          borderRadius: '12px'
                                        }}>
                                          • {eng.brands} Brands
                                        </span>
                                        <span style={{
                                          fontSize: '11px',
                                          fontWeight: 700,
                                          color: '#ea580c',
                                          backgroundColor: '#fff7ed',
                                          padding: '2px 8px',
                                          borderRadius: '12px'
                                        }}>
                                          • {eng.sources} Sources
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>

                                {isEngExpanded && eng.summary && (
                                  <div style={{
                                    padding: '14px 20px 18px 52px',
                                    backgroundColor: '#f8fafc',
                                    fontSize: '13px',
                                    lineHeight: '1.6',
                                    color: '#334155',
                                    borderTop: '1px solid #f1f5f9',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '12px'
                                  }}>
                                    <RichAiMarkdownView
                                      content={eng.summary}
                                      targetCompany={activeWorkspace || 'Saleswizard'}
                                      citations={eng.citations && eng.citations.length > 0 ? eng.citations : (p.citations || [])}
                                    />

                                    {/* Clickable Cited Sources & Favicon Links for this Engine */}
                                    {(() => {
                                      const rawCits = (eng.citations && eng.citations.length > 0) ? eng.citations : (p.citations || []);
                                      const normalizedCits = (Array.isArray(rawCits) ? rawCits : [])
                                        .map(c => {
                                          if (typeof c === 'string') {
                                            const u = normalizeExternalUrl(c);
                                            const d = extractDomainFromUrl(u);
                                            return u ? { url: u, domain: d, title: d || u } : null;
                                          }
                                          if (c && typeof c === 'object' && c.url) {
                                            const u = normalizeExternalUrl(c.url);
                                            const d = c.domain || extractDomainFromUrl(u);
                                            return { url: u, domain: d, title: c.title || d || u };
                                          }
                                          return null;
                                        })
                                        .filter(c => c && c.url && c.url.startsWith('http'));

                                      if (normalizedCits.length === 0) return null;

                                      return (
                                        <div style={{
                                          marginTop: '4px',
                                          paddingTop: '10px',
                                          borderTop: '1px dashed #e2e8f0',
                                          display: 'flex',
                                          flexDirection: 'column',
                                          gap: '6px'
                                        }}>
                                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                                            Geciteerde Bronnen & Links ({normalizedCits.length})
                                          </span>
                                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                            {normalizedCits.slice(0, 12).map((cit, cIdx) => (
                                              <a
                                                key={cIdx}
                                                href={cit.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={(e) => e.stopPropagation()}
                                                title={cit.url}
                                                style={{
                                                  display: 'inline-flex',
                                                  alignItems: 'center',
                                                  gap: '6px',
                                                  padding: '4px 10px',
                                                  borderRadius: '16px',
                                                  backgroundColor: '#ffffff',
                                                  border: '1px solid #cbd5e1',
                                                  color: '#1e293b',
                                                  fontSize: '11px',
                                                  fontWeight: 600,
                                                  textDecoration: 'none',
                                                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                                                  maxWidth: '260px'
                                                }}
                                              >
                                                <FaviconImage domain={cit.domain} fallbackLabel={cit.domain} size={14} />
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                  {cit.title && !cit.title.startsWith('Bron: ') ? cit.title : cit.domain}
                                                </span>
                                                <span style={{ color: '#2563eb', fontSize: '10px', flexShrink: 0 }}>↗</span>
                                              </a>
                                            ))}
                                          </div>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {(kw.prompts || []).length === 0 && (
                <div style={{
                  padding: '28px 20px',
                  borderRadius: '10px',
                  border: '1px dashed #d1d5db',
                  backgroundColor: '#f9fafb',
                  textAlign: 'center',
                  color: '#6b7280',
                  fontSize: '13px'
                }}>
                  Er zijn nog geen prompts ingesteld voor zoekwoord <strong>"{kw.text}"</strong>. Voeg hieronder zelf uw eigen prompt(s) toe of klik op "Genereer 3 AI Prompts".
                </div>
              )}
            </div>

            {!isReadOnly && (
              <div style={{
                borderTop: '1px dashed #e5e7eb',
                paddingTop: '16px',
                marginTop: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#374151' }}>
                    Zelf eigen prompt(s) toevoegen (1 prompt per regel):
                  </span>
                  <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600 }}>
                    Prompts verbruik: {totalUsedPrompts} / {activeLimit}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                  <textarea
                    rows={2}
                    placeholder={"bijv. Wat kost een gemiddelde seo optimalisatie bij Saleswizard?\nWelk marketingbureau in Arnhem heeft de beste reviews?"}
                    value={getCustomPromptInput(kw.id)}
                    onChange={(e) => setCustomPromptInput(kw.id, e.target.value)}
                    disabled={isLimitReached}
                    style={{ flex: 1, padding: '10px 14px', fontSize: '13px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                  />
                  <button
                    type="button"
                    disabled={isLimitReached || !getCustomPromptInput(kw.id).trim()}
                    onClick={() => handleAddCustomPrompt(kw.id)}
                    style={{
                      backgroundColor: (isLimitReached || !getCustomPromptInput(kw.id).trim()) ? '#9ca3af' : '#000000',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '12px',
                      padding: '10px 20px',
                      borderRadius: '6px',
                      cursor: (isLimitReached || !getCustomPromptInput(kw.id).trim()) ? 'not-allowed' : 'pointer',
                      border: 'none',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Prompt(s) toevoegen
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: SOURCES */}
        {detailTab === 'sources' && (
          <div style={{ fontSize: '13px', color: '#374151', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <h4 style={{ fontSize: '16px', fontWeight: 800, color: '#111827' }}>Grounding Sources voor '{kw.text}'</h4>
              <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                Dit zijn de webpagina's, blogs, en autoriteitsportals (Sources) waarop AI-modellen hun informatie baseren.
              </p>
            </div>

            <div style={{ overflow: 'hidden', border: '1px solid #e5e7eb', borderRadius: '12px', backgroundColor: '#ffffff' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                    <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 600, color: '#4b5563', textTransform: 'uppercase' }}>Type</th>
                    <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 600, color: '#4b5563', textTransform: 'uppercase' }}>Source / URL</th>
                    <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 600, color: '#4b5563', textTransform: 'uppercase' }}>Domein</th>
                    <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 600, color: '#4b5563', textTransform: 'uppercase' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const allCitations = [];
                    (kw.prompts || []).forEach(p => {
                      if (p.citations && Array.isArray(p.citations)) {
                        p.citations.forEach(c => allCitations.push(c));
                      }
                    });

                    const displaySources = allCitations.length > 0 ? allCitations : [
                      { title: `${kw.text} - Officiële Website`, url: `https://www.${(activeWorkspace || 'vitagroen.nl').toLowerCase()}/`, domain: (activeWorkspace || 'vitagroen.nl').toLowerCase(), type: 'Website' },
                      { title: `Beste ${kw.text} - Ervaringen & Reviews`, url: `https://trustoo.nl/gelderland/hovenier/`, domain: 'trustoo.nl', type: 'Review' },
                      { title: `Hoveniersbedrijven overzicht op Werkspot`, url: `https://werkspot.nl/hovenier/`, domain: 'werkspot.nl', type: 'Directory' }
                    ];

                    return displaySources.map((s, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '12px',
                            backgroundColor: s.type === 'Website' ? '#dbeafe' : s.type === 'Review' ? '#fef3c7' : '#f3f4f6',
                            color: s.type === 'Website' ? '#1e40af' : s.type === 'Review' ? '#b45309' : '#374151'
                          }}>
                            {s.type || 'Website'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <a href={s.url} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>
                            {s.title || s.url}
                          </a>
                        </td>
                        <td style={{ padding: '14px 16px', color: '#6b7280', fontWeight: 600 }}>
                          {s.domain}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a', backgroundColor: '#dcfce7', padding: '3px 10px', borderRadius: '12px' }}>
                            Geciteerd
                          </span>
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    );
  }

  // --- MAIN KEYWORDS LIST VIEW ---
  return (
    <div className="fade-in" style={{
      padding: '40px 48px',
      display: 'flex',
      flexDirection: 'column',
      gap: '32px',
      backgroundColor: '#ffffff',
      minHeight: '100%',
      width: '100%',
      maxWidth: '100%',
      boxSizing: 'border-box',
      flex: 1
    }}>

      {renderPromptLimitAlert()}

      {/* Header bar */}
      <div data-tour="keywords-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h1 style={{
              fontSize: '28px',
              fontWeight: 800,
              color: '#111827',
              fontFamily: "'Outfit', sans-serif",
              letterSpacing: '-0.5px',
              margin: 0
            }}>
              Keywords
            </h1>
            {isReadOnly && (
              <span style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: '12px',
                backgroundColor: '#f3e8ff',
                color: '#6b21a8',
                border: '1px solid #d8b4fe'
              }}>
                Read-only Klantweergave
              </span>
            )}
          </div>
          <p style={{ color: '#6b7280', fontSize: '13px', marginTop: '4px' }}>
            {isReadOnly
              ? `Live GEO resultaten, nulmeting en AI-zichtbaarheid voor ${activeWorkspace || 'uw merk'}.`
              : `Setup your keywords for ${activeWorkspace ? activeWorkspace.replace(/\.(nl|com|eu|de|be|org|net|io|co|info|biz|[a-z]{2,8})$/i, '') : 'Saleswizard'} brand visibility tracking.`}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{
            fontSize: '11px',
            fontWeight: 700,
            padding: '4px 10px',
            borderRadius: '12px',
            backgroundColor: '#f3f4f6',
            color: '#374151',
            border: '1px solid #e5e7eb'
          }}>
            Pakket: {activePlanName}
          </span>
          <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 600 }}>
            Prompts: {totalUsedPrompts} / {activeLimit}
          </span>
          <button
            type="button"
            onClick={handleExportProjectCsv}
            style={{
              backgroundColor: '#ffffff',
              color: '#374151',
              border: '1px solid #d1d5db',
              borderRadius: '24px',
              padding: '9px 16px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
            }}
            title="Exporteer alle keywords, nulmeting en prompts naar CSV (Excel)"
          >
            <Download size={13} />
            Export CSV
          </button>
          {!isReadOnly && (
            <button
              type="button"
              onClick={() => {
                setIsAdding(!isAdding);
              }}
              style={{
                backgroundColor: '#000000',
                color: '#ffffff',
                border: 'none',
                borderRadius: '24px',
                padding: '10px 20px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                transition: 'background-color 0.15s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1f2937'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#000000'}
            >
              <Plus size={14} strokeWidth={3} />
              Add Keywords
            </button>
          )}
        </div>
      </div>

      {/* Add Keywords Form */}
      {!isReadOnly && isAdding && (
        <form onSubmit={handleAddKeywords} style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          padding: '24px',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
          backgroundColor: '#f9fafb'
        }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', color: '#111827' }}>
            <Sparkles size={16} style={{ color: 'var(--brand-primary)' }} />
            Add Keywords & Generate Prompts
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#4b5563' }}>Keywords (comma-separated)</label>
              <button
                type="button"
                onClick={handleRecommendKeywords}
                disabled={recommending || isLimitReached}
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#440099',
                  backgroundColor: '#f3e8ff',
                  border: '1px solid #d8b4fe',
                  borderRadius: '16px',
                  padding: '4px 12px',
                  cursor: recommending || isLimitReached ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.15s ease'
                }}
              >
                {recommending ? (
                  <>
                    <Loader2 size={12} className="spin" />
                    Keywords aanbevelen...
                  </>
                ) : (
                  <>
                    <Sparkles size={12} />
                    Recommend keywords
                  </>
                )}
              </button>
            </div>
            <textarea
              rows={2}
              placeholder="e.g. seo arnhem, online marketing bureau, ads uitbesteden"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              required
              disabled={generateAiPromptsOnAdd && isLimitReached}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '13px'
              }}
            />

            {/* Toggle AI Prompt generation & Custom prompts when adding keywords */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              padding: '12px 14px',
              borderRadius: '8px',
              backgroundColor: '#ffffff',
              border: '1px solid #e5e7eb',
              marginTop: '4px'
            }}>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', margin: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={generateAiPromptsOnAdd}
                    onChange={(e) => setGenerateAiPromptsOnAdd(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: '#440099', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#111827' }}>
                    Automatisch AI prompts genereren (3 per keyword)
                  </span>
                </div>
                <span style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '10px',
                  backgroundColor: generateAiPromptsOnAdd ? '#440099' : '#e2e8f0',
                  color: generateAiPromptsOnAdd ? '#ffffff' : '#475569'
                }}>
                  {generateAiPromptsOnAdd ? 'AAN' : 'UIT'}
                </span>
              </label>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#4b5563' }}>
                  Zelf eigen prompts opgeven (optioneel, 1 prompt per regel)
                </label>
                <textarea
                  rows={2}
                  placeholder={"Typ hier uw eigen zoekvragen (1 per regel) of laat leeg om ze later bij het keyword in te voeren..."}
                  value={customPromptsOnAdd}
                  onChange={(e) => setCustomPromptsOnAdd(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    fontSize: '12px'
                  }}
                />
              </div>
            </div>

            {(() => {
              const enteredKws = keywordInput.split(',').map(k => k.trim()).filter(Boolean);
              const customLinesCount = customPromptsOnAdd.split(/\r?\n/).map(s => s.trim()).filter(Boolean).length;
              const countPrompts = (generateAiPromptsOnAdd ? enteredKws.length * 3 : 0) + customLinesCount;
              const remaining = Math.max(0, activeLimit - totalUsedPrompts);
              const willExceed = countPrompts > 0 && ((totalUsedPrompts + countPrompts) > activeLimit);

              if (enteredKws.length > 0 || customLinesCount > 0) {
                return (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    backgroundColor: willExceed ? '#fef2f2' : '#f0fdf4',
                    border: `1px solid ${willExceed ? '#fecaca' : '#bbf7d0'}`,
                    fontSize: '12px',
                    color: willExceed ? '#991b1b' : '#166534',
                    fontWeight: 600,
                    flexWrap: 'wrap',
                    gap: '6px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {willExceed ? <AlertTriangle size={14} color="#dc2626" /> : <Sparkles size={14} color="#16a34a" />}
                      <span>
                        {enteredKws.length} keyword(s) · <strong>{countPrompts} prompt(s)</strong> ({generateAiPromptsOnAdd ? `${enteredKws.length * 3} AI` : '0 AI'}{customLinesCount > 0 ? ` + ${customLinesCount} eigen` : ''})
                      </span>
                    </div>
                    <span>
                      {willExceed ? (
                        <span style={{ color: '#dc2626' }}>
                          Limiet overschreden! (max: {activeLimit}, gebruikt: {totalUsedPrompts})
                        </span>
                      ) : (
                        <span>
                          Nog <strong>{remaining - countPrompts}</strong> over na toevoegen (max: {activeLimit})
                        </span>
                      )}
                    </span>
                  </div>
                );
              }

              if (generateAiPromptsOnAdd && isLimitReached) {
                return (
                  <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: 700 }}>
                    Prompts limiet bereikt ({totalUsedPrompts}/{activeLimit}). Verwijder oude prompts/keywords of zet automatische AI-prompts uit.
                  </span>
                );
              }

              return (
                <p style={{ fontSize: '11px', color: '#6b7280', margin: 0 }}>
                  {generateAiPromptsOnAdd
                    ? 'AI Prompts Generator maakt automatisch 3 zoekvragen per keyword (verbruikt 3 prompts per keyword).'
                    : 'Automatische AI-prompts staan uit. Keywords worden toegevoegd met alleen uw eigen opgegeven prompts.'}
                </p>
              );
            })()}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                backgroundColor: '#ffffff'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={generateAiPromptsOnAdd && isLimitReached}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                backgroundColor: (generateAiPromptsOnAdd && isLimitReached) ? '#e5e7eb' : 'var(--brand-primary)',
                color: 'white',
                fontWeight: 700,
                fontSize: '13px',
                cursor: (generateAiPromptsOnAdd && isLimitReached) ? 'not-allowed' : 'pointer'
              }}
            >
              {generateAiPromptsOnAdd ? 'Genereer Prompts & Voeg Toe' : 'Keywords Toevoegen'}
            </button>
          </div>
        </form>
      )}

      {/* Active Crawl Status Banner */}
      {(() => {
        let totalActive = 0;
        (keywords || []).forEach(k => {
          (k.prompts || []).forEach(p => {
            if (p.status === 'pending' || p.status === 'processing' || p.status === 'crawling' || scanningPrompts[p.id]) {
              totalActive++;
            }
          });
        });

        if (totalActive > 0) {
          return (
            <div style={{
              backgroundColor: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '12px',
              padding: '14px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.08)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: '#dbeafe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#2563eb',
                  flexShrink: 0
                }}>
                  <Loader2 size={18} className="spin" />
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e40af' }}>
                    AI Zoekmachines doorzoeken... ({totalActive} prompt{totalActive === 1 ? '' : 's'} actief aan het crawlen)
                  </div>
                  <div style={{ fontSize: '12px', color: '#3b82f6', marginTop: '2px' }}>
                    ChatGPT (SearchGPT), Google AI Mode, Gemini en Perplexity analyseren het live web. Resultaten en Share of Voice worden automatisch bijgewerkt.
                  </div>
                </div>
              </div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#1d4ed8', backgroundColor: '#ffffff', padding: '4px 12px', borderRadius: '12px', border: '1px solid #bfdbfe', whiteSpace: 'nowrap' }}>
                Live Scannen
              </span>
            </div>
          );
        }
        return null;
      })()}

      {/* Filter box */}
      <div style={{ position: 'relative', width: '100%' }}>
        <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
        <input
          type="text"
          placeholder="Filter keywords..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 16px 10px 42px',
            borderRadius: '24px',
            border: '1px solid #e5e7eb',
            fontSize: '14px',
            backgroundColor: '#ffffff',
            color: '#1f2937',
            outline: 'none',
            transition: 'border-color 0.15s ease'
          }}
          onFocus={(e) => e.currentTarget.style.borderColor = 'var(--brand-primary)'}
          onBlur={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
        />
      </div>

      {/* Bulk actions */}
      {!isReadOnly && selectedKeywordIds.length > 0 && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '8px',
          padding: '10px 16px',
          marginTop: '12px',
          width: '100%'
        }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e40af' }}>
            {selectedKeywordIds.length} keywords geselecteerd
          </span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={handleBulkRescrapeKeywords}
              title="Alleen handmatig scannen bij status 'Mislukt'. Reguliere scans draaien dagelijks automatisch."
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                border: '1px solid #93c5fd',
                backgroundColor: '#2563eb',
                color: 'white',
                fontSize: '12px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
            >
              <RotateCw size={12} />
              Opnieuw Scrapen
            </button>
            <button
              type="button"
              onClick={handleBulkArchiveKeywords}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                border: 'none',
                backgroundColor: '#f59e0b',
                color: 'white',
                fontSize: '12px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
            >
              <Archive size={12} />
              Archiveer Geselecteerde
            </button>
            <button
              type="button"
              onClick={handleBulkDeleteKeywords}
              title="Verwijder geselecteerde keywords en bijbehorende prompts definitief en geef de promptlimiet vrij"
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                border: 'none',
                backgroundColor: '#ef4444',
                color: 'white',
                fontSize: '12px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
            >
              <Trash2 size={12} />
              Verwijder & Reset Limiet
            </button>
          </div>
        </div>
      )}

      {/* Keywords Table */}
      <div data-tour="keywords-table" style={{ width: '100%', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
              {!isReadOnly && (
                <th style={{ padding: '12px 16px', width: '40px' }}>
                  <input
                    type="checkbox"
                    checked={filteredKeywords.length > 0 && selectedKeywordIds.length === filteredKeywords.length}
                    onChange={handleSelectAllKeywords}
                    onClick={(e) => e.stopPropagation()}
                  />
                </th>
              )}
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#4b5563', cursor: 'help' }} title="Het zoekwoord waarop de AI-zoekmachines worden gescand">Keyword</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#4b5563', cursor: 'help' }} title="De organische positie in de traditionele Google.nl zoekresultaten">Rank</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#4b5563', cursor: 'help' }} title="Percentage van de prompts waarin dit merk door AI-modellen wordt genoemd">Share of Voice</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#4b5563', cursor: 'help' }} title="De gemiddelde positie/volgorde waarin het merk wordt genoemd in de AI-antwoorden">Position</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#4b5563', cursor: 'help' }} title="Schatting van het aantal maandelijkse zoekopdrachten in Google Nederland">Search Volume</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#4b5563', cursor: 'help' }} title="De meest genoemde merken in de AI-zoekresultaten voor dit zoekwoord">Top Brands</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#4b5563', textAlign: 'center', width: '90px', cursor: 'help' }} title="Acties zoals analyseren of archiveren">
                {isReadOnly ? 'Details' : 'Actions'}
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredKeywords.map((kw) => {
              const isKwScanning = kw.is_crawling || (kw.prompts || []).some(p => p.status === 'pending' || p.status === 'processing' || p.status === 'crawling' || scanningPrompts[p.id]);

              return (
                <tr
                  key={kw.id}
                  style={{
                    cursor: 'pointer',
                    borderBottom: '1px solid #f3f4f6',
                    backgroundColor: isKwScanning ? '#f8faff' : 'transparent',
                    transition: 'background-color 0.15s ease'
                  }}
                  onClick={() => {
                    setSelectedKeyword(kw);
                    setDetailTab('rankings');
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isKwScanning ? '#f0f7ff' : '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isKwScanning ? '#f8faff' : 'transparent'}
                >
                  {!isReadOnly && (
                    <td style={{ padding: '16px', width: '40px' }} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedKeywordIds.includes(kw.id)}
                        onChange={(e) => handleSelectKeyword(kw.id, e.target.checked)}
                      />
                    </td>
                  )}
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 600, color: '#111827', fontSize: '14px' }}>{kw.text}</span>
                      {isKwScanning && (
                        <span style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          backgroundColor: '#eff6ff',
                          color: '#2563eb',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          border: '1px solid #bfdbfe'
                        }}>
                          <Loader2 size={10} className="spin" /> AI Crawl
                        </span>
                      )}
                      <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#f3f4f6', color: '#6b7280', fontWeight: 700 }}>
                        🇳🇱 NL
                      </span>
                    </div>
                  </td>

                  <td style={{ padding: '16px', fontWeight: 700, color: kw.rank !== '-' ? '#111827' : '#9ca3af' }}>
                    {isKwScanning ? (
                      <span style={{ color: '#2563eb', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600 }}>
                        <Loader2 size={12} className="spin" /> Scannen...
                      </span>
                    ) : (
                      kw.rank
                    )}
                  </td>

                  <td style={{ padding: '16px' }}>
                    {isKwScanning ? (
                      <span style={{ color: '#2563eb', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600 }}>
                        <Loader2 size={12} className="spin" /> Analyseren...
                      </span>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, minWidth: '32px', color: '#111827' }}>{kw.sov}%</span>
                        <div style={{ width: '80px', height: '4px', borderRadius: '2px', backgroundColor: '#e5e7eb', overflow: 'hidden' }}>
                          <div style={{
                            width: `${kw.sov}%`,
                            height: '100%',
                            backgroundColor: '#f59e0b',
                            borderRadius: '2px'
                          }}></div>
                        </div>
                      </div>
                    )}
                  </td>

                  <td style={{ padding: '16px', fontWeight: 600, color: '#374151' }}>
                    {isKwScanning ? (
                      <span style={{ color: '#9ca3af' }}>-</span>
                    ) : (
                      kw.position
                    )}
                  </td>

                <td style={{ padding: '16px', color: '#6b7280' }}>
                  {kw.volume}
                </td>

                <td style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {(kw.brands || []).slice(0, 5).map((brandKey, bIdx) => {
                      const details = getBrandLogo(brandKey);
                      return (
                        <FaviconImage
                          key={brandKey || bIdx}
                          domain={details.domain}
                          fallbackLabel={details.label}
                          fallbackBg={details.color}
                          fallbackColor={details.text}
                          size={22}
                          style={{ border: '1px solid #ffffff', borderRadius: '50%' }}
                        />
                      );
                    })}
                  </div>
                </td>

                <td style={{ padding: '16px' }} onClick={(e) => { if (!isReadOnly) e.stopPropagation(); }}>
                  {isReadOnly ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--brand-primary)', fontSize: '12px', fontWeight: 700 }}>
                      Bekijken <ChevronRight size={14} />
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                      <button
                        type="button"
                        onClick={(e) => handleRescrapeKeyword(kw.id, e)}
                        title="Keyword rankings en AI-prompts opnieuw scrapen"
                        disabled={rescrapingKeywords[kw.id]}
                        style={{
                          padding: '6px',
                          borderRadius: '4px',
                          border: 'none',
                          background: 'none',
                          cursor: rescrapingKeywords[kw.id] ? 'not-allowed' : 'pointer',
                          color: rescrapingKeywords[kw.id] ? '#2563eb' : '#9ca3af',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        onMouseEnter={(e) => { if (!rescrapingKeywords[kw.id]) e.currentTarget.style.color = '#2563eb'; }}
                        onMouseLeave={(e) => { if (!rescrapingKeywords[kw.id]) e.currentTarget.style.color = '#9ca3af'; }}
                      >
                        <RotateCw size={14} className={rescrapingKeywords[kw.id] ? 'spin' : ''} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleArchiveKeyword(kw); }}
                        title="Zoekwoord Archiveren"
                        style={{ padding: '6px', borderRadius: '4px', border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = '#f59e0b'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = '#9ca3af'; }}
                      >
                        <Archive size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleDeleteKeyword(kw); }}
                        title="Zoekwoord & prompts definitief verwijderen (reset promptlimiet)"
                        style={{ padding: '6px', borderRadius: '4px', border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = '#9ca3af'; }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
          </tbody>
        </table>
      </div>

      {/* Collapsible Archived Keywords Accordion */}
      {!isReadOnly && (
        <div style={{ marginTop: '24px' }}>
          <button
            type="button"
            onClick={() => setIsArchivedOpen(!isArchivedOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '13px',
              color: '#4b5563',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '10px 14px',
              width: '100%',
              justifyContent: 'space-between',
              transition: 'background-color 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Archive size={15} style={{ color: '#d97706' }} />
              <span>Gearchiveerde zoekwoorden ({archivedKeywords.length})</span>
              <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 400 }}>
                (tellen niet mee in de actieve promptlimiet; kunnen hersteld of definitief verwijderd worden)
              </span>
            </div>
            {isArchivedOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {isArchivedOpen && (
            archivedKeywords.length > 0 ? (
              <div style={{ marginTop: '10px', overflowX: 'auto', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb', color: '#6b7280', fontSize: '12px' }}>
                      <th style={{ padding: '10px 16px' }}>Zoekwoord</th>
                      <th style={{ padding: '10px 16px' }}>Prompts</th>
                      <th style={{ padding: '10px 16px' }}>Rank</th>
                      <th style={{ padding: '10px 16px' }}>Share of Voice</th>
                      <th style={{ padding: '10px 16px' }}>Volume</th>
                      <th style={{ padding: '10px 16px', textAlign: 'right' }}>Actie</th>
                    </tr>
                  </thead>
                  <tbody>
                    {archivedKeywords.map(kw => (
                      <tr key={kw.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '10px 16px', fontWeight: 500, color: '#374151' }}>
                          <span style={{ textDecoration: 'line-through', color: '#9ca3af', marginRight: '8px' }}>{kw.text}</span>
                          <span style={{ fontSize: '10px', color: '#b45309', backgroundColor: '#fef3c7', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>Gearchiveerd</span>
                        </td>
                        <td style={{ padding: '10px 16px', color: '#6b7280' }}>
                          {(kw.prompts || []).length} prompt{(kw.prompts || []).length === 1 ? '' : 's'}
                        </td>
                        <td style={{ padding: '10px 16px', color: '#9ca3af' }}>{kw.rank}</td>
                        <td style={{ padding: '10px 16px', color: '#9ca3af' }}>{kw.sov}%</td>
                        <td style={{ padding: '10px 16px', color: '#9ca3af' }}>{kw.volume}</td>
                        <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                            <button
                              type="button"
                              onClick={() => handleRestoreKeyword(kw)}
                              style={{
                                fontSize: '12px',
                                padding: '5px 12px',
                                borderRadius: '6px',
                                backgroundColor: '#ffffff',
                                border: '1px solid #d1d5db',
                                color: '#1f2937',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px'
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f3f4f6'; e.currentTarget.style.borderColor = '#9ca3af'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#ffffff'; e.currentTarget.style.borderColor = '#d1d5db'; }}
                              title="Herstel dit zoekwoord naar de actieve lijst"
                            >
                              <RotateCcw size={13} />
                              Dearchiveren
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteKeyword(kw)}
                              style={{
                                fontSize: '12px',
                                padding: '5px 12px',
                                borderRadius: '6px',
                                backgroundColor: '#fef2f2',
                                border: '1px solid #fecaca',
                                color: '#dc2626',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px'
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#fee2e2'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#fef2f2'; }}
                              title="Verwijder dit zoekwoord en bijbehorende prompts definitief"
                            >
                              <Trash2 size={13} />
                              Verwijderen
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ fontSize: '13px', color: '#9ca3af', padding: '16px', fontStyle: 'italic', textAlign: 'center', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb', marginTop: '10px' }}>
                Er zijn momenteel geen gearchiveerde zoekwoorden voor dit project.
              </p>
            )
          )}
        </div>
      )}
    </div>
  );
}
