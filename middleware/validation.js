// middleware/validation.js
// Input validation and sanitization middleware

const { body, validationResult } = require('express-validator');
const config = require('../config/app.config');

// Generic validation error handler
exports.handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Validation failed',
            errors: errors.array()
        });
    }
    next();
};

// Show validation rules
exports.validateShow = [
    body('name')
        .notEmpty()
        .withMessage('Show name is required')
        .trim()
        .isLength({ min: 1, max: config.validation.maxTitleLength })
        .withMessage(`Show name must be between 1 and ${config.validation.maxTitleLength} characters`)
        .escape(),
    
    body('description')
        .optional()
        .trim()
        .isLength({ max: config.validation.maxDescriptionLength })
        .withMessage(`Description must not exceed ${config.validation.maxDescriptionLength} characters`)
        .escape(),
    
    body('color')
        .optional()
        .matches(/^#[0-9A-F]{6}$/i)
        .withMessage('Color must be a valid hex color (e.g., #FF0000)'),
    
    body('imageUrl')
        .optional()
        .isURL()
        .withMessage('Image URL must be a valid URL')
        .isLength({ max: 500 })
        .withMessage('Image URL must not exceed 500 characters'),
    
    body('is_active')
        .optional()
        .isBoolean()
        .withMessage('is_active must be a boolean value')
];

// Episode validation rules
exports.validateEpisode = [
    body('title')
        .notEmpty()
        .withMessage('Episode title is required')
        .trim()
        .isLength({ min: 1, max: config.validation.maxTitleLength })
        .withMessage(`Episode title must be between 1 and ${config.validation.maxTitleLength} characters`)
        .escape(),
    
    body('description')
        .optional()
        .trim()
        .isLength({ max: config.validation.maxDescriptionLength })
        .withMessage(`Description must not exceed ${config.validation.maxDescriptionLength} characters`)
        .escape(),
    
    body('show_id')
        .notEmpty()
        .withMessage('Show ID is required')
        .isInt({ min: 1 })
        .withMessage('Show ID must be a valid integer'),
    
    body('audio_url')
        .notEmpty()
        .withMessage('Audio URL is required')
        .isURL()
        .withMessage('Audio URL must be a valid URL'),
    
    body('image_url')
        .optional()
        .isURL()
        .withMessage('Image URL must be a valid URL'),
    
    body('duration')
        .optional()
        .matches(/^([0-9]{1,2}:)?[0-5]?[0-9]:[0-5][0-9]$/)
        .withMessage('Duration must be in format HH:MM:SS or MM:SS'),
    
    body('season')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Season must be a positive integer'),
    
    body('episode_number')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Episode number must be a positive integer'),
    
    body('is_published')
        .optional()
        .isBoolean()
        .withMessage('is_published must be a boolean value')
];

// User validation rules
exports.validateUser = [
    body('email')
        .isEmail()
        .withMessage('Valid email is required')
        .normalizeEmail()
        .isLength({ max: config.validation.maxEmailLength })
        .withMessage(`Email must not exceed ${config.validation.maxEmailLength} characters`),
    
    body('password')
        .isLength({ min: config.validation.minPasswordLength, max: config.validation.maxPasswordLength })
        .withMessage(`Password must be between ${config.validation.minPasswordLength} and ${config.validation.maxPasswordLength} characters`)
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
    
    body('first_name')
        .notEmpty()
        .withMessage('First name is required')
        .trim()
        .isLength({ min: 1, max: config.validation.maxNameLength })
        .withMessage(`First name must be between 1 and ${config.validation.maxNameLength} characters`)
        .matches(/^[a-zA-Z\s'-]+$/)
        .withMessage('First name can only contain letters, spaces, hyphens, and apostrophes')
        .escape(),
    
    body('last_name')
        .notEmpty()
        .withMessage('Last name is required')
        .trim()
        .isLength({ min: 1, max: config.validation.maxNameLength })
        .withMessage(`Last name must be between 1 and ${config.validation.maxNameLength} characters`)
        .matches(/^[a-zA-Z\s'-]+$/)
        .withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes')
        .escape(),
    
    body('role')
        .optional()
        .isIn(['super_admin', 'admin', 'editor', 'author', 'viewer'])
        .withMessage('Role must be one of: super_admin, admin, editor, author, viewer')
];

// File upload validation
exports.validateFileUpload = [
    body('filename')
        .notEmpty()
        .withMessage('Filename is required')
        .isLength({ max: 255 })
        .withMessage('Filename must not exceed 255 characters'),
    
    body('contentType')
        .notEmpty()
        .withMessage('Content type is required')
        .custom((value) => {
            const allowedTypes = config.s3.allowedMimeTypes;
            if (!allowedTypes.includes(value)) {
                throw new Error(`Content type must be one of: ${allowedTypes.join(', ')}`);
            }
            return true;
        }),
    
    body('size')
        .notEmpty()
        .withMessage('File size is required')
        .isInt({ min: 1, max: config.s3.maxFileSize })
        .withMessage(`File size must be between 1 byte and ${config.s3.maxFileSize} bytes`),
    
    body('entityType')
        .notEmpty()
        .withMessage('Entity type is required')
        .isIn(['episode', 'show_cover', 'user_avatar'])
        .withMessage('Entity type must be one of: episode, show_cover, user_avatar'),
    
    body('entityId')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Entity ID must be a positive integer')
];

// Settings validation
exports.validateSettings = [
    body('site_name')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('Site name must not exceed 100 characters')
        .escape(),
    
    body('site_description')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Site description must not exceed 500 characters')
        .escape(),
    
    body('contact_email')
        .optional()
        .isEmail()
        .withMessage('Contact email must be a valid email address')
        .normalizeEmail(),
    
    body('timezone')
        .optional()
        .isIn(['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo'])
        .withMessage('Invalid timezone'),
    
    body('language')
        .optional()
        .isIn(['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh'])
        .withMessage('Invalid language code')
];

// API Key validation
exports.validateApiKey = [
    body('name')
        .notEmpty()
        .withMessage('API key name is required')
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage('API key name must be between 1 and 100 characters')
        .escape(),
    
    body('permissions')
        .optional()
        .isArray()
        .withMessage('Permissions must be an array'),
    
    body('permissions.*')
        .optional()
        .isString()
        .withMessage('Each permission must be a string')
        .isLength({ max: 100 })
        .withMessage('Permission names must not exceed 100 characters')
];

// Password change validation
exports.validatePasswordChange = [
    body('currentPassword')
        .notEmpty()
        .withMessage('Current password is required'),
    
    body('newPassword')
        .isLength({ min: config.validation.minPasswordLength, max: config.validation.maxPasswordLength })
        .withMessage(`New password must be between ${config.validation.minPasswordLength} and ${config.validation.maxPasswordLength} characters`)
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('New password must contain at least one lowercase letter, one uppercase letter, and one number')
        .custom((value, { req }) => {
            if (value === req.body.currentPassword) {
                throw new Error('New password must be different from current password');
            }
            return true;
        })
];

// 2FA validation
exports.validate2FA = [
    body('token')
        .notEmpty()
        .withMessage('2FA token is required')
        .isLength({ min: 6, max: 6 })
        .withMessage('2FA token must be 6 digits')
        .isNumeric()
        .withMessage('2FA token must contain only numbers')
];

// Sanitization helpers
exports.sanitizeHtml = (req, res, next) => {
    const fieldsToSanitize = ['name', 'title', 'description', 'first_name', 'last_name'];
    
    fieldsToSanitize.forEach(field => {
        if (req.body[field] && typeof req.body[field] === 'string') {
            // Remove HTML tags and dangerous characters
            req.body[field] = req.body[field]
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
                .replace(/javascript:/gi, '')
                .replace(/on\w+\s*=/gi, '');
        }
    });
    
    next();
};

// Rate limiting per user action
exports.actionRateLimit = (action, maxAttempts = 10, windowMinutes = 15) => {
    const attempts = new Map();
    
    return (req, res, next) => {
        if (!req.user) return next();
        
        const key = `${req.user.id}:${action}`;
        const now = Date.now();
        const windowMs = windowMinutes * 60 * 1000;
        
        if (!attempts.has(key)) {
            attempts.set(key, { count: 1, resetTime: now + windowMs });
            return next();
        }
        
        const userAttempts = attempts.get(key);
        
        if (now > userAttempts.resetTime) {
            userAttempts.count = 1;
            userAttempts.resetTime = now + windowMs;
        } else {
            userAttempts.count++;
        }
        
        if (userAttempts.count > maxAttempts) {
            return res.status(429).json({
                error: `Too many ${action} attempts`,
                reset_at: new Date(userAttempts.resetTime).toISOString()
            });
        }
        
        next();
    };
};

// Custom validation for slug uniqueness
exports.validateUniqueSlug = (model) => {
    return async (req, res, next) => {
        try {
            if (req.body.name) {
                const slug = model.generateSlug(req.body.name);
                const isValid = await model.validateSlug(slug, req.params.id);
                
                if (!isValid) {
                    return res.status(409).json({
                        error: 'A record with this name already exists'
                    });
                }
            }
            next();
        } catch (error) {
            console.error('Slug validation error:', error);
            res.status(500).json({ error: 'Validation failed' });
        }
    };
};