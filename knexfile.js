import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbClient = process.env.DB_CLIENT || 'sqlite3';

const getConnection = () => {
  if (dbClient === 'sqlite3') {
    return {
      filename: process.env.DB_FILENAME || path.join(__dirname, 'geo_wizard.sqlite3')
    };
  }
  return {
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : (dbClient === 'pg' ? 5432 : 3306),
    user: process.env.DB_USER || 'forge',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'geo_wizard',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
  };
};

const config = {
  development: {
    client: dbClient,
    connection: getConnection(),
    useNullAsDefault: dbClient === 'sqlite3',
    migrations: {
      directory: path.join(__dirname, 'migrations')
    },
    seeds: {
      directory: path.join(__dirname, 'seeds')
    }
  },
  production: {
    client: dbClient,
    connection: getConnection(),
    useNullAsDefault: dbClient === 'sqlite3',
    migrations: {
      directory: path.join(__dirname, 'migrations')
    },
    seeds: {
      directory: path.join(__dirname, 'seeds')
    }
  }
};

export default config;
