const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const Pricing = require('../models/Pricing');
const logger = require('../utils/logger');
const { RateLimitError } = require('../utils/errorFormatter');

/**
 * Enhanced rate limiting middleware based on user's subscription plan
 */
module.exports = async function (req, res, next) {
  try {
    // Skip rate limiting for admin users
    if (req.user.role === 'admin') {
      return next();
    }

    // Get user's pricing plan
    const pricing = await Pricing.getPlan(req.user.subscription.plan);
    if (!pricing) {
      return res.status(500).json({
        error: 'Pricing configuration not found',
        code: 'PRICING_ERROR'
      });
    }

    // Check monthly limits
    await req.user.checkMonthlyReset();
    
    const monthlyLimit = pricing.limits.monthlyCalls;
    const currentUsage = req.user.usage.monthlyCalls || 0;
    
    if (currentUsage >= monthlyLimit) {
      logger.warn('Monthly rate limit exceeded:', {
        userId: req.user._id,
        email: req.user.email,
        plan: req.user.subscription.plan,
        currentUsage,
        monthlyLimit
      });
      
      return res.status(429).json({
        error: 'Monthly API call limit exceeded',
        code: 'MONTHLY_LIMIT_EXCEEDED',
        usage: {
          current: currentUsage,
          limit: monthlyLimit,
          resetDate: new Date(req.user.usage.monthlyReset.getTime() + 30 * 24 * 60 * 60 * 1000)
        },
        upgrade: req.user.subscription.plan === 'free' 
          ? 'Upgrade to a paid plan for higher limits'
          : 'Upgrade your plan for higher limits'
      });
    }

    // Check daily limits (rough approximation)
    const dailyLimit = pricing.limits.dailyCalls;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todaysUsage = await req.user.constructor.aggregate([
      {
        $match: {
          _id: req.user._id
        }
      },
      {
        $lookup: {
          from: 'apicalls',
          let: { userId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$user', '$$userId'] },
                timestamp: { $gte: today }
              }
            }
          ],
          as: 'todaysCalls'
        }
      },
      {
        $project: {
          todaysCallCount: { $size: '$todaysCalls' }
        }
      }
    ]);

    const dailyUsage = todaysUsage[0]?.todaysCallCount || 0;
    
    if (dailyUsage >= dailyLimit) {
      logger.warn('Daily rate limit exceeded:', {
        userId: req.user._id,
        email: req.user.email,
        plan: req.user.subscription.plan,
        dailyUsage,
        dailyLimit
      });
      
      return res.status(429).json({
        error: 'Daily API call limit exceeded',
        code: 'DAILY_LIMIT_EXCEEDED',
        usage: {
          current: dailyUsage,
          limit: dailyLimit,
          resetTime: new Date(today.getTime() + 24 * 60 * 60 * 1000)
        }
      });
    }

    // Check requests per minute limit
    const perMinuteLimit = pricing.limits.requestsPerMinute;
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    
    const recentCalls = await req.user.constructor.aggregate([
      {
        $match: {
          _id: req.user._id
        }
      },
      {
        $lookup: {
          from: 'apicalls',
          let: { userId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$user', '$$userId'] },
                timestamp: { $gte: oneMinuteAgo }
              }
            }
          ],
          as: 'recentCalls'
        }
      },
      {
        $project: {
          recentCallCount: { $size: '$recentCalls' }
        }
      }
    ]);

    const recentCallCount = recentCalls[0]?.recentCallCount || 0;
    
    if (recentCallCount >= perMinuteLimit) {
      logger.warn('Per-minute rate limit exceeded:', {
        userId: req.user._id,
        email: req.user.email,
        plan: req.user.subscription.plan,
        recentCallCount,
        perMinuteLimit
      });
      
      return res.status(429).json({
        error: 'Too many requests. Please wait before making another request.',
        code: 'RATE_LIMIT_EXCEEDED',
        usage: {
          current: recentCallCount,
          limit: perMinuteLimit,
          windowMs: 60000,
          retryAfter: 60
        }
      });
    }

    // Add usage information to response headers
    res.set({
      'X-RateLimit-Limit-Monthly': monthlyLimit.toString(),
      'X-RateLimit-Remaining-Monthly': (monthlyLimit - currentUsage).toString(),
      'X-RateLimit-Limit-Daily': dailyLimit.toString(),
      'X-RateLimit-Remaining-Daily': (dailyLimit - dailyUsage).toString(),
      'X-RateLimit-Limit-PerMinute': perMinuteLimit.toString(),
      'X-RateLimit-Remaining-PerMinute': (perMinuteLimit - recentCallCount).toString()
    });

    next();

  } catch (error) {
    logger.error('Rate limiting error:', {
      error: error.message,
      userId: req.user?._id,
      endpoint: req.originalUrl
    });
    
    // If rate limiting fails, allow the request but log the error
    next();
  }
};

/**
 * IP-based rate limiting for authentication endpoints
 */
exports.authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: {
    error: 'Too many authentication attempts from this IP',
    code: 'AUTH_RATE_LIMIT',
    retryAfter: 15 * 60 // 15 minutes in seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for admin users (if they're authenticated)
    return req.user && req.user.role === 'admin';
  }
});

/**
 * Strict rate limiting for sensitive operations
 */
exports.strictRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 requests per hour
  message: {
    error: 'Too many attempts. Please try again later.',
    code: 'STRICT_RATE_LIMIT',
    retryAfter: 60 * 60 // 1 hour in seconds
  },
  standardHeaders: true,
  legacyHeaders: false
});
