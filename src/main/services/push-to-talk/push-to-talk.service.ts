/**
 * Push-to-Talk Service.
 * Orchestrates keyboard hooks, ASR, and text insertion for voice input.
 *
 * Flow:
 * 1. User holds Right Option key
 * 2. KeyboardService detects keydown -> triggers handleKeyDown
 * 3. ASR session starts, floating window shows
 * 4. Renderer starts recording, sends audio chunks
 * 5. User releases Right Option key
 * 6. KeyboardService detects keyup -> triggers handleKeyUp
 * 7. ASR session stops, gets final result
 * 8. Text is inserted at cursor position
 * 9. Floating window hides
 */

import { BrowserWindow } from 'electron';
import log from 'electron-log';
import { keyboardService } from '../keyboard';
import { textInputService } from '../text-input';
import { asrService } from '../asr';
import { permissionsService } from '../permissions';
import { floatingWindow } from '../../windows';
import { IPC_CHANNELS } from '../../../shared/constants/channels';
import { getLLMService } from '../llm';

const logger = log.scope('push-to-talk-service');

/**
 * Push-to-Talk Service configuration.
 */
export interface PushToTalkConfig {
  /** Whether to auto-insert text after recognition */
  autoInsertText: boolean;
  /** Delay before hiding floating window after done (ms) */
  hideDelayMs: number;
}

/**
 * Default configuration.
 */
const DEFAULT_CONFIG: PushToTalkConfig = {
  autoInsertText: true,
  hideDelayMs: 500,
};

/**
 * Push-to-Talk Service orchestrates the voice input flow.
 *
 * Coordinates:
 * - KeyboardService: Global keyboard hook for trigger key
 * - ASRService: Speech recognition
 * - TextInputService: Text insertion at cursor
 * - FloatingWindow: Visual feedback
 *
 * @example
 * ```typescript
 * // Initialize on app ready
 * pushToTalkService.initialize();
 *
 * // Cleanup on app quit
 * pushToTalkService.dispose();
 * ```
 */
export class PushToTalkService {
  private config: PushToTalkConfig;
  private isActive = false;
  private isInitialized = false;
  private isWarmedUp = false;
  private warmupTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<PushToTalkConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the Push-to-Talk service.
   * Registers keyboard hooks and sets up event listeners.
   */
  initialize(): void {
    if (this.isInitialized) {
      logger.warn('PushToTalkService already initialized');
      return;
    }

    logger.info('Initializing PushToTalkService', { platform: process.platform });

    // Log platform-specific notes
    if (process.platform === 'win32') {
      logger.info('Windows detected: Using insertWithPaste method for text insertion');
      logger.info('Note: On Windows, global keyboard hooks may require specific permissions');
    } else if (process.platform === 'darwin') {
      logger.info('macOS detected: Accessibility permissions required for text insertion');
    }

    // Log permission status for debugging
    permissionsService.logPermissionStatus();

    try {
      logger.info('PushToTalkService: Attempting to register keyboard hooks...');
      // Register keyboard hooks
      keyboardService.register(
        () => this.handleKeyDown(),
        () => this.handleKeyUp()
      );

      this.isInitialized = true;
      logger.info('PushToTalkService initialized successfully', { platform: process.platform });

      // Start warmup timer - keyboard hooks may need time to fully activate
      // Especially on Windows, global hooks can take a moment to start receiving events
      const WARMUP_TIME_MS = process.platform === 'win32' ? 1000 : 500;
      this.isWarmedUp = false;

      this.warmupTimer = setTimeout(() => {
        this.isWarmedUp = true;
        logger.info('PushToTalkService warmed up and ready', {
          platform: process.platform,
          warmupTimeMs: WARMUP_TIME_MS
        });
      }, WARMUP_TIME_MS);

      logger.info(`PushToTalkService warming up for ${WARMUP_TIME_MS}ms`, { platform: process.platform });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Failed to initialize PushToTalkService', {
        error: message,
        platform: process.platform
      });

      // Don't mark as initialized so we can retry
      this.isInitialized = false;

      // Provide user-friendly error message based on platform
      if (process.platform === 'win32') {
        logger.error('On Windows, this may be due to:');
        logger.error('1. Missing permissions for global keyboard hooks');
        logger.error('2. Antivirus or security software blocking keyboard monitoring');
        logger.error('3. Need to run as administrator');
      }

      // Re-throw the error so the caller knows initialization failed
      throw error;
    }
  }

  /**
   * Dispose of the Push-to-Talk service.
   * Unregisters keyboard hooks and cleans up resources.
   */
  dispose(): void {
    if (!this.isInitialized) {
      return;
    }

    logger.info('Disposing PushToTalkService');

    // Clear warmup timer
    if (this.warmupTimer) {
      clearTimeout(this.warmupTimer);
      this.warmupTimer = null;
    }

    // Stop any active session
    if (this.isActive) {
      this.handleKeyUp().catch((error) => {
        logger.error('Error during dispose cleanup', { error });
      });
    }

    // Unregister keyboard hooks
    keyboardService.unregister();

    this.isInitialized = false;
    this.isWarmedUp = false;
    logger.info('PushToTalkService disposed');
  }

  /**
   * Check if the service is currently active (recording).
   */
  get isRecording(): boolean {
    return this.isActive;
  }

  /**
   * Handle key down event (trigger key pressed).
   * Starts ASR session and shows floating window.
   */
  private async handleKeyDown(): Promise<void> {
    if (this.isActive) {
      logger.warn('Already recording, ignoring key down');
      return;
    }

    // Check if service is warmed up (keyboard hooks fully active)
    if (!this.isWarmedUp) {
      logger.warn('Service not fully warmed up yet, processing key down anyway');
      // Continue processing - warmup is just a warning
    }

    logger.info('Push-to-talk: START');
    this.isActive = true;

    try {
      // Show floating window with listening status
      floatingWindow.sendStatus('connecting');

      // Start ASR session
      await asrService.start();

      // Update status to listening
      floatingWindow.sendStatus('listening');

      // Notify renderer to start recording
      this.notifyRendererStartRecording();

      logger.info('Push-to-talk session started');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Failed to start push-to-talk session', { error: message });

      // Reset state on failure
      this.isActive = false;

      // Show error in floating window
      floatingWindow.sendError(`Failed to start: ${message}`);
    }
  }

  /**
   * Handle key up event (trigger key released).
   * Stops ASR session, inserts text, and hides floating window.
   */
  private async handleKeyUp(): Promise<void> {
    if (!this.isActive) {
      logger.debug('Not recording, ignoring key up');
      return;
    }

    logger.info('Push-to-talk: STOP');
    this.isActive = false;

    try {
      // Update floating window status
      floatingWindow.sendStatus('processing');

      // Notify renderer to stop recording
      this.notifyRendererStopRecording();

      // Stop ASR and get final result
      const result = await asrService.stop();

      if (result && result.text) {
        logger.info('ASR result received', {
          textLength: result.text.length,
          isFinal: result.isFinal,
        });

        // Send result to floating window
        floatingWindow.sendResult(result);

        let finalText = result.text;

        // Check if LLM optimization is enabled and available
        const llmService = getLLMService();
        if (llmService.isAvailable()) {
          try {
            logger.info('Starting LLM optimization...');

            // Update floating window status to show LLM optimization in progress
            floatingWindow.sendStatus('llm_optimizing');

            // Optimize text using LLM
            const optimizedText = await llmService.optimizeText(result.text, {
              timeout: 15000, // 15 seconds timeout for LLM
              maxRetries: 2,
            });

            if (optimizedText !== result.text) {
              logger.info('LLM optimization completed', {
                originalLength: result.text.length,
                optimizedLength: optimizedText.length,
                reduction: result.text.length - optimizedText.length,
              });

              finalText = optimizedText;

              // Send optimized result to floating window
              floatingWindow.sendResult({
                ...result,
                text: optimizedText,
                isOptimized: true,
              });
            } else {
              logger.info('LLM optimization returned same text, using original');
            }

          } catch (error: any) {
            const message = error instanceof Error ? error.message : String(error);
            logger.warn('LLM optimization failed, using original text', {
              error: message,
              errorType: error.type,
            });

            // Show warning in floating window
            floatingWindow.sendWarning('LLM优化失败，使用原始文本');

            // Continue with original text
            finalText = result.text;
          }
        } else {
          logger.debug('LLM optimization is disabled or not configured');
        }

        floatingWindow.sendStatus('done');

        // IMPORTANT: Hide floating window FIRST to return focus to the previous app
        // Then wait a bit for the focus to switch before inserting text
        floatingWindow.hide();

        // Insert text at cursor position after focus returns
        if (this.config.autoInsertText) {
          // Wait for focus to return to the previous application
          // Windows may need more time for focus to properly return
          const focusWaitTime = process.platform === 'win32' ? 300 : 100;
          logger.debug(`Waiting ${focusWaitTime}ms for focus to return`, { platform: process.platform });
          await new Promise(resolve => setTimeout(resolve, focusWaitTime));

          const insertResult = await textInputService.insert(finalText);

          if (!insertResult.success) {
            logger.error('Failed to insert text', {
              error: insertResult.error,
              platform: process.platform,
              textLength: finalText.length
            });
            // Show error briefly
            floatingWindow.sendError(`Insert failed: ${insertResult.error}`);
          } else {
            logger.info('Text inserted successfully', {
              platform: process.platform,
              optimized: finalText !== result.text,
              originalLength: result.text.length,
              finalLength: finalText.length,
            });
          }
        }
      } else {
        logger.info('No ASR result to insert');
        // Hide floating window
        floatingWindow.hide();
      }

      logger.info('Push-to-talk session completed');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Failed to stop push-to-talk session', { error: message });

      // Show error in floating window briefly, then hide
      floatingWindow.sendError(`Error: ${message}`);
      setTimeout(() => {
        floatingWindow.hide();
      }, this.config.hideDelayMs * 2);
    }
  }

  /**
   * Notify renderer process to start recording.
   */
  private notifyRendererStartRecording(): void {
    const mainWindow = this.getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send(IPC_CHANNELS.ASR.STATUS, 'listening');
    }
  }

  /**
   * Notify renderer process to stop recording.
   */
  private notifyRendererStopRecording(): void {
    const mainWindow = this.getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send(IPC_CHANNELS.ASR.STATUS, 'processing');
    }
  }

  /**
   * Get the main application window.
   */
  private getMainWindow(): BrowserWindow | null {
    return BrowserWindow.getAllWindows().find(
      (win) => !win.isDestroyed()
    ) ?? null;
  }
}

/**
 * Singleton instance of the push-to-talk service.
 */
export const pushToTalkService = new PushToTalkService();
