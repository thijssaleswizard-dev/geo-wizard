/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  await knex.schema.alterTable('users', (table) => {
    table.string('mollie_customer_id').nullable();
    table.string('mollie_subscription_id').nullable();
    table.string('payment_status').defaultTo('paid'); // Set default to paid for existing users so they don't get locked out
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('mollie_customer_id');
    table.dropColumn('mollie_subscription_id');
    table.dropColumn('payment_status');
  });
}
