import db from '../db.js';
import { runScraper } from './scraper.js';

const queue = [];
let processing = false;

async function processNext() {
  if (processing || queue.length === 0) return;
  processing = true;

  const promptId = queue.shift();
  try {
    // 1. Fetch prompt from database
    const promptRecord = await db('prompts').where({ id: promptId }).first();
    if (!promptRecord) {
      processing = false;
      setTimeout(processNext, 50);
      return;
    }

    // Update status to processing
    await db('prompts').where({ id: promptId }).update({
      status: 'processing',
      updated_at: new Date().toISOString()
    });

    console.log(`[Queue] Processing prompt #${promptId}: "${promptRecord.prompt_text}"`);

    // 2. Run the scraper
    const result = await runScraper({
      prompt: promptRecord.prompt_text,
      company: promptRecord.company_key
    });

    // 3. Update prompt with results
    const totalMentionedCount = Object.values(result.modelMentions).filter(m => m.mentioned).length;
    const totalModelsCount = Object.keys(result.modelMentions).length;

    const chatgptMention = result.modelMentions.chatgpt;
    const geminiMention = result.modelMentions.gemini;

    await db('prompts').where({ id: promptId }).update({
      status: 'completed',
      brand_mentioned: totalMentionedCount > 0,
      position: chatgptMention?.position || geminiMention?.position || 1,
      response_summary: `${promptRecord.company_key} wordt door ${totalMentionedCount} van de ${totalModelsCount} AI-modellen aanbevolen.`,
      sentiment: chatgptMention?.sentiment || '+90',
      logs: JSON.stringify(result.logs),
      results: JSON.stringify(result),
      updated_at: new Date().toISOString()
    });

    console.log(`[Queue] Completed prompt #${promptId}`);
  } catch (err) {
    console.error(`[Queue Error] Failed to process prompt #${promptId}:`, err);
    try {
      await db('prompts').where({ id: promptId }).update({
        status: 'failed',
        logs: JSON.stringify([`[Queue Error] ${err.message}`]),
        updated_at: new Date().toISOString()
      });
    } catch (dbErr) {
      console.error('Failed to update job failure in database:', dbErr);
    }
  } finally {
    processing = false;
    setTimeout(processNext, 200); // Small cooldown
  }
}

export function enqueueScrape(promptId) {
  if (!queue.includes(promptId)) {
    queue.push(promptId);
    console.log(`[Queue] Enqueued prompt #${promptId}. Queue length: ${queue.length}`);
  }
  processNext();
}
