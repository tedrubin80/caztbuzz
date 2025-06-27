// lib/database.js
// Database connection manager using mysql2 with connection pooling

const mysql = require('mysql2/promise');
const dbConfig = require('../config/database.config');

class Database {
    constructor() {
        this.pool = null;
        this.isConnected = false;
    }
    
    async connect() {
        if (this.pool && this.isConnected) {
            return this.pool;
        }
        
        try {
            // Create connection pool
            this.pool = mysql.createPool(dbConfig);
            
            // Test the connection
            const connection = await this.pool.getConnection();
            await connection.ping();
            connection.release();
            
            this.isConnected = true;
            
            console.log(`✅ MySQL connected successfully to ${dbConfig.database}`);
            console.log(`📊 Connection pool created with limit: ${dbConfig.connectionLimit}`);
            
            // Set up connection pool event handlers
            this.setupEventHandlers();
            
            return this.pool;
        } catch (error) {
            console.error('❌ MySQL connection failed:', error.message);
            this.isConnected = false;
            throw new Error(`Database connection failed: ${error.message}`);
        }
    }
    
    setupEventHandlers() {
        if (!this.pool) return;
        
        this.pool.on('connection', (connection) => {
            console.log(`🔗 New MySQL connection established: ${connection.threadId}`);
        });
        
        this.pool.on('acquire', (connection) => {
            if (dbConfig.debug) {
                console.log(`📤 Connection ${connection.threadId} acquired`);
            }
        });
        
        this.pool.on('release', (connection) => {
            if (dbConfig.debug) {
                console.log(`📥 Connection ${connection.threadId} released`);
            }
        });
        
        this.pool.on('error', (error) => {
            console.error('❌ MySQL pool error:', error);
            if (error.code === 'PROTOCOL_CONNECTION_LOST') {
                console.log('🔄 Attempting to reconnect...');
                this.handleDisconnect();
            }
        });
    }
    
    async handleDisconnect() {
        this.isConnected = false;
        
        try {
            if (this.pool) {
                await this.pool.end();
            }
            
            setTimeout(async () => {
                console.log('🔄 Reconnecting to MySQL...');
                await this.connect();
            }, 2000);
        } catch (error) {
            console.error('❌ Error handling disconnect:', error);
        }
    }
    
    async query(sql, params = []) {
        if (!this.pool || !this.isConnected) {
            await this.connect();
        }
        
        try {
            const startTime = Date.now();
            const [rows] = await this.pool.execute(sql, params);
            const duration = Date.now() - startTime;
            
            if (dbConfig.debug) {
                console.log(`🔍 SQL Query executed in ${duration}ms:`, {
                    sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
                    params: params.length > 0 ? params : undefined,
                    rowCount: Array.isArray(rows) ? rows.length : 'N/A'
                });
            }
            
            return rows;
        } catch (error) {
            console.error('❌ SQL Query failed:', {
                error: error.message,
                code: error.code,
                sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
                params
            });
            
            // Handle specific MySQL errors
            if (error.code === 'ER_DUP_ENTRY') {
                throw new Error('Duplicate entry: Record already exists');
            } else if (error.code === 'ER_NO_REFERENCED_ROW_2') {
                throw new Error('Reference constraint failed: Related record not found');
            } else if (error.code === 'ER_ROW_IS_REFERENCED_2') {
                throw new Error('Cannot delete: Record is referenced by other data');
            }
            
            throw error;
        }
    }
    
    async transaction(callback) {
        const connection = await this.pool.getConnection();
        
        try {
            await connection.beginTransaction();
            
            // Create a query function that uses this specific connection
            const queryFn = async (sql, params = []) => {
                const [rows] = await connection.execute(sql, params);
                return rows;
            };
            
            const result = await callback(queryFn);
            await connection.commit();
            
            return result;
        } catch (error) {
            await connection.rollback();
            console.error('❌ Transaction failed, rolled back:', error.message);
            throw error;
        } finally {
            connection.release();
        }
    }
    
    async getConnectionStatus() {
        if (!this.pool) {
            return {
                connected: false,
                poolSize: 0,
                activeConnections: 0,
                queuedConnections: 0
            };
        }
        
        try {
            const connection = await this.pool.getConnection();
            connection.release();
            
            return {
                connected: this.isConnected,
                poolSize: this.pool.config.connectionLimit,
                activeConnections: this.pool._allConnections ? this.pool._allConnections.length : 0,
                queuedConnections: this.pool._connectionQueue ? this.pool._connectionQueue.length : 0,
                database: dbConfig.database,
                host: dbConfig.host
            };
        } catch (error) {
            return {
                connected: false,
                error: error.message
            };
        }
    }
    
    async healthCheck() {
        try {
            const [result] = await this.query('SELECT 1 as health_check');
            return {
                status: 'healthy',
                message: 'Database connection is working',
                timestamp: new Date().toISOString(),
                result: result.health_check === 1
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                message: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
    
    async getTableInfo(tableName) {
        const sql = `
            SELECT 
                COLUMN_NAME,
                DATA_TYPE,
                IS_NULLABLE,
                COLUMN_DEFAULT,
                COLUMN_KEY,
                EXTRA
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
            ORDER BY ORDINAL_POSITION
        `;
        
        return await this.query(sql, [dbConfig.database, tableName]);
    }
    
    async getDatabaseStats() {
        const sql = `
            SELECT 
                table_name,
                table_rows,
                ROUND(((data_length + index_length) / 1024 / 1024), 2) AS size_mb
            FROM information_schema.TABLES 
            WHERE table_schema = ?
            ORDER BY size_mb DESC
        `;
        
        return await this.query(sql, [dbConfig.database]);
    }
    
    async close() {
        if (this.pool) {
            try {
        