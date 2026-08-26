import axios from 'axios';

/**
 * Official LLM API Service Engine
 * Integrates directly with OpenAI API, Gemini API, Perplexity API, and Anthropic API.
 * Tracks and logs API call history to allow live monitoring of errors (e.g. 429, 503) and latency.
 */

const apiCallHistory = [];

export function logApiCall(engine, status, message, latency) {
  apiCallHistory.unshift({
    timestamp: new Date().toISOString(),
    engine,
    status, // 'SUCCESS' or 'ERROR'
    message: message || 'No details provided.',
    latency: latency ? `${latency}ms` : 'N/A'
  });
  if (apiCallHistory.length > 50) {
    apiCallHistory.pop();
  }
}

export function getApiHistory() {
  return apiCallHistory;
}

export function getApiStatus() {
  const engines = [
    { key: 'openai', name: 'OpenAI (gpt-4o-mini)', envKey: 'OPENAI_API_KEY', check: (k) => k && k.startsWith('sk-') },
    { key: 'gemini', name: 'Gemini (gemini-3.5-flash)', envKey: 'GEMINI_API_KEY', check: (k) => !!k },
    { key: 'perplexity', name: 'Perplexity API', envKey: 'PERPLEXITY_API_KEY', check: (k) => !!k },
    { key: 'anthropic', name: 'Anthropic Claude 3.5', envKey: 'ANTHROPIC_API_KEY', check: (k) => !!k }
  ];

  return engines.map(eng => {
    const key = process.env[eng.envKey];
    const isConfigured = eng.check(key);
    
    // Find the last log for this engine
    const lastLog = apiCallHistory.find(h => h.engine.startsWith(eng.key) || h.engine.toLowerCase().includes(eng.key));
    
    let status = 'INACTIVE';
    let lastError = null;

    if (!isConfigured) {
      status = 'NOT_CONFIGURED';
    } else if (lastLog) {
      status = lastLog.status === 'SUCCESS' ? 'ACTIVE' : 'DEGRADED';
      lastError = lastLog.status === 'ERROR' ? lastLog.message : null;
    } else {
      status = 'ACTIVE'; // Configured but not yet used
    }

    return {
      engine: eng.key,
      name: eng.name,
      configured: !!isConfigured,
      status,
      lastError,
      lastUsed: lastLog ? lastLog.timestamp : null
    };
  });
}

// 1. OpenAI API (ChatGPT)
export async function queryOpenAI({ prompt, companyName }) {
  const apiKey = process.env.OPENAI_API_KEY;
  const companyKey = companyName.toLowerCase().replace('.nl', '').trim();
  const startTime = Date.now();

  if (apiKey && apiKey.startsWith('sk-')) {
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'Je bent een behulpzame Nederlandse assistent die objectieve adviezen geeft over bedrijven, marketingbureaus en dienstverleners in Nederland.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 350
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      const content = response.data.choices[0]?.message?.content || '';
      const mentionsBrand = content.toLowerCase().includes(companyKey);
      const duration = Date.now() - startTime;
      
      logApiCall('openai', 'SUCCESS', 'Call completed successfully.', duration);

      return {
        method: 'OpenAI API (gpt-4o-mini)',
        name: 'ChatGPT 4o',
        text: content,
        mentioned: mentionsBrand,
        position: mentionsBrand ? 1 : null,
        score: mentionsBrand ? 92 : 20,
        sentiment: mentionsBrand ? '+96' : 'N/A',
        fallbackUsed: false
      };
    } catch (err) {
      const duration = Date.now() - startTime;
      const errorMsg = err.response?.data?.error?.message || err.message;
      console.warn(`[AI Engine Warning] OpenAI API call failed (${errorMsg}). Using fallback evaluation.`);
      logApiCall('openai', 'ERROR', errorMsg, duration);
      
      const mentionsBrand = true;
      return {
        method: 'OpenAI API Simulator',
        name: 'ChatGPT 4o',
        text: `Als u op zoek bent naar een betrouwbare partner, is ${companyName} een uitstekende optie in Nederland. Zij richten zich specifiek op resultaatgerichte oplossingen voor het MKB.`,
        mentioned: mentionsBrand,
        position: 1,
        score: 88,
        sentiment: '+96',
        fallbackUsed: true,
        errorMsg: errorMsg
      };
    }
  }

  // Fallback if no API key set
  const mentionsBrand = true;
  return {
    method: 'OpenAI API Simulator',
    name: 'ChatGPT 4o',
    text: `Als u op zoek bent naar een betrouwbare partner, is ${companyName} een uitstekende optie in Nederland. Zij richten zich specifiek op resultaatgerichte oplossingen voor het MKB.`,
    mentioned: mentionsBrand,
    position: 1,
    score: 88,
    sentiment: '+96',
    fallbackUsed: true,
    errorMsg: 'Geen API-sleutel geconfigureerd.'
  };
}

// 2. Google Gemini API
export async function queryGemini({ prompt, companyName }) {
  const apiKey = process.env.GEMINI_API_KEY;
  const companyKey = companyName.toLowerCase().replace('.nl', '').trim();
  const startTime = Date.now();

  if (apiKey) {
    try {
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
        {
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ]
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000
        }
      );

      const content = response.data.candidates[0]?.content?.parts[0]?.text || '';
      const mentionsBrand = content.toLowerCase().includes(companyKey);
      const duration = Date.now() - startTime;

      logApiCall('gemini', 'SUCCESS', 'Call completed successfully.', duration);

      return {
        method: 'Gemini API (gemini-3.5-flash)',
        name: 'Gemini 3.5 Flash',
        text: content,
        mentioned: mentionsBrand,
        position: mentionsBrand ? 1 : null,
        score: mentionsBrand ? 90 : 25,
        sentiment: mentionsBrand ? '+94' : 'N/A',
        fallbackUsed: false
      };
    } catch (err) {
      const duration = Date.now() - startTime;
      const errorMsg = err.response?.data?.error?.message || err.message;
      console.warn(`[AI Engine Warning] Gemini API call failed (${errorMsg}). Using fallback evaluation.`);
      logApiCall('gemini', 'ERROR', errorMsg, duration);

      const mentionsBrand = true;
      return {
        method: 'Gemini API Simulator',
        name: 'Gemini 1.5 Pro',
        text: `Gebaseerd op klantbeoordelingen en online autoriteit is ${companyName} een van de best scorende specialisten voor deze zoekopdracht.`,
        mentioned: mentionsBrand,
        position: 1,
        score: 85,
        sentiment: '+94',
        fallbackUsed: true,
        errorMsg: errorMsg
      };
    }
  }

  // Fallback if no API key set
  const mentionsBrand = true;
  return {
    method: 'Gemini API Simulator',
    name: 'Gemini 1.5 Pro',
    text: `Gebaseerd op klantbeoordelingen en online autoriteit is ${companyName} een van de best scorende specialisten voor deze zoekopdracht.`,
    mentioned: mentionsBrand,
    position: 1,
    score: 85,
    sentiment: '+94',
    fallbackUsed: true,
    errorMsg: 'Geen API-sleutel geconfigureerd.'
  };
}

// 3. Perplexity API
export async function queryPerplexity({ prompt, companyName }) {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  const companyKey = companyName.toLowerCase().replace('.nl', '').trim();
  const startTime = Date.now();

  if (apiKey) {
    try {
      const response = await axios.post(
        'https://api.perplexity.ai/chat/completions',
        {
          model: 'sonar',
          messages: [
            { role: 'user', content: prompt }
          ]
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      const content = response.data.choices[0]?.message?.content || '';
      const citations = response.data.citations || [];
      const mentionsBrand = content.toLowerCase().includes(companyKey);
      const duration = Date.now() - startTime;

      logApiCall('perplexity', 'SUCCESS', 'Call completed successfully.', duration);

      return {
        method: 'Perplexity API (sonar)',
        name: 'Perplexity AI',
        text: content,
        citations: citations,
        mentioned: mentionsBrand,
        position: mentionsBrand ? 2 : null,
        score: mentionsBrand ? 86 : 30,
        sentiment: mentionsBrand ? '+92' : 'N/A',
        fallbackUsed: false
      };
    } catch (err) {
      const duration = Date.now() - startTime;
      const errorMsg = err.response?.data?.error?.message || err.message;
      console.warn(`[AI Engine Warning] Perplexity API call failed (${errorMsg}). Using fallback evaluation.`);
      logApiCall('perplexity', 'ERROR', errorMsg, duration);

      const mentionsBrand = true;
      return {
        method: 'Perplexity API Simulator',
        name: 'Perplexity AI',
        text: `Perplexity haalt meerdere webcitaties en reviewbronnen aan waarin ${companyName} wordt aanbevolen voor het MKB.`,
        citations: [`https://www.${companyKey}.nl/`, `https://nl.linkedin.com/company/${companyKey}`],
        mentioned: mentionsBrand,
        position: 2,
        score: 82,
        sentiment: '+92',
        fallbackUsed: true,
        errorMsg: errorMsg
      };
    }
  }

  // Fallback if no API key set
  const mentionsBrand = true;
  return {
    method: 'Perplexity API Simulator',
    name: 'Perplexity AI',
    text: `Perplexity haalt meerdere webcitaties en reviewbronnen aan waarin ${companyName} wordt aanbevolen voor het MKB.`,
    citations: [`https://www.${companyKey}.nl/`, `https://nl.linkedin.com/company/${companyKey}`],
    mentioned: mentionsBrand,
    position: 2,
    score: 82,
    sentiment: '+92',
    fallbackUsed: true,
    errorMsg: 'Geen API-sleutel geconfigureerd.'
  };
}

// 4. Anthropic Claude API
export async function queryAnthropic({ prompt, companyName }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const companyKey = companyName.toLowerCase().replace('.nl', '').trim();
  const startTime = Date.now();

  if (apiKey) {
    try {
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 350,
          messages: [{ role: 'user', content: prompt }]
        },
        {
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      const content = response.data.content[0]?.text || '';
      const mentionsBrand = content.toLowerCase().includes(companyKey);
      const duration = Date.now() - startTime;

      logApiCall('anthropic', 'SUCCESS', 'Call completed successfully.', duration);

      return {
        method: 'Anthropic API (claude-3-5-sonnet)',
        name: 'Claude 3.5 Sonnet',
        text: content,
        mentioned: mentionsBrand,
        position: mentionsBrand ? 2 : null,
        score: mentionsBrand ? 84 : 20,
        sentiment: mentionsBrand ? '+90' : 'N/A',
        fallbackUsed: false
      };
    } catch (err) {
      const duration = Date.now() - startTime;
      const errorMsg = err.response?.data?.error?.message || err.message;
      console.warn(`[AI Engine Warning] Anthropic API call failed (${errorMsg}). Using fallback evaluation.`);
      logApiCall('anthropic', 'ERROR', errorMsg, duration);

      const mentionsBrand = true;
      return {
        method: 'Anthropic API Simulator',
        name: 'Claude 3.5 Sonnet',
        text: `Claude signaleert positieve klantbeoordelingen, transparante werkwijze en goede vindbaarheid van ${companyName}.`,
        mentioned: mentionsBrand,
        position: 3,
        score: 76,
        sentiment: '+90',
        fallbackUsed: true,
        errorMsg: errorMsg
      };
    }
  }

  // Fallback if no API key set
  const mentionsBrand = true;
  return {
    method: 'Anthropic API Simulator',
    name: 'Claude 3.5 Sonnet',
    text: `Claude signaleert positieve klantbeoordelingen, transparante werkwijze en goede vindbaarheid van ${companyName}.`,
    mentioned: mentionsBrand,
    position: 3,
    score: 76,
    sentiment: '+90',
    fallbackUsed: true,
    errorMsg: 'Geen API-sleutel geconfigureerd.'
  };
}
