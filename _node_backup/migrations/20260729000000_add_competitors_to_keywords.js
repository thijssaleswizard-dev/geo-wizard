/**
 * Migration to add competitors_json and brands_mentioned columns to keywords table
 */
export async function up(knex) {
  const hasCompetitorsJson = await knex.schema.hasColumn('keywords', 'competitors_json');
  if (!hasCompetitorsJson) {
    await knex.schema.table('keywords', (table) => {
      table.text('competitors_json');
      table.text('brands_mentioned');
    });
  }
}

export async function down(knex) {
  const hasCompetitorsJson = await knex.schema.hasColumn('keywords', 'competitors_json');
  if (hasCompetitorsJson) {
    await knex.schema.table('keywords', (table) => {
      table.dropColumn('competitors_json');
      table.dropColumn('brands_mentioned');
    });
  }
}
