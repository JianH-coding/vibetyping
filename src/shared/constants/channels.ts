/**
 * IPC channel constants.
 * Used by both main process and renderer process for communication.
 */

export const IPC_CHANNELS = {
  ASR: {
    /** Start ASR session */
    START: 'asr:start',
    /** Stop ASR session */
    STOP: 'asr:stop',
    /** Send audio data (Renderer -> Main) */
    SEND_AUDIO: 'asr:send-audio',
    /** ASR result (Main -> Renderer) */
    RESULT: 'asr:result',
    /** ASR status change (Main -> Renderer) */
    STATUS: 'asr:status',
    /** ASR error (Main -> Renderer) */
    ERROR: 'asr:error',
    /** ASR warning (Main -> Renderer) */
    WARNING: 'asr:warning',
  },
  LLM: {
    /** Test LLM connection */
    TEST_CONNECTION: 'llm:test-connection',
    /** Get LLM configuration */
    GET_CONFIG: 'llm:get-config',
    /** Update LLM configuration */
    UPDATE_CONFIG: 'llm:update-config',
    /** Optimize text with LLM */
    OPTIMIZE_TEXT: 'llm:optimize-text',
    /** Reload LLM configuration from environment */
    RELOAD_CONFIG: 'llm:reload-config',
  },
  FLOATING_WINDOW: {
    /** Show floating window (Renderer -> Main) */
    SHOW: 'floating-window:show',
    /** Hide floating window (Renderer -> Main) */
    HIDE: 'floating-window:hide',
    /** Set content height for adaptive window sizing (Renderer -> Main) */
    SET_CONTENT_HEIGHT: 'floating-window:set-content-height',
  },
  SETTINGS: {
    /** Get current environment configuration */
    GET_ENV_CONFIG: 'settings:get-env-config',
    /** Update environment configuration */
    UPDATE_ENV_CONFIG: 'settings:update-env-config',
    /** Apply default configuration from .env.example */
    APPLY_DEFAULT_CONFIG: 'settings:apply-default-config',
  },
} as const;
