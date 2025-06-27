// middleware/auth.js
// Enhanced authentication middleware with JWT, API keys, and permissions

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config/app.config');

// Main authentication middleware
exports.requireAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const apiKey = req.headers['x-api-key'];
        
        let user = null;
        
        // Check for API key first
        if (apiKey) {
            user = await this.validateApiKey(apiKey);
            if (!user) {
                return res.status(401).json({ error: 'Invalid API key' });
            }
        }
        // Check for JWT token
        else if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            user = await this.validateJWTToken(token);
            if (!user) {
                return res.status(401).json({ error: 'Invalid or expired token' });
            }
        }
        else {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        req.user = user;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(401).json({ error: 'Authentication failed' });
    }
};

// Optional authentication (doesn't fail if no auth)
exports.optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const apiKey = req.headers['x-api-key'];
        
        if (apiKey) {
            const user = await this.validateApiKey(apiKey);
            if (user) req.user = user;
        }
        else if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const user = await this.validateJWTToken(token);
            if (user) req.user = user;
        }
        
        next();
    } catch (error) {
        console.warn('Optional auth error:', error);
        next();
    }
};

// Validate JWT token
exports.validateJWTToken = async (token) => {
    try {
        const decoded = jwt.verify(token, config.auth.jwtSecret);
        const user = await User.findById(decoded.userId);
        
        if (!user || user.status !== 'active') {
            return null;
        }
        
        return user;
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            throw new Error('Token expired');
        }
        return null;
    }
};

// Validate API key
exports.validateApiKey = async (apiKey) => {
    try {
        if (!apiKey.startsWith('cb_')) {
            return null;
        }
        
        const keyPrefix = apiKey.split('_')[0] + '_' + apiKey.split('_')[1];
        const result = await User.validateApiKey(keyPrefix, apiKey);
        
        if (!result) return null;
        
        // Return user-like object for API key auth
        return {
            id: result.user_id,
            email: result.email,
            role: result.role,
            permissions: result.permissions,
            auth_type: 'api_key'
        };
    } catch (error) {
        console.error('API key validation error:', error);
        return null;
    }
};

// Permission-based authorization
exports.requirePermission = (permission) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        // Super admin has all permissions
        if (req.user.role === 'super_admin') {
            return next();
        }
        
        // Check if user has the specific permission
        if (!req.user.permissions || !req.user.permissions.includes(permission)) {
            return res.status(403).json({ 
                error: 'Insufficient permissions',
                required: permission,
                user_permissions: req.user.permissions
            });
        }
        
        next();
    };
};

// Role-based authorization
exports.requireRole = (roles) => {
    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ 
                error: 'Insufficient role privileges',
                required: allowedRoles,
                current: req.user.role
            });
        }
        
        next();
    };
};

// Check if user owns resource or has permission
exports.requireOwnership = (resourceField = 'created_by') => {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        // Super admin and admin bypass ownership check
        if (['super_admin', 'admin'].includes(req.user.role)) {
            return next();
        }
        
        // Get resource ID from params
        const resourceId = req.params.id;
        if (!resourceId) {
            return res.status(400).json({ error: 'Resource ID required' });
        }
        
        // This would need to be implemented per resource type
        // For now, just check if user ID matches
        if (req.user.id === parseInt(resourceId)) {
            return next();
        }
        
        return res.status(403).json({ error: 'Access denied: not resource owner' });
    };
};

// Rate limiting by user
exports.userRateLimit = (maxRequests = 100, windowMinutes = 15) => {
    const userRequests = new Map();
    
    return (req, res, next) => {
        if (!req.user) return next(); // Skip if no user
        
        const userId = req.user.id;
        const now = Date.now();
        const windowMs = windowMinutes * 60 * 1000;
        
        if (!userRequests.has(userId)) {
            userRequests.set(userId, { count: 1, resetTime: now + windowMs });
            return next();
        }
        
        const userLimit = userRequests.get(userId);
        
        if (now > userLimit.resetTime) {
            userLimit.count = 1;
            userLimit.resetTime = now + windowMs;
        } else {
            userLimit.count++;
        }
        
        if (userLimit.count > maxRequests) {
            return res.status(429).json({ 
                error: 'Rate limit exceeded',
                reset_at: new Date(userLimit.resetTime).toISOString()
            });
        }
        
        // Add rate limit headers
        res.set({
            'X-RateLimit-Limit': maxRequests,
            'X-RateLimit-Remaining': Math.max(0, maxRequests - userLimit.count),
            'X-RateLimit-Reset': new Date(userLimit.resetTime).toISOString()
        });
        
        next();
    };
};

// 2FA verification middleware
exports.require2FA = async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Check if user has 2FA enabled
    if (!req.user.has_2fa) {
        return res.status(403).json({ 
            error: '2FA required',
            message: 'This action requires two-factor authentication to be enabled'
        });
    }
    
    // Check for 2FA token in headers
    const twoFAToken = req.headers['x-2fa-token'];
    if (!twoFAToken) {
        return res.status(403).json({ 
            error: '2FA token required',
            message: 'Please provide your 2FA token in X-2FA-Token header'
        });
    }
    
    // Verify 2FA token
    const isValid = await User.verify2FA(req.user.id, twoFAToken);
    if (!isValid) {
        return res.status(403).json({ error: 'Invalid 2FA token' });
    }
    
    next();
};

// Session validation (for session-based auth)
exports.validateSession = async (req, res, next) => {
    try {
        const sessionId = req.headers['x-session-id'] || req.cookies.session_id;
        
        if (!sessionId) {
            return res.status(401).json({ error: 'Session ID required' });
        }
        
        // Check session in database
        const sql = `
            SELECT us.*, u.id, u.email, u.role, u.status
            FROM user_sessions us
            JOIN users u ON us.user_id = u.id
            WHERE us.id = ? AND us.last_activity > DATE_SUB(NOW(), INTERVAL 24 HOUR)
        `;
        
        const [session] = await db.query(sql, [sessionId]);
        
        if (!session || session.status !== 'active') {
            return res.status(401).json({ error: 'Invalid or expired session' });
        }
        
        // Update last activity
        await db.query('UPDATE user_sessions SET last_activity = NOW() WHERE id = ?', [sessionId]);
        
        // Get full user with permissions
        req.user = await User.findById(session.user_id);
        next();
    } catch (error) {
        console.error('Session validation error:', error);
        return res.status(401).json({ error: 'Session validation failed' });
    }
};

// Log request activity
exports.logActivity = (action) => {
    return async (req, res, next) => {
        if (req.user) {
            try {
                await User.logActivity(req.user.id, action, {
                    entityType: req.params.resource || null,
                    entityId: req.params.id || null,
                    data: {
                        method: req.method,
                        path: req.path,
                        body: req.method !== 'GET' ? req.body : undefined
                    },
                    ipAddress: req.ip,
                    userAgent: req.get('user-agent')
                });
            } catch (error) {
                console.error('Activity logging error:', error);
            }
        }
        next();
    };
};

// Audit sensitive actions
exports.auditAction = (actionType) => {
    return async (req, res, next) => {
        const originalSend = res.json;
        
        res.json = function(data) {
            // Log successful actions
            if (res.statusCode < 400 && req.user) {
                setImmediate(async () => {
                    try {
                        await User.logActivity(req.user.id, `${actionType}_success`, {
                            entityType: req.params.resource,
                            entityId: req.params.id,
                            data: {
                                request: {
                                    method: req.method,
                                    path: req.path,
                                    body: req.body
                                },
                                response: data
                            },
                            ipAddress: req.ip,
                            userAgent: req.get('user-agent')
                        });
                    } catch (error) {
                        console.error('Audit logging error:', error);
                    }
                });
            }
            
            originalSend.call(this, data);
        };
        
        next();
    };
};