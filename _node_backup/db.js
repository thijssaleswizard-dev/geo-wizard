import 'dotenv/config';
import knex from 'knex';
import config from './knexfile.js';

const environment = process.env.NODE_ENV || 'development';
const db = knex(config[environment] || config.development);

export default db;
