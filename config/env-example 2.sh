# config/.env.example
# Copy this file to .env and update with your actual values

# Application
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000

# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=castbuzz_user
DB_PASSWORD=your_secure_password_here
DB_NAME=castbuzz_production
DB_CONNECTION_LIMIT=10
DB_SSL=false

# Authentication
JWT_SECRET=generate_a_random_32_character_secret_key_here
JWT_EXPIRY=1h
REFRESH_TOKEN_EXPIRY=7d
SESSION_SECRET=generate_another_random_secret_for_sessions
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_DURATION=1800000
PASSWORD_RESET_EXPIRY=3600000

# CORS
CORS_ORIGIN=http://localhost:3000,https://yourdomain.com

# Rate Limiting
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100

# S3 Storage
S3_ENDPOINT=https://s3.amazonaws.com
S3_REGION=us-east-1
S3_BUCKET=your-castbuzz-bucket
S3_ACCESS_KEY_ID=your_access_key
S3_SECRET_ACCESS_KEY=your_secret_key
S3_USE_PATH_STYLE=false
MAX_FILE_SIZE=524288000

# Email (Optional)
EMAIL_SERVICE=smtp
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your_email@domain.com
EMAIL_PASSWORD=your_email_password
EMAIL_FROM=noreply@castbuzz.com

# Redis (Optional)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_TTL=3600

# Logging
LOG_LEVEL=info
LOG_FILE=logs/app.log
LOG_MAX_SIZE=10m
LOG_MAX_FILES=5

# Monitoring (Optional)
MONITORING_ENABLED=false
MONITORING_ENDPOINT=
MONITORING_API_KEY=

# Features
ALLOW_REGISTRATION=false
EMAIL_VERIFICATION=false
TWO_FACTOR_AUTH=true
API_KEYS=true
FILE_UPLOADS=true
ANALYTICS=true