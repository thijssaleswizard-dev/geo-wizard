import React, { useState, useEffect, useRef } from 'react';
import PromptReport from './PromptReport';
import {
  ChevronRight, ChevronDown, ChevronUp, Plus, Search, Trash2, Archive, RotateCcw,
  Sparkles, Play, Edit2, X, AlertTriangle, Loader2,
  ArrowLeft, ArrowRight, Download, Share2, RotateCw, RefreshCw, FileText, History, Check
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
    } catch (e) { }
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
  const [standalonePrompts, setStandalonePrompts] = useState([]);
  const [mainViewTab, setMainViewTab] = useState('all_prompts');
  const [projectInfo, setProjectInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedKeyword, setSelectedKeyword] = useState(null);
  const [detailTab, setDetailTab] = useState('rankings');
  const [editPromptModes, setEditPromptModes] = useState({});
  const [customPromptInputs, setCustomPromptInputs] = useState({});
  const [generatingPromptsForKw, setGeneratingPromptsForKw] = useState({});
  const [recommending, setRecommending] = useState(false);
  const [keywordInput, setKeywordInput] = useState('');
  const [directPromptKeywordId, setDirectPromptKeywordId] = useState('');
  const [generateAiPromptsOnAdd, setGenerateAiPromptsOnAdd] = useState(false);
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
  const [editingPromptId, setEditingPromptId] = useState(null);
  const [editingPromptText, setEditingPromptText] = useState('');
  const [savingEditedPrompt, setSavingEditedPrompt] = useState(false);
  const [resettingNulmeting, setResettingNulmeting] = useState(false);
  const [nulmetingBanner, setNulmetingBanner] = useState(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportKeywordId, setReportKeywordId] = useState(null);
  const [addingPromptsBusy, setAddingPromptsBusy] = useState(false);
  const [bulkRescrapingBusy, setBulkRescrapingBusy] = useState(false);
  const [rescrapingAllPrompts, setRescrapingAllPrompts] = useState(false);
  const [progressTick, setProgressTick] = useState(() => Date.now());
  const [crawlFinishedFlash, setCrawlFinishedFlash] = useState(null);

  const scanStartedAtRef = useRef({});
  const sessionPromptIdsRef = useRef(new Set());
  const sessionMaxPctRef = useRef(0);
  const sessionPrepStartedAtRef = useRef(null);
  const pollInFlightRef = useRef(false);
  const wasWorkActiveRef = useRef(false);
  const wasActionInFlightRef = useRef(false);

  const formatPromptFromApi = (p) => ({
    id: p.id,
    keyword_id: p.keyword_id || null,
    keyword_text: p.keyword_text || null,
    text: p.prompt_text || p.text || '',
    status: p.status || (p.results ? (p.brand_mentioned ? 'Cited' : 'Not Cited') : 'pending'),
    processingElapsedSec: Number(p.processingElapsedSec || 0),
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
  });

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
    prompts: (k.prompts || []).map(formatPromptFromApi)
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
      if (data.success) {
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
    setBulkRescrapingBusy(true);
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
              prompts: (k.prompts || []).map(p => ({ ...p, status: 'pending', processingElapsedSec: 0 }))
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
    } finally {
      setBulkRescrapingBusy(false);
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

        setKeywords(prev => prev.map(k => ({
          ...k,
          prompts: (k.prompts || []).map(updatePromptObj)
        })));

        setStandalonePrompts(prev => prev.map(updatePromptObj));

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

  const isPromptActivelyCrawling = (p) => Boolean(
    p && (
      scanningPrompts[p.id] ||
      p.status === 'pending' ||
      p.status === 'processing' ||
      p.status === 'crawling'
    )
  );

  const allUniquePromptsMap = (() => {
    const map = new Map();
    (standalonePrompts || []).forEach(p => {
      if (p?.id) map.set(p.id, p);
    });
    (keywords || []).forEach(k => {
      (k.prompts || []).forEach(p => {
        if (p?.id) map.set(p.id, p);
      });
    });
    return map;
  })();

  const activeCrawlingPrompts = Array.from(allUniquePromptsMap.values()).filter(isPromptActivelyCrawling);
  const hasAnyKeywordCrawling = (keywords || []).some(k => Boolean(k?.is_crawling));
  const hasAnyActionInFlight = Boolean(
    addingPromptsBusy ||
    bulkRescrapingBusy ||
    rescrapingAllPrompts ||
    resettingNulmeting ||
    savingEditedPrompt ||
    Object.values(scanningPrompts || {}).some(Boolean) ||
    Object.values(rescrapingKeywords || {}).some(Boolean) ||
    Object.values(generatingPromptsForKw || {}).some(Boolean)
  );
  const isAnyWorkActive = activeCrawlingPrompts.length > 0 || hasAnyKeywordCrawling || hasAnyActionInFlight;

  const getPromptLiveProgress = (p) => {
    if (!p || !isPromptActivelyCrawling(p)) {
      return { active: false, mode: 'done', pct: 100, label: 'Voltooid' };
    }
    const isProcessingNow = Boolean(
      scanningPrompts[p.id] ||
      p.status === 'processing' ||
      p.status === 'crawling'
    );
    if (!isProcessingNow) {
      return { active: true, mode: 'pending', pct: 6, label: 'In wachtrij' };
    }

    const serverElapsedMs = Math.max(0, Number(p.processingElapsedSec || 0) * 1000);
    const nowMs = Math.max(Date.now(), progressTick);
    const existingStart = scanStartedAtRef.current[p.id];
    const impliedStartFromServer = nowMs - serverElapsedMs;
    const startMs = existingStart
      ? Math.min(existingStart, impliedStartFromServer)
      : impliedStartFromServer;
    scanStartedAtRef.current[p.id] = startMs;

    const elapsedSec = Math.max(0, (nowMs - startMs) / 1000);
    // Smooth asymptotic curve: starts at 10%, ~40% at 12s, ~65% at 30s, ~86% at 65s, caps at 94% until server reports completion
    const pct = Math.min(94, Math.max(10, Math.round(10 + 84 * (1 - Math.exp(-elapsedSec / 28)))));
    return { active: true, mode: 'processing', pct, label: 'Live crawlen' };
  };

  // Keep per-prompt start timestamps & session batch set synchronized
  useEffect(() => {
    const prevSize = sessionPromptIdsRef.current.size;
    activeCrawlingPrompts.forEach(p => {
      if (p?.id) sessionPromptIdsRef.current.add(p.id);
    });
    const newSize = sessionPromptIdsRef.current.size;
    if (prevSize > 0 && newSize > prevSize && sessionMaxPctRef.current > 0) {
      sessionMaxPctRef.current = Math.max(5, Math.round(sessionMaxPctRef.current * (prevSize / newSize)));
    }

    Object.keys(scanStartedAtRef.current).forEach(pid => {
      const numId = Number(pid);
      const pObj = allUniquePromptsMap.get(numId) || allUniquePromptsMap.get(pid);
      if (!pObj || !isPromptActivelyCrawling(pObj)) {
        delete scanStartedAtRef.current[pid];
      }
    });
  }, [keywords, standalonePrompts, scanningPrompts]);

  // Smooth 500ms progress animation tick + 100% completion flash when crawl finishes
  useEffect(() => {
    if (isAnyWorkActive) {
      if (!wasWorkActiveRef.current) {
        wasWorkActiveRef.current = true;
        sessionPrepStartedAtRef.current = Date.now();
        setCrawlFinishedFlash(null);
      }
      setProgressTick(Date.now());
      const tickInterval = setInterval(() => {
        setProgressTick(Date.now());
      }, 500);
      return () => clearInterval(tickInterval);
    }

    if (wasWorkActiveRef.current) {
      const completedTotal = Math.max(1, sessionPromptIdsRef.current.size);
      wasWorkActiveRef.current = false;
      sessionPromptIdsRef.current = new Set();
      sessionMaxPctRef.current = 0;
      sessionPrepStartedAtRef.current = null;
      scanStartedAtRef.current = {};
      setCrawlingStatus(null);
      setCrawlFinishedFlash({
        count: completedTotal,
        message: `Alle AI crawls & merk-analyses zijn voltooid (${completedTotal} prompt${completedTotal === 1 ? '' : 's'})`
      });
      const clearTimer = setTimeout(() => setCrawlFinishedFlash(null), 4500);
      return () => clearTimeout(clearTimer);
    }
  }, [isAnyWorkActive]);

  const buildKeywordsApiUrl = (workspaceName) => {
    const params = new URLSearchParams();
    if (workspaceName) params.set('company', workspaceName);
    if (currentUser?.id) params.set('userId', String(currentUser.id));
    if (currentUser?.role) params.set('role', String(currentUser.role));
    return `/api/keywords?${params.toString()}`;
  };

  const pollWorkspaceKeywords = async (workspaceName) => {
    if (pollInFlightRef.current) return;
    pollInFlightRef.current = true;
    try {
      const res = await fetch(buildKeywordsApiUrl(workspaceName));
      const data = await res.json();
      if (data.success) {
        if (data.project) {
          setProjectInfo(data.project);
        }
        const formatted = (data.keywords || []).map(formatKeywordFromApi);
        const formattedStandalone = (data.standalonePrompts || []).map(formatPromptFromApi);
        setKeywords(formatted);
        setStandalonePrompts(formattedStandalone);
        setSelectedKeyword(prev => prev ? (formatted.find(f => f.id === prev.id) || prev) : null);
        const activeCount = formatted.filter(f => !f.is_archived).reduce((acc, f) => acc + (f.prompts || []).length, 0) + formattedStandalone.length;
        setTotalUsedPrompts(typeof data.totalUsedPrompts === 'number' ? data.totalUsedPrompts : activeCount);
      }
    } catch (err) {
      console.error('Polling error:', err);
    } finally {
      pollInFlightRef.current = false;
    }
  };

  // Continuous background polling FOR AS LONG AS any prompt crawl, keyword scrape, or setup action is active
  useEffect(() => {
    const workspace = activeWorkspace || 'Saleswizard.nl';
    if (!isAnyWorkActive) return;

    const initialKick = setTimeout(() => {
      pollWorkspaceKeywords(workspace);
    }, 800);

    const interval = setInterval(() => {
      pollWorkspaceKeywords(workspace);
    }, 2000);

    return () => {
      clearTimeout(initialKick);
      clearInterval(interval);
    };
  }, [isAnyWorkActive, activeWorkspace]);

  // Trigger an immediate refresh when an in-flight setup/rescrape request finishes so newly queued prompts are picked up immediately
  useEffect(() => {
    if (wasActionInFlightRef.current && !hasAnyActionInFlight) {
      const workspace = activeWorkspace || 'Saleswizard.nl';
      pollWorkspaceKeywords(workspace);
    }
    wasActionInFlightRef.current = hasAnyActionInFlight;
  }, [hasAnyActionInFlight, activeWorkspace]);

  // Fetch active keywords & standalone prompts from DB when switching workspace
  useEffect(() => {
    setLoading(true);
    setSelectedKeyword(null);
    sessionPromptIdsRef.current = new Set();
    sessionMaxPctRef.current = 0;
    sessionPrepStartedAtRef.current = null;
    scanStartedAtRef.current = {};
    wasWorkActiveRef.current = false;
    setCrawlFinishedFlash(null);

    const workspace = activeWorkspace || (currentUser?.role === 'klant' ? (currentUser?.company || '') : 'Saleswizard.nl');
    fetch(buildKeywordsApiUrl(workspace))
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          if (data.project) {
            setProjectInfo(data.project);
          }
          const formatted = (data.keywords || []).map(formatKeywordFromApi);
          const formattedStandalone = (data.standalonePrompts || []).map(formatPromptFromApi);
          setKeywords(formatted);
          setStandalonePrompts(formattedStandalone);

          const activeCount = formatted.filter(f => !f.is_archived).reduce((acc, f) => acc + (f.prompts || []).length, 0) + formattedStandalone.length;
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
  // Prompts zijn niet langer gelimiteerd; extra prompts brengen wel extra kosten met zich mee
  const isLimitReached = false;

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
      navigator.clipboard.writeText(summaryText).catch(() => { });
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
    if (!isStaffOrAdmin) return;

    const rawKeywords = keywordInput.split(',').map(k => k.trim()).filter(Boolean);
    const customLines = customPromptsOnAdd
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean);

    if (rawKeywords.length === 0 && customLines.length === 0) {
      return;
    }

    setLimitAlert(null);
    const workspace = activeWorkspace || 'Saleswizard.nl';
    const targetExistingKwId = directPromptKeywordId ? Number(directPromptKeywordId) : null;

    setAddingPromptsBusy(true);
    try {
      setIsAdding(false);
      setKeywordInput('');
      setCustomPromptsOnAdd('');
      setDirectPromptKeywordId('');

      let totalCreatedPromptsCount = 0;

      // Case 1: Geen nieuwe zoektermen opgegeven -> voeg prompts direct toe (als losse prompts of gekoppeld aan gekozen zoekterm)
      if (rawKeywords.length === 0 && customLines.length > 0) {
        const createdDirectPrompts = [];
        for (const cLine of customLines) {
          const pResponse = await fetch('/api/prompts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              company: workspace,
              text: cLine,
              tag: 'Custom',
              keyword_id: targetExistingKwId || null,
              userId: currentUser?.id,
              role: currentUser?.role
            })
          });
          const pData = await pResponse.json();
          if (pData.success) {
            totalCreatedPromptsCount++;
            createdDirectPrompts.push(formatPromptFromApi({
              ...pData.prompt,
              status: 'pending',
              engines: ['chatgpt', 'gemini', 'perplexity']
            }));
          }
        }

        if (createdDirectPrompts.length > 0) {
          if (targetExistingKwId) {
            setKeywords(prev => prev.map(k => k.id === targetExistingKwId ? {
              ...k,
              is_crawling: true,
              prompts: [...(k.prompts || []), ...createdDirectPrompts]
            } : k));
          } else {
            setStandalonePrompts(prev => [...createdDirectPrompts, ...prev]);
          }
          setTotalUsedPrompts(prev => prev + totalCreatedPromptsCount);
        }
        return;
      }

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
    } finally {
      setAddingPromptsBusy(false);
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
          const activeCount = next.filter(k => !k.is_archived).reduce((acc, k) => acc + (k.prompts || []).length, 0) + standalonePrompts.length;
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
    } catch (e) { }
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

    setLimitAlert(null);
    setAddingPromptsBusy(true);

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
    } finally {
      setAddingPromptsBusy(false);
    }
  };

  const handleGenerateAiPromptsForKeyword = async (kw) => {
    if (!isStaffOrAdmin || !kw) return;
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
    if (!window.confirm('Weet u zeker dat u deze prompt definitief wilt verwijderen?')) return;

    try {
      const params = new URLSearchParams({
        userId: String(currentUser?.id || ''),
        role: String(currentUser?.role || 'medewerker')
      });
      const res = await fetch(`/api/prompts/${promptId}?${params.toString()}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setStandalonePrompts(prev => prev.filter(p => p.id !== promptId));

        setKeywords(prev => {
          const next = prev.map(k => {
            if (!kwId || k.id === kwId) {
              return {
                ...k,
                prompts: (k.prompts || []).filter(p => p.id !== promptId)
              };
            }
            return k;
          });
          const activeCount = next.filter(k => !k.is_archived).reduce((acc, k) => acc + (k.prompts || []).length, 0) + standalonePrompts.filter(p => p.id !== promptId).length;
          setTotalUsedPrompts(typeof data.totalUsedPrompts === 'number' ? data.totalUsedPrompts : activeCount);
          return next;
        });

        if (selectedKeyword && (!kwId || selectedKeyword.id === kwId)) {
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

  const handleSaveEditedPrompt = async (promptObj, startNewNulmeting = true) => {
    if (!isStaffOrAdmin || !promptObj || !editingPromptText.trim()) return;
    setSavingEditedPrompt(true);
    try {
      const res = await fetch(`/api/prompts/${promptObj.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: editingPromptText.trim(),
          reset_nulmeting: startNewNulmeting,
          rescan: startNewNulmeting,
          userId: currentUser?.id,
          role: currentUser?.role
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const newText = editingPromptText.trim();
        const updateP = (p) => {
          if (p.id !== promptObj.id) return p;
          if (startNewNulmeting) {
            return {
              ...p,
              text: newText,
              status: 'pending',
              history: [],
              baseline: null
            };
          }
          return { ...p, text: newText };
        };

        setKeywords(prev => prev.map(k => ({
          ...k,
          is_crawling: startNewNulmeting && (k.prompts || []).some(p => p.id === promptObj.id) ? true : k.is_crawling,
          prompts: (k.prompts || []).map(updateP)
        })));
        setStandalonePrompts(prev => prev.map(updateP));
        if (selectedKeyword) {
          setSelectedKeyword(prev => ({
            ...prev,
            is_crawling: startNewNulmeting ? true : prev.is_crawling,
            prompts: (prev.prompts || []).map(updateP)
          }));
        }
        setEditingPromptId(null);
        setEditingPromptText('');
        if (startNewNulmeting) {
          setNulmetingBanner({
            message: `Prompt gewijzigd en nieuwe 0-meting gestart voor "${newText}".`
          });
          setTimeout(() => setNulmetingBanner(null), 6000);
        }
      } else {
        alert(data.error || 'Fout bij opslaan van gewijzigde prompt.');
      }
    } catch (err) {
      console.error('Failed to edit prompt:', err);
    } finally {
      setSavingEditedPrompt(false);
    }
  };

  const handleRescrapeAllPrompts = async () => {
    if (!isStaffOrAdmin || allPromptsList.length === 0) return;
    setRescrapingAllPrompts(true);
    const workspace = activeWorkspace || 'Saleswizard.nl';
    try {
      const res = await fetch('/api/prompts/rescrape-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: workspace,
          userId: currentUser?.id,
          role: currentUser?.role
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setKeywords(prev => prev.map(k => {
          if (k.is_archived) return k;
          const hasPrompts = (k.prompts || []).length > 0;
          return {
            ...k,
            is_crawling: hasPrompts ? true : k.is_crawling,
            prompts: (k.prompts || []).map(p => ({ ...p, status: 'pending', processingElapsedSec: 0 }))
          };
        }));
        setStandalonePrompts(prev => prev.map(p => ({ ...p, status: 'pending', processingElapsedSec: 0 })));
        if (selectedKeyword && !selectedKeyword.is_archived) {
          setSelectedKeyword(prev => ({
            ...prev,
            is_crawling: true,
            prompts: (prev.prompts || []).map(p => ({ ...p, status: 'pending', processingElapsedSec: 0 }))
          }));
        }
      } else {
        alert(data.error || 'Fout bij opnieuw scrapen van alle prompts.');
      }
    } catch (err) {
      console.error('Failed to rescrape all prompts:', err);
      alert('Kan geen verbinding maken met de server.');
    } finally {
      setRescrapingAllPrompts(false);
    }
  };

  const handleStartNewNulmeting = async ({ keywordId = null, promptIds = null, label = 'dit project' } = {}) => {
    if (!isStaffOrAdmin) return;
    if (!window.confirm(`Weet u zeker dat u handmatig een nieuwe 0-meting wilt starten voor ${label}?\n\nDe bestaande metingshistorie wordt gereset en de prompts worden direct opnieuw gescand als nieuw startpunt (Nulmeting).`)) {
      return;
    }

    setResettingNulmeting(true);
    const workspace = activeWorkspace || 'Saleswizard.nl';
    try {
      const res = await fetch('/api/prompts/reset-nulmeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: workspace,
          keyword_id: keywordId,
          prompt_ids: promptIds,
          rescan: true,
          userId: currentUser?.id,
          role: currentUser?.role
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const shouldResetPrompt = (p, kwId) => {
          if (Array.isArray(promptIds) && promptIds.length > 0) {
            return promptIds.includes(p.id);
          }
          if (keywordId) {
            return kwId === keywordId;
          }
          return true;
        };

        setKeywords(prev => prev.map(k => {
          const resetKw = !promptIds && (!keywordId || k.id === keywordId);
          return {
            ...k,
            is_crawling: resetKw || (k.prompts || []).some(p => shouldResetPrompt(p, k.id)) ? true : k.is_crawling,
            history: resetKw ? [] : k.history,
            baseline: resetKw ? null : k.baseline,
            prompts: (k.prompts || []).map(p => shouldResetPrompt(p, k.id) ? {
              ...p,
              status: 'pending',
              history: [],
              baseline: null
            } : p)
          };
        }));

        setStandalonePrompts(prev => prev.map(p => shouldResetPrompt(p, null) ? {
          ...p,
          status: 'pending',
          history: [],
          baseline: null
        } : p));

        if (selectedKeyword && (!keywordId || selectedKeyword.id === keywordId)) {
          setSelectedKeyword(prev => ({
            ...prev,
            is_crawling: true,
            history: !promptIds ? [] : prev.history,
            baseline: !promptIds ? null : prev.baseline,
            prompts: (prev.prompts || []).map(p => shouldResetPrompt(p, prev.id) ? {
              ...p,
              status: 'pending',
              history: [],
              baseline: null
            } : p)
          }));
        }

        setNulmetingBanner({
          message: data.message || `Nieuwe 0-meting is gestart voor ${label}! De prompts worden nu live gescand.`
        });
        setTimeout(() => setNulmetingBanner(null), 7000);
      } else {
        alert(data.error || 'Fout bij starten van nieuwe 0-meting.');
      }
    } catch (err) {
      console.error('Failed to reset 0-meting:', err);
    } finally {
      setResettingNulmeting(false);
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

  const activeKeywords = keywords.filter(kw => !kw.is_archived);

  const allPromptsList = [
    ...(standalonePrompts || []).map(p => ({ ...p, _keywordObj: null })),
    ...activeKeywords.flatMap(kw => (kw.prompts || []).map(p => ({ ...p, _keywordObj: kw })))
  ];

  const filteredAllPrompts = allPromptsList.filter(p => {
    if (!searchQuery || !searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchText = p.text ? String(p.text).toLowerCase().includes(q) : false;
    const matchKw = p._keywordObj?.text ? String(p._keywordObj.text).toLowerCase().includes(q) : false;
    return matchText || matchKw;
  });

  const filteredKeywords = keywords.filter(kw =>
    !kw.is_archived && (kw && kw.text ? String(kw.text).toLowerCase().includes((searchQuery || '').toLowerCase()) : false)
  );

  const archivedKeywords = keywords.filter(kw =>
    kw.is_archived && (kw && kw.text ? String(kw.text).toLowerCase().includes((searchQuery || '').toLowerCase()) : false)
  );

  const renderNulmetingBanner = () => {
    if (!nulmetingBanner) return null;
    return (
      <div style={{
        backgroundColor: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
        padding: '12px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#0f172a', fontSize: '13px', fontWeight: 600 }}>
          <RefreshCw size={15} style={{ color: '#64748b' }} />
          <span>{nulmetingBanner.message}</span>
        </div>
        <button
          type="button"
          onClick={() => setNulmetingBanner(null)}
          style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}
        >
          <X size={15} />
        </button>
      </div>
    );
  };

  const renderLiveCrawlProgressBanner = () => {
    if (!isAnyWorkActive && !crawlFinishedFlash) return null;

    if (!isAnyWorkActive && crawlFinishedFlash) {
      return (
        <div style={{
          position: 'sticky',
          top: '12px',
          zIndex: 30,
          backgroundColor: '#ffffff',
          border: '1px solid #cbd5e1',
          borderRadius: '10px',
          padding: '14px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          boxShadow: '0 4px 14px rgba(15, 23, 42, 0.06)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a', fontSize: '13px', fontWeight: 600 }}>
              <Check size={16} style={{ color: '#47ca9b' }} />
              <span>{crawlFinishedFlash.message}</span>
            </div>
            <span style={{
              fontSize: '13.5px',
              fontWeight: 700,
              color: '#0f172a',
              fontVariantNumeric: 'tabular-nums'
            }}>
              100%
            </span>
          </div>
          <div style={{
            width: '100%',
            height: '5px',
            borderRadius: '999px',
            backgroundColor: '#f1f5f9',
            overflow: 'hidden'
          }}>
            <div style={{
              width: '100%',
              height: '100%',
              borderRadius: '999px',
              backgroundColor: '#47ca9b',
              transition: 'width 0.35s ease'
            }} />
          </div>
        </div>
      );
    }

    // Active crawl / scrape / prompt setup computation
    const sessionIds = Array.from(sessionPromptIdsRef.current);
    activeCrawlingPrompts.forEach(p => {
      if (p?.id && !sessionIds.includes(p.id)) {
        sessionIds.push(p.id);
      }
    });

    const sessionTotal = sessionIds.length;
    let processingCount = 0;
    let pendingCount = 0;
    let completedInSession = 0;
    let sumPct = 0;

    sessionIds.forEach(pid => {
      const pObj = allUniquePromptsMap.get(pid);
      if (!pObj || !isPromptActivelyCrawling(pObj)) {
        completedInSession++;
        sumPct += 100;
      } else {
        const prog = getPromptLiveProgress(pObj);
        sumPct += prog.pct;
        if (prog.mode === 'processing') processingCount++;
        else pendingCount++;
      }
    });

    let computedPct = 8;
    if (sessionTotal > 0) {
      computedPct = Math.min(96, Math.max(6, Math.round(sumPct / sessionTotal)));
    } else {
      const prepStart = sessionPrepStartedAtRef.current || Date.now();
      const prepSec = Math.max(0, (Math.max(Date.now(), progressTick) - prepStart) / 1000);
      computedPct = Math.min(28, Math.max(6, Math.round(6 + 22 * (1 - Math.exp(-prepSec / 8)))));
    }

    const displayPct = Math.min(96, Math.max(sessionMaxPctRef.current, computedPct));
    sessionMaxPctRef.current = displayPct;

    let headline = 'Live AI crawl & scrape bezig...';
    let subline = 'ChatGPT, Gemini, Google AI Mode, AI Overviews, Perplexity en Claude analyseren het web. Resultaten worden elke 2s bijgewerkt.';

    if (sessionTotal === 0) {
      if (resettingNulmeting) {
        headline = 'Nieuwe 0-meting wordt ingepland...';
      } else if (rescrapingAllPrompts) {
        headline = 'Alle prompts worden ingepland voor een nieuwe scrape...';
      } else if (addingPromptsBusy || Object.values(generatingPromptsForKw || {}).some(Boolean)) {
        headline = 'Prompts en concurrenten worden voorbereid...';
      } else if (bulkRescrapingBusy || Object.values(rescrapingKeywords || {}).some(Boolean)) {
        headline = 'Zoektermen en prompts worden ingeladen...';
      }
    } else if (sessionTotal === 1) {
      headline = processingCount > 0
        ? '1 prompt wordt nu live gescand in de AI-zoekmachines'
        : '1 prompt staat klaar in de wachtrij';
    } else {
      const parts = [];
      if (processingCount > 0) parts.push(`${processingCount} aan het scannen`);
      if (pendingCount > 0) parts.push(`${pendingCount} in wachtrij`);
      headline = `Crawl bezig — ${completedInSession} van ${sessionTotal} prompts voltooid${parts.length ? ` (${parts.join(' · ')})` : ''}`;
    }

    return (
      <div style={{
        position: 'sticky',
        top: '12px',
        zIndex: 30,
        backgroundColor: '#ffffff',
        border: '1px solid #cbd5e1',
        borderRadius: '10px',
        padding: '14px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        boxShadow: '0 4px 16px rgba(15, 23, 42, 0.06)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '240px' }}>
            <Loader2 size={18} className="spin" style={{ color: '#0f172a', flexShrink: 0 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                  {headline}
                </span>
                <span style={{
                  fontSize: '10.5px',
                  fontWeight: 600,
                  color: '#475569',
                  backgroundColor: '#f1f5f9',
                  padding: '1px 8px',
                  borderRadius: '999px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}>
                  <span style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: '#47ca9b',
                    display: 'inline-block'
                  }} />
                  Live polling
                </span>
              </div>
              <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                {subline}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            {sessionTotal > 1 && (
              <span style={{
                fontSize: '11.5px',
                fontWeight: 600,
                color: '#475569',
                backgroundColor: '#f1f5f9',
                padding: '2px 9px',
                borderRadius: '6px',
                fontVariantNumeric: 'tabular-nums'
              }}>
                {completedInSession} / {sessionTotal}
              </span>
            )}
            <span style={{
              fontSize: '17px',
              fontWeight: 800,
              color: '#0f172a',
              fontVariantNumeric: 'tabular-nums',
              minWidth: '44px',
              textAlign: 'right'
            }}>
              {displayPct}%
            </span>
          </div>
        </div>

        <div style={{
          width: '100%',
          height: '5px',
          borderRadius: '999px',
          backgroundColor: '#f1f5f9',
          overflow: 'hidden'
        }}>
          <div style={{
            width: `${displayPct}%`,
            height: '100%',
            borderRadius: '999px',
            backgroundColor: '#440099',
            transition: 'width 0.45s ease'
          }} />
        </div>
      </div>
    );
  };

  const renderSinglePromptCard = (p, pIdx, kwContext = null, showEditActions = false) => {
    const promptKey = p.id || `p_${pIdx}`;
    const isOpen = !!expandedPrompts[promptKey];
    const isCrawling = isPromptActivelyCrawling(p);
    const liveProg = getPromptLiveProgress(p);
    const isMentioned = p.status === 'Cited' || p.mentioned;
    const brandsCount = p.brandsCount || (isMentioned ? (p.citations ? p.citations.length + 3 : 5) : 0);
    const sourcesCount = p.sourcesCount || (p.citations ? p.citations.length : 0);
    const mData = p.modelMentions || {};
    const isEditingThis = editingPromptId === p.id;

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
        displayDate: p.lastUpdated || kwContext?.last_updated || 'Nulmeting',
        isBaseline: true,
        label: 'Nulmeting',
        mentioned: isMentioned,
        position: p.position && p.position !== '-' ? p.position : (isMentioned ? kwContext?.position || '#1' : '-'),
        totalMentions: p.totalMentions ?? (isMentioned ? 2 : 0),
        totalModels: p.totalModels ?? Math.max(1, enginesList.length || 4),
        overallScore: p.overallScore ?? (isMentioned ? 50 : 0)
      }];
    const promptBaseline = p.baseline || promptHistory[0];

    return (
      <div
        key={promptKey}
        style={{
          backgroundColor: '#ffffff',
          border: isCrawling ? '1px solid #cbd5e1' : '1px solid #e5e7eb',
          borderRadius: '10px',
          overflow: 'hidden',
          transition: 'border-color 0.15s ease'
        }}
      >
        {/* Prompt Card Header */}
        <div
          style={{
            padding: '13px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#ffffff',
            cursor: isEditingThis ? 'default' : 'pointer',
            userSelect: 'none',
            gap: '12px',
            flexWrap: 'wrap'
          }}
          onClick={() => { if (!isEditingThis) toggleExpandedPrompt(promptKey); }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '240px', flexWrap: 'wrap' }}>
            {isEditingThis ? (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}
              >
                <input
                  type="text"
                  value={editingPromptText}
                  onChange={(e) => setEditingPromptText(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #64748b',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#0f172a'
                  }}
                  autoFocus
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    disabled={savingEditedPrompt || !editingPromptText.trim()}
                    onClick={() => handleSaveEditedPrompt(p, true)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      backgroundColor: '#440099',
                      color: '#ffffff',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {savingEditedPrompt ? 'Opslaan...' : 'Opslaan & nieuwe 0-meting'}
                  </button>
                  <button
                    type="button"
                    disabled={savingEditedPrompt || !editingPromptText.trim()}
                    onClick={() => handleSaveEditedPrompt(p, false)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      backgroundColor: '#ffffff',
                      color: '#374151',
                      fontSize: '11px',
                      fontWeight: 700,
                      border: '1px solid #d1d5db',
                      cursor: 'pointer'
                    }}
                  >
                    Alleen tekst opslaan
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditingPromptId(null); setEditingPromptText(''); }}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '6px',
                      backgroundColor: 'transparent',
                      color: '#6b7280',
                      fontSize: '11px',
                      fontWeight: 600,
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    Annuleren
                  </button>
                </div>
              </div>
            ) : (
              <>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>
                  {p.text}
                </span>
                {!selectedKeyword && (
                  kwContext ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedKeyword(kwContext);
                        setDetailTab('rankings');
                      }}
                      title="Open zoekterm details & concurrentierankings"
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '2px 10px',
                        borderRadius: '12px',
                        backgroundColor: '#f3f4f6',
                        color: '#374151',
                        border: '1px solid #e5e7eb',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      🔍 {kwContext.text}
                    </button>
                  ) : (
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '2px 10px',
                      borderRadius: '12px',
                      backgroundColor: '#f8fafc',
                      color: '#64748b',
                      border: '1px solid #e2e8f0'
                    }}>
                      Losse prompt
                    </span>
                  )
                )}
                {isCrawling && (
                  <span style={{
                    fontSize: '11px',
                    padding: '2px 9px',
                    borderRadius: '6px',
                    backgroundColor: '#f8fafc',
                    color: '#334155',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    border: '1px solid #e2e8f0',
                    fontVariantNumeric: 'tabular-nums'
                  }}>
                    <Loader2 size={11} className="spin" style={{ color: '#475569' }} />
                    {liveProg.mode === 'processing' ? `Crawlen · ${liveProg.pct}%` : `Wachtrij · ${liveProg.pct}%`}
                  </span>
                )}
              </>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {isCrawling ? (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: '#ffffff',
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{
                  width: '64px',
                  height: '5px',
                  borderRadius: '999px',
                  backgroundColor: '#e2e8f0',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${liveProg.pct}%`,
                    height: '100%',
                    borderRadius: '999px',
                    backgroundColor: '#440099',
                    transition: 'width 0.45s ease'
                  }} />
                </div>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#0f172a',
                  fontVariantNumeric: 'tabular-nums'
                }}>
                  {liveProg.pct}%
                </span>
              </div>
            ) : (
              <>
                {p.status === 'failed' ? (
                  <span style={{
                    fontSize: '11.5px',
                    fontWeight: 600,
                    color: '#475569',
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    padding: '2px 9px',
                    borderRadius: '6px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
                    Mislukt
                  </span>
                ) : isMentioned ? (
                  <span style={{
                    fontSize: '11.5px',
                    fontWeight: 600,
                    color: '#0f172a',
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    padding: '2px 10px',
                    borderRadius: '6px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#47ca9b' }} />
                    Vermeld {p.position && p.position !== '-' ? `(${p.position})` : ''}
                  </span>
                ) : (
                  <span style={{
                    fontSize: '11.5px',
                    fontWeight: 500,
                    color: '#64748b',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    padding: '2px 10px',
                    borderRadius: '6px'
                  }}>
                    Niet vermeld
                  </span>
                )}

                <span style={{
                  fontSize: '11.5px',
                  fontWeight: 500,
                  color: '#64748b',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  padding: '2px 10px',
                  borderRadius: '999px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span>0-meting: <strong style={{ color: '#334155', fontWeight: 600 }}>{promptBaseline?.mentioned ? (promptBaseline?.position && promptBaseline.position !== '-' ? promptBaseline.position : 'Vermeld') : '—'}</strong></span>
                  <span style={{ color: '#cbd5e1' }}>·</span>
                  <span>{brandsCount} merken</span>
                  <span style={{ color: '#cbd5e1' }}>·</span>
                  <span>{sourcesCount} bronnen</span>
                </span>
              </>
            )}

            {!isReadOnly && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => {
                    setEditingPromptId(p.id);
                    setEditingPromptText(p.text || '');
                  }}
                  title="Prompt tekst wijzigen (en optioneel nieuwe 0-meting starten)"
                  style={{
                    padding: '5px 8px',
                    borderRadius: '6px',
                    border: '1px solid #e5e7eb',
                    backgroundColor: '#ffffff',
                    color: '#374151',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Edit2 size={12} />
                </button>
                <button
                  type="button"
                  disabled={isCrawling || resettingNulmeting}
                  onClick={() => handleStartNewNulmeting({ promptIds: [p.id], label: `prompt "${p.text}"` })}
                  title="Optioneel: nieuwe 0-meting starten voor deze prompt (wist bestaande historie)"
                  style={{
                    padding: '5px 7px',
                    borderRadius: '6px',
                    border: '1px solid #e5e7eb',
                    backgroundColor: '#f9fafb',
                    color: '#6b7280',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: (isCrawling || resettingNulmeting) ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px'
                  }}
                >
                  <RefreshCw size={11} />
                </button>
                <button
                  type="button"
                  disabled={isCrawling}
                  onClick={() => handleRunPromptScan(p.id, p.text)}
                  title="Deze prompt opnieuw scrapen (behoudt 0-meting)"
                  style={{
                    padding: '5px 11px',
                    borderRadius: '6px',
                    backgroundColor: isCrawling ? '#334155' : '#0f172a',
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    cursor: isCrawling ? 'not-allowed' : 'pointer',
                    border: 'none',
                    fontVariantNumeric: 'tabular-nums'
                  }}
                >
                  {isCrawling ? <Loader2 size={12} className="spin" /> : <Play size={11} />}
                  {isCrawling ? `${liveProg.pct}%` : 'Crawl'}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeletePrompt(kwContext?.id || null, p.id)}
                  title="Prompt definitief verwijderen"
                  style={{
                    padding: '5px',
                    borderRadius: '6px',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    backgroundColor: 'transparent',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#dc2626'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; }}
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

        {/* Full-width per-prompt progress bar along bottom of header whenever actively crawling */}
        {isCrawling && (
          <div style={{
            width: '100%',
            height: '3px',
            backgroundColor: '#f1f5f9',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${liveProg.pct}%`,
              height: '100%',
              backgroundColor: '#440099',
              transition: 'width 0.45s ease'
            }} />
          </div>
        )}

        {/* Engine Breakdown Rows + Per-Prompt History */}
        {isOpen && (
          <div style={{ borderTop: '1px solid #e5e7eb', backgroundColor: '#ffffff', padding: '4px 0' }}>
            {/* Calm Minimalist Nulmeting & Resultaten Historie Strip */}
            <div style={{
              margin: '12px 20px',
              padding: '12px 16px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: '#334155', fontSize: '12px', fontWeight: 600 }}>
                  <History size={15} style={{ color: '#64748b' }} />
                  <span>Nulmeting &amp; resultaten historie</span>
                  <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>
                    ({promptHistory.length} {promptHistory.length === 1 ? 'meting' : 'metingen'})
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11.5px', color: '#475569' }}>
                  <span>
                    0-meting:{' '}
                    <strong style={{ color: '#0f172a', fontWeight: 600 }}>
                      {promptBaseline?.mentioned
                        ? `Vermeld (${promptBaseline?.position && promptBaseline.position !== '-' ? promptBaseline.position : `${promptBaseline.totalMentions || 1}/${promptBaseline.totalModels || 6} AI`})`
                        : 'Niet vermeld'}
                    </strong>
                  </span>
                  <ArrowRight size={13} style={{ color: '#94a3b8' }} />
                  <span>
                    Actueel:{' '}
                    <strong style={{ color: isMentioned ? '#047857' : '#475569', fontWeight: 600 }}>
                      {isMentioned
                        ? `Vermeld (${p.position && p.position !== '-' ? p.position : `${p.totalMentions || 1}/${p.totalModels || 6} AI`})`
                        : 'Niet vermeld'}
                    </strong>
                  </span>
                </div>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                overflowX: 'auto',
                paddingBottom: '2px'
              }}>
                {promptHistory.map((hItem, hIdx) => {
                  const isBase = hIdx === 0 || !!hItem.isBaseline;
                  const posLabel = hItem.position && hItem.position !== '-'
                    ? hItem.position
                    : (hItem.mentioned ? `${hItem.totalMentions || 1}/${hItem.totalModels || 6} AI` : 'Niet vermeld');

                  return (
                    <React.Fragment key={hIdx}>
                      {hIdx > 0 && (
                        <div style={{ width: '14px', height: '1px', backgroundColor: '#cbd5e1', flexShrink: 0 }} />
                      )}
                      <div
                        title={`${isBase ? '0-meting' : `Meting ${hIdx + 1}`}: ${hItem.displayDate || hItem.date}`}
                        style={{
                          flex: '0 0 auto',
                          padding: '6px 11px',
                          backgroundColor: '#ffffff',
                          border: isBase ? '1px solid #cbd5e1' : '1px solid #e2e8f0',
                          borderRadius: '7px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '11.5px'
                        }}
                      >
                        <span style={{
                          width: '7px',
                          height: '7px',
                          borderRadius: '50%',
                          backgroundColor: hItem.mentioned ? '#47ca9b' : '#cbd5e1',
                          flexShrink: 0
                        }} />
                        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
                          <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 500 }}>
                            {isBase ? '0-meting · ' : ''}{formatCompactDate(hItem.displayDate || hItem.date)}
                          </span>
                          <span style={{ fontSize: '11.5px', fontWeight: 600, color: hItem.mentioned ? '#0f172a' : '#64748b', fontVariantNumeric: 'tabular-nums' }}>
                            {posLabel}
                          </span>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {isCrawling && (
              <div style={{
                margin: '12px 20px',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Loader2 size={15} className="spin" style={{ color: '#0f172a', flexShrink: 0 }} />
                    <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#0f172a' }}>
                      {liveProg.mode === 'processing'
                        ? 'Prompt wordt nu live uitgevoerd over alle gekoppelde AI-zoekmachines...'
                        : 'Prompt staat in de wachtrij en wordt zo dadelijk live gecrawld...'}
                    </span>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                    {liveProg.pct}%
                  </span>
                </div>
                <div style={{
                  width: '100%',
                  height: '5px',
                  borderRadius: '999px',
                  backgroundColor: '#e2e8f0',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${liveProg.pct}%`,
                    height: '100%',
                    borderRadius: '999px',
                    backgroundColor: '#440099',
                    transition: 'width 0.45s ease'
                  }} />
                </div>
                <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                  ChatGPT, Gemini, Google AI Mode, AI Overviews, Perplexity en Claude analyseren actuele citaties en merkvermeldingen.{p.modelMentions ? ' Hieronder ziet u nog de vorige meting tot de nieuwe scan op 100% staat.' : ' Resultaten verschijnen automatisch zodra de scan op 100% staat.'}
                </span>
              </div>
            )}

            {(!isCrawling || p.modelMentions) && (
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
                        backgroundColor: isEngExpanded ? '#f8fafc' : 'transparent'
                      }}
                      onClick={() => eng.summary && toggleExpandedEngine(promptKey, eng.id)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {EngineLogos[eng.id]}
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                          {eng.name}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px' }}>
                        {eng.unavailable ? (
                          <span
                            title={eng.errorMsg || 'Engine niet beschikbaar tijdens deze scan; telt niet mee in scores.'}
                            style={{
                              fontSize: '11.5px',
                              fontWeight: 500,
                              color: '#94a3b8',
                              cursor: 'help'
                            }}
                          >
                            Niet gemeten
                          </span>
                        ) : (
                          <>
                            <span style={{
                              fontSize: '11.5px',
                              fontWeight: eng.mentioned ? 600 : 500,
                              color: eng.mentioned ? '#047857' : '#94a3b8',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              {eng.mentioned && <Check size={13} />}
                              {eng.mentioned ? 'Vermeld' : 'Niet vermeld'}
                            </span>
                            <span style={{ color: '#cbd5e1' }}>·</span>
                            <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                              {eng.brands} merken · {eng.sources} bronnen
                            </span>
                          </>
                        )}
                        {eng.summary && (
                          <span style={{ color: '#94a3b8', display: 'inline-flex', alignItems: 'center' }}>
                            {isEngExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                          </span>
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
  };


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
        {reportModalOpen && (
          <PromptReport
            activeWorkspace={activeWorkspace}
            initialKeywordId={reportKeywordId}
            keywordsList={activeKeywords}
            isModal={true}
            onClose={() => setReportModalOpen(false)}
          />
        )}
        {renderPromptLimitAlert()}
        {renderNulmetingBanner()}
        {renderLiveCrawlProgressBanner()}

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
                fontSize: '11.5px',
                fontWeight: 500,
                padding: '2px 9px',
                borderRadius: '6px',
                backgroundColor: '#f8fafc',
                color: '#475569',
                border: '1px solid #e2e8f0'
              }}>
                0-meting: {kw.baseline.displayDate || kw.baseline.date}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {!isReadOnly && (
              <>
                <button
                  type="button"
                  onClick={() => handleStartNewNulmeting({ keywordId: kw.id, label: `zoekterm "${kw.text}"` })}
                  disabled={resettingNulmeting}
                  title="Optioneel: reset de historie en start een nieuwe 0-meting voor dit zoekwoord"
                  style={{
                    padding: '7px 11px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#ffffff',
                    color: '#64748b',
                    fontSize: '12px',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    cursor: resettingNulmeting ? 'not-allowed' : 'pointer'
                  }}
                >
                  <RefreshCw size={13} className={resettingNulmeting ? 'spin' : ''} />
                  0-meting
                </button>
                <button
                  type="button"
                  onClick={(e) => handleRescrapeKeyword(kw.id, e)}
                  disabled={rescrapingKeywords[kw.id]}
                  title="Alle prompts en concurrentierankings van deze zoekterm opnieuw scrapen (behoudt 0-meting)"
                  style={{
                    padding: '7px 13px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#f8fafc',
                    color: '#0f172a',
                    fontSize: '12px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: rescrapingKeywords[kw.id] ? 'not-allowed' : 'pointer'
                  }}
                >
                  <RotateCw size={13} className={rescrapingKeywords[kw.id] ? 'spin' : ''} />
                  {rescrapingKeywords[kw.id] ? 'Scrapen bezig...' : 'Opnieuw scrapen'}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteKeyword(kw)}
                  title="Zoekterm en gekoppelde prompts definitief verwijderen"
                  style={{
                    padding: '7px 12px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#ffffff',
                    color: '#b91c1c',
                    fontSize: '12px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    cursor: 'pointer'
                  }}
                >
                  <Trash2 size={13} />
                  Verwijderen
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => {
                setReportKeywordId(kw.id);
                setReportModalOpen(true);
              }}
              title="Open SalesWizard PDF Rapportage voor dit zoekwoord"
              style={{
                padding: '7px 13px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
                fontSize: '12px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                color: '#334155'
              }}
            >
              <FileText size={13} />
              Rapportage
            </button>
            <button
              type="button"
              style={{
                padding: '7px 13px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
                fontSize: '12px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                color: '#334155'
              }}
              onClick={() => handleExportKeywordCsv(kw)}
              title="Exporteer nulmeting, historie, rankings en prompts naar CSV (Excel)"
            >
              <Download size={13} />
              CSV
            </button>
            <button
              type="button"
              style={{
                padding: '7px 14px',
                borderRadius: '8px',
                backgroundColor: shareCopied ? '#047857' : '#0f172a',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                border: 'none'
              }}
              onClick={() => handleShareKeyword(kw)}
            >
              <Share2 size={13} />
              {shareCopied ? 'Gekopieerd' : 'Delen'}
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
                fontWeight: detailTab === t.id ? 600 : 500,
                color: detailTab === t.id ? '#440099' : '#64748b',
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
                  padding: '14px 18px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  backgroundColor: '#f8fafc',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>
                      <History size={15} style={{ color: '#64748b' }} />
                      <span>Positie &amp; Share of Voice historie</span>
                      <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>
                        ({rawHistory.length} {rawHistory.length === 1 ? 'meetpunt' : 'meetpunten'})
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setDetailTab('nulmeting')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#475569',
                        fontWeight: 600,
                        fontSize: '11.5px',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <span>Nulmeting overzicht</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    overflowX: 'auto',
                    paddingBottom: '2px'
                  }}>
                    {rawHistory.map((item, i) => {
                      const isFirst = i === 0 || !!item.isBaseline;
                      const itemSov = Number(item.sov ?? 0);

                      return (
                        <React.Fragment key={i}>
                          {i > 0 && (
                            <div style={{ width: '16px', height: '1px', backgroundColor: '#cbd5e1', flexShrink: 0 }} />
                          )}
                          <div
                            title={`${isFirst ? '0-meting' : `Meting ${i + 1}`}: ${item.displayDate || item.date}`}
                            style={{
                              flex: '0 0 auto',
                              minWidth: '125px',
                              padding: '8px 12px',
                              backgroundColor: '#ffffff',
                              border: '1px solid #e2e8f0',
                              borderRadius: '8px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '4px'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', fontSize: '10.5px', color: '#64748b' }}>
                              <span>{formatCompactDate(item.displayDate || item.date)}</span>
                              {isFirst && <span style={{ fontWeight: 600, color: '#475569' }}>0-meting</span>}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
                              <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                                {item.position && item.position !== '-' ? item.position : '—'}
                              </span>
                              <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', fontVariantNumeric: 'tabular-nums' }}>
                                {itemSov}% SOV
                              </span>
                            </div>
                          </div>
                        </React.Fragment>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  {/* Calm Header & Side-by-Side Comparison */}
                  <div style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '20px 24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '18px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                      <div>
                        <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                          Nulmeting &amp; voortgang
                        </h3>
                        <p style={{ fontSize: '12.5px', color: '#64748b', margin: '4px 0 0 0' }}>
                          Vergelijking van <strong>{kw.text}</strong> tussen het vastgelegde startpunt en de meest recente meting.
                        </p>
                      </div>
                      <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
                        Startpunt: <strong style={{ color: '#334155' }}>{baselinePoint?.displayDate || baselinePoint?.date || '—'}</strong> · {rawHistory.length} {rawHistory.length === 1 ? 'meting' : 'metingen'}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
                      {/* Baseline Box */}
                      <div style={{
                        padding: '16px 18px',
                        borderRadius: '10px',
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', color: '#64748b', fontWeight: 600 }}>
                          <span>0-meting (Startpunt)</span>
                          <span>{baselinePoint?.displayDate || baselinePoint?.date || '—'}</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                          <div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>AI Positie</div>
                            <div style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                              {baselinePoint?.position && baselinePoint.position !== '-' ? baselinePoint.position : (kw.position || '—')}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>Share of Voice</div>
                            <div style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                              {baseSov}%
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>Google Rank</div>
                            <div style={{ fontSize: '20px', fontWeight: 700, color: '#475569', marginTop: '2px' }}>
                              {baselinePoint?.rank || kw.rank || '—'}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Current Box */}
                      <div style={{
                        padding: '16px 18px',
                        borderRadius: '10px',
                        backgroundColor: '#ffffff',
                        border: '1px solid #cbd5e1',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', color: '#334155', fontWeight: 600 }}>
                          <span>Actuele meting</span>
                          <span style={{ color: '#64748b', fontWeight: 500 }}>{latestPoint?.displayDate || kw.last_updated || 'Actueel'}</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                          <div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>AI Positie</div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '2px' }}>
                              <span style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>
                                {kw.position || latestPoint?.position || '—'}
                              </span>
                              {posDiff !== null && posDiff !== 0 && (
                                <span style={{ fontSize: '11px', fontWeight: 600, color: posDiff > 0 ? '#059669' : '#dc2626' }}>
                                  {posDiff > 0 ? `+${posDiff}` : `${posDiff}`}
                                </span>
                              )}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>Share of Voice</div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '2px' }}>
                              <span style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>
                                {currSov}%
                              </span>
                              {sovDiff !== 0 && (
                                <span style={{ fontSize: '11px', fontWeight: 600, color: sovDiff > 0 ? '#059669' : '#dc2626' }}>
                                  {sovDiff > 0 ? `+${sovDiff}%` : `${sovDiff}%`}
                                </span>
                              )}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>Google Rank</div>
                            <div style={{ fontSize: '20px', fontWeight: 700, color: '#475569', marginTop: '2px' }}>
                              {kw.rank || latestPoint?.rank || '—'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Calm Horizontal Measurement Strip */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto', paddingTop: '4px' }}>
                      {rawHistory.map((item, i) => {
                        const isFirst = i === 0 || !!item.isBaseline;
                        const itemSov = Number(item.sov ?? 0);
                        return (
                          <React.Fragment key={i}>
                            {i > 0 && <div style={{ width: '16px', height: '1px', backgroundColor: '#cbd5e1', flexShrink: 0 }} />}
                            <div style={{
                              flex: '0 0 auto',
                              padding: '7px 12px',
                              borderRadius: '8px',
                              backgroundColor: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '10px',
                              fontSize: '12px'
                            }}>
                              <span style={{ color: '#64748b', fontSize: '11px' }}>
                                {isFirst ? '0-meting · ' : ''}{formatCompactDate(item.displayDate || item.date)}
                              </span>
                              <span style={{ fontWeight: 600, color: '#0f172a' }}>
                                {item.position && item.position !== '-' ? item.position : '—'}
                              </span>
                              <span style={{ color: '#64748b', fontSize: '11px' }}>
                                {itemSov}% SOV
                              </span>
                            </div>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>

                  {/* Calm Prompts Comparison Table */}
                  <div style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      padding: '14px 20px',
                      borderBottom: '1px solid #e2e8f0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a' }}>
                        Prompts vergelijking (0-meting vs. actueel)
                      </span>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>
                        {(kw.prompts || []).length} prompts
                      </span>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', fontSize: '11.5px', color: '#64748b' }}>
                            <th style={{ padding: '10px 18px', fontWeight: 600 }}>Prompt</th>
                            <th style={{ padding: '10px 18px', fontWeight: 600, width: '160px' }}>0-meting</th>
                            <th style={{ padding: '10px 18px', fontWeight: 600, width: '160px' }}>Actueel</th>
                            <th style={{ padding: '10px 18px', fontWeight: 600, width: '130px' }}>Verloop</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(kw.prompts || []).map((p, pIdx) => {
                            const pHistory = Array.isArray(p.history) && p.history.length > 0 ? p.history : [];
                            const pBase = p.baseline || pHistory[0];
                            const baseMentioned = Boolean(pBase?.mentioned);
                            const currMentioned = Boolean(p.brand_mentioned || p.status === 'Cited' || p.mentioned);

                            let deltaText = 'Gelijk';
                            let deltaColor = '#64748b';
                            if (!baseMentioned && currMentioned) {
                              deltaText = 'Nieuw vermeld';
                              deltaColor = '#059669';
                            } else if (baseMentioned && !currMentioned) {
                              deltaText = 'Niet meer vermeld';
                              deltaColor = '#dc2626';
                            } else if (baseMentioned && currMentioned) {
                              deltaText = 'Behouden';
                              deltaColor = '#059669';
                            }

                            return (
                              <tr key={pIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '12px 18px', fontWeight: 500, color: '#0f172a' }}>
                                  {p.text}
                                </td>
                                <td style={{ padding: '12px 18px', color: baseMentioned ? '#334155' : '#94a3b8', fontSize: '12.5px' }}>
                                  {baseMentioned ? `Vermeld (${pBase?.position || '#1'})` : 'Niet vermeld'}
                                </td>
                                <td style={{ padding: '12px 18px', color: currMentioned ? '#047857' : '#64748b', fontWeight: currMentioned ? 600 : 400, fontSize: '12.5px' }}>
                                  {currMentioned ? `Vermeld (${p.position && p.position !== '-' ? p.position : 'AI'})` : 'Niet vermeld'}
                                </td>
                                <td style={{ padding: '12px 18px', fontSize: '12px', fontWeight: 600, color: deltaColor }}>
                                  {deltaText}
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
              {(kw.prompts || []).map((p, pIdx) => renderSinglePromptCard(p, pIdx, kw, isEditMode))}
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
                    placeholder={`bijv. Welke partij is een betrouwbare keuze voor ${kw.text || 'deze dienst'}?\nWat zijn de ervaringen en kosten voor ${kw.text || 'dit aanbod'}?`}
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
      {renderNulmetingBanner()}

      {/* Header bar (Compact) */}
      <div data-tour="keywords-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ minWidth: '260px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h1 style={{
              fontSize: '25px',
              fontWeight: 800,
              color: '#111827',
              fontFamily: "'Outfit', sans-serif",
              letterSpacing: '-0.5px',
              margin: 0
            }}>
              Prompts & Zoektermen
            </h1>
            <span
              title="Geen harde promptlimiet. Extra prompts buiten uw pakket brengen extra API-/scankosten met zich mee."
              style={{
                fontSize: '11.5px',
                fontWeight: 500,
                padding: '3px 10px',
                borderRadius: '6px',
                backgroundColor: '#f4f4f5',
                color: '#3f3f46',
                border: '1px solid #e4e4e7',
                cursor: 'help'
              }}
            >
              {activePlanName} · {totalUsedPrompts}/{activeLimit} prompts{totalUsedPrompts > activeLimit ? ` (+${totalUsedPrompts - activeLimit} extra)` : ''}
            </span>
            {isReadOnly && (
              <span style={{
                fontSize: '11.5px',
                fontWeight: 500,
                padding: '3px 9px',
                borderRadius: '6px',
                backgroundColor: '#f4f4f5',
                color: '#52525b',
                border: '1px solid #e4e4e7'
              }}>
                Klantweergave
              </span>
            )}
          </div>
          <p style={{ color: '#6b7280', fontSize: '12.5px', margin: '3px 0 0 0' }}>
            {isReadOnly
              ? `Live GEO resultaten en nulmeting voor ${activeWorkspace || 'uw merk'}.`
              : `Beheer AI-prompts voor ${activeWorkspace ? activeWorkspace.replace(/\.(nl|com|eu|de|be|org|net|io|co|info|biz|[a-z]{2,8})$/i, '') : 'uw merk'}. Extra prompts boven ${activeLimit} zijn mogelijk tegen meerkosten.`}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {!isReadOnly && (
            <button
              type="button"
              disabled={resettingNulmeting || allPromptsList.length === 0}
              onClick={() => handleStartNewNulmeting({ label: activeWorkspace || 'dit project' })}
              title="Optioneel: wis de bestaande historie en start handmatig een nieuwe 0-meting"
              style={{
                backgroundColor: '#ffffff',
                color: '#64748b',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '7px 11px',
                fontSize: '12px',
                fontWeight: 500,
                cursor: (resettingNulmeting || allPromptsList.length === 0) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <RefreshCw size={13} className={resettingNulmeting ? 'spin' : ''} />
              0-meting
            </button>
          )}
          <button
            type="button"
            onClick={handleExportProjectCsv}
            style={{
              backgroundColor: '#ffffff',
              color: '#334155',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '7px 12px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
            title="Exporteer alle prompts, nulmeting en zoektermen naar CSV (Excel)"
          >
            <Download size={14} style={{ color: '#64748b' }} />
            CSV
          </button>
          <button
            type="button"
            onClick={() => {
              setReportKeywordId(null);
              setReportModalOpen(true);
            }}
            style={{
              backgroundColor: '#ffffff',
              color: '#334155',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '7px 13px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            title="Bekijk en download de SalesWizard PDF Rapportage voor al uw prompts en stijgingen"
          >
            <FileText size={14} style={{ color: '#64748b' }} />
            Rapportage
          </button>
          {!isReadOnly && (
            <>
              <button
                type="button"
                disabled={rescrapingAllPrompts || activeCrawlingPrompts.length > 0 || allPromptsList.length === 0}
                onClick={handleRescrapeAllPrompts}
                title="Scrape direct alle actieve prompts opnieuw (behoudt de bestaande 0-meting en historie)"
                style={{
                  backgroundColor: '#f8fafc',
                  color: '#0f172a',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '7px 13px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: (rescrapingAllPrompts || activeCrawlingPrompts.length > 0 || allPromptsList.length === 0) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <RotateCw size={14} className={(rescrapingAllPrompts || activeCrawlingPrompts.length > 0) ? 'spin' : ''} />
                {(rescrapingAllPrompts || activeCrawlingPrompts.length > 0)
                  ? 'Scrapen bezig...'
                  : 'Alle prompts opnieuw scrapen'}
              </button>
              <button
                type="button"
                onClick={() => setIsAdding(!isAdding)}
                style={{
                  backgroundColor: '#440099',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '7px 15px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#5a1bb8'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#440099'}
              >
                <Plus size={15} />
                Prompts toevoegen
              </button>
            </>
          )}
        </div>
      </div>

      {/* Add Prompts & Optional Keywords Form (Prompts-first!) */}
      {!isReadOnly && isAdding && (
        <form onSubmit={handleAddKeywords} style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          padding: '22px',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          backgroundColor: '#f8fafc'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', color: '#0f172a', margin: 0 }}>
              Prompts toevoegen (zoektermen zijn optioneel)
            </h3>
            <span style={{ fontSize: '11.5px', color: '#64748b' }}>
              Extra prompts boven uw pakketbundel zijn mogelijk tegen meerkosten
            </span>
          </div>

          {/* 1. Primary: Prompts opgeven */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            padding: '14px 16px',
            borderRadius: '8px',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                1. Prompts opgeven (1 prompt per regel)
              </label>
              <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                Prompts vormen de basis van de AI-meting
              </span>
            </div>
            <textarea
              rows={4}
              placeholder={"Welke partij is een betrouwbare keuze voor onze dienstverlening?\nWat zijn de beste aanbieders en ervaringen in deze branche?\nWelke specialist wordt het meest aanbevolen?"}
              value={customPromptsOnAdd}
              onChange={(e) => setCustomPromptsOnAdd(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '13px',
                lineHeight: 1.5
              }}
            />
            {activeKeywords.length > 0 && !keywordInput.trim() && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 500, color: '#475569' }}>
                  Optioneel koppelen aan bestaande zoekterm:
                </label>
                <select
                  value={directPromptKeywordId}
                  onChange={(e) => setDirectPromptKeywordId(e.target.value)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    fontSize: '12px',
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    fontWeight: 500
                  }}
                >
                  <option value="">— Niet koppelen (losse prompts) —</option>
                  {activeKeywords.map(k => (
                    <option key={k.id} value={k.id}>{k.text}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* 2. Optional: Nieuwe zoektermen toevoegen */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            padding: '12px 14px',
            borderRadius: '8px',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>
                2. Optioneel: nieuwe zoektermen toevoegen (komma-gescheiden)
              </label>
              <button
                type="button"
                onClick={handleRecommendKeywords}
                disabled={recommending}
                style={{
                  fontSize: '11.5px',
                  fontWeight: 600,
                  color: '#334155',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  cursor: recommending ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                {recommending ? (
                  <>
                    <Loader2 size={12} className="spin" />
                    Aanbevelen...
                  </>
                ) : (
                  <>
                    <Sparkles size={12} style={{ color: '#64748b' }} />
                    Suggesties ophalen
                  </>
                )}
              </button>
            </div>
            <input
              type="text"
              placeholder="Optioneel: bijv. uw dienst, productnaam, specialist in regio (laat leeg om alleen prompts toe te voegen)"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '13px'
              }}
            />

            {keywordInput.trim().length > 0 && (
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginTop: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={generateAiPromptsOnAdd}
                    onChange={(e) => setGenerateAiPromptsOnAdd(e.target.checked)}
                    style={{ width: '15px', height: '15px', accentColor: '#18181b', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>
                    Automatisch 3 AI prompts per nieuwe zoekterm genereren
                  </span>
                </div>
              </label>
            )}
          </div>

          {(() => {
            const enteredKws = keywordInput.split(',').map(k => k.trim()).filter(Boolean);
            const customLinesCount = customPromptsOnAdd.split(/\r?\n/).map(s => s.trim()).filter(Boolean).length;
            const countPrompts = (generateAiPromptsOnAdd ? enteredKws.length * 3 : 0) + customLinesCount;
            const newTotal = totalUsedPrompts + countPrompts;
            const extraBeyondPlan = Math.max(0, newTotal - activeLimit);

            return (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                fontSize: '12px',
                color: '#475569',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                <span>
                  Toe te voegen: <strong style={{ color: '#0f172a' }}>{countPrompts} prompt(s)</strong>
                  {enteredKws.length > 0 ? ` en ${enteredKws.length} zoekterm(en)` : ''}
                </span>
                <span>
                  {extraBeyondPlan > 0
                    ? `Na toevoegen: ${newTotal} prompts (${extraBeyondPlan} extra boven bundel van ${activeLimit}).`
                    : `Totaal na toevoegen: ${newTotal} / ${activeLimit} prompts.`}
                </span>
              </div>
            );
          })()}

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
              Annuleren
            </button>
            <button
              type="submit"
              style={{
                padding: '8px 18px',
                borderRadius: '6px',
                backgroundColor: 'var(--brand-primary)',
                color: 'white',
                fontWeight: 700,
                fontSize: '13px',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Prompts Opslaan & Scannen
            </button>
          </div>
        </form>
      )}

      {/* Live Crawl & Scrape Progress Banner */}
      {renderLiveCrawlProgressBanner()}

      {/* Main View Switcher Tabs: 1. Alle Prompts (Totaaloverzicht) | 2. Zoektermen & Concurrenten */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #e2e8f0',
        gap: '12px',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            onClick={() => setMainViewTab('all_prompts')}
            style={{
              padding: '11px 16px',
              fontSize: '13.5px',
              fontWeight: mainViewTab === 'all_prompts' ? 700 : 500,
              color: mainViewTab === 'all_prompts' ? '#0f172a' : '#64748b',
              borderBottom: mainViewTab === 'all_prompts' ? '2px solid #440099' : '2px solid transparent',
              backgroundColor: 'transparent',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span>Alle prompts</span>
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              padding: '1px 7px',
              borderRadius: '999px',
              backgroundColor: mainViewTab === 'all_prompts' ? '#f1f5f9' : '#f8fafc',
              color: mainViewTab === 'all_prompts' ? '#0f172a' : '#64748b'
            }}>
              {allPromptsList.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setMainViewTab('keywords')}
            style={{
              padding: '11px 16px',
              fontSize: '13.5px',
              fontWeight: mainViewTab === 'keywords' ? 700 : 500,
              color: mainViewTab === 'keywords' ? '#0f172a' : '#64748b',
              borderBottom: mainViewTab === 'keywords' ? '2px solid #440099' : '2px solid transparent',
              backgroundColor: 'transparent',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span>Zoektermen &amp; concurrenten</span>
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              padding: '1px 7px',
              borderRadius: '999px',
              backgroundColor: mainViewTab === 'keywords' ? '#f1f5f9' : '#f8fafc',
              color: mainViewTab === 'keywords' ? '#0f172a' : '#64748b'
            }}>
              {activeKeywords.length}
            </span>
          </button>
        </div>
      </div>

      {/* Filter box */}
      <div style={{ position: 'relative', width: '100%' }}>
        <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
        <input
          type="text"
          placeholder={mainViewTab === 'all_prompts' ? 'Filter door alle prompts of zoektermen...' : 'Filter zoektermen...'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '9px 14px 9px 40px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            fontSize: '13.5px',
            backgroundColor: '#ffffff',
            color: '#0f172a',
            outline: 'none'
          }}
        />
      </div>

      {/* VIEW 1: ALLE PROMPTS (TOTAALOVERZICHT) */}
      {mainViewTab === 'all_prompts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Calm Uniform Summary Strip */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px'
          }}>
            <div style={{ padding: '14px 18px', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}>
              <div style={{ fontSize: '12px', fontWeight: 500, color: '#64748b' }}>Totaal prompts</div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', marginTop: '3px' }}>{allPromptsList.length}</div>
            </div>
            <div style={{ padding: '14px 18px', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}>
              <div style={{ fontSize: '12px', fontWeight: 500, color: '#64748b' }}>Vermeld in AI</div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: '#047857', marginTop: '3px' }}>
                {allPromptsList.filter(p => p.status === 'Cited' || p.mentioned).length}
              </div>
            </div>
            <div style={{ padding: '14px 18px', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}>
              <div style={{ fontSize: '12px', fontWeight: 500, color: '#64748b' }}>Losse prompts</div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', marginTop: '3px' }}>{standalonePrompts.length}</div>
            </div>
            <div style={{ padding: '14px 18px', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}>
              <div style={{ fontSize: '12px', fontWeight: 500, color: '#64748b' }}>Actieve zoektermen</div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', marginTop: '3px' }}>{activeKeywords.length}</div>
            </div>
          </div>

          {filteredAllPrompts.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredAllPrompts.map((p, pIdx) => renderSinglePromptCard(p, pIdx, p._keywordObj || null, true))}
            </div>
          ) : (
            <div style={{
              padding: '36px 24px',
              borderRadius: '12px',
              border: '1px dashed #d1d5db',
              backgroundColor: '#f9fafb',
              textAlign: 'center',
              color: '#6b7280',
              fontSize: '14px'
            }}>
              Er zijn nog geen prompts gevonden voor dit project. Klik rechtsboven op <strong>"+ Prompts Toevoegen"</strong> om direct uw prompts in te voeren (zoektermen zijn niet verplicht).
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: ZOEKTERMEN & CONCURRENTEN */}
      {mainViewTab === 'keywords' && (
        <>

          {/* Bulk actions */}
          {!isReadOnly && selectedKeywordIds.length > 0 && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '10px 16px',
              marginTop: '12px',
              width: '100%'
            }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                {selectedKeywordIds.length} zoektermen geselecteerd
              </span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={handleBulkRescrapeKeywords}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    fontSize: '12px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    cursor: 'pointer'
                  }}
                >
                  <RotateCw size={13} />
                  Opnieuw scrapen
                </button>
                <button
                  type="button"
                  onClick={handleBulkArchiveKeywords}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#ffffff',
                    color: '#475569',
                    fontSize: '12px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    cursor: 'pointer'
                  }}
                >
                  <Archive size={13} />
                  Archiveren
                </button>
                <button
                  type="button"
                  onClick={handleBulkDeleteKeywords}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #fecaca',
                    backgroundColor: '#fef2f2',
                    color: '#dc2626',
                    fontSize: '12px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    cursor: 'pointer'
                  }}
                >
                  <Trash2 size={13} />
                  Verwijderen
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
                          <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '14px' }}>{kw.text}</span>
                          {isKwScanning && (
                            <span style={{
                              fontSize: '11px',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              backgroundColor: '#eff6ff',
                              color: '#2563eb',
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              border: '1px solid #bfdbfe'
                            }}>
                              <Loader2 size={10} className="spin" /> Scannen
                            </span>
                          )}
                        </div>
                      </td>

                      <td style={{ padding: '16px', fontWeight: 600, color: kw.rank !== '-' ? '#0f172a' : '#94a3b8' }}>
                        {isKwScanning ? (
                          <span style={{ color: '#2563eb', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 500 }}>
                            <Loader2 size={12} className="spin" /> Scannen...
                          </span>
                        ) : (
                          kw.rank
                        )}
                      </td>

                      <td style={{ padding: '16px' }}>
                        {isKwScanning ? (
                          <span style={{ color: '#2563eb', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 500 }}>
                            <Loader2 size={12} className="spin" /> Analyseren...
                          </span>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, minWidth: '32px', color: '#0f172a' }}>{kw.sov}%</span>
                            <div style={{ width: '72px', height: '4px', borderRadius: '2px', backgroundColor: '#e2e8f0', overflow: 'hidden' }}>
                              <div style={{
                                width: `${kw.sov}%`,
                                height: '100%',
                                backgroundColor: '#475569',
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
                              title="Zoekterm & gekoppelde prompts definitief verwijderen"
                              style={{
                                padding: '6px',
                                borderRadius: '4px',
                                border: 'none',
                                background: 'none',
                                cursor: 'pointer',
                                color: '#94a3b8',
                                display: 'inline-flex',
                                alignItems: 'center'
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.color = '#dc2626'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; }}
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
                    (tellen niet mee in de actieve prompts; kunnen hersteld of definitief verwijderd worden)
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
        </>
      )}

      {reportModalOpen && (
        <PromptReport
          activeWorkspace={activeWorkspace}
          initialKeywordId={reportKeywordId}
          keywordsList={activeKeywords}
          isModal={true}
          onClose={() => setReportModalOpen(false)}
        />
      )}
    </div>
  );
}
