# CastBuzz MySQL Configuration Setup Guide

## Directory Structure

```
your-project/
├── config/                    # Private configuration folder
│   ├── .env                  # Environment variables (git ignored)
│   ├── .env.example          # Example env file (committed)
│   ├── database.config.js    # MySQL configuration
│   └── app.config.js         # Application configuration
├── lib/                      # Library files
│   ├── database.js          # Database connection manager
│   └── db-schema.sql        # Database schema
├── models/                   # Database models
│   ├── User.js
│   ├── Show.js
│   └── Episode.js
├── api/                      # API endpoints
│   ├── auth.js
│   ├── users.js
│   └── ...
├── public/                   # Public files
│   └── admin.html           # Your admin panel
├── .gitignore               # Git ignore file
└── package.json
```

## Step 1: Secure the Configuration Folder

### Create .gitignore file:
```gitignore
# Configuration files with sensitive data
/config/.env
/config/*.local.js

# Dependencies
node_modules/
package-lock.json

# Logs
logs/
*.log

# OS files
.DS_Store
Thumbs.db

# IDE files
.vscode/
.idea/

# Build files
dist/
build/

# Temporary files
tmp/
temp/
```

### Create .htaccess for Apache (place in /config folder):
```apache
# /config/.htaccess
# Deny all access to this directory
Order deny,allow
Deny from all

# Prevent directory listing
Options -Indexes
```

### For Nginx, add to your server configuration:
```nginx
# Deny access to config directory
location ~ /config/ {
    deny all;
    return 403;
}
```

## Step 2: Environment Setup

1. **Copy the example environment file:**
   ```bash
   cp config/.env.example config/.env
   ```

2. **Edit the .env file with your actual values:**
   ```bash
   nano config/.env
   ```

3. **Install required dependencies:**
   ```bash
   npm install mysql2 bcrypt jsonwebtoken dotenv express cors helmet express-rate-limit
   npm install --save-dev nodemon
   ```

## Step 3: Initialize the Database

1. **Create the database:**
   ```bash
   mysql -u root -p < lib/db-schema.sql
   ```

2. **Generate the default admin password:**
   ```javascript
   // generate-password.js
   const bcrypt = require('bcrypt');
   const password = 'ChangeMe123!'; // Change this!
   const rounds = 10;
   
   bcrypt.hash(password, rounds, (err, hash) => {
       console.log('Password hash:', hash);
       console.log('Use this in your database for the admin user');
   });
   ```

3. **Update the admin user with the generated hash:**
   ```sql
   UPDATE users 
   SET password_hash = 'your-generated-hash-here' 
   WHERE email = 'admin@castbuzz.com';
   ```

## Step 4: API Server Setup

Create `server.js`:
```javascript
// server.js
require('dotenv').config({ path: './config/.env' });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./config/app.config');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors(config.cors));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit(config.rateLimit);
app.use('/api/', limiter);

// API routes
app.use('/api/auth', require('./api/auth'));
app.use('/api/users', require('./api/users'));
app.use('/api/shows', require('./api/shows'));
app.use('/api/episodes', require('./api/episodes'));

// Serve static files
app.use(express.static('public'));

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Start server
const port = config.app.port;
app.listen(port, () => {
    console.log(`🚀 CastBuzz API running on port ${port}`);
    console.log(`📊 Environment: ${config.app.env}`);
});
```

## Step 5: Security Best Practices

### 1. **Use Environment Variables**
Never hardcode sensitive information. Always use environment variables:
```javascript
// ❌ Bad
const password = "mypassword123";

// ✅ Good
const password = process.env.DB_PASSWORD;
```

### 2. **Validate and Sanitize Input**
```javascript
// Example validation middleware
const { body, validationResult } = require('express-validator');

const validateUser = [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }).trim(),
    body('firstName').isAlpha().trim(),
    body('lastName').isAlpha().trim(),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }
];
```

### 3. **Use Prepared Statements**
The provided database class uses parameterized queries to prevent SQL injection:
```javascript
// ✅ Safe - uses parameterized queries
const user = await db.query('SELECT * FROM users WHERE email = ?', [email]);

// ❌ Unsafe - vulnerable to SQL injection
const user = await db.query(`SELECT * FROM users WHERE email = '${email}'`);
```

### 4. **Implement Session Management**
```javascript
// middleware/session.js
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);

const sessionStore = new MySQLStore({
    ...dbConfig[process.env.NODE_ENV],
    clearExpired: true,
    checkExpirationInterval: 900000, // 15 minutes
    expiration: 86400000 // 24 hours
});

module.exports = session({
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        httpOnly: true,
        maxAge: 86400000 // 24 hours
    }
});
```

### 5. **API Authentication Middleware**
```javascript
// middleware/auth.js
const jwt = require('jsonwebtoken');
const config = require('../config/app.config');

exports.requireAuth = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }
        
        const decoded = jwt.verify(token, config.auth.jwtSecret);
        req.user = await User.findById(decoded.userId);
        
        if (!req.user) {
            return res.status(401).json({ error: 'Invalid token' });
        }
        
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired' });
        }
        return res.status(401).json({ error: 'Invalid token' });
    }
};

exports.requirePermission = (permission) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        // Super admin has all permissions
        if (req.user.role === 'super_admin') {
            return next();
        }
        
        if (!req.user.permissions.includes(permission)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        
        next();
    };
};
```

## Step 6: Production Deployment Checklist

### 1. **Environment Configuration**
- [ ] Set `NODE_ENV=production`
- [ ] Use strong, unique passwords
- [ ] Generate new JWT secret (minimum 32 characters)
- [ ] Configure SSL certificates
- [ ] Set up proper CORS origins

### 2. **Database Security**
- [ ] Create a dedicated MySQL user with limited privileges
- [ ] Enable SSL for MySQL connections
- [ ] Regular automated backups
- [ ] Set up replication for high availability

### 3. **Server Security**
- [ ] Enable firewall (allow only necessary ports)
- [ ] Configure fail2ban for brute force protection
- [ ] Keep system and dependencies updated
- [ ] Set up monitoring and alerting

### 4. **Application Security**
- [ ] Enable HTTPS everywhere
- [ ] Implement CSRF protection
- [ ] Set secure headers with Helmet.js
- [ ] Regular security audits with `npm audit`

## Step 7: MySQL User Privileges

Create a dedicated database user with minimal required privileges:

```sql
-- Create user
CREATE USER 'castbuzz_app'@'localhost' IDENTIFIED BY 'strong_password_here';

-- Grant only necessary privileges
GRANT SELECT, INSERT, UPDATE, DELETE ON castbuzz_production.* TO 'castbuzz_app'@'localhost';

-- Apply changes
FLUSH PRIVILEGES;
```

## Step 8: Backup Strategy

### Automated Daily Backups
Create a backup script `/scripts/backup-mysql.sh`:
```bash
#!/bin/bash
# MySQL backup script

# Configuration
DB_USER="castbuzz_backup"
DB_PASS="backup_password"
DB_NAME="castbuzz_production"
BACKUP_DIR="/var/backups/mysql"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Perform backup
mysqldump -u$DB_USER -p$DB_PASS $DB_NAME | gzip > $BACKUP_DIR/castbuzz_$DATE.sql.gz

# Keep only last 30 days of backups
find $BACKUP_DIR -name "castbuzz_*.sql.gz" -mtime +30 -delete

# Upload to S3 (optional)
# aws s3 cp $BACKUP_DIR/castbuzz_$DATE.sql.gz s3://your-backup-bucket/mysql/
```

Add to crontab:
```bash
# Run backup daily at 2 AM
0 2 * * * /scripts/backup-mysql.sh
```

## Step 9: Monitoring Setup

### Basic Health Check Endpoint
```javascript
// api/health.js
app.get('/api/health', async (req, res) => {
    try {
        // Check database connection
        await db.query('SELECT 1');
        
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: process.env.NODE_ENV
        });
    } catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            error: 'Database connection failed'
        });
    }
});
```

## Step 10: Frontend Integration

Update your admin panel to use the API:

```javascript
// In your admin panel JavaScript
const API_BASE_URL = window.location.origin + '/api';

// Update the authentication function
async function authenticateUser(email, password) {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Store the token
            localStorage.setItem('authToken', data.token);
            return {
                success: true,
                ...data
            };
        } else {
            return {
                success: false,
                error: data.error
            };
        }
    } catch (error) {
        return {
            success: false,
            error: 'Network error'
        };
    }
}

// Add authorization header to all API requests
async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('authToken');
    
    return fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...options.headers
        }
    });
}
```

## Troubleshooting

### Common Issues:

1. **Cannot connect to MySQL**
   - Check MySQL is running: `systemctl status mysql`
   - Verify credentials in `.env` file
   - Check firewall rules

2. **Permission denied errors**
   - Ensure config folder has correct permissions
   - Check file ownership

3. **Token errors**
   - Verify JWT_SECRET is set
   - Check token expiration settings
   - Clear browser localStorage

### Debug Mode
Set in your `.env` file:
```env
DEBUG=true
LOG_LEVEL=debug
```

This will enable detailed logging for troubleshooting.

## Additional Resources

- [MySQL Security Best Practices](https://dev.mysql.com/doc/refman/8.0/en/security.html)
- [Node.js Security Checklist](https://blog.risingstack.com/node-js-security-checklist/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

## Support

For issues or questions:
1. Check the logs in `/logs` directory
2. Review the troubleshooting section
3. Verify all configuration files are properly set up
4. Ensure all dependencies are installed

Remember to always keep your dependencies updated and regularly review security advisories!