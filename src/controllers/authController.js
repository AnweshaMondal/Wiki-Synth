const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Pricing = require('../models/Pricing');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const logger = require('../utils/logger');
const { 
  formatValidationErrors, 
  AuthenticationError, 
  ValidationError,
  NotFoundError 
} = require('../utils/errorFormatter');

/**
 * Validation rules for user registration
 */
const registerValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  
  body('firstName')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be between 1 and 50 characters'),
  
  body('lastName')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be between 1 and 50 characters'),
  
  body('company')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Company name must be between 1 and 100 characters')
];

/**
 * Validation rules for user login
 */
const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

/**
 * Register a new user
 * POST /api/auth/register
 */
exports.register = [
  ...registerValidation,
  async (req, res, next) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(formatValidationErrors(errors.array()));
      }

      const { email, password, firstName, lastName, company } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(409).json({
          error: 'User with this email already exists',
          code: 'USER_EXISTS'
        });
      }

      // Get default free pricing plan
      const freePlan = await Pricing.getFreePlan();
      if (!freePlan) {
        throw new Error('Default pricing plan not configured');
      }

      // Create new user
      const user = new User({
        email,
        password,
        firstName,
        lastName,
        company,
        subscription: {
          plan: 'free',
          status: 'active',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      // Generate API key and email verification token
      user.generateApiKey();
      const emailVerificationToken = user.generateEmailVerificationToken();

      await user.save();

      // Generate auth token
      const authToken = user.generateAuthToken();

      // Log registration
      logger.logAuth('register', user._id, user.email, true, {
        plan: 'free',
        ipAddress: req.ip
      });

      // TODO: Send welcome email with verification token
      // await emailService.sendWelcomeEmail(user.email, emailVerificationToken);

      res.status(201).json({
        success: true,
        message: 'User registered successfully. Please check your email for verification.',
        data: {
          user: {
            id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            fullName: user.fullName,
            role: user.role,
            status: user.status,
            subscription: user.subscription,
            apiKey: user.apiKey,
            emailVerified: user.emailVerified
          },
          token: authToken,
          usage: {
            limits: user.getUsageLimits(),
            current: user.usage
          }
        }
      });

    } catch (error) {
      logger.error('Registration failed:', {
        email: req.body.email,
        error: error.message,
        stack: error.stack
      });
      next(error);
    }
  }
];

/**
 * Login user
 * POST /api/auth/login
 */
exports.login = [
  ...loginValidation,
  async (req, res, next) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(formatValidationErrors(errors.array()));
      }

      const { email, password } = req.body;

      // Find user and include password field
      const user = await User.findOne({ email }).select('+password');
      
      if (!user) {
        logger.logAuth('login', null, email, false, { reason: 'user_not_found' });
        throw new AuthenticationError('Invalid email or password');
      }

      // Check if account is locked
      if (user.isLocked) {
        logger.logAuth('login', user._id, email, false, { reason: 'account_locked' });
        throw new AuthenticationError('Account is temporarily locked. Please try again later.');
      }

      // Check if account is suspended
      if (user.status === 'suspended') {
        logger.logAuth('login', user._id, email, false, { reason: 'account_suspended' });
        throw new AuthenticationError('Account has been suspended. Please contact support.');
      }

      // Verify password
      const isPasswordValid = await user.comparePassword(password);
      
      if (!isPasswordValid) {
        await user.incLoginAttempts();
        logger.logAuth('login', user._id, email, false, { reason: 'invalid_password' });
        throw new AuthenticationError('Invalid email or password');
      }

      // Reset login attempts on successful login
      if (user.loginAttempts > 0) {
        await user.resetLoginAttempts();
      }

      // Update last login and activity
      user.lastLogin = new Date();
      user.lastActiveAt = new Date();
      user.ipAddress = req.ip;
      user.userAgent = req.get('User-Agent');

      // Check and reset monthly usage if needed
      await user.checkMonthlyReset();
      await user.save({ validateBeforeSave: false });

      // Generate auth token
      const authToken = user.generateAuthToken();

      // Log successful login
      logger.logAuth('login', user._id, email, true, {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            fullName: user.fullName,
            role: user.role,
            status: user.status,
            subscription: user.subscription,
            apiKey: user.apiKey,
            emailVerified: user.emailVerified,
            lastLogin: user.lastLogin,
            preferences: user.preferences
          },
          token: authToken,
          usage: {
            limits: user.getUsageLimits(),
            current: user.usage
          }
        }
      });

    } catch (error) {
      logger.error('Login failed:', {
        email: req.body.email,
        error: error.message
      });
      next(error);
    }
  }
];

/**
 * Refresh JWT token
 * POST /api/auth/refresh
 */
exports.refreshToken = async (req, res, next) => {
  try {
    // User is already authenticated via middleware
    const user = req.user;

    // Update last activity
    await user.updateLastActivity();

    // Generate new token
    const newToken = user.generateAuthToken();

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        token: newToken,
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          subscription: user.subscription
        }
      }
    });

  } catch (error) {
    logger.error('Token refresh failed:', {
      userId: req.user?._id,
      error: error.message
    });
    next(error);
  }
};

/**
 * Logout user
 * POST /api/auth/logout
 */
exports.logout = async (req, res, next) => {
  try {
    // In a production environment, you might want to:
    // 1. Blacklist the token
    // 2. Store logout timestamp
    // 3. Clear any session data

    logger.logAuth('logout', req.user._id, req.user.email, true);

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    logger.error('Logout failed:', {
      userId: req.user?._id,
      error: error.message
    });
    next(error);
  }
};

/**
 * Verify email address
 * POST /api/auth/verify-email
 */
exports.verifyEmail = [
  body('token')
    .notEmpty()
    .withMessage('Verification token is required'),

  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(formatValidationErrors(errors.array()));
      }

      const { token } = req.body;

      const user = await User.findByEmailVerificationToken(token);
      if (!user) {
        throw new NotFoundError('Invalid or expired verification token');
      }

      // Mark email as verified
      user.emailVerified = true;
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;
      user.status = 'active';

      await user.save({ validateBeforeSave: false });

      logger.logAuth('email_verified', user._id, user.email, true);

      res.status(200).json({
        success: true,
        message: 'Email verified successfully',
        data: {
          user: {
            id: user._id,
            email: user.email,
            emailVerified: user.emailVerified,
            status: user.status
          }
        }
      });

    } catch (error) {
      logger.error('Email verification failed:', {
        error: error.message
      });
      next(error);
    }
  }
];

/**
 * Request password reset
 * POST /api/auth/forgot-password
 */
exports.forgotPassword = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),

  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(formatValidationErrors(errors.array()));
      }

      const { email } = req.body;

      const user = await User.findOne({ email });
      if (!user) {
        // Don't reveal if user exists or not
        return res.status(200).json({
          success: true,
          message: 'If an account with that email exists, we have sent a password reset link.'
        });
      }

      // Generate password reset token
      const resetToken = user.generatePasswordResetToken();
      await user.save({ validateBeforeSave: false });

      // TODO: Send password reset email
      // await emailService.sendPasswordResetEmail(user.email, resetToken);

      logger.logAuth('password_reset_requested', user._id, email, true);

      res.status(200).json({
        success: true,
        message: 'If an account with that email exists, we have sent a password reset link.'
      });

    } catch (error) {
      logger.error('Password reset request failed:', {
        email: req.body.email,
        error: error.message
      });
      next(error);
    }
  }
];

/**
 * Reset password
 * POST /api/auth/reset-password
 */
exports.resetPassword = [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required'),
  
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),

  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(formatValidationErrors(errors.array()));
      }

      const { token, password } = req.body;

      const user = await User.findByPasswordResetToken(token);
      if (!user) {
        throw new NotFoundError('Invalid or expired reset token');
      }

      // Update password
      user.password = password;
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      
      // Reset any login attempts
      user.loginAttempts = 0;
      user.lockUntil = undefined;

      await user.save();

      logger.logAuth('password_reset', user._id, user.email, true);

      res.status(200).json({
        success: true,
        message: 'Password reset successfully'
      });

    } catch (error) {
      logger.error('Password reset failed:', {
        error: error.message
      });
      next(error);
    }
  }
];

/**
 * Get current user profile
 * GET /api/auth/me
 */
exports.getProfile = async (req, res, next) => {
  try {
    const user = req.user;
    
    // Update last activity
    await user.updateLastActivity();

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: user.fullName,
          company: user.company,
          role: user.role,
          status: user.status,
          subscription: user.subscription,
          apiKey: user.apiKey,
          emailVerified: user.emailVerified,
          preferences: user.preferences,
          createdAt: user.createdAt,
          lastLogin: user.lastLogin,
          lastActiveAt: user.lastActiveAt
        },
        usage: {
          limits: user.getUsageLimits(),
          current: user.usage
        }
      }
    });

  } catch (error) {
    logger.error('Get profile failed:', {
      userId: req.user?._id,
      error: error.message
    });
    next(error);
  }
};

module.exports = exports;
