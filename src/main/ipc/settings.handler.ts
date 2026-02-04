/**
 * IPC handler for settings management.
 * Handles reading and writing .env configuration files.
 */

import { ipcMain } from 'electron';
import fs from 'fs';
import path from 'node:path';
import { IPC_CHANNELS } from '../../shared/constants/channels';

// Environment configuration type
type EnvConfig = {
  VOLCENGINE_APP_ID: string;
  VOLCENGINE_ACCESS_TOKEN: string;
  VOLCENGINE_RESOURCE_ID: string;
  /** Push-to-talk trigger key code (default: 228 = Right Ctrl) */
  PUSH_TO_TALK_KEY?: string;
  /** Whether LLM optimization is enabled */
  VOLCENGINE_LLM_ENABLED?: string;
  /** LLM API key */
  VOLCENGINE_LLM_API_KEY?: string;
  /** LLM model name */
  VOLCENGINE_LLM_MODEL?: string;
  /** LLM optimization prompt */
  VOLCENGINE_LLM_PROMPT?: string;
  /** LLM API base URL */
  VOLCENGINE_LLM_BASE_URL?: string;
};

/**
 * Parse .env file content into key-value pairs.
 */
function parseEnvFile(content: string): Record<string, string> {
  const config: Record<string, string> = {};
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex === -1) {
      continue;
    }

    const key = trimmed.substring(0, equalsIndex).trim();
    const value = trimmed.substring(equalsIndex + 1).trim();
    // Remove quotes if present
    const unquotedValue = value.replace(/^['"](.*)['"]$/, '$1');
    config[key] = unquotedValue;
  }

  return config;
}

/**
 * Convert config object to .env file content.
 */
function stringifyEnvConfig(config: EnvConfig): string {
  return `# 火山引擎豆包语音识别配置
# 复制此文件为 .env 并填入你的配置

# APP ID (从应用管理获取)
VOLCENGINE_APP_ID=${config.VOLCENGINE_APP_ID}

# Access Token (从流式语音识别大模型页面获取，点击眼睛图标查看)
VOLCENGINE_ACCESS_TOKEN=${config.VOLCENGINE_ACCESS_TOKEN}

# Resource ID (volc.bigasr.sauc.duration = 大模型1.0 流式识别)
VOLCENGINE_RESOURCE_ID=${config.VOLCENGINE_RESOURCE_ID}

# Push-to-talk trigger key code (default: 228 = Right Ctrl)
# Common key codes: 228=Right Ctrl, 229=Right Shift, 230=Right Alt, 58=Caps Lock
PUSH_TO_TALK_KEY=${config.PUSH_TO_TALK_KEY || '228'}

# 火山引擎豆包大语言模型配置
# 是否启用LLM优化 (true/false)
VOLCENGINE_LLM_ENABLED=${config.VOLCENGINE_LLM_ENABLED || 'false'}

# LLM API密钥 (从火山引擎控制台获取)
VOLCENGINE_LLM_API_KEY=${config.VOLCENGINE_LLM_API_KEY || ''}

# LLM模型名称 (例如: "skylark2-pro-32k", "ep-20250730192125-j4n46")
VOLCENGINE_LLM_MODEL=${config.VOLCENGINE_LLM_MODEL || 'skylark2-pro-32k'}

# LLM优化提示词
VOLCENGINE_LLM_PROMPT=${config.VOLCENGINE_LLM_PROMPT || '请将以下口语化的文本优化为书面语，保持原意不变，修正语法错误，使表达更加流畅自然：'}

# LLM API基础URL (默认使用火山引擎官方API)
VOLCENGINE_LLM_BASE_URL=${config.VOLCENGINE_LLM_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3'}
`;
}

/**
 * Read .env file or return default values.
 */
function readEnvConfig(): EnvConfig {
  const envPath = path.join(process.cwd(), '.env');
  const defaultConfig: EnvConfig = {
    VOLCENGINE_APP_ID: '',
    VOLCENGINE_ACCESS_TOKEN: '',
    VOLCENGINE_RESOURCE_ID: 'volc.bigasr.sauc.duration',
    PUSH_TO_TALK_KEY: '228', // Right Ctrl key code
    VOLCENGINE_LLM_ENABLED: 'false',
    VOLCENGINE_LLM_API_KEY: '',
    VOLCENGINE_LLM_MODEL: 'skylark2-pro-32k',
    VOLCENGINE_LLM_PROMPT: '请将以下口语化的文本优化为书面语，保持原意不变，修正语法错误，使表达更加流畅自然：',
    VOLCENGINE_LLM_BASE_URL: 'https://ark.cn-beijing.volces.com/api/v3',
  };

  try {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      const parsed = parseEnvFile(content);

      return {
        VOLCENGINE_APP_ID: parsed.VOLCENGINE_APP_ID || defaultConfig.VOLCENGINE_APP_ID,
        VOLCENGINE_ACCESS_TOKEN: parsed.VOLCENGINE_ACCESS_TOKEN || defaultConfig.VOLCENGINE_ACCESS_TOKEN,
        VOLCENGINE_RESOURCE_ID: parsed.VOLCENGINE_RESOURCE_ID || defaultConfig.VOLCENGINE_RESOURCE_ID,
        PUSH_TO_TALK_KEY: (() => {
          const key = parsed.PUSH_TO_TALK_KEY || defaultConfig.PUSH_TO_TALK_KEY;
          // Migration: old default was 574, new default is 228 (Right Ctrl)
          if (key === '574') {
            console.log('Migrating PUSH_TO_TALK_KEY from 574 to 228');
            return defaultConfig.PUSH_TO_TALK_KEY;
          }
          return key;
        })(),
        VOLCENGINE_LLM_ENABLED: parsed.VOLCENGINE_LLM_ENABLED || defaultConfig.VOLCENGINE_LLM_ENABLED,
        VOLCENGINE_LLM_API_KEY: parsed.VOLCENGINE_LLM_API_KEY || defaultConfig.VOLCENGINE_LLM_API_KEY,
        VOLCENGINE_LLM_MODEL: parsed.VOLCENGINE_LLM_MODEL || defaultConfig.VOLCENGINE_LLM_MODEL,
        VOLCENGINE_LLM_PROMPT: parsed.VOLCENGINE_LLM_PROMPT || defaultConfig.VOLCENGINE_LLM_PROMPT,
        VOLCENGINE_LLM_BASE_URL: parsed.VOLCENGINE_LLM_BASE_URL || defaultConfig.VOLCENGINE_LLM_BASE_URL,
      };
    }
  } catch (error) {
    console.error('Failed to read .env file:', error);
  }

  return defaultConfig;
}

/**
 * Write configuration to .env file.
 */
function writeEnvConfig(config: EnvConfig): void {
  const envPath = path.join(process.cwd(), '.env');
  const content = stringifyEnvConfig(config);

  try {
    fs.writeFileSync(envPath, content, 'utf-8');
    console.log('Configuration saved to .env file');
  } catch (error) {
    console.error('Failed to write .env file:', error);
    throw error;
  }
}

/**
 * Apply default configuration from .env.example.
 */
function applyDefaultConfig(): void {
  const examplePath = path.join(process.cwd(), '.env.example');
  const envPath = path.join(process.cwd(), '.env');

  try {
    if (fs.existsSync(examplePath)) {
      const content = fs.readFileSync(examplePath, 'utf-8');
      fs.writeFileSync(envPath, content, 'utf-8');
      console.log('Default configuration applied from .env.example');
    } else {
      throw new Error('.env.example file not found');
    }
  } catch (error) {
    console.error('Failed to apply default configuration:', error);
    throw error;
  }
}

/**
 * Setup settings IPC handlers.
 */
export function setupSettingsHandlers(): void {
  console.log('Setting up settings IPC handlers...');

  // Get current environment configuration
  ipcMain.handle(IPC_CHANNELS.SETTINGS.GET_ENV_CONFIG, async (): Promise<EnvConfig> => {
    console.log('Getting environment configuration...');
    return readEnvConfig();
  });

  // Update environment configuration
  ipcMain.handle(IPC_CHANNELS.SETTINGS.UPDATE_ENV_CONFIG, async (_event, config: EnvConfig): Promise<void> => {
    console.log('Updating environment configuration...');
    writeEnvConfig(config);
    // Configuration is automatically reloaded by dotenv when app restarts
    // In a real app, you might want to notify services to reload config
  });

  // Apply default configuration from .env.example
  ipcMain.handle(IPC_CHANNELS.SETTINGS.APPLY_DEFAULT_CONFIG, async (): Promise<void> => {
    console.log('Applying default configuration from .env.example...');
    applyDefaultConfig();
  });

  console.log('Settings IPC handlers setup complete');
}