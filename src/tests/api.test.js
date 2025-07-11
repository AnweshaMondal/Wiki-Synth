const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../src/app');
const User = require('../src/models/User');
const Pricing = require('../src/models/Pricing');

describe('Wikipedia Summary API', () => {
  let server;
  let authToken;
  let testUser;

  beforeAll(async () => {
    // Connect to test database
    const testDbUri = process.env.MONGO_URI_TEST || 'mongodb://localhost:27017/wikipedia-summary-test';
    await mongoose.connect(testDbUri);
    
    // Seed test data
    await seedTestData();
  });

  afterAll(async () => {
    // Clean up test database
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    // Reset test user state
    await User.findByIdAndUpdate(testUser._id, {
      'usage.monthlyCalls': 0,
      'usage.totalCalls': 0
    });
  });

  async function seedTestData() {
    // Create test pricing plan
    await Pricing.create({
      plan: 'free',
      name: 'Free Plan',
      description: 'Test plan',
      pricePerCall: 0,
      limits: {
        monthlyCalls: 10,
        dailyCalls: 5,
        requestsPerMinute: 2,
        maxInputLength: 5000,
        maxOutputLength: 500,
        batchSize: 1
      },
      features: {
        basicSummary: true,
        customStyles: false,
        batchProcessing: false
      },
      isActive: true,
      isVisible: true
    });

    // Create test user
    testUser = await User.create({
      email: 'test@example.com',
      password: 'TestPass123!',
      firstName: 'Test',
      lastName: 'User',
      status: 'active',
      emailVerified: true,
      subscription: {
        plan: 'free',
        status: 'active'
      }
    });

    testUser.generateApiKey();
    await testUser.save();

    authToken = testUser.generateAuthToken();
  }

  describe('Health Endpoints', () => {
    test('GET /health should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('ok');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('timestamp');
    });

    test('GET /api/health/detailed should return detailed health', async () => {
      const response = await request(app)
        .get('/api/health/detailed')
        .expect(200);

      expect(response.body.status).toBe('ok');
      expect(response.body).toHaveProperty('services');
      expect(response.body).toHaveProperty('performance');
    });
  });

  describe('Authentication', () => {
    test('POST /api/auth/register should create new user', async () => {
      const userData = {
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        firstName: 'New',
        lastName: 'User'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data).toHaveProperty('usage');
    });

    test('POST /api/auth/login should authenticate user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'TestPass123!'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('test@example.com');
      expect(response.body.data).toHaveProperty('token');
    });

    test('GET /api/auth/me should return user profile', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('test@example.com');
    });
  });

  describe('Summary Generation', () => {
    test('POST /api/summary should generate Wikipedia summary', async () => {
      const response = await request(app)
        .post('/api/summary')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Artificial Intelligence',
          options: {
            style: 'wikipedia',
            length: 'medium'
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('summary');
      expect(response.body.data).toHaveProperty('metadata');
      expect(response.body).toHaveProperty('usage');
    });

    test('POST /api/summary should generate custom content summary', async () => {
      const testContent = `
        Machine learning is a subset of artificial intelligence that focuses on algorithms 
        and statistical models that computer systems use to perform tasks without explicit 
        instructions. It relies on patterns and inference instead. Machine learning algorithms 
        build a mathematical model based on training data to make predictions or decisions.
      `;

      const response = await request(app)
        .post('/api/summary')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: testContent,
          options: {
            style: 'academic',
            length: 'short'
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('summary');
      expect(response.body.data.metadata.summaryStyle).toBe('academic');
    });

    test('should respect rate limits', async () => {
      // Make requests up to the limit
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/summary')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ title: `Test Title ${i}` })
          .expect(200);
      }

      // Next request should be rate limited
      const response = await request(app)
        .post('/api/summary')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Rate Limited Test' })
        .expect(429);

      expect(response.body.error).toContain('limit');
    });

    test('should validate input parameters', async () => {
      const response = await request(app)
        .post('/api/summary')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          // Missing both title and content
          options: { style: 'wikipedia' }
        })
        .expect(400);

      expect(response.body.error).toContain('title');
    });
  });

  describe('API Key Authentication', () => {
    test('should authenticate with API key', async () => {
      const response = await request(app)
        .post('/api/summary')
        .set('X-API-Key', testUser.apiKey)
        .send({
          title: 'Test with API Key',
          options: { style: 'wikipedia' }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should reject invalid API key', async () => {
      const response = await request(app)
        .post('/api/summary')
        .set('X-API-Key', 'invalid_key')
        .send({ title: 'Test' })
        .expect(401);

      expect(response.body.error).toContain('Invalid');
    });
  });

  describe('Error Handling', () => {
    test('should handle missing authentication', async () => {
      const response = await request(app)
        .post('/api/summary')
        .send({ title: 'Test' })
        .expect(401);

      expect(response.body.error).toContain('authentication');
    });

    test('should handle invalid JSON', async () => {
      const response = await request(app)
        .post('/api/summary')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);
    });
  });
});

// Mock GitHub AI service for testing
jest.mock('../src/services/wikipediaService', () => ({
  getWikipediaSummary: jest.fn().mockResolvedValue({
    title: 'Test Article',
    summary: 'This is a test summary generated by the mocked AI service.',
    metadata: {
      summaryStyle: 'wikipedia',
      summaryLength: 'medium',
      wordCount: 12,
      generatedAt: new Date().toISOString(),
      model: 'openai/gpt-4o'
    }
  }),
  generateCustomSummary: jest.fn().mockResolvedValue({
    summary: 'This is a test custom summary.',
    metadata: {
      summaryStyle: 'academic',
      summaryLength: 'short',
      wordCount: 7,
      generatedAt: new Date().toISOString(),
      model: 'openai/gpt-4o'
    }
  }),
  checkAIServiceHealth: jest.fn().mockResolvedValue({
    status: 'healthy',
    model: 'openai/gpt-4o',
    responseTime: Date.now()
  })
}));
