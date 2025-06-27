// lib/mysql.js - MySQL connection utility for Vercel
import mysql from 'mysql2/promise';

let connection = null;

export async function getConnection() {
  // Reuse existing connection if available
  if (connection && connection.connection && !connection.connection._closing) {
    try {
      await connection.ping();
      return connection;
    } catch (error) {
      console.log('Connection lost, creating new one...');
      connection = null;
    }
  }

  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: {
        rejectUnauthorized: false,
        ca: undefined
      },
      connectTimeout: 30000,
      acquireTimeout: 30000,
      timeout: 30000,
      charset: 'utf8mb4'
    });

    console.log('✅ Connected to MySQL database');
    return connection;
  } catch (error) {
    console.error('❌ MySQL connection failed:', error);
    throw error;
  }
}

export async function closeConnection() {
  if (connection) {
    await connection.end();
    connection = null;
  }
}

// Query helper function
export async function query(sql, params = []) {
  const conn = await getConnection();
  try {
    const [results] = await conn.execute(sql, params);
    return results;
  } catch (error) {
    console.error('Query error:', error);
    throw error;
  }
}

// Transaction helper
export async function transaction(callback) {
  const conn = await getConnection();
  await conn.beginTransaction();
  
  try {
    const result = await callback(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  }
}