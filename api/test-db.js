// api/test-db.js - Test database connection
import mysql from 'mysql2/promise';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let connection;
  
  try {
    // Log environment variables (safely)
    console.log('Environment check:');
    console.log('DB_HOST:', process.env.DB_HOST ? 'Set' : 'Missing');
    console.log('DB_USER:', process.env.DB_USER ? 'Set' : 'Missing');
    console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? 'Set' : 'Missing');
    console.log('DB_NAME:', process.env.DB_NAME ? 'Set' : 'Missing');
    console.log('DB_PORT:', process.env.DB_PORT ? 'Set' : 'Missing');

    // Test basic connection
    console.log('Attempting to connect to MySQL...');
    
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: {
        rejectUnauthorized: false
      },
      connectTimeout: 30000,
      acquireTimeout: 30000,
      timeout: 30000
    });

    console.log('✅ MySQL connection successful');

    // Test a simple query
    const [result] = await connection.execute('SELECT 1 as test');
    console.log('✅ Query test successful:', result);

    // Test if tables exist
    const [tables] = await connection.execute('SHOW TABLES');
    console.log('✅ Tables found:', tables.length);

    return res.status(200).json({
      success: true,
      message: 'Database connection successful',
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      tablesCount: tables.length,
      tables: tables.map(t => Object.values(t)[0])
    });

  } catch (error) {
    console.error('❌ Database connection failed:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message,
      code: error.code,
      sqlState: error.sqlState,
      errno: error.errno,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      troubleshooting: {
        checkEnvironmentVariables: 'Verify all DB_ variables are set in Vercel dashboard',
        checkSSL: 'SSL connection might be required',
        checkFirewall: 'Database server might block Vercel IPs',
        checkCredentials: 'Verify username and password are correct'
      }
    });

  } finally {
    if (connection) {
      try {
        await connection.end();
      } catch (e) {
        console.log('Connection cleanup error:', e.message);
      }
    }
  }
}