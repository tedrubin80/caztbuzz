// scripts/verify_database.js
// Verify database schema and integrity for CastBuzz

require('dotenv').config();
const mysql = require('mysql2/promise');

async function verifyDatabase() {
  let connection;
  
  try {
    console.log('🔍 Verifying CastBuzz database...');
    
    // Connect to database
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'castbuzz'
    });

    console.log('✅ Connected to database');

    // Check required tables
    const requiredTables = [
      'users', 'user_preferences', 'user_2fa', 'user_sessions',
      'roles', 'permissions', 'role_permissions',
      'shows', 'episodes', 'tags', 'episode_tags',
      'file_uploads', 'analytics_events', 'listening_history',
      'show_subscriptions', 'email_subscribers',
      'comments', 'episode_ratings', 'social_shares',
      'system_settings', 'activity_logs'
    ];

    const [tables] = await connection.execute('SHOW TABLES');
    const existingTables = tables.map(row => Object.values(row)[0]);
    
    console.log('\n📋 Table Verification:');
    const missingTables = [];
    
    for (const table of requiredTables) {
      if (existingTables.includes(table)) {
        console.log(`✅ ${table}`);
      } else {
        console.log(`❌ ${table} - MISSING`);
        missingTables.push(table);
      }
    }

    // Check indexes
    console.log('\n🔍 Index Verification:');
    const criticalIndexes = [
      { table: 'users', index: 'idx_email' },
      { table: 'episodes', index: 'idx_show_id' },
      { table: 'analytics_events', index: 'idx_episode_id' },
      { table: 'shows', index: 'idx_slug' },
      { table: 'episodes', index: 'unique_show_slug' }
    ];

    for (const { table, index } of criticalIndexes) {
      try {
        const [indexes] = await connection.execute(
          `SHOW INDEX FROM ${table} WHERE Key_name = ?`, [index]
        );
        if (indexes.length > 0) {
          console.log(`✅ ${table}.${index}`);
        } else {
          console.log(`❌ ${table}.${index} - MISSING`);
        }
      } catch (error) {
        console.log(`❌ ${table}.${index} - ERROR: ${error.message}`);
      }
    }

    // Check foreign key constraints
    console.log('\n🔗 Foreign Key Verification:');
    const [foreignKeys] = await connection.execute(`
      SELECT 
        TABLE_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME IS NOT NULL
    `, [process.env.DB_NAME || 'castbuzz']);

    console.log(`✅ Found ${foreignKeys.length} foreign key constraints`);

    // Check data integrity
    console.log('\n📊 Data Integrity Check:');
    
    // Check for orphaned episodes
    const [orphanedEpisodes] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM episodes e 
      LEFT JOIN shows s ON e.show_id = s.id 
      WHERE s.id IS NULL
    `);
    
    if (orphanedEpisodes[0].count > 0) {
      console.log(`❌ Found ${orphanedEpisodes[0].count} orphaned episodes`);
    } else {
      console.log('✅ No orphaned episodes found');
    }

    // Check episode counts
    const [episodeCountMismatch] = await connection.execute(`
      SELECT s.id, s.name, s.episode_count, COUNT(e.id) as actual_count
      FROM shows s
      LEFT JOIN episodes e ON s.id = e.show_id AND e.is_published = TRUE
      GROUP BY s.id
      HAVING s.episode_count != actual_count
    `);

    if (episodeCountMismatch.length > 0) {
      console.log(`❌ Found ${episodeCountMismatch.length} shows with incorrect episode counts`);
      for (const show of episodeCountMismatch) {
        console.log(`   - ${show.name}: stored=${show.episode_count}, actual=${show.actual_count}`);
      }
    } else {
      console.log('✅ Episode counts are accurate');
    }

    // Database statistics
    console.log('\n📈 Database Statistics:');
    const stats = await getDatabaseStats(connection);
    
    for (const [table, count] of Object.entries(stats)) {
      console.log(`📊 ${table}: ${count.toLocaleString()} records`);
    }

    // Storage analysis
    console.log('\n💾 Storage Analysis:');
    const [storageInfo] = await connection.execute(`
      SELECT 
        table_name,
        ROUND(((data_length + index_length) / 1024 / 1024), 2) AS size_mb,
        table_rows
      FROM information_schema.TABLES 
      WHERE table_schema = ?
      ORDER BY (data_length + index_length) DESC
    `, [process.env.DB_NAME || 'castbuzz']);

    let totalSize = 0;
    for (const table of storageInfo) {
      console.log(`💽 ${table.table_name}: ${table.size_mb} MB (${table.table_rows?.toLocaleString() || 0} rows)`);
      totalSize += table.size_mb;
    }
    console.log(`📦 Total database size: ${totalSize.toFixed(2)} MB`);

    // Performance recommendations
    console.log('\n⚡ Performance Recommendations:');
    
    // Check for large tables without recent optimization
    const largeTablesQuery = `
      SELECT table_name, table_rows
      FROM information_schema.TABLES 
      WHERE table_schema = ? AND table_rows > 10000
    `;
    const [largeTables] = await connection.execute(largeTablesQuery, [process.env.DB_NAME || 'castbuzz']);
    
    if (largeTables.length > 0) {
      console.log('📊 Large tables detected (consider optimization):');
      for (const table of largeTables) {
        console.log(`   - ${table.table_name}: ${table.table_rows?.toLocaleString() || 0} rows`);
      }
    } else {
      console.log('✅ No large tables requiring immediate attention');
    }

    // Final summary
    console.log('\n🎯 Verification Summary:');
    if (missingTables.length > 0) {
      console.log(`❌ ${missingTables.length} missing tables detected`);
      console.log('   Run: node scripts/setup_database.js to fix');
    } else {
      console.log('✅ All required tables present');
    }

    if (orphanedEpisodes[0].count > 0 || episodeCountMismatch.length > 0) {
      console.log('⚠️ Data integrity issues detected');
      console.log('   Consider running data cleanup scripts');
    } else {
      console.log('✅ Data integrity checks passed');
    }

    console.log(`📊 Database health: ${missingTables.length === 0 ? 'GOOD' : 'NEEDS ATTENTION'}`);

  } catch (error) {
    console.error('❌ Database verification failed:', error.message);
    
    if (error.code === 'ER_BAD_DB_ERROR') {
      console.log('\n💡 Database does not exist. Run: node scripts/setup_database.js');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Cannot connect to MySQL. Check if MySQL server is running.');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('\n💡 Access denied. Check database credentials in .env file.');
    }
    
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

async function getDatabaseStats(connection) {
  const tables = [
    'users', 'shows', 'episodes', 'analytics_events', 
    'comments', 'show_subscriptions', 'email_subscribers'
  ];
  
  const stats = {};
  
  for (const table of tables) {
    try {
      const [result] = await connection.execute(`SELECT COUNT(*) as count FROM ${table}`);
      stats[table] = result[0].count;
    } catch (error) {
      stats[table] = 0;
    }
  }
  
  return stats;
}

// Handle command line arguments
function showHelp() {
  console.log(`
🔍 CastBuzz Database Verification Tool

Usage: node scripts/verify_database.js [options]

Options:
  --help          Show this help message
  --fix-counts    Fix episode count mismatches (coming soon)

This tool checks:
✅ Required tables exist
✅ Critical indexes are present  
✅ Foreign key constraints
✅ Data integrity
✅ Storage usage
✅ Performance recommendations

Environment Variables Required:
  DB_HOST         MySQL host
  DB_USER         MySQL username  
  DB_PASSWORD     MySQL password
  DB_NAME         Database name
  `);
}

// Main execution
if (process.argv.includes('--help')) {
  showHelp();
} else {
  verifyDatabase().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { verifyDatabase, getDatabaseStats };