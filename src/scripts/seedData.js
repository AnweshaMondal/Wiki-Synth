const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('../models/User');
const Pricing = require('../models/Pricing');
const logger = require('../utils/logger');

/**
 * Seed script to initialize the database with default data
 */
async function seedDatabase() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    logger.info('Connected to MongoDB for seeding');

    // Clear existing data (optional - comment out in production)
    // await User.deleteMany({});
    // await Pricing.deleteMany({});
    // logger.info('Cleared existing data');

    // Create pricing plans
    await seedPricingPlans();
    
    // Create admin user
    await seedAdminUser();

    logger.info('Database seeding completed successfully');
    process.exit(0);

  } catch (error) {
    logger.error('Database seeding failed:', error);
    process.exit(1);
  }
}

/**
 * Seed pricing plans
 */
async function seedPricingPlans() {
  const pricingPlans = [
    {
      plan: 'free',
      name: 'Free Plan',
      description: 'Perfect for trying out our API with basic features',
      pricePerCall: 0,
      monthlyPrice: 0,
      annualPrice: 0,
      limits: {
        monthlyCalls: parseInt(process.env.PRICING_FREE_CALLS) || 100,
        dailyCalls: 10,
        requestsPerMinute: 2,
        maxInputLength: 5000,
        maxOutputLength: 500,
        batchSize: 1
      },
      features: {
        basicSummary: true,
        customStyles: false,
        batchProcessing: false,
        apiAccess: true,
        prioritySupport: false,
        analyticsAccess: false,
        customIntegrations: false,
        whiteLabel: false,
        sla: {
          uptime: 99.0,
          responseTime: 10000
        }
      },
      allowedModels: [
        {
          name: 'openai/gpt-4o',
          displayName: 'GPT-4o',
          costMultiplier: 1.0
        }
      ],
      billing: {
        cycle: 'monthly',
        trialDays: 0,
        gracePeriodDays: 3
      },
      isActive: true,
      isVisible: true,
      sortOrder: 1,
      metadata: {
        popular: false,
        recommended: false,
        tags: ['starter', 'free'],
        targetAudience: ['students', 'researchers', 'hobbyists']
      }
    },
    {
      plan: 'basic',
      name: 'Basic Plan',
      description: 'Great for small projects and regular API usage',
      pricePerCall: parseFloat(process.env.PRICING_BASIC_COST) || 0.01,
      monthlyPrice: 29,
      annualPrice: 290,
      limits: {
        monthlyCalls: 1000,
        dailyCalls: 100,
        requestsPerMinute: 10,
        maxInputLength: 15000,
        maxOutputLength: 1000,
        batchSize: 5
      },
      features: {
        basicSummary: true,
        customStyles: true,
        batchProcessing: true,
        apiAccess: true,
        prioritySupport: false,
        analyticsAccess: true,
        customIntegrations: false,
        whiteLabel: false,
        sla: {
          uptime: 99.5,
          responseTime: 5000
        }
      },
      allowedModels: [
        {
          name: 'openai/gpt-4o',
          displayName: 'GPT-4o',
          costMultiplier: 1.0
        }
      ],
      billing: {
        cycle: 'monthly',
        trialDays: 7,
        gracePeriodDays: 3
      },
      isActive: true,
      isVisible: true,
      sortOrder: 2,
      metadata: {
        popular: true,
        recommended: true,
        tags: ['popular', 'small-business'],
        targetAudience: ['small businesses', 'content creators', 'developers']
      }
    },
    {
      plan: 'premium',
      name: 'Premium Plan',
      description: 'Perfect for growing businesses with advanced features',
      pricePerCall: parseFloat(process.env.PRICING_PREMIUM_COST) || 0.005,
      monthlyPrice: 99,
      annualPrice: 990,
      limits: {
        monthlyCalls: 10000,
        dailyCalls: 1000,
        requestsPerMinute: 30,
        maxInputLength: 50000,
        maxOutputLength: 2000,
        batchSize: 20
      },
      features: {
        basicSummary: true,
        customStyles: true,
        batchProcessing: true,
        apiAccess: true,
        prioritySupport: true,
        analyticsAccess: true,
        customIntegrations: true,
        whiteLabel: false,
        sla: {
          uptime: 99.9,
          responseTime: 3000
        }
      },
      allowedModels: [
        {
          name: 'openai/gpt-4o',
          displayName: 'GPT-4o',
          costMultiplier: 1.0
        }
      ],
      billing: {
        cycle: 'monthly',
        trialDays: 14,
        gracePeriodDays: 5
      },
      isActive: true,
      isVisible: true,
      sortOrder: 3,
      metadata: {
        popular: false,
        recommended: false,
        tags: ['premium', 'business'],
        targetAudience: ['medium businesses', 'agencies', 'enterprise developers']
      }
    },
    {
      plan: 'enterprise',
      name: 'Enterprise Plan',
      description: 'For large-scale applications with maximum capabilities',
      pricePerCall: parseFloat(process.env.PRICING_ENTERPRISE_COST) || 0.003,
      monthlyPrice: 299,
      annualPrice: 2990,
      limits: {
        monthlyCalls: 100000,
        dailyCalls: 10000,
        requestsPerMinute: 100,
        maxInputLength: 100000,
        maxOutputLength: 5000,
        batchSize: 100
      },
      features: {
        basicSummary: true,
        customStyles: true,
        batchProcessing: true,
        apiAccess: true,
        prioritySupport: true,
        analyticsAccess: true,
        customIntegrations: true,
        whiteLabel: true,
        sla: {
          uptime: 99.99,
          responseTime: 1000
        }
      },
      allowedModels: [
        {
          name: 'openai/gpt-4o',
          displayName: 'GPT-4o',
          costMultiplier: 1.0
        }
      ],
      billing: {
        cycle: 'monthly',
        trialDays: 30,
        gracePeriodDays: 7
      },
      isActive: true,
      isVisible: true,
      sortOrder: 4,
      metadata: {
        popular: false,
        recommended: false,
        tags: ['enterprise', 'custom'],
        targetAudience: ['large enterprises', 'enterprise developers', 'high-volume users']
      }
    }
  ];

  for (const planData of pricingPlans) {
    const existingPlan = await Pricing.findOne({ plan: planData.plan });
    if (!existingPlan) {
      await Pricing.create(planData);
      logger.info(`Created pricing plan: ${planData.name}`);
    } else {
      // Update existing plan with new data
      await Pricing.findOneAndUpdate({ plan: planData.plan }, planData);
      logger.info(`Updated pricing plan: ${planData.name}`);
    }
  }
}

/**
 * Seed admin user
 */
async function seedAdminUser() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  const existingAdmin = await User.findOne({ email: adminEmail });
  if (!existingAdmin) {
    const adminUser = new User({
      email: adminEmail,
      password: adminPassword,
      firstName: 'System',
      lastName: 'Administrator',
      role: 'admin',
      status: 'active',
      emailVerified: true,
      subscription: {
        plan: 'enterprise',
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
      }
    });

    adminUser.generateApiKey();
    await adminUser.save();
    
    logger.info(`Created admin user: ${adminEmail}`);
    logger.info(`Admin API Key: ${adminUser.apiKey}`);
  } else {
    logger.info(`Admin user already exists: ${adminEmail}`);
  }
}

// Run the seeding if this file is executed directly
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase, seedPricingPlans, seedAdminUser };
