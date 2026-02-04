/**
 * Text Input Service.
 * Inserts text at cursor position using native keyboard simulation.
 *
 * Uses @xitanggg/node-insert-text which supports both Windows and macOS:
 * - macOS: Leverages CGEventKeyboardSetUnicodeString to simulate typing
 * - Windows: Uses Windows API for input simulation
 *
 * Note: On Windows, we use insertWithPaste method for better compatibility.
 */

import { insertText } from '@xitanggg/node-insert-text';
import { systemPreferences, shell } from 'electron';
import log from 'electron-log';

const logger = log.scope('text-input-service');

/**
 * Result of a text insertion operation.
 */
export interface TextInsertResult {
  success: boolean;
  error?: string;
}

/**
 * Text Input Service for inserting text at cursor position.
 *
 * Uses native keyboard simulation to insert text without clipboard pollution.
 * Requires macOS Accessibility permission to function.
 *
 * @example
 * ```typescript
 * // Check permission first
 * if (!textInputService.checkPermission()) {
 *   textInputService.openPermissionSettings();
 *   return;
 * }
 *
 * // Insert text
 * const result = textInputService.insert("Hello, world!");
 * if (!result.success) {
 *   console.error(result.error);
 * }
 * ```
 */
export class TextInputService {
  /**
   * Check if Accessibility permission is granted.
   *
   * @param promptIfNeeded - If true, shows system prompt when permission is not granted
   * @returns true if permission is granted
   */
  checkPermission(promptIfNeeded = false): boolean {
    if (process.platform !== 'darwin') {
      // On non-macOS platforms, assume permission is granted
      return true;
    }

    return systemPreferences.isTrustedAccessibilityClient(promptIfNeeded);
  }

  /**
   * Open system settings to the Accessibility permission page.
   * Only applicable on macOS. On other platforms, logs a message.
   */
  openPermissionSettings(): void {
    if (process.platform !== 'darwin') {
      logger.info('Accessibility settings are platform-specific. On Windows, ensure the application has appropriate permissions.');
      return;
    }

    const url = 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility';
    shell.openExternal(url).catch((error) => {
      logger.error('Failed to open accessibility settings', { error });
    });
  }

  /**
   * Insert text at the current cursor position.
   *
   * @param text - Text to insert
   * @returns Result indicating success or failure with error message
   */
  async insert(text: string): Promise<TextInsertResult> {
    // Validate input
    if (!text) {
      return { success: true }; // Empty text is a no-op
    }

    // Check permission first
    if (!this.checkPermission()) {
      logger.warn('Accessibility permission not granted');
      return {
        success: false,
        error: 'Accessibility permission required. Please enable in System Settings.',
      };
    }

    try {
      logger.debug('Inserting text', {
        length: text.length,
        platform: process.platform,
        preview: text.length > 50 ? text.substring(0, 50) + '...' : text
      });

      // Use different settings based on platform for better compatibility
      if (process.platform === 'win32') {
        // On Windows, use insertWithPaste method for better compatibility
        // Some applications may block direct keyboard simulation
        // Add retry logic for Windows as it may fail on first attempt
        let lastError: Error | null = null;
        const maxRetries = 2;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            logger.debug(`Insert attempt ${attempt}/${maxRetries}`, { platform: process.platform });
            insertText(text, true, null, 100); // insertWithPaste: true, pasteWaitTimeMs: 100
            logger.info('Text inserted successfully', {
              length: text.length,
              platform: process.platform,
              attempt
            });
            return { success: true };
          } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            logger.warn(`Insert attempt ${attempt} failed`, {
              error: lastError.message,
              platform: process.platform
            });

            // Wait a bit before retry
            if (attempt < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 50));
            }
          }
        }

        // If we get here, all retries failed
        throw lastError || new Error('Failed to insert text after retries');
      } else if (process.platform === 'darwin') {
        // On macOS, use default method (no paste) to avoid clipboard pollution
        insertText(text);
        logger.info('Text inserted successfully', {
          length: text.length,
          platform: process.platform
        });
        return { success: true };
      } else {
        // Linux and other platforms - try with paste method
        insertText(text, true, null, 100);
        logger.info('Text inserted successfully', {
          length: text.length,
          platform: process.platform
        });
        return { success: true };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Failed to insert text', {
        error: message,
        platform: process.platform,
        textLength: text.length
      });

      // Provide more helpful error messages based on platform
      let userMessage = message;
      if (process.platform === 'win32') {
        if (message.includes('access') || message.includes('permission') || message.includes('privilege')) {
          userMessage = 'Windows may require administrator privileges for text insertion. Try running the application as administrator.';
        } else if (message.includes('focus')) {
          userMessage = 'Make sure the target application has focus before inserting text. Try clicking on the target window first.';
        } else if (message.includes('clipboard')) {
          userMessage = 'Clipboard operation failed. Some applications may block clipboard access.';
        }
      }

      return { success: false, error: userMessage };
    }
  }
}

/**
 * Singleton instance of the text input service.
 */
export const textInputService = new TextInputService();
