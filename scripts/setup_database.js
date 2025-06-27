// scripts/setup_database.js
// Initialize CastBuzz database with schema and default data

require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcrypt');

async function setupDatabase() {
  let connection;
  
  try {
    console.log('🔌 Connecting to MySQL server...');
    
    // Connect to MySQL server (without specifying database)
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      multipleStatements: true
    });

    console.log('✅ Connected to MySQL server');

    // Create database if it doesn't exist
    const dbName = process.env.DB_NAME || 'castbuzz';
    await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    console.log(`✅ Database "${dbName}" created/verified`);

    // Use the database
    await connection.execute(`USE \`${dbName}\``);

    // Read and execute schema
    const schemaPath = path.join(__dirname, '../lib/db-schema.sql');
    const schema = await fs.readFile(schemaPath, 'utf8');
    
    console.log('📋 Executing database schema...');
    
    // Split the schema into individual statements
    const statements = schema
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await connection.execute(statement);
        } catch (error) {
          if (!error.message.includes('already exists')) {
            console.warn(`⚠️ Statement warning: ${error.message}`);
          }
        }
      }
    }
    
    console.log('✅ Database schema created successfully');

    // Create default admin user
    await createDefaultAdmin(connection);
    
    // Create sample data if requested
    if (process.argv.includes('--sample-data')) {
      await createSampleData(connection);
    }

    console.log('\n🎉 Database setup complete!');
    console.log('\n📋 Next steps:');
    console.log('1. Update your .env file with database credentials');
    console.log('2. Run: npm start');
    console.log('3. Visit: http://localhost:3000/admin');
    console.log('\n📊 Database Statistics:');
    
    // Show table statistics
    const [tables] = await connection.execute('SHOW TABLES');
    console.log(`📈 Tables created: ${tables.length}`);
    
    const [users] = await connection.execute('SELECT COUNT(*) as count FROM users');
    console.log(`👥 Users: ${users[0].count}`);

  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('1. Check MySQL server is running');
    console.error('2. Verify database credentials in .env file');
    console.error('3. Ensure user has CREATE DATABASE privileges');
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

async function createDefaultAdmin(connection) {
  try {
    // Check if admin user already exists
    const [existing] = await connection.execute(
      'SELECT id FROM users WHERE email = ?', 
      ['admin@castbuzz.com']
    );
    
    if (existing.length > 0) {
      console.log('ℹ️ Admin user already exists');
      return;
    }

    // Create admin user
    const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    
    const adminUser = `
      INSERT INTO users (
        email, password_hash, first_name, last_name, 
        role, status, email_verified
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    await connection.execute(adminUser, [
      'admin@castbuzz.com',
      hashedPassword,
      'Super',
      'Admin',
      'super_admin',
      'active',
      true
    ]);
    
    console.log('✅ Default admin user created');
    console.log('📧 Admin email: admin@castbuzz.com');
    console.log(`🔑 Admin password: ${adminPassword}`);
    console.log('⚠️ IMPORTANT: Change the default password after first login!');

  } catch (error) {
    console.error('❌ Failed to create admin user:', error.message);
  }
}

async function createSampleData(connection) {
  try {
    console.log('🎭 Creating sample data...');

    // Create sample shows
    const shows = [
      {
        name: 'Tech Talk Weekly',
        slug: 'tech-talk-weekly',
        description: 'Weekly discussions about the latest in technology',
        category: 'Technology',
        color: '#3B82F6'
      },
      {
        name: 'Business Insights',
        slug: 'business-insights',
        description: 'Insights and strategies for modern business',
        category: 'Business',
        color: '#10B981'
      },
      {
        name: 'Creative Minds',
        slug: 'creative-minds',
        description: 'Conversations with creative professionals',
        category: 'Arts',
        color: '#8B5CF6'
      }
    ];

    for (const show of shows) {
      await connection.execute(`
        INSERT IGNORE INTO shows 
        (name, slug, description, category, color, is_active, created_by) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        show.name, show.slug, show.description, 
        show.category, show.color, true, 1
      ]);
    }

    // Create sample episodes
    const episodes = [
      {
        show_id: 1,
        title: 'The Future of AI Development',
        slug: 'future-of-ai-development',
        description: 'Exploring the latest trends in artificial intelligence and machine learning',
        audio_url: 'https://example.com/audio/episode-1.mp3',
        duration: '00:45:30',
        duration_seconds: 2730
      },
      {
        show_id: 1,
        title: 'Cybersecurity in 2024',
        slug: 'cybersecurity-2024',
        description: 'Essential cybersecurity practices for individuals and businesses',
        audio_url: 'https://example.com/audio/episode-2.mp3',
        duration: '00:38:15',
        duration_seconds: 2295
      },
      {
        show_id: 2,
        title: 'Building a Startup in Tough Times',
        slug: 'building-startup-tough-times',
        description: 'Strategies for launching and growing a startup during economic uncertainty',
        audio_url: 'https://example.com/audio/episode-3.mp3',
        duration: '00:52:20',
        duration_seconds: 3140
      }
    ];

    for (const episode of episodes) {
      await connection.execute(`
        INSERT IGNORE INTO episodes 
        (show_id, title, slug, description, audio_url, duration, duration_seconds, is_published, created_by) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        episode.show_id, episode.title, episode.slug, episode.description,
        episode.audio_url, episode.duration, episode.duration_seconds, true, 1
      ]);
    }

    // Create sample tags
    const tags = ['Technology', 'AI', 'Business', 'Startup', 'Security', 'Innovation'];
    for (const tag of tags) {
      await connection.execute(`
        INSERT IGNORE INTO tags (name, slug) 
        VALUES (?, ?)
      `, [tag, tag.toLowerCase().replace(/\s+/g, '-')]);
    }

    // Update episode counts for shows
    await connection.execute(`
      UPDATE shows s 
      SET episode_count = (
        SELECT COUNT(*) FROM episodes e 
        WHERE e.show_id = s.id AND e.is_published = TRUE
      )
    `);

    console.log('✅ Sample data created successfully');
    console.log('📊 Created: 3 shows, 3 episodes, 6 tags');

  } catch (error) {
    console.error('❌ Failed to create sample data:', error.message);
  }
}

// Handle command line arguments
function showHelp() {
  console.log(`
🎙️ CastBuzz Database Setup

Usage: node scripts/setup_database.js [options]

Options:
  --sample-data    Create sample shows and episodes for testing
  --help          Show this help message

Environment Variables Required:
  DB_HOST         MySQL host (default: localhost)
  DB_PORT         MySQL port (default: 3306)
  DB_USER         MySQL username (default: root)
  DB_PASSWORD     MySQL password
  DB_NAME         Database name (default: castbuzz)
  ADMIN_PASSWORD  Default admin password (default: ChangeMe123!)

Examples:
  node scripts/setup_database.js
  node scripts/setup_database.js --sample-data
  `);
}

// Main execution
if (process.argv.includes('--help')) {
  showHelp();
} else {
  setupDatabase().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { setupDatabase, createDefaultAdmin, createSampleData };