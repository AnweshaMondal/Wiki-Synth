const { query, body, validationResult } = require('express-validator');
const ApiCall = require('../models/ApiCall');
const User = require('../models/User');
const Pricing = require('../models/Pricing');
const logger = require('../utils/logger');
const { formatValidationErrors, NotFoundError, AuthorizationError } = require('../utils/errorFormatter');
const { checkAIServiceHealth } = require('../services/wikipediaService');

/**
 * Get comprehensive usage statistics
 * GET /api/admin/usage
 */
exports.usageStats = [
  query('days')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Days must be between 1 and 365'),
  
  query('groupBy')
    .optional()
    .isIn(['day', 'week', 'month'])
    .withMessage('GroupBy must be one of: day, week, month'),

  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(formatValidationErrors(errors.array()));
      }

      const { days = 30, groupBy = 'day' } = req.query;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(days));

      // Get system-wide statistics
      const [
        totalStats,
        systemStats,
        topUsers,
        endpointPerformance,
        hourlyUsage,
        userGrowth
      ] = await Promise.all([
        // Total statistics
        ApiCall.aggregate([
          { $match: { timestamp: { $gte: startDate } } },
          {
            $group: {
              _id: null,
              totalCalls: { $sum: 1 },
              successfulCalls: {
                $sum: { $cond: [{ $eq: ['$responseStatus', 'success'] }, 1, 0] }
              },
              totalRevenue: { $sum: '$cost' },
              avgResponseTime: { $avg: '$responseTime' },
              totalTokens: { $sum: '$tokensUsed.total' },
              uniqueUsers: { $addToSet: '$user' }
            }
          }
        ]),

        // Daily/weekly/monthly breakdown
        ApiCall.getSystemStats(parseInt(days)),

        // Top users by usage
        ApiCall.getTopUsers(10, parseInt(days)),

        // Endpoint performance
        ApiCall.getEndpointPerformance(parseInt(days)),

        // Hourly usage patterns
        ApiCall.getHourlyUsage(7),

        // User growth
        User.aggregate([
          { $match: { createdAt: { $gte: startDate } } },
          {
            $group: {
              _id: {
                date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
              },
              newUsers: { $sum: 1 }
            }
          },
          { $sort: { '_id.date': 1 } }
        ])
      ]);

      // Calculate success rate
      const stats = totalStats[0] || {};
      const successRate = stats.totalCalls > 0 
        ? (stats.successfulCalls / stats.totalCalls * 100).toFixed(2)
        : 0;

      // Get current user counts by plan
      const usersByPlan = await User.aggregate([
        { $match: { status: 'active' } },
        {
          $group: {
            _id: '$subscription.plan',
            count: { $sum: 1 }
          }
        }
      ]);

      res.status(200).json({
        success: true,
        data: {
          overview: {
            totalCalls: stats.totalCalls || 0,
            successfulCalls: stats.successfulCalls || 0,
            successRate: parseFloat(successRate),
            totalRevenue: stats.totalRevenue || 0,
            avgResponseTime: Math.round(stats.avgResponseTime || 0),
            totalTokens: stats.totalTokens || 0,
            uniqueUsers: stats.uniqueUsers?.length || 0
          },
          timeline: systemStats,
          topUsers: topUsers.map(user => ({
            id: user._id,
            email: user.user[0]?.email,
            fullName: user.user[0]?.fullName,
            plan: user.user[0]?.subscription?.plan,
            totalCalls: user.totalCalls,
            totalCost: user.totalCost,
            lastCall: user.lastCall
          })),
          endpoints: endpointPerformance,
          hourlyPattern: hourlyUsage,
          userGrowth,
          usersByPlan: usersByPlan.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
          }, {}),
          period: {
            days: parseInt(days),
            startDate,
            endDate: new Date()
          }
        }
      });

    } catch (error) {
      logger.error('Failed to fetch usage stats:', {
        error: error.message,
        adminId: req.user._id
      });
      next(error);
    }
  }
];

/**
 * Get earnings and revenue statistics
 * GET /api/admin/earnings
 */
exports.earnings = [
  query('days')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Days must be between 1 and 365'),

  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(formatValidationErrors(errors.array()));
      }

      const { days = 30 } = req.query;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(days));

      // Revenue analytics
      const [
        totalEarnings,
        dailyRevenue,
        revenueByPlan,
        topRevenueUsers
      ] = await Promise.all([
        // Total earnings summary
        ApiCall.aggregate([
          { $match: { timestamp: { $gte: startDate } } },
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: '$cost' },
              totalCalls: { $sum: 1 },
              avgRevenuePerCall: { $avg: '$cost' }
            }
          }
        ]),

        // Daily revenue breakdown
        ApiCall.aggregate([
          { $match: { timestamp: { $gte: startDate } } },
          {
            $group: {
              _id: {
                date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }
              },
              revenue: { $sum: '$cost' },
              calls: { $sum: 1 }
            }
          },
          { $sort: { '_id.date': 1 } }
        ]),

        // Revenue by subscription plan
        User.aggregate([
          { $match: { status: 'active' } },
          {
            $lookup: {
              from: 'apicalls',
              let: { userId: '$_id' },
              pipeline: [
                {
                  $match: {
                    $expr: { $eq: ['$user', '$$userId'] },
                    timestamp: { $gte: startDate }
                  }
                }
              ],
              as: 'calls'
            }
          },
          {
            $group: {
              _id: '$subscription.plan',
              users: { $sum: 1 },
              totalRevenue: { $sum: { $sum: '$calls.cost' } },
              totalCalls: { $sum: { $size: '$calls' } }
            }
          }
        ]),

        // Top revenue generating users
        ApiCall.aggregate([
          { $match: { timestamp: { $gte: startDate } } },
          {
            $group: {
              _id: '$user',
              totalRevenue: { $sum: '$cost' },
              totalCalls: { $sum: 1 }
            }
          },
          { $sort: { totalRevenue: -1 } },
          { $limit: 10 },
          {
            $lookup: {
              from: 'users',
              localField: '_id',
              foreignField: '_id',
              as: 'user'
            }
          },
          { $unwind: '$user' }
        ])
      ]);

      // Calculate growth rate
      const yesterdayStart = new Date();
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      yesterdayStart.setHours(0, 0, 0, 0);
      
      const yesterdayEnd = new Date();
      yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);
      yesterdayEnd.setHours(23, 59, 59, 999);

      const yesterdayRevenue = await ApiCall.aggregate([
        { 
          $match: { 
            timestamp: { 
              $gte: yesterdayStart, 
              $lte: yesterdayEnd 
            } 
          } 
        },
        {
          $group: {
            _id: null,
            revenue: { $sum: '$cost' }
          }
        }
      ]);

      const earnings = totalEarnings[0] || {};
      const avgDailyRevenue = earnings.totalRevenue / parseInt(days);
      const yesterdayRev = yesterdayRevenue[0]?.revenue || 0;
      const growthRate = avgDailyRevenue > 0 
        ? ((yesterdayRev - avgDailyRevenue) / avgDailyRevenue * 100).toFixed(2)
        : 0;

      res.status(200).json({
        success: true,
        data: {
          summary: {
            totalRevenue: earnings.totalRevenue || 0,
            totalCalls: earnings.totalCalls || 0,
            avgRevenuePerCall: earnings.avgRevenuePerCall || 0,
            avgDailyRevenue,
            yesterdayRevenue: yesterdayRev,
            growthRate: parseFloat(growthRate)
          },
          timeline: dailyRevenue,
          byPlan: revenueByPlan,
          topUsers: topRevenueUsers.map(item => ({
            id: item._id,
            email: item.user.email,
            fullName: item.user.fullName,
            plan: item.user.subscription.plan,
            totalRevenue: item.totalRevenue,
            totalCalls: item.totalCalls,
            avgRevenuePerCall: item.totalRevenue / item.totalCalls
          })),
          period: {
            days: parseInt(days),
            startDate,
            endDate: new Date()
          }
        }
      });

    } catch (error) {
      logger.error('Failed to fetch earnings data:', {
        error: error.message,
        adminId: req.user._id
      });
      next(error);
    }
  }
];

/**
 * Get system health information
 * GET /api/admin/health
 */
exports.health = async (req, res, next) => {
  try {
    const healthInfo = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {},
      performance: {},
      alerts: []
    };

    // Database health
    const dbHealth = await User.countDocuments();
    healthInfo.services.database = {
      status: 'healthy',
      connections: dbHealth >= 0 ? 'active' : 'inactive',
      responseTime: Date.now()
    };

    // AI service health
    try {
      const aiHealth = await checkAIServiceHealth();
      healthInfo.services.ai = aiHealth;
    } catch (error) {
      healthInfo.services.ai = {
        status: 'unhealthy',
        error: error.message
      };
      healthInfo.alerts.push({
        type: 'service_down',
        service: 'ai',
        message: 'AI service is not responding'
      });
    }

    // Performance metrics
    const memUsage = process.memoryUsage();
    healthInfo.performance = {
      memory: {
        used: Math.round(memUsage.rss / 1024 / 1024), // MB
        heap: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        limit: Math.round(memUsage.heapTotal / 1024 / 1024) // MB
      },
      cpu: process.cpuUsage(),
      nodeVersion: process.version,
      platform: process.platform
    };

    // Check recent error rates
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [totalCalls, errorCalls] = await Promise.all([
      ApiCall.countDocuments({ timestamp: { $gte: last24Hours } }),
      ApiCall.countDocuments({ 
        timestamp: { $gte: last24Hours },
        responseStatus: 'error'
      })
    ]);

    const errorRate = totalCalls > 0 ? (errorCalls / totalCalls * 100) : 0;
    
    if (errorRate > 5) { // Alert if error rate > 5%
      healthInfo.alerts.push({
        type: 'high_error_rate',
        value: errorRate.toFixed(2) + '%',
        message: 'Error rate is above normal threshold'
      });
      healthInfo.status = 'degraded';
    }

    // Check response times
    const avgResponseTime = await ApiCall.aggregate([
      { $match: { timestamp: { $gte: last24Hours } } },
      {
        $group: {
          _id: null,
          avgResponseTime: { $avg: '$responseTime' }
        }
      }
    ]);

    const responseTime = avgResponseTime[0]?.avgResponseTime || 0;
    if (responseTime > 5000) { // Alert if avg response time > 5s
      healthInfo.alerts.push({
        type: 'slow_response',
        value: Math.round(responseTime) + 'ms',
        message: 'Average response time is higher than normal'
      });
      healthInfo.status = 'degraded';
    }

    healthInfo.performance.errorRate = errorRate;
    healthInfo.performance.avgResponseTime = Math.round(responseTime);

    res.status(200).json({
      success: true,
      data: healthInfo
    });

  } catch (error) {
    logger.error('Health check failed:', {
      error: error.message,
      adminId: req.user._id
    });
    
    res.status(503).json({
      success: false,
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Get user management data
 * GET /api/admin/users
 */
exports.getUsers = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('search')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search term must be between 1 and 100 characters'),
  
  query('plan')
    .optional()
    .isIn(['free', 'basic', 'premium', 'enterprise'])
    .withMessage('Plan must be one of: free, basic, premium, enterprise'),
  
  query('status')
    .optional()
    .isIn(['active', 'suspended', 'pending_verification', 'deleted'])
    .withMessage('Status must be one of: active, suspended, pending_verification, deleted'),

  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(formatValidationErrors(errors.array()));
      }

      const { 
        page = 1, 
        limit = 20, 
        search, 
        plan, 
        status,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const skip = (page - 1) * limit;
      
      // Build filter
      const filter = {};
      
      if (search) {
        filter.$or = [
          { email: { $regex: search, $options: 'i' } },
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { company: { $regex: search, $options: 'i' } }
        ];
      }
      
      if (plan) {
        filter['subscription.plan'] = plan;
      }
      
      if (status) {
        filter.status = status;
      }

      // Build sort
      const sort = {};
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const [users, total] = await Promise.all([
        User.find(filter)
          .select('-password -emailVerificationToken -passwordResetToken -twoFactorSecret')
          .sort(sort)
          .skip(skip)
          .limit(parseInt(limit)),
        User.countDocuments(filter)
      ]);

      // Get usage stats for each user
      const usersWithStats = await Promise.all(
        users.map(async (user) => {
          const stats = await ApiCall.getUsageStats(user._id, null, null);
          return {
            ...user.toObject(),
            stats: stats[0] || {
              totalCalls: 0,
              successfulCalls: 0,
              totalCost: 0,
              avgResponseTime: 0
            }
          };
        })
      );

      res.status(200).json({
        success: true,
        data: {
          users: usersWithStats,
          pagination: {
            current: parseInt(page),
            pages: Math.ceil(total / limit),
            total,
            limit: parseInt(limit)
          },
          filters: {
            search,
            plan,
            status,
            sortBy,
            sortOrder
          }
        }
      });

    } catch (error) {
      logger.error('Failed to fetch users:', {
        error: error.message,
        adminId: req.user._id
      });
      next(error);
    }
  }
];

/**
 * Update user status or plan
 * PUT /api/admin/users/:userId
 */
exports.updateUser = [
  body('status')
    .optional()
    .isIn(['active', 'suspended', 'pending_verification', 'deleted'])
    .withMessage('Status must be one of: active, suspended, pending_verification, deleted'),
  
  body('plan')
    .optional()
    .isIn(['free', 'basic', 'premium', 'enterprise'])
    .withMessage('Plan must be one of: free, basic, premium, enterprise'),
  
  body('role')
    .optional()
    .isIn(['user', 'premium', 'enterprise', 'admin'])
    .withMessage('Role must be one of: user, premium, enterprise, admin'),

  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(formatValidationErrors(errors.array()));
      }

      const { userId } = req.params;
      const { status, plan, role, reason } = req.body;

      const user = await User.findById(userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Prevent admin from modifying other admins (unless super admin)
      if (user.role === 'admin' && req.user.role !== 'super_admin') {
        throw new AuthorizationError('Cannot modify admin users');
      }

      const updates = {};
      const changes = [];

      if (status && status !== user.status) {
        updates.status = status;
        changes.push(`status: ${user.status} → ${status}`);
      }

      if (plan && plan !== user.subscription.plan) {
        updates['subscription.plan'] = plan;
        changes.push(`plan: ${user.subscription.plan} → ${plan}`);
      }

      if (role && role !== user.role) {
        updates.role = role;
        changes.push(`role: ${user.role} → ${role}`);
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          error: 'No valid updates provided'
        });
      }

      await User.findByIdAndUpdate(userId, updates);

      // Log admin action
      logger.info('Admin user update:', {
        adminId: req.user._id,
        adminEmail: req.user.email,
        targetUserId: userId,
        targetEmail: user.email,
        changes,
        reason: reason || 'No reason provided'
      });

      res.status(200).json({
        success: true,
        message: 'User updated successfully',
        data: {
          userId,
          changes,
          reason
        }
      });

    } catch (error) {
      logger.error('Failed to update user:', {
        error: error.message,
        adminId: req.user._id,
        targetUserId: req.params.userId
      });
      next(error);
    }
  }
];

module.exports = exports;
