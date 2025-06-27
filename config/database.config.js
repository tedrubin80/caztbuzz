// config/database.config.js
// MySQL database configuration for different environments

require('dotenv').config();

const baseConfig = {
  connectionLimit: 10,
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true,
  charset: 'utf8mb4',
  timezone: 'Z',
  supportBigNumbers: true,
  bigNumberStrings: true,
  dateStrings: true,
  multipleStatements: false
};

const config = {
  development: {
    ...baseConfig,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'castbuzz_dev',
    ssl: false,
    debug: process.env.DB_DEBUG === 'true',
    connectionLimit: 5
  },

  test: {
    ...baseConfig,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'castbuzz_test',
    ssl: false,
    connectionLimit: 5
  },

  production: {
    ...baseConfig,
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'true' ? {
      ca: process.env.DB_SSL_CA,
      rejectUnauthorized: true
    } : false,
    connectionLimit: 20
  }
};

// Validate required environment variables in production
if (process.env.NODE_ENV === 'production') {
  const required = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required database environment variables: ${missing.join(', ')}`);
  }
}

const environment = process.env.NODE_ENV || 'development';

if (!config[environment]) {
  throw new Error(`Database configuration for environment "${environment}" not found`);
}

module.exports = config[environment];