import bcrypt from 'bcryptjs';

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
export async function seed(knex) {
  // Clear existing entries
  await knex('users').del();
  await knex('roles').del();

  // Insert roles
  const [adminRoleId] = await knex('roles').insert({ name: 'admin' });
  const [klantRoleId] = await knex('roles').insert({ name: 'klant' });
  const [medewerkerRoleId] = await knex('roles').insert({ name: 'medewerker' });

  // Generate password hashes
  const klantPasswordHash = await bcrypt.hash('klant123', 10);
  const salesPasswordHash = await bcrypt.hash('sales123', 10);

  // Insert users
  await knex('users').insert([
    {
      username: 'Saleswizard.nl',
      email: 'klant@saleswizard.nl',
      password_hash: klantPasswordHash,
      role_id: klantRoleId,
      company_name: 'Saleswizard',
      subscription: 'AI Pro',
      addon_prompts: 0
    },
    {
      username: 'DoubleSmart.nl',
      email: 'klant@doublesmart.nl',
      password_hash: klantPasswordHash,
      role_id: klantRoleId,
      company_name: 'DoubleSmart',
      subscription: 'AI Starter',
      addon_prompts: 0
    },
    {
      username: 'Saleswizard Marketeer',
      email: 'medewerker@saleswizard.nl',
      password_hash: salesPasswordHash,
      role_id: medewerkerRoleId,
      company_name: 'Saleswizard B.V.',
      subscription: 'None',
      addon_prompts: 0
    }
  ]);
}
