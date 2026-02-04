/**
 * Settings type definitions.
 */

export type EnvConfig = {
  VOLCENGINE_APP_ID: string;
  VOLCENGINE_ACCESS_TOKEN: string;
  VOLCENGINE_RESOURCE_ID: string;
  /** Push-to-talk trigger key code (default: 574 = Right Ctrl) */
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