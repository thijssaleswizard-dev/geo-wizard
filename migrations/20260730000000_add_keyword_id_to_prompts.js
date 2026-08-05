/**
 * Migration to add keyword_id column to prompts table
 */
export async function up(knex) {
  const hasKeywordId = await knex.schema.hasColumn('prompts', 'keyword_id');
  if (!hasKeywordId) {
    await knex.schema.table('prompts', (table) => {
      table.integer('keyword_id').index();
    });
  }
}

export async function down(knex) {
  const hasKeywordId = await knex.schema.hasColumn('prompts', 'keyword_id');
  if (hasKeywordId) {
    await knex.schema.table('prompts', (table) => {
      table.dropColumn('keyword_id');
    });
  }
}
