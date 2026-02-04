/**
 * Keyboard Service.
 * Provides global keyboard monitoring using uiohook-napi.
 *
 * This service enables detection of keyboard events globally,
 * even when the application is not focused. Used primarily for
 * Push-to-Talk functionality.
 */

import { uIOhook, UiohookKey } from 'uiohook-napi';
import log from 'electron-log';

const logger = log.scope('keyboard-service');

/**
 * Configuration for keyboard service.
 */
export interface KeyboardConfig {
  /** Key code to trigger push-to-talk (default: Right Alt/Option) */
  triggerKey: number;
  /** Debounce time in milliseconds to prevent duplicate events */
  debounceMs: number;
  /** Minimum recording duration in milliseconds */
  minRecordingMs: number;
}

/**
 * Default configuration values.
 */
const DEFAULT_CONFIG: KeyboardConfig = {
  triggerKey: UiohookKey.CtrlRight, // Right Ctrl key (recommended)
  debounceMs: 50,
  minRecordingMs: 200,
};

/**
 * Internal state for keyboard service.
 */
interface KeyboardState {
  isKeyHeld: boolean;
  lastKeyDownTime: number;
  lastKeyUpTime: number;
  recordingStartTime: number;
}

/**
 * Keyboard Service for global keyboard monitoring.
 *
 * Uses uiohook-napi to detect key press/release events globally.
 * Handles debouncing and minimum recording duration.
 *
 * @example
 * ```typescript
 * keyboardService.register(
 *   () => console.log('Key down - start recording'),
 *   () => console.log('Key up - stop recording')
 * );
 * ```
 */
export class KeyboardService {
  private config: KeyboardConfig;
  private state: KeyboardState = {
    isKeyHeld: false,
    lastKeyDownTime: 0,
    lastKeyUpTime: 0,
    recordingStartTime: 0,
  };

  private onKeyDown: (() => void) | null = null;
  private onKeyUp: (() => void) | null = null;
  private isStarted = false;

  // Bound handlers for proper cleanup
  private boundKeyDownHandler: ((e: { keycode: number }) => void) | null = null;
  private boundKeyUpHandler: ((e: { keycode: number }) => void) | null = null;

  constructor(config: Partial<KeyboardConfig> = {}) {
    // Read trigger key from environment variable if not provided in config
    const envTriggerKey = process.env.PUSH_TO_TALK_KEY;
    let triggerKey = DEFAULT_CONFIG.triggerKey;

    if (envTriggerKey) {
      const parsedKey = parseInt(envTriggerKey, 10);
      if (!isNaN(parsedKey)) {
        // Validate that the key code is a known uiohook key code
        // Get all known key codes from UiohookKey enum (both string and numeric values)
        const knownKeyCodes = Object.values(UiohookKey).filter(v => typeof v === 'number') as number[];
        if (knownKeyCodes.includes(parsedKey)) {
          triggerKey = parsedKey;
          logger.info('Using trigger key from environment variable', {
            keyCode: parsedKey,
            keyName: this.getKeyName(parsedKey)
          });
        } else {
          logger.warn('PUSH_TO_TALK_KEY environment variable is not a known key code, using default', {
            value: parsedKey,
            defaultKeyCode: DEFAULT_CONFIG.triggerKey,
            defaultKeyName: this.getKeyName(DEFAULT_CONFIG.triggerKey)
          });
        }
      } else {
        logger.warn('Invalid PUSH_TO_TALK_KEY environment variable, using default', {
          value: envTriggerKey
        });
      }
    }

    this.config = {
      ...DEFAULT_CONFIG,
      triggerKey,
      ...config
    };

    logger.info('KeyboardService created', {
      triggerKey: this.config.triggerKey,
      triggerKeyName: this.getKeyName(this.config.triggerKey),
      debounceMs: this.config.debounceMs,
      minRecordingMs: this.config.minRecordingMs,
      source: envTriggerKey ? 'environment' : config.triggerKey ? 'config' : 'default'
    });
  }

  /**
   * Register callbacks for key down/up events.
   *
   * @param onKeyDown - Called when trigger key is pressed
   * @param onKeyUp - Called when trigger key is released (after min duration)
   */
  register(onKeyDown: () => void, onKeyUp: () => void): void {
    if (this.isStarted) {
      logger.warn('KeyboardService already registered, unregistering first');
      this.unregister();
    }

    this.onKeyDown = onKeyDown;
    this.onKeyUp = onKeyUp;

    // Create bound handlers
    this.boundKeyDownHandler = (e) => this.handleKeyDown(e.keycode);
    this.boundKeyUpHandler = (e) => this.handleKeyUp(e.keycode);

    // Register event listeners
    uIOhook.on('keydown', this.boundKeyDownHandler);
    uIOhook.on('keyup', this.boundKeyUpHandler);

    // Start the hook
    try {
      uIOhook.start();
      this.isStarted = true;

      logger.info('KeyboardService registered', {
        platform: process.platform,
        triggerKey: this.config.triggerKey,
        triggerKeyName: this.getKeyName(this.config.triggerKey)
      });

      // Platform-specific guidance
      const keyName = this.getKeyName(this.config.triggerKey);
      if (process.platform === 'win32') {
        logger.info(`On Windows, hold ${keyName} key to trigger speech recognition`);
      } else if (process.platform === 'darwin') {
        logger.info(`On macOS, hold ${keyName} key to trigger speech recognition`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Failed to start keyboard hook', {
        error: message,
        platform: process.platform
      });

      if (process.platform === 'win32') {
        logger.error('On Windows, global keyboard hooks may require administrator privileges or specific permissions.');
      }
      throw error;
    }
  }

  /**
   * Unregister callbacks and stop keyboard monitoring.
   */
  unregister(): void {
    if (!this.isStarted) {
      return;
    }

    // Remove event listeners before stopping
    if (this.boundKeyDownHandler) {
      uIOhook.off('keydown', this.boundKeyDownHandler);
    }
    if (this.boundKeyUpHandler) {
      uIOhook.off('keyup', this.boundKeyUpHandler);
    }

    // Stop the hook
    uIOhook.stop();

    // Clean up state
    this.onKeyDown = null;
    this.onKeyUp = null;
    this.boundKeyDownHandler = null;
    this.boundKeyUpHandler = null;
    this.isStarted = false;
    this.resetState();

    logger.info('KeyboardService unregistered');
  }

  /**
   * Check if keyboard service is currently active.
   */
  get isActive(): boolean {
    return this.isStarted;
  }

  /**
   * Check if the trigger key is currently held.
   */
  get isKeyCurrentlyHeld(): boolean {
    return this.state.isKeyHeld;
  }

  /**
   * Reset internal state.
   */
  private resetState(): void {
    this.state = {
      isKeyHeld: false,
      lastKeyDownTime: 0,
      lastKeyUpTime: 0,
      recordingStartTime: 0,
    };
  }

  /**
   * Get human-readable key name for logging.
   */
  private getKeyName(keycode: number): string {
    // Common key codes from uiohook-napi
    const keyNames: Record<number, string> = {
      0x00: 'Unknown',
      0x38: 'Alt',
      0x39: 'Space',
      0x3A: 'CapsLock',
      0x3B: 'F1',
      0x3C: 'F2',
      0x3D: 'F3',
      0x3E: 'F4',
      0x3F: 'F5',
      0x40: 'F6',
      0x41: 'F7',
      0x42: 'F8',
      0x43: 'F9',
      0x44: 'F10',
      0x57: 'F11',
      0x58: 'F12',
      0x5B: 'MetaLeft', // Windows key left
      0x5C: 'MetaRight', // Windows key right
      0x64: 'ContextMenu', // Menu key
      0xE0: 'ControlLeft',
      0xE1: 'ShiftLeft',
      0xE2: 'AltLeft',
      0xE3: 'MetaLeft',
      0xE4: 'ControlRight',
      0xE5: 'ShiftRight',
      0xE6: 'AltRight', // Right Alt/Option
      // Additional keys for better logging
      0x46: 'ScrollLock',
      0x45: 'Pause',
      0x01: 'Escape',
      0x1C: 'Enter',
      0x0F: 'Tab',
      0x0E: 'Backspace',
    };

    return keyNames[keycode] || `KeyCode_${keycode.toString(16)}`;
  }

  /**
   * Check if an event should be debounced.
   */
  private isDebounced(lastTime: number): boolean {
    return Date.now() - lastTime < this.config.debounceMs;
  }

  /**
   * Handle key down event.
   */
  private handleKeyDown(keycode: number): void {
    // Ignore if not our trigger key
    if (keycode !== this.config.triggerKey) {
      return;
    }

    // Ignore if debounced (auto-repeat prevention)
    if (this.isDebounced(this.state.lastKeyDownTime)) {
      return;
    }

    // Ignore if already held (prevents duplicate events)
    if (this.state.isKeyHeld) {
      return;
    }

    // Update state
    this.state.isKeyHeld = true;
    this.state.lastKeyDownTime = Date.now();
    this.state.recordingStartTime = Date.now();

    logger.debug('Trigger key pressed');

    // Call callback
    this.onKeyDown?.();
  }

  /**
   * Handle key up event.
   */
  private handleKeyUp(keycode: number): void {
    // Ignore if not our trigger key
    if (keycode !== this.config.triggerKey) {
      return;
    }

    // Ignore if not currently held
    if (!this.state.isKeyHeld) {
      return;
    }

    // Ignore if debounced
    if (this.isDebounced(this.state.lastKeyUpTime)) {
      return;
    }

    // Calculate recording duration
    const recordingDuration = Date.now() - this.state.recordingStartTime;

    // Update state
    this.state.isKeyHeld = false;
    this.state.lastKeyUpTime = Date.now();

    // Check minimum recording duration
    if (recordingDuration < this.config.minRecordingMs) {
      logger.debug('Recording too short, ignoring', {
        duration: recordingDuration,
        minRequired: this.config.minRecordingMs,
      });
      return;
    }

    logger.debug('Trigger key released', { duration: recordingDuration });

    // Call callback
    this.onKeyUp?.();
  }
}

/**
 * Singleton instance of the keyboard service.
 */
export const keyboardService = new KeyboardService();
