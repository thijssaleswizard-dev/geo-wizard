/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  // 1. Clients / Workspaces table
  await knex.schema.createTable('clients', (table) => {
    table.increments('id').primary();
    table.string('company').notNullable().unique();
    table.string('name');
    table.string('email');
    table.string('subscription').defaultTo('AI Pro');
    table.integer('prompts_count').defaultTo(0);
    table.integer('visibility_index').defaultTo(0);
    table.timestamps(true, true);
  });

  // 2. Keywords table
  await knex.schema.createTable('keywords', (table) => {
    table.increments('id').primary();
    table.string('company_key').notNullable().index();
    table.string('keyword').notNullable();
    table.integer('rank').defaultTo(1);
    table.string('search_engine').defaultTo('ChatGPT');
    table.string('sentiment').defaultTo('+90');
    table.integer('citations_count').defaultTo(1);
    table.integer('monthly_searches').defaultTo(100);
    table.timestamps(true, true);
  });

  // 3. Prompts table
  await knex.schema.createTable('prompts', (table) => {
    table.increments('id').primary();
    table.string('company_key').notNullable().index();
    table.text('prompt_text').notNullable();
    table.string('category').defaultTo('Algemeen');
    table.text('response_summary');
    table.boolean('brand_mentioned').defaultTo(true);
    table.integer('position').defaultTo(1);
    table.string('sentiment').defaultTo('+90');
    table.string('engine').defaultTo('ChatGPT');
    table.timestamps(true, true);
  });

  // 4. Recommendations table
  await knex.schema.createTable('recommendations', (table) => {
    table.increments('id').primary();
    table.string('company_key').notNullable().index();
    table.string('title').notNullable();
    table.string('category').defaultTo('SEO & GEO');
    table.string('priority').defaultTo('High');
    table.integer('impact_score').defaultTo(80);
    table.string('status').defaultTo('todo');
    table.text('description');
    table.timestamps(true, true);
  });

  // 5. Notifications table
  await knex.schema.createTable('notifications', (table) => {
    table.increments('id').primary();
    table.string('company_key').defaultTo('all').index();
    table.string('text').notNullable();
    table.string('time');
    table.boolean('read').defaultTo(false);
    table.timestamps(true, true);
  });

  // 6. Agents Analytics table
  await knex.schema.createTable('agents_analytics', (table) => {
    table.increments('id').primary();
    table.string('company_key').notNullable().index();
    table.string('model_name').notNullable();
    table.integer('visibility_score').defaultTo(70);
    table.integer('citations_count').defaultTo(5);
    table.integer('sentiment_score').defaultTo(90);
    table.timestamps(true, true);
  });

  // 7. Overview Stats table
  await knex.schema.createTable('overview_stats', (table) => {
    table.increments('id').primary();
    table.string('company_key').notNullable().unique();
    table.integer('geo_score').defaultTo(74);
    table.integer('brand_share').defaultTo(68);
    table.integer('citations_total').defaultTo(24);
    table.integer('sentiment_avg').defaultTo(92);
    table.timestamps(true, true);
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists('overview_stats');
  await knex.schema.dropTableIfExists('agents_analytics');
  await knex.schema.dropTableIfExists('notifications');
  await knex.schema.dropTableIfExists('recommendations');
  await knex.schema.dropTableIfExists('prompts');
  await knex.schema.dropTableIfExists('keywords');
  await knex.schema.dropTableIfExists('clients');
}
