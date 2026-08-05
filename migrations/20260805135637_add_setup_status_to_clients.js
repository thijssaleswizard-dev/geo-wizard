/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  await knex.schema.alterTable('clients', (table) => {
    table.string('setup_status').defaultTo('completed');
    table.integer('setup_progress').defaultTo(100);
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.alterTable('clients', (table) => {
    table.dropColumn('setup_status');
    table.dropColumn('setup_progress');
  });
}
