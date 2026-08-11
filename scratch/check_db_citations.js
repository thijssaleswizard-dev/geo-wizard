import db from '../server/db.js';

async function main() {
  try {
    const citations = await db('citations').where({ company_key: 'vitagroen' });
    console.log(`Found ${citations.length} citations in DB:`);
    citations.forEach(c => {
      console.log(`- Title: ${c.title} | Domain: ${c.domain} | URL: ${c.url}`);
    });
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
