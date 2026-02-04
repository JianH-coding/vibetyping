/**
 * Preload script for Electron.
 * Exposes a safe API to the renderer process via contextBridge.
 *
 * See the Electron documentation for details on how to use preload scripts:
 * https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
 */

import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from './shared/constants/channels';
import type { ASRConfig, ASRResult, ASRStatus } from './shared/types/asr';
import type { EnvConfig } from './shared/types/settings';
import type { LLMConfig, LLMRequestOptions } from './main/services/llm/types';

/**
 * ASR API exposed to the renderer process.
 */
const asrApi = {
  /**
   * Start ASR session.
   * @param config - Optional partial ASR configuration
   */
  start: (config?: Partial<ASRConfig>): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(IPC_CHANNELS.ASR.START, config),

  /**
   * Stop ASR session.
   */
  stop: (): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(IPC_CHANNELS.ASR.STOP),

  /**
   * Send audio chunk to main process.
   * @param chunk - Audio data as ArrayBuffer
   */
  sendAudio: (chunk: ArrayBuffer): void => {
    ipcRenderer.send(IPC_CHANNELS.ASR.SEND_AUDIO, chunk);
  },

  /**
   * Subscribe to ASR results.
   * @param callback - Called when ASR result is received
   * @returns Unsubscribe function
   */
  onResult: (callback: (result: ASRResult) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, result: ASRResult): void => {
      callback(result);
    };
    ipcRenderer.on(IPC_CHANNELS.ASR.RESULT, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.ASR.RESULT, handler);
    };
  },

  /**
   * Subscribe to ASR status changes.
   * @param callback - Called when ASR status changes
   * @returns Unsubscribe function
   */
  onStatus: (callback: (status: ASRStatus) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: ASRStatus): void => {
      callback(status);
    };
    ipcRenderer.on(IPC_CHANNELS.ASR.STATUS, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.ASR.STATUS, handler);
    };
  },

  /**
   * Subscribe to ASR errors.
   * @param callback - Called when ASR error occurs
   * @returns Unsubscribe function
   */
  onError: (callback: (error: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, error: string): void => {
      callback(error);
    };
    ipcRenderer.on(IPC_CHANNELS.ASR.ERROR, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.ASR.ERROR, handler);
    };
  },
};

/**
 * Floating Window API exposed to the renderer process.
 */
const floatingWindowApi = {
  /**
   * Show the floating window.
   */
  show: (): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(IPC_CHANNELS.FLOATING_WINDOW.SHOW),

  /**
   * Hide the floating window.
   */
  hide: (): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(IPC_CHANNELS.FLOATING_WINDOW.HIDE),

  /**
   * Set content height for adaptive window sizing.
   * @param height - Content height in pixels (from scrollHeight)
   */
  setContentHeight: (height: number): void => {
    ipcRenderer.send(IPC_CHANNELS.FLOATING_WINDOW.SET_CONTENT_HEIGHT, height);
  },
};

/**
 * Settings API exposed to the renderer process.
 */
const settingsApi = {
  /**
   * Get current environment configuration.
   */
  getEnvConfig: (): Promise<EnvConfig> =>
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS.GET_ENV_CONFIG),

  /**
   * Update environment configuration.
   * @param config - New environment configuration
   */
  updateEnvConfig: (config: EnvConfig): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS.UPDATE_ENV_CONFIG, config),

  /**
   * Apply default configuration from .env.example.
   */
  applyDefaultConfig: (): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS.APPLY_DEFAULT_CONFIG),
};

/**
 * LLM API exposed to the renderer process.
 */
const llmApi = {
  /**
   * Test LLM connection.
   */
  testConnection: (): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> => ipcRenderer.invoke(IPC_CHANNELS.LLM.TEST_CONNECTION),

  /**
   * Get LLM configuration.
   */
  getConfig: (): Promise<LLMConfig> =>
    ipcRenderer.invoke(IPC_CHANNELS.LLM.GET_CONFIG),

  /**
   * Update LLM configuration.
   * @param config - New LLM configuration
   */
  updateConfig: (config: Partial<LLMConfig>): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.LLM.UPDATE_CONFIG, config),

  /**
   * Optimize text with LLM.
   * @param text - Text to optimize
   * @param options - Request options
   */
  optimizeText: (
    text: string,
    options?: LLMRequestOptions
  ): Promise<{
    success: boolean;
    text: string;
    error?: string;
    processingTime?: number;
  }> => ipcRenderer.invoke(IPC_CHANNELS.LLM.OPTIMIZE_TEXT, text, options),

  /**
   * Reload LLM configuration from environment.
   */
  reloadConfig: (): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.LLM.RELOAD_CONFIG),
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('api', {
  asr: asrApi,
  floatingWindow: floatingWindowApi,
  settings: settingsApi,
  llm: llmApi,
});
