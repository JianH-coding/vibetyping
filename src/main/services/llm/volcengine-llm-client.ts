/**
 * Volcano Engine LLM client.
 * Implements direct HTTP API for Volcano Engine (curl-style).
 */

import { LLMConfig, LLMRequestOptions, LLMResponse, LLMError, LLMErrorType } from './types';

/**
 * Volcano Engine LLM client.
 */
export class VolcengineLLMClient {
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  /**
   * Make HTTP request to Volcano Engine LLM API.
   * @param inputText Input text to send to LLM
   * @param options Request options
   * @returns Raw API response
   */
  private async makeRequest(
    inputText: string,
    options: LLMRequestOptions = {}
  ): Promise<unknown> {
    const url = `${this.config.baseURL}/responses`;
    const headers = {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
    };

    // Build request body according to Volcano Engine API format
    // Based on Volcano Engine OpenAI-compatible API documentation
    const requestBody = {
      model: this.config.model,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: inputText
            }
          ]
        }
      ],
      thinking: { type: 'disabled' },
      // temperature and max_tokens are not supported by Volcano Engine API
      // temperature: options.temperature ?? 0.7,
    };

    const maxRetries = options.maxRetries ?? 2;
    let lastError: any = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), options.timeout ?? 30000);

      try {
        console.log(`LLM API request attempt ${attempt + 1}/${maxRetries + 1}`, {
          url,
          model: this.config.model,
          inputLength: inputText.length,
        });

        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('LLM API request failed:', {
            status: response.status,
            statusText: response.statusText,
            error: errorText,
            attempt: attempt + 1,
          });

          const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
          (error as any).status = response.status;
          (error as any).responseText = errorText;
          lastError = error;

          // Don't retry on client errors (4xx) except 429 (rate limit)
          if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            throw error;
          }

          // Wait before retry (exponential backoff)
          if (attempt < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
            console.log(`Retrying after ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }

          throw error;
        }

        const responseData = await response.json();
        console.log(`LLM API request successful on attempt ${attempt + 1}`);
        return responseData;
      } catch (error: any) {
        clearTimeout(timeoutId);

        // Enhance error with more details
        if (error.name === 'AbortError') {
          error.name = 'TimeoutError';
          error.code = 'ETIMEDOUT';
        }

        lastError = error;

        // Don't retry timeout errors immediately
        if (error.name === 'TimeoutError') {
          throw error;
        }

        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          console.log(`Retrying after ${delay}ms due to error:`, error.message);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
    }

    // If we get here, all retries failed
    throw lastError || new Error('LLM API request failed after all retries');
  }

  /**
   * Optimize text using Volcano Engine LLM.
   * @param text Text to optimize
   * @param options Request options
   * @returns LLM response
   */
  async optimizeText(
    text: string,
    options: LLMRequestOptions = {}
  ): Promise<LLMResponse> {
    const startTime = Date.now();

    // Validate configuration
    if (!this.config.enabled) {
      throw new LLMError(
        LLMErrorType.CONFIGURATION_ERROR,
        'LLM optimization is not enabled'
      );
    }

    if (!this.config.apiKey) {
      throw new LLMError(
        LLMErrorType.CONFIGURATION_ERROR,
        'LLM API key is not configured'
      );
    }


    // Validate input text
    if (!text || text.trim().length === 0) {
      throw new LLMError(
        LLMErrorType.VALIDATION_ERROR,
        'Input text cannot be empty'
      );
    }

    if (text.length > 10000) {
      throw new LLMError(
        LLMErrorType.VALIDATION_ERROR,
        'Input text is too long (maximum 10000 characters)'
      );
    }

    try {
      // Prepare the prompt with user's custom prompt
      const fullPrompt = `${this.config.prompt}\n\n原文：${text}`;

      // Make API request using direct HTTP call
      const response = await this.makeRequest(fullPrompt, options) as any;

      const processingTime = Date.now() - startTime;

      // Log response structure for debugging
      console.log('LLM API response structure:', {
        hasOutput: !!response.output,
        outputType: Array.isArray(response.output) ? 'array' : typeof response.output,
        responseKeys: Object.keys(response),
      });

      // Extract optimized text from response
      // Try multiple possible response formats
      let optimizedText = text;

      // Format 1: OpenAI-compatible format (output array with content)
      if (response.output && Array.isArray(response.output) && response.output[0]?.content) {
        optimizedText = response.output[0]?.content[0]?.text || text;
      }
      // Format 2: Direct text response
      else if (response.output && typeof response.output === 'string') {
        optimizedText = response.output;
      }
      // Format 3: Simple output field
      else if (response.output && response.output.text) {
        optimizedText = response.output.text;
      }
      // Format 4: Direct response text
      else if (response.text) {
        optimizedText = response.text;
      }
      // Format 5: Try to find any text field in response
      else {
        // Search for text fields in response
        const findTextInObject = (obj: any): string | null => {
          if (typeof obj === 'string') return obj;
          if (typeof obj !== 'object' || obj === null) return null;

          if (obj.text && typeof obj.text === 'string') return obj.text;
          if (obj.content && typeof obj.content === 'string') return obj.content;
          if (obj.message && typeof obj.message === 'string') return obj.message;

          // Recursively search
          for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
              const found = findTextInObject(obj[key]);
              if (found) return found;
            }
          }
          return null;
        };

        const foundText = findTextInObject(response);
        if (foundText) {
          optimizedText = foundText;
        }
      }

      if (!optimizedText || optimizedText.trim().length === 0) {
        throw new LLMError(
          LLMErrorType.API_ERROR,
          'Empty response from LLM API'
        );
      }

      return {
        text: optimizedText,
        rawResponse: response,
        processingTime,
        success: true,
      };
    } catch (error: any) {
      const processingTime = Date.now() - startTime;

      // Handle different types of errors
      let errorType = LLMErrorType.API_ERROR;
      let errorMessage = 'Failed to optimize text with LLM';

      if (error.name === 'TimeoutError' || error.code === 'ETIMEDOUT') {
        errorType = LLMErrorType.TIMEOUT_ERROR;
        errorMessage = 'LLM request timed out';
      } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        errorType = LLMErrorType.NETWORK_ERROR;
        errorMessage = 'Network error connecting to LLM API';
      } else if (error.status === 401 || error.status === 403) {
        errorType = LLMErrorType.CONFIGURATION_ERROR;
        errorMessage = 'Invalid API key or authentication failed';
      } else if (error.status === 429) {
        errorType = LLMErrorType.API_ERROR;
        errorMessage = 'Rate limit exceeded, please try again later';
      } else if (error.status === 400) {
        errorType = LLMErrorType.VALIDATION_ERROR;
        errorMessage = 'Invalid request parameters';
      }

      console.error('LLM optimization error:', {
        errorType,
        errorMessage,
        details: error.message,
        processingTime,
      });

      return {
        text: text, // Fallback to original text
        processingTime,
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Test connection to Volcano Engine LLM API.
   * @returns Whether connection is successful
   */
  async testConnection(): Promise<boolean> {
    if (!this.config.enabled || !this.config.apiKey) {
      return false;
    }

    try {
      // Send a simple test request using direct HTTP call
      const response = await this.makeRequest('Hello, please respond with "OK"', {
        maxTokens: 10,
      }) as any;

      // Try to extract response text using same logic as optimizeText
      let responseText = '';

      // Format 1: OpenAI-compatible format (output array with content)
      if (response.output && Array.isArray(response.output) && response.output[0]?.content) {
        responseText = response.output[0]?.content[0]?.text || '';
      }
      // Format 2: Direct text response
      else if (response.output && typeof response.output === 'string') {
        responseText = response.output;
      }
      // Format 3: Simple output field
      else if (response.output && response.output.text) {
        responseText = response.output.text;
      }
      // Format 4: Direct response text
      else if (response.text) {
        responseText = response.text;
      }

      console.log('LLM connection test response:', { responseText, hasResponse: !!responseText });
      return responseText.includes('OK') || responseText.length > 0;
    } catch (error: any) {
      console.error('LLM connection test failed:', error.message);
      return false;
    }
  }

  /**
   * Update client configuration.
   * @param config New configuration
   */
  async updateConfig(config: Partial<LLMConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    // No client to reinitialize with curl implementation
  }

  /**
   * Get current configuration.
   * @returns Current configuration
   */
  getConfig(): LLMConfig {
    return { ...this.config };
  }
}