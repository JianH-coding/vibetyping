/**
 * Global type declarations for the Electron application.
 * Extends the Window interface with the exposed API.
 */

import type { ASRConfig, ASRResult, ASRStatus } from '../shared/types/asr';
import type { EnvConfig } from '../shared/types/settings';
import type { LLMConfig, LLMRequestOptions } from '../main/services/llm/types';

/**
 * ASR API interface exposed via contextBridge.
 */
interface ASRApi {
  /**
   * Start ASR session.
   * @param config - Optional partial ASR configuration
   */
  start: (config?: Partial<ASRConfig>) => Promise<{ success: boolean }>;

  /**
   * Stop ASR session.
   */
  stop: () => Promise<{ success: boolean }>;

  /**
   * Send audio chunk to main process.
   * @param chunk - Audio data as ArrayBuffer
   */
  sendAudio: (chunk: ArrayBuffer) => void;

  /**
   * Subscribe to ASR results.
   * @param callback - Called when ASR result is received
   * @returns Unsubscribe function
   */
  onResult: (callback: (result: ASRResult) => void) => () => void;

  /**
   * Subscribe to ASR status changes.
   * @param callback - Called when ASR status changes
   * @returns Unsubscribe function
   */
  onStatus: (callback: (status: ASRStatus) => void) => () => void;

  /**
   * Subscribe to ASR errors.
   * @param callback - Called when ASR error occurs
   * @returns Unsubscribe function
   */
  onError: (callback: (error: string) => void) => () => void;
}

/**
 * Floating Window API interface exposed via contextBridge.
 */
interface FloatingWindowApi {
  /**
   * Show the floating window.
   */
  show: () => Promise<{ success: boolean }>;

  /**
   * Hide the floating window.
   */
  hide: () => Promise<{ success: boolean }>;

  /**
   * Set content height for adaptive window sizing.
   * @param height - Content height in pixels (from scrollHeight)
   */
  setContentHeight: (height: number) => void;
}

/**
 * Settings API interface exposed via contextBridge.
 */
interface SettingsApi {
  /**
   * Get current environment configuration.
   */
  getEnvConfig: () => Promise<EnvConfig>;

  /**
   * Update environment configuration.
   * @param config - New environment configuration
   */
  updateEnvConfig: (config: EnvConfig) => Promise<void>;

  /**
   * Apply default configuration from .env.example.
   */
  applyDefaultConfig: () => Promise<void>;
}

/**
 * LLM API interface exposed via contextBridge.
 */
interface LLMApi {
  /**
   * Test LLM connection.
   */
  testConnection: () => Promise<{
    success: boolean;
    message: string;
    details?: any;
  }>;

  /**
   * Get LLM configuration.
   */
  getConfig: () => Promise<LLMConfig>;

  /**
   * Update LLM configuration.
   * @param config - New LLM configuration
   */
  updateConfig: (config: Partial<LLMConfig>) => Promise<void>;

  /**
   * Optimize text with LLM.
   * @param text - Text to optimize
   * @param options - Request options
   */
  optimizeText: (text: string, options?: LLMRequestOptions) => Promise<{
    success: boolean;
    text: string;
    error?: string;
    processingTime?: number;
  }>;

  /**
   * Reload LLM configuration from environment.
   */
  reloadConfig: () => Promise<void>;
}

/**
 * Application API exposed to the renderer process.
 */
interface AppApi {
  asr: ASRApi;
  floatingWindow: FloatingWindowApi;
  settings: SettingsApi;
  llm: LLMApi;
}

declare global {
  interface Window {
    api: AppApi;
  }
}

export {};
