/**
 * LLM service type definitions.
 */

/**
 * LLM configuration from environment variables.
 */
export interface LLMConfig {
  /** Whether LLM optimization is enabled */
  enabled: boolean;
  /** LLM API key */
  apiKey: string;
  /** LLM model name */
  model: string;
  /** LLM optimization prompt */
  prompt: string;
  /** LLM API base URL */
  baseURL: string;
}

/**
 * LLM request options.
 */
export interface LLMRequestOptions {
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Temperature for generation */
  temperature?: number;
  /** Maximum tokens to generate */
  maxTokens?: number;
}

/**
 * LLM response from volcano engine.
 */
export interface LLMResponse {
  /** Optimized text */
  text: string;
  /** Raw response from API */
  rawResponse?: any;
  /** Processing time in milliseconds */
  processingTime: number;
  /** Whether the request was successful */
  success: boolean;
  /** Error message if request failed */
  error?: string;
}

/**
 * LLM error types.
 */
export enum LLMErrorType {
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  API_ERROR = 'API_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
}

/**
 * LLM error class.
 */
export class LLMError extends Error {
  constructor(
    public type: LLMErrorType,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

/**
 * LLM service interface.
 */
export interface ILLMService {
  /**
   * Optimize text using LLM.
   * @param text Text to optimize
   * @param options Request options
   * @returns Optimized text
   */
  optimizeText(text: string, options?: LLMRequestOptions): Promise<string>;

  /**
   * Test LLM connection.
   * @returns Whether connection is successful
   */
  testConnection(): Promise<boolean>;

  /**
   * Get current LLM configuration.
   * @returns LLM configuration
   */
  getConfig(): LLMConfig;

  /**
   * Update LLM configuration.
   * @param config New configuration
   */
  updateConfig(config: Partial<LLMConfig>): void;
}