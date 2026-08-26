/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  await knex.schema.createTable('invoices', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
    table.string('invoice_number').notNullable().unique();
    table.decimal('amount', 10, 2).notNullable();
    table.decimal('vat_amount', 10, 2).notNullable();
    table.decimal('total_amount', 10, 2).notNullable();
    table.string('status').defaultTo('paid');
    table.string('package_name').notNullable();
    table.string('html_path').nullable();
    table.timestamps(true, true);
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists('invoices');
}
