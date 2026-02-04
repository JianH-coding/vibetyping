/**
 * Permissions Service.
 * Handles system permission checks and prompts for different platforms.
 *
 * Required permissions for Push-to-Talk:
 * - macOS:
 *   - Input Monitoring: For global keyboard hooks (uiohook-napi)
 *   - Accessibility: For text insertion (node-insert-text)
 *   - Microphone: For audio recording (handled by renderer)
 * - Windows:
 *   - Microphone: For audio recording (handled by renderer)
 *   - May require administrator privileges for text insertion
 */

import { systemPreferences, shell } from 'electron';
import log from 'electron-log';

const logger = log.scope('permissions-service');

/**
 * System settings URLs for various permissions.
 */
const SETTINGS_URLS = {
  microphone: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
  accessibility: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
  inputMonitoring: 'x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent',
} as const;

/**
 * Permission types that can be checked.
 */
export type PermissionType = keyof typeof SETTINGS_URLS;

/**
 * Media access status type from Electron.
 * Includes all possible values that getMediaAccessStatus can return.
 */
export type MediaAccessStatus = 'not-determined' | 'granted' | 'denied' | 'restricted' | 'unknown';

/**
 * Permission status for all required permissions.
 */
export interface PermissionStatus {
  /** Microphone permission status */
  microphone: MediaAccessStatus;
  /** Accessibility permission for text insertion */
  accessibility: boolean;
  /** All required permissions are granted */
  allGranted: boolean;
}

/**
 * Permissions Service for macOS system permissions.
 *
 * Note: Input Monitoring permission cannot be checked programmatically.
 * The app will simply fail to receive keyboard events if not granted.
 * Users should be guided to grant this permission manually.
 *
 * @example
 * ```typescript
 * const status = permissionsService.checkPermissions();
 * if (!status.allGranted) {
 *   permissionsService.openSettings('accessibility');
 * }
 * ```
 */
export class PermissionsService {
  /**
   * Check all required permissions.
   *
   * @returns Permission status for each permission type
   */
  checkPermissions(): PermissionStatus {
    const microphone = this.getMicrophoneStatus();
    const accessibility = this.getAccessibilityStatus();

    const allGranted = microphone === 'granted' && accessibility;

    logger.debug('Permission check result', { microphone, accessibility, allGranted });

    return {
      microphone,
      accessibility,
      allGranted,
    };
  }

  /**
   * Get microphone permission status.
   *
   * @returns Permission status string
   */
  getMicrophoneStatus(): MediaAccessStatus {
    if (process.platform !== 'darwin') {
      return 'granted';
    }

    return systemPreferences.getMediaAccessStatus('microphone');
  }

  /**
   * Get accessibility permission status.
   *
   * @param promptIfNeeded - If true, prompts user if not determined
   * @returns true if accessibility permission is granted
   */
  getAccessibilityStatus(promptIfNeeded = false): boolean {
    if (process.platform !== 'darwin') {
      return true;
    }

    return systemPreferences.isTrustedAccessibilityClient(promptIfNeeded);
  }

  /**
   * Request microphone permission.
   * Only works on signed apps; unsigned apps inherit terminal permissions.
   *
   * @returns Promise resolving to true if granted
   */
  async requestMicrophonePermission(): Promise<boolean> {
    if (process.platform !== 'darwin') {
      return true;
    }

    const status = this.getMicrophoneStatus();
    if (status === 'granted') {
      return true;
    }

    if (status === 'not-determined') {
      try {
        return await systemPreferences.askForMediaAccess('microphone');
      } catch (error) {
        logger.error('Failed to request microphone permission', { error });
        return false;
      }
    }

    // If denied or restricted, guide to settings
    return false;
  }

  /**
   * Open system settings to the specified permission page.
   * On non-macOS platforms, provides guidance instead of opening settings.
   *
   * @param type - Permission type to open settings for
   */
  openSettings(type: PermissionType): void {
    if (process.platform !== 'darwin') {
      logger.info(`On ${process.platform}, permission settings are platform-specific.`);

      if (type === 'microphone') {
        logger.info('On Windows, configure microphone permissions in Settings > Privacy & security > Microphone');
      } else if (type === 'accessibility') {
        logger.info('On Windows, text insertion may require administrator privileges or running as administrator.');
      } else if (type === 'inputMonitoring') {
        logger.info('On Windows, global keyboard hooks may require specific permissions or running as administrator.');
      }
      return;
    }

    const url = SETTINGS_URLS[type];
    logger.info('Opening permission settings', { type, url });

    shell.openExternal(url).catch((error) => {
      logger.error('Failed to open settings', { type, error });
    });
  }

  /**
   * Log current permission status.
   * Useful for debugging permission issues.
   */
  logPermissionStatus(): void {
    const status = this.checkPermissions();
    logger.info('Current permission status', { ...status, platform: process.platform });

    if (process.platform === 'darwin') {
      if (!status.allGranted) {
        logger.warn('Missing permissions detected');

        if (status.microphone !== 'granted') {
          logger.warn('- Microphone: Not granted. Enable in System Settings > Privacy & Security > Microphone');
        }

        if (!status.accessibility) {
          logger.warn('- Accessibility: Not granted. Enable in System Settings > Privacy & Security > Accessibility');
        }

        logger.warn('- Input Monitoring: Cannot check programmatically. Enable in System Settings > Privacy & Security > Input Monitoring');
      }
    } else if (process.platform === 'win32') {
      logger.info('Windows permission notes:');
      logger.info('- Microphone: Check Windows Settings > Privacy & security > Microphone');
      logger.info('- Text insertion: May require running as administrator for some applications');
      logger.info('- Global keyboard hooks: May require specific permissions for uiohook-napi');
    } else {
      logger.info(`Platform ${process.platform}: Permissions may vary. Check system settings for microphone and input permissions.`);
    }
  }
}

/**
 * Singleton instance of the permissions service.
 */
export const permissionsService = new PermissionsService();
