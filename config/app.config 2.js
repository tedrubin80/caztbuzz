// config/app.config.js
// Application configuration for CastBuzz

require('dotenv').config();

const config = {
  app: {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT) || 3000,
    url: process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`,
    name: 'CastBuzz',
    version: process.env.npm_package_version || '1.0.0',
    adminEmail: process.env.ADMIN_EMAIL || 'admin@castbuzz.com'
  },

  auth: {
    jwtSecret: process.env.JWT_SECRET || 'your-jwt-secret-change-this',
    jwtExpiry: process.env.JWT_EXPIRY || '24h',
    refreshTokenExpiry: process.env.REFRESH_TOKEN_EXPIRY || '7d',
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 10,
    sessionTimeout: parseInt(process.env.SESSION_TIMEOUT) || 86400000, // 24 hours
    maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5,
    lockoutDuration: parseInt(process.env.LOCKOUT_DURATION) || 900000, // 15 minutes
    sessionSecret: process.env.SESSION_SECRET || process.env.JWT_SECRET || 'your-session-secret-change-this'
  },

  cors: {
    origin: process.env.CORS_ORIGIN ? 
      process.env.CORS_ORIGIN.split(',').map(origin => origin.trim()) : 
      ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
  },

  s3: {
    endpoint: process.env.S3_ENDPOINT || 'https://s3.amazonaws.com',
    region: process.env.S3_REGION || 'us-east-1',
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    bucket: process.env.S3_BUCKET || 'castbuzz-podcasts',
    usePathStyle: process.env.S3_USE_PATH_STYLE === 'true',
    maxFileSize: 500 * 1024 * 1024, // 500MB
    allowedMimeTypes: [
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/m4a',
      'audio/aac',
      'image/jpeg',
      'image/png',
      'image/webp'
    ],
    uploadTimeout: 300000 // 5 minutes
  },

  email: {
    smtp: {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    },
    from: {
      name: process.env.EMAIL_FROM_NAME || 'CastBuzz',
      address: process.env.EMAIL_FROM_ADDRESS || 'noreply@castbuzz.com'
    }
  },

  logging: {
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    file: process.env.LOG_FILE || 'logs/app.log',
    maxFiles: parseInt(process.env.LOG_MAX_FILES) || 5,
    maxSize: process.env.LOG_MAX_SIZE || '10m'
  },

  security: {
    helmet: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
          scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
          imgSrc: ["'self'", "data:", "https:", "http:"],
          fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
          connectSrc: ["'self'"],
          mediaSrc: ["'self'", "data:"]
        }
      },
      crossOriginEmbedderPolicy: false
    },
    trustProxy: process.env.TRUST_PROXY === 'true'
  },

  validation: {
    minPasswordLength: 8,
    maxPasswordLength: 128,
    maxTitleLength: 255,
    maxDescriptionLength: 5000,
    maxUsernameLength: 50,
    emailValidation: true,
    sanitizeHtml: true
  },

  analytics: {
    enabled: process.env.ANALYTICS_ENABLED !== 'false',
    retentionDays: parseInt(process.env.ANALYTICS_RETENTION_DAYS) || 90,
    trackIpAddresses: process.env.TRACK_IP_ADDRESSES === 'true',
    privacyMode: process.env.PRIVACY_MODE !== 'false'
  },

  uploads: {
    tempDir: process.env.UPLOAD_TEMP_DIR || './temp',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 500 * 1024 * 1024, // 500MB
    allowedFileTypes: ['audio/mpeg', 'audio/wav', 'audio/m4a', 'image/jpeg', 'image/png'],
    cleanupInterval: parseInt(process.env.CLEANUP_INTERVAL) || 3600000 // 1 hour
  }
};

// Validate required environment variables in production
if (config.app.env === 'production') {
  const required = ['JWT_SECRET', 'SESSION_SECRET'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.warn(`⚠️  Missing recommended environment variables: ${missing.join(', ')}`);
  }
}

module.exports = config;