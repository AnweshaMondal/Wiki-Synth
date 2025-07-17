const { body, validationResult } = require('express-validator');
const { 
  getWikipediaSummary, 
  generateCustomSummary, 
  generateBatchSummaries 
} = require('../services/wikipediaService');
const ApiCall = require('../models/ApiCall');
const User = require('../models/User');
const Pricing = require('../models/Pricing');
const logger = require('../utils/logger');
const { formatValidationErrors, APIError, NotFoundError } = require('../utils/errorFormatter');

/**
 * Validation rules for summary generation
 */
const summaryValidation = [
  body('title')
    .optional()
    .isString()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),
  
  body('content')
    .optional()
    .isString()
    .isLength({ min: 50, max: 50000 })
    .withMessage('Content must be between 50 and 50,000 characters'),
  
  body('options.style')
    .optional()
    .isIn(['wikipedia', 'academic', 'casual', 'technical'])
    .withMessage('Style must be one of: wikipedia, academic, casual, technical'),
  
  body('options.length')
    .optional()
    .isIn(['short', 'medium', 'long', 'detailed'])
    .withMessage('Length must be one of: short, medium, long, detailed'),
  
  body('options.language')
    .optional()
    .isString()
    .isLength({ max: 50 })
    .withMessage('Language must be a valid string'),
  
  body('options.includeKeyPoints')
    .optional()
    .isBoolean()
    .withMessage('includeKeyPoints must be a boolean')
];

/**
 * Generate Wikipedia summary
 * POST /api/summary
 */
exports.getSummary = [
  ...summaryValidation,
  async (req, res, next) => {
    const startTime = Date.now();
    let apiCall = null;

    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(formatValidationErrors(errors.array()));
      }

      const { title, content, options = {} } = req.body;

      // Must provide either title or content
      if (!title && !content) {
        return res.status(400).json({
          error: 'Either title (for Wikipedia summary) or content (for custom summary) is required'
        });
      }

      // Check user limits
      await req.user.checkMonthlyReset();
      if (!req.user.canMakeApiCall()) {
        return res.status(429).json({
          error: 'Monthly API limit exceeded',
          usage: req.user.usage,
          limits: req.user.getUsageLimits()
        });
      }

      // Get pricing for user's plan
      const pricing = await Pricing.getPlan(req.user.subscription.plan);
      if (!pricing) {
        throw new NotFoundError('Pricing plan not found');
      }

      const cost = pricing.getEffectivePrice(req.user.usage.monthlyCalls);

      // Create API call record
      apiCall = new ApiCall({
        user: req.user._id,
        endpoint: '/api/summary',
        method: 'POST',
        requestData: {
          title: title || 'Custom content',
          content: content ? content.substring(0, 500) : undefined,
          options
        },
        cost,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      await apiCall.save();

      // Merge user preferences with request options
      const summaryOptions = {
        style: options.style || req.user.preferences.defaultSummaryStyle,
        length: options.length || req.user.preferences.defaultSummaryLength,
        language: options.language || req.user.preferences.language,
        includeKeyPoints: options.includeKeyPoints || false,
        ...options
      };

      let result;
      let tokensUsed = { prompt: 0, completion: 0, total: 0 };

      // Generate summary
      if (title) {
        result = await getWikipediaSummary(title, summaryOptions);
      } else {
        result = await generateCustomSummary(content, summaryOptions);
      }

      // Estimate token usage (rough approximation)
      const inputTokens = Math.ceil((content || title || '').length / 4);
      const outputTokens = Math.ceil((result.summary || '').length / 4);
      tokensUsed = {
        prompt: inputTokens,
        completion: outputTokens,
        total: inputTokens + outputTokens
      };

      const responseTime = Date.now() - startTime;
      const responseSize = Buffer.byteLength(JSON.stringify(result), 'utf8');

      // Update API call record
      await apiCall.markCompleted({
        responseTime,
        tokensUsed,
        responseSize
      });

      // Update user usage
      await req.user.incrementUsage(cost);

      // Log successful API call
      logger.logApiCall(req.user._id, '/api/summary', cost, true);

      // Response
      res.status(200).json({
        success: true,
        data: result,
        usage: {
          tokensUsed,
          cost,
          remainingCalls: pricing.limits.monthlyCalls - req.user.usage.monthlyCalls
        },
        metadata: {
          responseTime,
          responseSize,
          apiCallId: apiCall._id
        }
      });

    } catch (error) {
      logger.error('Summary generation failed:', {
        userId: req.user._id,
        error: error.message,
        stack: error.stack
      });

      // Mark API call as failed
      if (apiCall) {
        await apiCall.markFailed(error);
      }

      next(error);
    }
  }
];

/**
 * Generate batch summaries
 * POST /api/summary/batch
 */
exports.getBatchSummaries = [
  body('items')
    .isArray({ min: 1, max: 10 })
    .withMessage('Items must be an array with 1-10 elements'),
  
  body('items.*')
    .custom((value, { req }) => {
      // Accept either string or object format
      if (typeof value === 'string') {
        if (value.length < 1 || value.length > 10000) {
          throw new Error('Each string item must be between 1 and 10,000 characters');
        }
        return true;
      }
      
      if (typeof value === 'object' && value !== null) {
        // Check if it has either title or content
        if (!value.title && !value.content) {
          throw new Error('Each object item must have either "title" or "content" property');
        }
        
        if (value.title && (typeof value.title !== 'string' || value.title.length < 1 || value.title.length > 200)) {
          throw new Error('Title must be between 1 and 200 characters');
        }
        
        if (value.content && (typeof value.content !== 'string' || value.content.length < 50 || value.content.length > 50000)) {
          throw new Error('Content must be between 50 and 50,000 characters');
        }
        
        return true;
      }
      
      throw new Error('Each item must be either a string or an object with title/content property');
    }),

  ...summaryValidation.filter(rule => !rule.builder.fields.includes('title') && !rule.builder.fields.includes('content')),

  async (req, res, next) => {
    const startTime = Date.now();
    let apiCall = null;

    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(formatValidationErrors(errors.array()));
      }

      const { items, options = {} } = req.body;

      // Check if user's plan supports batch processing
      const pricing = await Pricing.getPlan(req.user.subscription.plan);
      if (!pricing || !pricing.hasFeature('batchProcessing')) {
        return res.status(403).json({
          error: 'Batch processing not available in your current plan',
          upgrade: 'Upgrade to Premium or Enterprise plan for batch processing'
        });
      }

      // Check if batch size is within limits
      if (items.length > pricing.limits.batchSize) {
        return res.status(400).json({
          error: `Batch size exceeds limit. Maximum ${pricing.limits.batchSize} items allowed.`
        });
      }

      // Check user limits for batch
      await req.user.checkMonthlyReset();
      const remainingCalls = pricing.limits.monthlyCalls - req.user.usage.monthlyCalls;
      if (remainingCalls < items.length) {
        return res.status(429).json({
          error: 'Insufficient API calls remaining for batch processing',
          required: items.length,
          remaining: remainingCalls
        });
      }

      const cost = pricing.getEffectivePrice(req.user.usage.monthlyCalls) * items.length;

      // Create API call record
      apiCall = new ApiCall({
        user: req.user._id,
        endpoint: '/api/summary/batch',
        method: 'POST',
        requestData: {
          batchSize: items.length,
          options
        },
        cost,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      await apiCall.save();

      // Generate batch summaries
      const summaryOptions = {
        style: options.style || req.user.preferences.defaultSummaryStyle,
        length: options.length || req.user.preferences.defaultSummaryLength,
        language: options.language || req.user.preferences.language,
        ...options
      };

      // Transform items to the format expected by generateBatchSummaries
      const processedItems = items.map(item => {
        if (typeof item === 'string') {
          return item; // Already in correct format
        } else if (typeof item === 'object') {
          // Convert object to string - prioritize title for Wikipedia, content for custom
          return item.title || item.content;
        }
        return item;
      });

      const results = await generateBatchSummaries(processedItems, summaryOptions);

      const responseTime = Date.now() - startTime;
      const responseSize = Buffer.byteLength(JSON.stringify(results), 'utf8');

      // Calculate total tokens used
      const totalTokens = results.reduce((acc, result) => {
        if (result.metadata) {
          return acc + (result.metadata.tokensUsed || 0);
        }
        return acc;
      }, 0);

      const tokensUsed = {
        total: totalTokens,
        prompt: Math.ceil(totalTokens * 0.6),
        completion: Math.ceil(totalTokens * 0.4)
      };

      // Update API call record
      await apiCall.markCompleted({
        responseTime,
        tokensUsed,
        responseSize
      });

      // Update user usage
      await req.user.incrementUsage(cost);

      logger.logApiCall(req.user._id, '/api/summary/batch', cost, true);

      res.status(200).json({
        success: true,
        data: results,
        summary: {
          total: items.length,
          successful: results.filter(r => !r.error).length,
          failed: results.filter(r => r.error).length
        },
        usage: {
          tokensUsed,
          cost,
          remainingCalls: pricing.limits.monthlyCalls - req.user.usage.monthlyCalls
        },
        metadata: {
          responseTime,
          responseSize,
          apiCallId: apiCall._id
        }
      });

    } catch (error) {
      logger.error('Batch summary generation failed:', {
        userId: req.user._id,
        error: error.message
      });

      if (apiCall) {
        await apiCall.markFailed(error);
      }

      next(error);
    }
  }
];

/**
 * Get user's summary history
 * GET /api/summary/history
 */
exports.getSummaryHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, startDate, endDate } = req.query;
    const skip = (page - 1) * limit;

    const filter = { 
      user: req.user._id,
      endpoint: { $in: ['/api/summary', '/api/summary/batch'] }
    };

    if (startDate && endDate) {
      filter.timestamp = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const [calls, total] = await Promise.all([
      ApiCall.find(filter)
        .select('endpoint requestData responseStatus cost tokensUsed timestamp responseTime')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      ApiCall.countDocuments(filter)
    ]);

    const stats = await ApiCall.getUsageStats(
      req.user._id, 
      startDate, 
      endDate
    );

    res.status(200).json({
      success: true,
      data: {
        history: calls,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
          limit: parseInt(limit)
        },
        statistics: stats[0] || {
          totalCalls: 0,
          successfulCalls: 0,
          totalCost: 0,
          avgResponseTime: 0,
          totalTokens: 0
        }
      }
    });

  } catch (error) {
    logger.error('Failed to fetch summary history:', {
      userId: req.user._id,
      error: error.message
    });
    next(error);
  }
};

module.exports = exports;
