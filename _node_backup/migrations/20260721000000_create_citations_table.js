/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  return knex.schema.createTable('citations', (table) => {
    table.increments('id').primary();
    table.string('company_key').notNullable().index();
    table.string('title').notNullable();
    table.string('url').notNullable();
    table.string('domain').notNullable();
    table.text('snippet').notNullable();
    table.string('type').defaultTo('Website');
    table.string('sentiment').defaultTo('+90');
    table.text('cited_by'); // Stored as JSON string e.g. '["chatgpt","gemini"]'
    table.string('crawl_date');
    table.timestamps(true, true);
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  return knex.schema.dropTableIfExists('citations');
}
