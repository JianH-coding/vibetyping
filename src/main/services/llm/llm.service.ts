/**
 * LLM service for text optimization.
 * Manages LLM configuration, requests, and error handling.
 */

import { LLMConfig, LLMRequestOptions, ILLMService, LLMError, LLMErrorType } from './types';
import { VolcengineLLMClient } from './volcengine-llm-client';

/**
 * Default LLM configuration.
 */
const DEFAULT_CONFIG: LLMConfig = {
  enabled: false,
  apiKey: '',
  model: 'skylark2-pro-32k',
  prompt: '请将以下口语化的文本优化为书面语，保持原意不变，修正语法错误，使表达更加流畅自然：',
  baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
};

/**
 * Default request options.
 */
const DEFAULT_REQUEST_OPTIONS: LLMRequestOptions = {
  timeout: 10000, // 10 seconds
  maxRetries: 3,
  temperature: 0.7,
  maxTokens: 2000,
};

/**
 * LLM service implementation.
 */
export class LLMService implements ILLMService {
  private config: LLMConfig;
  private client: VolcengineLLMClient;
  private isInitialized = false;

  constructor() {
    try {
      console.log('LLM service: Starting initialization...');
      // Load initial configuration from environment variables
      this.config = this.loadConfigFromEnv();
      console.log('LLM service: Configuration loaded:', {
        enabled: this.config.enabled,
        model: this.config.model,
        baseURL: this.config.baseURL,
        hasApiKey: !!this.config.apiKey,
      });
      this.client = new VolcengineLLMClient(this.config);
      this.isInitialized = true;
      console.log('LLM service: Initialized successfully');
    } catch (error) {
      console.error('LLM service: Initialization failed:', error);
      // Fallback to default config but mark as not initialized
      this.config = DEFAULT_CONFIG;
      this.client = new VolcengineLLMClient(this.config);
      this.isInitialized = false;
    }
  }

  /**
   * Load LLM configuration from environment variables.
   * @returns LLM configuration
   */
  private loadConfigFromEnv(): LLMConfig {
    try {
      return {
        enabled: process.env.VOLCENGINE_LLM_ENABLED === 'true',
        apiKey: process.env.VOLCENGINE_LLM_API_KEY || '',
        model: process.env.VOLCENGINE_LLM_MODEL || DEFAULT_CONFIG.model,
        prompt: process.env.VOLCENGINE_LLM_PROMPT || DEFAULT_CONFIG.prompt,
        baseURL: process.env.VOLCENGINE_LLM_BASE_URL || DEFAULT_CONFIG.baseURL,
      };
    } catch (error) {
      console.error('Failed to load LLM configuration from environment:', error);
      return DEFAULT_CONFIG;
    }
  }

  /**
   * Optimize text using LLM.
   * @param text Text to optimize
   * @param options Request options
   * @returns Optimized text
   */
  async optimizeText(text: string, options: LLMRequestOptions = {}): Promise<string> {
    if (!this.isInitialized) {
      throw new LLMError(
        LLMErrorType.CONFIGURATION_ERROR,
        'LLM service is not initialized'
      );
    }

    if (!this.config.enabled) {
      console.log('LLM optimization is disabled, returning original text');
      return text;
    }

    // Merge default options with provided options
    const requestOptions: LLMRequestOptions = {
      ...DEFAULT_REQUEST_OPTIONS,
      ...options,
    };

    console.log('Starting LLM optimization:', {
      textLength: text.length,
      model: this.config.model,
      options: requestOptions,
    });

    try {
      const response = await this.client.optimizeText(text, requestOptions);

      if (response.success) {
        console.log('LLM optimization successful:', {
          originalLength: text.length,
          optimizedLength: response.text.length,
          processingTime: response.processingTime,
        });
        return response.text;
      } else {
        console.warn('LLM optimization failed, using original text:', {
          error: response.error,
          processingTime: response.processingTime,
        });
        return text; // Fallback to original text
      }
    } catch (error: any) {
      console.error('LLM optimization error:', {
        error: error.message,
        errorType: error.type,
      });

      // Re-throw the error for upstream handling
      throw error;
    }
  }

  /**
   * Test LLM connection.
   * @returns Whether connection is successful
   */
  async testConnection(): Promise<boolean> {
    if (!this.isInitialized) {
      return false;
    }

    if (!this.config.enabled) {
      console.log('LLM is disabled, connection test skipped');
      return false;
    }

    try {
      const isConnected = await this.client.testConnection();
      console.log('LLM connection test:', {
        success: isConnected,
        model: this.config.model,
        baseURL: this.config.baseURL,
      });
      return isConnected;
    } catch (error: any) {
      console.error('LLM connection test failed:', error.message);
      return false;
    }
  }

  /**
   * Get current LLM configuration.
   * @returns LLM configuration
   */
  getConfig(): LLMConfig {
    return { ...this.config };
  }

  /**
   * Update LLM configuration.
   * @param config New configuration
   */
  async updateConfig(config: Partial<LLMConfig>): Promise<void> {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...config };

    // Update the client with new configuration
    await this.client.updateConfig(this.config);

    console.log('LLM configuration updated:', {
      oldEnabled: oldConfig.enabled,
      newEnabled: this.config.enabled,
      oldModel: oldConfig.model,
      newModel: this.config.model,
      configChanged: JSON.stringify(oldConfig) !== JSON.stringify(this.config),
    });
  }

  /**
   * Reload configuration from environment variables.
   */
  reloadConfig(): void {
    const newConfig = this.loadConfigFromEnv();
    this.updateConfig(newConfig);
    console.log('LLM configuration reloaded from environment');
  }

  /**
   * Check if LLM optimization is available.
   * @returns Whether LLM optimization is available
   */
  isAvailable(): boolean {
    return this.isInitialized && this.config.enabled && this.config.apiKey.length > 0;
  }

  /**
   * Get service status.
   * @returns Service status information
   */
  getStatus(): {
    initialized: boolean;
    enabled: boolean;
    configured: boolean;
    model: string;
    baseURL: string;
  } {
    return {
      initialized: this.isInitialized,
      enabled: this.config.enabled,
      configured: this.config.apiKey.length > 0,
      model: this.config.model,
      baseURL: this.config.baseURL,
    };
  }
}

/**
 * Singleton instance of LLM service.
 */
let llmServiceInstance: LLMService | null = null;

/**
 * Get or create the LLM service instance.
 * @returns LLM service instance
 */
export function getLLMService(): LLMService {
  if (!llmServiceInstance) {
    llmServiceInstance = new LLMService();
  }
  return llmServiceInstance;
}