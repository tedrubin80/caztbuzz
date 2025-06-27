#!/bin/bash
# scripts/backup-mysql.sh
# MySQL backup script for CastBuzz

# Load environment variables
if [ -f "$(dirname "$0")/../config/.env" ]; then
    export $(cat "$(dirname "$0")/../config/.env" | grep -v '^#' | xargs)
fi

# Configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-castbuzz_backup}"
DB_PASS="${DB_PASSWORD}"
DB_NAME="${DB_NAME:-castbuzz_production}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/mysql}"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS="${RETENTION_DAYS:-30}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo -e "${YELLOW}Starting MySQL backup for database: $DB_NAME${NC}"
echo "Timestamp: $(date)"

# Check if password is set
if [ -z "$DB_PASS" ]; then
    echo -e "${RED}Error: Database password not set${NC}"
    echo "Please set DB_PASSWORD in your .env file or environment"
    exit 1
fi

# Perform backup
echo -e "${YELLOW}Creating backup...${NC}"
BACKUP_FILE="$BACKUP_DIR/castbuzz_${DATE}.sql"

mysqldump \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --user="$DB_USER" \
    --password="$DB_PASS" \
    --single-transaction \
    --routines \
    --triggers \
    --add-drop-table \
    --extended-insert \
    --hex-blob \
    "$DB_NAME" > "$BACKUP_FILE"

# Check if backup was successful
if [ $? -eq 0 ]; then
    echo -e "${GREEN}Backup created successfully: $BACKUP_FILE${NC}"
    
    # Compress the backup
    echo -e "${YELLOW}Compressing backup...${NC}"
    gzip "$BACKUP_FILE"
    BACKUP_FILE="${BACKUP_FILE}.gz"
    
    # Get file size
    SIZE=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')
    echo -e "${GREEN}Compressed backup size: $SIZE${NC}"
    
    # Remove old backups
    echo -e "${YELLOW}Removing backups older than $RETENTION_DAYS days...${NC}"
    find "$BACKUP_DIR" -name "castbuzz_*.sql.gz" -mtime +$RETENTION_DAYS -delete
    
    # Count remaining backups
    BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/castbuzz_*.sql.gz 2>/dev/null | wc -l)
    echo -e "${GREEN}Total backups retained: $BACKUP_COUNT${NC}"
    
    # Upload to S3 if configured
    if [ ! -z "$S3_BUCKET" ] && [ ! -z "$S3_ACCESS_KEY_ID" ]; then
        echo -e "${YELLOW}Uploading to S3...${NC}"
        
        # Using AWS CLI
        if command -v aws &> /dev/null; then
            aws s3 cp "$BACKUP_FILE" "s3://$S3_BUCKET/backups/mysql/" \
                --storage-class STANDARD_IA
            
            if [ $? -eq 0 ]; then
                echo -e "${GREEN}Backup uploaded to S3 successfully${NC}"
            else
                echo -e "${RED}Failed to upload backup to S3${NC}"
            fi
        else
            echo -e "${YELLOW}AWS CLI not installed, skipping S3 upload${NC}"
        fi
    fi
    
    # Log success
    echo "$(date): Backup completed successfully - $BACKUP_FILE" >> "$BACKUP_DIR/backup.log"
    
else
    echo -e "${RED}Backup failed!${NC}"
    echo "$(date): Backup failed" >> "$BACKUP_DIR/backup.log"
    exit 1
fi

echo -e "${GREEN}Backup process completed!${NC}"
echo "----------------------------------------"

# Optional: Send notification (example using mail command)
if command -v mail &> /dev/null && [ ! -z "$ADMIN_EMAIL" ]; then
    echo "CastBuzz backup completed successfully at $(date). File: $BACKUP_FILE, Size: $SIZE" | \
        mail -s "CastBuzz Backup Success" "$ADMIN_EMAIL"
fi

exit 0