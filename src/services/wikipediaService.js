const OpenAI = require("openai");
const axios = require('axios');
const logger = require('../utils/logger');
const { ExternalServiceError } = require('../utils/errorFormatter');

// GitHub AI configuration
const token = process.env.GITHUB_TOKEN;
const endpoint = "https://models.github.ai/inference";
const modelName = "openai/gpt-4o";

// Initialize OpenAI client
const client = new OpenAI({ 
  baseURL: endpoint, 
  apiKey: token,
  timeout: 30000 // 30 seconds timeout
});

/**
 * Get Wikipedia article content
 * @param {string} title - Wikipedia article title
 * @returns {Promise<string>} Article content
 */
async function getWikipediaContent(title) {
  try {
    const response = await axios.get('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title), {
      timeout: 10000,
      headers: {
        'User-Agent': 'WikipediaSummaryGenerator/2.0 (https://github.com/AnweshaMondal/Wikipedia-Summary-Generator)'
      }
    });
    
    return {
      title: response.data.title,
      extract: response.data.extract,
      thumbnail: response.data.thumbnail?.source,
      pageUrl: response.data.content_urls?.desktop?.page
    };
  } catch (error) {
    logger.error('Wikipedia API error:', { title, error: error.message });
    throw new ExternalServiceError('Failed to fetch Wikipedia content', 'wikipedia');
  }
}

/**
 * Generate AI-powered summary using GitHub AI models
 * @param {string} content - Content to summarize
 * @param {Object} options - Summary options
 * @returns {Promise<string>} Generated summary
 */
async function generateAISummary(content, options = {}) {
  const {
    style = 'wikipedia',
    length = 'medium',
    audience = 'general',
    language = 'english',
    temperature = 0.7,
    includeKeyPoints = false
  } = options;

  let systemPrompt = `You are an expert AI assistant that creates high-quality summaries.`;
  
  // Customize prompt based on style
  switch (style) {
    case 'wikipedia':
      systemPrompt += ` Generate Wikipedia-style summaries that are factual, neutral, and encyclopedic.`;
      break;
    case 'academic':
      systemPrompt += ` Generate academic-style summaries suitable for research and scholarly work.`;
      break;
    case 'casual':
      systemPrompt += ` Generate casual, easy-to-understand summaries for general audiences.`;
      break;
    case 'technical':
      systemPrompt += ` Generate technical summaries with precise terminology and detailed explanations.`;
      break;
  }

  // Adjust length instruction
  const lengthInstructions = {
    short: 'Keep the summary brief (50-100 words).',
    medium: 'Create a medium-length summary (150-250 words).',
    long: 'Provide a comprehensive summary (300-500 words).',
    detailed: 'Generate a detailed summary (500-800 words).'
  };

  systemPrompt += ` ${lengthInstructions[length] || lengthInstructions.medium}`;
  
  if (includeKeyPoints) {
    systemPrompt += ` Include key points as bullet points at the end.`;
  }

  systemPrompt += ` Ensure accuracy, clarity, and coherence. Target audience: ${audience}.`;

  let userPrompt = `Please summarize the following content:\n\n${content}`;

  try {
    const response = await client.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: temperature,
      top_p: 1.0,
      max_tokens: length === 'detailed' ? 1000 : length === 'long' ? 600 : 400,
      model: modelName,
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    logger.error('GitHub AI API error:', { error: error.message, model: modelName });
    throw new ExternalServiceError('Failed to generate AI summary', 'github-ai');
  }
}

/**
 * Get Wikipedia summary with AI enhancement
 * @param {string} title - Wikipedia article title
 * @param {Object} options - Summary options
 * @returns {Promise<Object>} Enhanced summary with metadata
 */
async function getWikipediaSummary(title, options = {}) {
  try {
    // Get Wikipedia content
    const wikipediaData = await getWikipediaContent(title);
    
    // Use Wikipedia extract as base content
    let contentToSummarize = wikipediaData.extract;
    
    // If extract is too short, indicate that
    if (contentToSummarize.length < 100) {
      contentToSummarize = `Brief Wikipedia extract for "${title}": ${contentToSummarize}. This is a short extract, please provide a comprehensive summary based on general knowledge about this topic.`;
    }

    // Generate AI-enhanced summary
    const aiSummary = await generateAISummary(contentToSummarize, options);

    return {
      title: wikipediaData.title,
      summary: aiSummary,
      originalExtract: wikipediaData.extract,
      thumbnail: wikipediaData.thumbnail,
      sourceUrl: wikipediaData.pageUrl,
      metadata: {
        summaryStyle: options.style || 'wikipedia',
        summaryLength: options.length || 'medium',
        wordCount: aiSummary.split(' ').length,
        generatedAt: new Date().toISOString(),
        model: modelName
      }
    };
  } catch (error) {
    logger.error('Wikipedia summary generation failed:', { title, error: error.message });
    throw error;
  }
}

/**
 * Generate summary from custom text content
 * @param {string} content - Custom text content
 * @param {Object} options - Summary options
 * @returns {Promise<Object>} Summary with metadata
 */
async function generateCustomSummary(content, options = {}) {
  try {
    if (!content || content.trim().length < 50) {
      throw new Error('Content must be at least 50 characters long');
    }

    const summary = await generateAISummary(content, options);

    return {
      summary,
      originalContent: content.substring(0, 500) + (content.length > 500 ? '...' : ''),
      metadata: {
        summaryStyle: options.style || 'wikipedia',
        summaryLength: options.length || 'medium',
        wordCount: summary.split(' ').length,
        originalWordCount: content.split(' ').length,
        compressionRatio: Math.round((summary.split(' ').length / content.split(' ').length) * 100) + '%',
        generatedAt: new Date().toISOString(),
        model: modelName
      }
    };
  } catch (error) {
    logger.error('Custom summary generation failed:', { error: error.message });
    throw error;
  }
}

/**
 * Generate batch summaries
 * @param {Array} items - Array of items to summarize (titles or content)
 * @param {Object} options - Summary options
 * @returns {Promise<Array>} Array of summaries
 */
async function generateBatchSummaries(items, options = {}) {
  const results = [];
  const { batchSize = 5 } = options;

  // Process in batches to avoid overwhelming the API
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (item) => {
      try {
        if (typeof item === 'string' && item.length < 100) {
          // Assume it's a Wikipedia title
          return await getWikipediaSummary(item, options);
        } else {
          // Assume it's custom content
          return await generateCustomSummary(item, options);
        }
      } catch (error) {
        return {
          error: error.message,
          input: typeof item === 'string' ? item.substring(0, 100) : 'Invalid input'
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Small delay between batches to respect rate limits
    if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return results;
}

/**
 * Check if GitHub AI service is healthy
 * @returns {Promise<Object>} Health status
 */
async function checkAIServiceHealth() {
  try {
    const response = await client.chat.completions.create({
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Say 'OK' if you can respond." }
      ],
      max_tokens: 10,
      model: modelName,
    });

    return {
      status: 'healthy',
      model: modelName,
      responseTime: Date.now(),
      testResponse: response.choices[0].message.content
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      model: modelName,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = {
  getWikipediaSummary,
  generateCustomSummary,
  generateBatchSummaries,
  checkAIServiceHealth,
  generateAISummary,
  getWikipediaContent
};
