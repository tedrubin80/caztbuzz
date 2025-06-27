// scripts/migrate.js
// Database migration system for CastBuzz

require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');

class MigrationRunner {
  constructor() {
    this.connection = null;
    this.migrationsPath = path.join(__dirname, '../migrations');
  }

  async connect() {
    this.connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'castbuzz',
      multipleStatements: true
    });
    
    // Create migrations table if it doesn't exist
    await this.connection.execute(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        batch INT NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  async disconnect() {
    if (this.connection) {
      await this.connection.end();
    }
  }

  async getMigrationFiles() {
    try {
      const files = await fs.readdir(this.migrationsPath);
      return files
        .filter(file => file.endsWith('.sql'))
        .sort(); // Sort alphabetically for consistent order
    } catch (error) {
      // Migrations directory doesn't exist
      return [];
    }
  }

  async getExecutedMigrations() {
    const [rows] = await this.connection.execute(
      'SELECT filename FROM migrations ORDER BY id'
    );
    return rows.map(row => row.filename);
  }

  async getPendingMigrations() {
    const allMigrations = await this.getMigrationFiles();
    const executedMigrations = await this.getExecutedMigrations();
    
    return allMigrations.filter(
      migration => !executedMigrations.includes(migration)
    );
  }

  async executeMigration(filename) {
    const migrationPath = path.join(this.migrationsPath, filename);
    const migrationSQL = await fs.readFile(migrationPath, 'utf8');
    
    console.log(`🔄 Executing migration: ${filename}`);
    
    try {
      // Begin transaction
      await this.connection.beginTransaction();
      
      // Execute migration SQL
      const statements = migrationSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
      
      for (const statement of statements) {
        if (statement.trim()) {
          await this.connection.execute(statement);
        }
      }
      
      // Record migration as executed
      const [result] = await this.connection.execute(
        'SELECT COALESCE(MAX(batch), 0) + 1 as next_batch FROM migrations'
      );
      const batch = result[0].next_batch;
      
      await this.connection.execute(
        'INSERT INTO migrations (filename, batch) VALUES (?, ?)',
        [filename, batch]
      );
      
      // Commit transaction
      await this.connection.commit();
      console.log(`✅ Migration completed: ${filename}`);
      
    } catch (error) {
      // Rollback on error
      await this.connection.rollback();
      console.error(`❌ Migration failed: ${filename}`);
      throw error;
    }
  }

  async runMigrations() {
    const pendingMigrations = await this.getPendingMigrations();
    
    if (pendingMigrations.length === 0) {
      console.log('✅ No pending migrations');
      return;
    }
    
    console.log(`📋 Found ${pendingMigrations.length} pending migrations`);
    
    for (const migration of pendingMigrations) {
      await this.executeMigration(migration);
    }
    
    console.log(`🎉 All migrations completed successfully!`);
  }

  async rollback(steps = 1) {
    console.log(`🔄 Rolling back ${steps} migration(s)...`);
    
    // Get the last batch(es) to rollback
    const [batches] = await this.connection.execute(`
      SELECT DISTINCT batch FROM migrations 
      ORDER BY batch DESC 
      LIMIT ?
    `, [steps]);
    
    if (batches.length === 0) {
      console.log('ℹ️ No migrations to rollback');
      return;
    }
    
    const batchesToRollback = batches.map(row => row.batch);
    const placeholders = batchesToRollback.map(() => '?').join(',');
    
    const [migrations] = await this.connection.execute(`
      SELECT filename, batch FROM migrations 
      WHERE batch IN (${placeholders})
      ORDER BY batch DESC, id DESC
    `, batchesToRollback);
    
    console.log(`📋 Rolling back ${migrations.length} migration(s)`);
    
    for (const migration of migrations) {
      await this.rollbackMigration(migration.filename, migration.batch);
    }
    
    console.log('🎉 Rollback completed successfully!');
  }

  async rollbackMigration(filename, batch) {
    console.log(`🔄 Rolling back migration: ${filename}`);
    
    // Check if there's a corresponding rollback file
    const rollbackFilename = filename.replace('.sql', '.rollback.sql');
    const rollbackPath = path.join(this.migrationsPath, rollbackFilename);
    
    try {
      const rollbackSQL = await fs.readFile(rollbackPath, 'utf8');
      
      await this.connection.beginTransaction();
      
      // Execute rollback SQL
      const statements = rollbackSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
      
      for (const statement of statements) {
        if (statement.trim()) {
          await this.connection.execute(statement);
        }
      }
      
      // Remove migration record
      await this.connection.execute(
        'DELETE FROM migrations WHERE filename = ?',
        [filename]
      );
      
      await this.connection.commit();
      console.log(`✅ Rollback completed: ${filename}`);
      
    } catch (error) {
      await this.connection.rollback();
      
      if (error.code === 'ENOENT') {
        console.warn(`⚠️ No rollback file found for ${filename}`);
        console.warn('   Manual intervention may be required');
        
        // Still remove the migration record
        await this.connection.execute(
          'DELETE FROM migrations WHERE filename = ?',
          [filename]
        );
        console.log(`✅ Migration record removed: ${filename}`);
      } else {
        console.error(`❌ Rollback failed: ${filename}`);
        throw error;
      }
    }
  }

  async status() {
    const allMigrations = await this.getMigrationFiles();
    const executedMigrations = await this.getExecutedMigrations();
    const pendingMigrations = await this.getPendingMigrations();
    
    console.log('\n📊 Migration Status:');
    console.log(`📁 Total migrations: ${allMigrations.length}`);
    console.log(`✅ Executed: ${executedMigrations.length}`);
    console.log(`⏳ Pending: ${pendingMigrations.length}`);
    
    if (pendingMigrations.length > 0) {
      console.log('\n⏳ Pending Migrations:');
      for (const migration of pendingMigrations) {
        console.log(`   - ${migration}`);
      }
    }
    
    if (executedMigrations.length > 0) {
      console.log('\n✅ Executed Migrations:');
      const [rows] = await this.connection.execute(`
        SELECT filename, batch, executed_at 
        FROM migrations 
        ORDER BY id DESC 
        LIMIT 5
      `);
      
      for (const row of rows) {
        console.log(`   - ${row.filename} (batch ${row.batch}) - ${row.executed_at}`);
      }
      
      if (executedMigrations.length > 5) {
        console.log(`   ... and ${executedMigrations.length - 5} more`);
      }
    }
  }

  async createMigration(name) {
    const timestamp = new Date().toISOString()
      .replace(/[-:T]/g, '')
      .substr(0, 14);
    
    const filename = `${timestamp}_${name.replace(/\s+/g, '_').toLowerCase()}.sql`;
    const migrationPath = path.join(this.migrationsPath, filename);
    const rollbackPath = path.join(this.migrationsPath, filename.replace('.sql', '.rollback.sql'));
    
    // Ensure migrations directory exists
    await fs.mkdir(this.migrationsPath, { recursive: true });
    
    // Create migration file template
    const migrationTemplate = `-- Migration: ${name}
-- Created: ${new Date().toISOString()}

-- Add your migration SQL here
-- Example:
-- ALTER TABLE users ADD COLUMN new_field VARCHAR(255);
-- CREATE INDEX idx_new_field ON users(new_field);

`;

    // Create rollback file template
    const rollbackTemplate = `-- Rollback for: ${name}
-- Created: ${new Date().toISOString()}

-- Add your rollback SQL here
-- Example:
-- DROP INDEX idx_new_field ON users;
-- ALTER TABLE users DROP COLUMN new_field;

`;

    await fs.writeFile(migrationPath, migrationTemplate);
    await fs.writeFile(rollbackPath, rollbackTemplate);
    
    console.log(`✅ Migration created: ${filename}`);
    console.log(`✅ Rollback created: ${filename.replace('.sql', '.rollback.sql')}`);
    console.log(`📝 Edit the files to add your migration SQL`);
  }
}

async function main() {
  const runner = new MigrationRunner();
  
  try {
    await runner.connect();
    
    const command = process.argv[2];
    
    switch (command) {
      case 'run':
        await runner.runMigrations();
        break;
        
      case 'rollback':
        const steps = parseInt(process.argv[3]) || 1;
        await runner.rollback(steps);
        break;
        
      case 'status':
        await runner.status();
        break;
        
      case 'create':
        const name = process.argv.slice(3).join(' ');
        if (!name) {
          console.error('❌ Migration name is required');
          console.log('Usage: npm run migrate create "migration name"');
          process.exit(1);
        }
        await runner.createMigration(name);
        break;
        
      default:
        showHelp();
    }
    
  } catch (error) {
    console.error('❌ Migration error:', error.message);
    process.exit(1);
  } finally {
    await runner.disconnect();
  }
}

function showHelp() {
  console.log(`
🔄 CastBuzz Database Migration Tool

Usage: npm run migrate <command> [options]

Commands:
  run                    Run all pending migrations
  rollback [steps]       Rollback the last N migrations (default: 1)
  status                 Show migration status
  create "name"          Create a new migration file

Examples:
  npm run migrate run
  npm run migrate rollback
  npm run migrate rollback 3
  npm run migrate status
  npm run migrate create "add user preferences table"

Migration files are stored in: ./migrations/
Format: YYYYMMDDHHMMSS_migration_name.sql

Each migration should have a corresponding rollback file:
YYYYMMDDHHMMSS_migration_name.rollback.sql
  `);
}

if (require.main === module) {
  main();
}

module.exports = MigrationRunner;