// config/app.config.js
// Main application configuration

require('dotenv').config({ path: './config/.env' });

module.exports = {
    app: {
        port: process.env.PORT || 3000,
        env: process.env.NODE_ENV || 'development',
        url: process.env.APP_URL || 'http://localhost:3000'
    },
    
    database: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'castbuzz_production',
        connectionLimit: process.env.DB_CONNECTION_LIMIT || 10,
        acquireTimeout: 60000,
        timeout: 60000,
        charset: 'utf8mb4',
        ssl: process.env.DB_SSL === 'true' ? {
            rejectUnauthorized: false
        } : false
    },
    
    auth: {
        jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this',
        jwtExpiry: process.env.JWT_EXPIRY || '1h',
        refreshTokenExpiry: process.env.REFRESH_TOKEN_EXPIRY || '7d',
        sessionSecret: process.env.SESSION_SECRET || 'your-session-secret-change-this',
        maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5,
        lockoutDuration: parseInt(process.env.LOCKOUT_DURATION) || 30 * 60 * 1000, // 30 minutes
        passwordResetExpiry: parseInt(process.env.PASSWORD_RESET_EXPIRY) || 60 * 60 * 1000, // 1 hour
        apiKeyExpiry: parseInt(process.env.API_KEY_EXPIRY) || 365 * 24 * 60 * 60 * 1000 // 1 year
    },
    
    cors: {
        origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:3000'],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Session-ID', 'X-2FA-Token']
    },
    
    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000, // 15 minutes
        max: parseInt(process.env.RATE_LIMIT_MAX) || 100, // 100 requests per window
        message: 'Too many requests from this IP, please try again later.',
        standardHeaders: true,
        legacyHeaders: false
    },
    
    s3: {
        endpoint: process.env.S3_ENDPOINT || '',
        region: process.env.S3_REGION || 'us-east-1',
        bucket: process.env.S3_BUCKET || '',
        accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
        usePathStyle: process.env.S3_USE_PATH_STYLE === 'true',
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 500 * 1024 * 1024, // 500MB
        allowedMimeTypes: [
            'audio/mpeg',
            'audio/mp3',
            'audio/wav',
            'audio/ogg',
            'audio/mp4',
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp'
        ]
    },
    
    email: {
        service: process.env.EMAIL_SERVICE || 'smtp',
        host: process.env.EMAIL_HOST || '',
        port: parseInt(process.env.EMAIL_PORT) || 587,
        secure: process.env.EMAIL_SECURE === 'true',
        user: process.env.EMAIL_USER || '',
        password: process.env.EMAIL_PASSWORD || '',
        from: process.env.EMAIL_FROM || 'noreply@castbuzz.com'
    },
    
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || '',
        db: parseInt(process.env.REDIS_DB) || 0,
        ttl: parseInt(process.env.REDIS_TTL) || 3600 // 1 hour
    },
    
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        file: process.env.LOG_FILE || 'logs/app.log',
        maxSize: process.env.LOG_MAX_SIZE || '10m',
        maxFiles: parseInt(process.env.LOG_MAX_FILES) || 5
    },
    
    monitoring: {
        enabled: process.env.MONITORING_ENABLED === 'true',
        endpoint: process.env.MONITORING_ENDPOINT || '',
        apiKey: process.env.MONITORING_API_KEY || ''
    },
    
    features: {
        registration: process.env.ALLOW_REGISTRATION === 'true',
        emailVerification: process.env.EMAIL_VERIFICATION === 'true',
        twoFactorAuth: process.env.TWO_FACTOR_AUTH === 'true',
        apiKeys: process.env.API_KEYS === 'true',
        fileUploads: process.env.FILE_UPLOADS === 'true',
        analytics: process.env.ANALYTICS === 'true'
    },
    
    validation: {
        maxEmailLength: 255,
        maxNameLength: 100,
        minPasswordLength: 8,
        maxPasswordLength: 128,
        maxDescriptionLength: 2000,
        maxTitleLength: 255
    }
};