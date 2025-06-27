// scripts/setup-database.js - Initialize MySQL database
require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcrypt');

async function setupDatabase() {
  let connection;
  
  try {
    console.log('🔌 Connecting to MySQL...');
    
    // Connect to MySQL server (without specifying database)
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      multipleStatements: true
    });

    console.log('✅ Connected to MySQL server');

    // Create database if it doesn't exist
    await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\``);
    console.log(`✅ Database "${process.env.DB_NAME}" created/verified`);

    // Use the database
    await connection.execute(`USE \`${process.env.DB_NAME}\``);

    // Read and execute schema
    const schemaPath = path.join(__dirname, '../lib/db-schema.sql');
    const schema = await fs.readFile(schemaPath, 'utf8');
    
    console.log('📋 Executing database schema...');
    await connection.execute(schema);
    console.log('✅ Database schema created');

    // Create default admin user
    const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    
    const adminUser = `
      INSERT IGNORE INTO users (email, password_hash, first_name, last_name, role, status, email_verified)
      VALUES (
        'admin@castbuzz.com',
        '${hashedPassword}',
        'Super',
        'Admin',
        'super_admin',
        'active',
        TRUE
      )
    `;
    
    await connection.execute(adminUser);
    console.log('✅ Default admin user created');
    console.log('📧 Admin email: admin@castbuzz.com');
    console.log(`🔑 Admin password: ${adminPassword}`);

    console.log('\n🎉 Database setup complete!');
    console.log('\n📋 Next steps:');
    console.log('1. Update your .env file with database credentials');
    console.log('2. Run: npm start');
    console.log('3. Visit: http://localhost:3000/admin');

  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run setup
setupDatabase();