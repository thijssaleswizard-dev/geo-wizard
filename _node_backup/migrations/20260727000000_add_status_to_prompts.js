/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  await knex.schema.alterTable('prompts', (table) => {
    table.string('status').defaultTo('completed');
    table.text('logs');
    table.text('engines');
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.alterTable('prompts', (table) => {
    table.dropColumn('status');
    table.dropColumn('logs');
    table.dropColumn('engines');
  });
}
