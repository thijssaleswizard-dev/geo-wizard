/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  // 1. Rename table 'clients' to 'projects'
  await knex.schema.renameTable('clients', 'projects');

  // 2. Create 'user_projects' junction table
  await knex.schema.createTable('user_projects', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
    table.integer('project_id').unsigned().references('id').inTable('projects').onDelete('CASCADE');
    table.timestamps(true, true);
  });

  // 3. Populate junction table from existing users' company_name association
  const users = await knex('users').whereNotNull('company_name').andWhere('company_name', '!=', '');
  for (const u of users) {
    const project = await knex('projects')
      .whereRaw('LOWER(company) = ?', [u.company_name.toLowerCase()])
      .first();

    if (project) {
      await knex('user_projects').insert({
        user_id: u.id,
        project_id: project.id
      });
    }
  }
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists('user_projects');
  await knex.schema.renameTable('projects', 'clients');
}
