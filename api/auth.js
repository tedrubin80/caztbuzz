// api/auth.js - MySQL version for authentication
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../lib/mysql.js';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    switch (req.method) {
      case 'POST':
        if (req.body.action === 'login') {
          return await handleLogin(req, res);
        } else if (req.body.action === 'verify') {
          return await handleVerify(req, res);
        }
        break;
      case 'GET':
        return await handleVerify(req, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /api/auth - Login
async function handleLogin(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  try {
    // Check if using default admin credentials
    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
      const token = jwt.sign(
        { 
          userId: 1, 
          username: process.env.ADMIN_USERNAME, 
          role: 'super_admin',
          isDefaultAdmin: true 
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      return res.status(200).json({
        success: true,
        token,
        user: {
          id: 1,
          username: process.env.ADMIN_USERNAME,
          role: 'super_admin',
          isDefaultAdmin: true
        }
      });
    }

    // Check database users
    const users = await query(
      'SELECT id, email, password_hash, first_name, last_name, role, status FROM users WHERE email = ? AND status = "active"',
      [username]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        role: user.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Log successful login
    await query(
      'INSERT INTO activity_logs (user_id, action, ip_address, created_at) VALUES (?, ?, ?, NOW())',
      [user.id, 'login', req.headers['x-forwarded-for'] || 'unknown']
    );

    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Login failed' });
  }
}

// GET /api/auth - Verify token
async function handleVerify(req, res) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // If default admin
    if (decoded.isDefaultAdmin) {
      return res.status(200).json({
        valid: true,
        user: {
          id: 1,
          username: process.env.ADMIN_USERNAME,
          role: 'super_admin',
          isDefaultAdmin: true
        }
      });
    }

    // Check database user
    const users = await query(
      'SELECT id, email, first_name, last_name, role, status FROM users WHERE id = ? AND status = "active"',
      [decoded.userId]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = users[0];

    return res.status(200).json({
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role
      }
    });

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Helper function for other API files
export async function verifyAdmin(req) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false };
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Default admin
    if (decoded.isDefaultAdmin) {
      return { 
        valid: true, 
        user: { 
          id: 1, 
          username: process.env.ADMIN_USERNAME, 
          role: 'super_admin' 
        } 
      };
    }

    // Database user
    const users = await query(
      'SELECT id, email, first_name, last_name, role FROM users WHERE id = ? AND status = "active"',
      [decoded.userId]
    );

    if (users.length === 0) {
      return { valid: false };
    }

    return { valid: true, user: users[0] };

  } catch (error) {
    return { valid: false };
  }
}