const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');
const { AuthenticationError } = require('../utils/errorFormatter');

/**
 * JWT Authentication middleware
 * Supports both Bearer token and API key authentication
 */
module.exports = async function (req, res, next) {
  try {
    let token = null;
    let user = null;
    let authMethod = null;

    // Check for Bearer token in Authorization header
    const authHeader = req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
      authMethod = 'jwt';
    }
    
    // Check for API key in header or query parameter
    const apiKey = req.header('X-API-Key') || req.query.apiKey;
    if (apiKey && !token) {
      authMethod = 'apikey';
    }

    // If no authentication method provided
    if (!token && !apiKey) {
      throw new AuthenticationError('No authentication token provided');
    }

    // Authenticate with JWT token
    if (authMethod === 'jwt') {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        user = await User.findById(decoded.id).select('-password');
        
        if (!user) {
          throw new AuthenticationError('User not found');
        }

      } catch (jwtError) {
        if (jwtError.name === 'JsonWebTokenError') {
          throw new AuthenticationError('Invalid token');
        } else if (jwtError.name === 'TokenExpiredError') {
          throw new AuthenticationError('Token expired');
        }
        throw jwtError;
      }
    }

    // Authenticate with API key
    if (authMethod === 'apikey') {
      if (!apiKey.startsWith('wsg_')) {
        throw new AuthenticationError('Invalid API key format');
      }

      user = await User.findByApiKey(apiKey);
      if (!user) {
        throw new AuthenticationError('Invalid API key');
      }
    }

    // Check if user account is active
    if (user.status !== 'active') {
      const statusMessages = {
        suspended: 'Account has been suspended',
        pending_verification: 'Email verification required',
        deleted: 'Account has been deleted'
      };
      
      throw new AuthenticationError(
        statusMessages[user.status] || 'Account is not active'
      );
    }

    // Check if account is locked
    if (user.isLocked) {
      const lockTime = Math.ceil((user.lockUntil - Date.now()) / 60000); // minutes
      throw new AuthenticationError(
        `Account is temporarily locked. Try again in ${lockTime} minutes.`
      );
    }

    // Update user's last activity (for JWT auth only, not for every API key request)
    if (authMethod === 'jwt') {
      user.lastActiveAt = new Date();
      await user.save({ validateBeforeSave: false });
    }

    // Add user and auth method to request
    req.user = user;
    req.authMethod = authMethod;

    // Add user context to logger for this request
    req.logger = logger.child({
      userId: user._id,
      userEmail: user.email,
      authMethod
    });

    next();

  } catch (error) {
    // Log authentication failure
    logger.warn('Authentication failed:', {
      error: error.message,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.originalUrl,
      method: req.method
    });

    // Return appropriate error response
    if (error instanceof AuthenticationError) {
      return res.status(401).json({
        error: error.message,
        code: 'AUTHENTICATION_FAILED',
        timestamp: new Date().toISOString()
      });
    }

    // Generic authentication error for unexpected errors
    return res.status(401).json({
      error: 'Authentication failed',
      code: 'AUTHENTICATION_ERROR',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Optional authentication middleware
 * Adds user to request if authenticated, but doesn't require authentication
 */
module.exports.optional = async function (req, res, next) {
  try {
    const authHeader = req.header('Authorization');
    const apiKey = req.header('X-API-Key') || req.query.apiKey;

    if (!authHeader && !apiKey) {
      return next(); // No authentication provided, continue without user
    }

    // Try to authenticate, but don't fail if it doesn't work
    try {
      await module.exports(req, res, next);
    } catch (error) {
      // Authentication failed, but continue without user
      next();
    }
  } catch (error) {
    next();
  }
};

/**
 * API Key only authentication
 * Only accepts API key authentication, not JWT tokens
 */
module.exports.apiKeyOnly = async function (req, res, next) {
  try {
    const apiKey = req.header('X-API-Key') || req.query.apiKey;

    if (!apiKey) {
      throw new AuthenticationError('API key required');
    }

    if (!apiKey.startsWith('wsg_')) {
      throw new AuthenticationError('Invalid API key format');
    }

    const user = await User.findByApiKey(apiKey);
    if (!user) {
      throw new AuthenticationError('Invalid API key');
    }

    if (user.status !== 'active') {
      throw new AuthenticationError('Account is not active');
    }

    req.user = user;
    req.authMethod = 'apikey';
    
    next();

  } catch (error) {
    logger.warn('API key authentication failed:', {
      error: error.message,
      ip: req.ip,
      endpoint: req.originalUrl
    });

    return res.status(401).json({
      error: error.message || 'API key authentication failed',
      code: 'API_KEY_AUTH_FAILED',
      timestamp: new Date().toISOString()
    });
  }
};
