/**
 * IPC handler for LLM service.
 * Handles LLM-related IPC requests from renderer process.
 */

import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants/channels';
import { getLLMService } from '../services/llm';
import { LLMConfig, LLMRequestOptions } from '../services/llm/types';

/**
 * Setup LLM IPC handlers.
 */
export function setupLLMHandlers(): void {
  console.log('Setting up LLM IPC handlers...');

  const llmService = getLLMService();

  // Test LLM connection
  ipcMain.handle(IPC_CHANNELS.LLM.TEST_CONNECTION, async (): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> => {
    console.log('Testing LLM connection...');

    try {
      const isConnected = await llmService.testConnection();

      if (isConnected) {
        return {
          success: true,
          message: 'LLM连接测试成功',
          details: {
            model: llmService.getConfig().model,
            baseURL: llmService.getConfig().baseURL,
          },
        };
      } else {
        return {
          success: false,
          message: 'LLM连接测试失败',
          details: {
            enabled: llmService.getConfig().enabled,
            configured: llmService.getConfig().apiKey.length > 0,
            model: llmService.getConfig().model,
          },
        };
      }
    } catch (error: any) {
      console.error('LLM connection test error:', error);
      return {
        success: false,
        message: `连接测试出错: ${error.message}`,
        details: { error: error.message },
      };
    }
  });

  // Get LLM configuration
  ipcMain.handle(IPC_CHANNELS.LLM.GET_CONFIG, async (): Promise<LLMConfig> => {
    console.log('Getting LLM configuration...');
    return llmService.getConfig();
  });

  // Update LLM configuration
  ipcMain.handle(
    IPC_CHANNELS.LLM.UPDATE_CONFIG,
    async (_event, config: Partial<LLMConfig>): Promise<void> => {
      console.log('Updating LLM configuration...', {
        enabled: config.enabled,
        model: config.model,
        baseURL: config.baseURL,
      });

      try {
        llmService.updateConfig(config);
        console.log('LLM configuration updated successfully');
      } catch (error: any) {
        console.error('Failed to update LLM configuration:', error);
        throw new Error(`更新LLM配置失败: ${error.message}`);
      }
    }
  );

  // Optimize text with LLM
  ipcMain.handle(
    IPC_CHANNELS.LLM.OPTIMIZE_TEXT,
    async (_event, text: string, options?: LLMRequestOptions): Promise<{
      success: boolean;
      text: string;
      error?: string;
      processingTime?: number;
    }> => {
      console.log('Optimizing text with LLM...', {
        textLength: text.length,
        options,
      });

      if (!llmService.isAvailable()) {
        return {
          success: false,
          text,
          error: 'LLM优化未启用或未配置',
        };
      }

      try {
        const optimizedText = await llmService.optimizeText(text, options);
        return {
          success: true,
          text: optimizedText,
        };
      } catch (error: any) {
        console.error('LLM optimization error:', error);
        return {
          success: false,
          text,
          error: `优化失败: ${error.message}`,
        };
      }
    }
  );

  // Reload LLM configuration from environment variables
  ipcMain.handle(IPC_CHANNELS.LLM.RELOAD_CONFIG, async (): Promise<void> => {
    console.log('Reloading LLM configuration from environment...');
    llmService.reloadConfig();
  });

  console.log('LLM IPC handlers setup complete');
}