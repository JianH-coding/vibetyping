import 'dotenv/config';
import { app, BrowserWindow, Tray, Menu, nativeImage } from 'electron';
import fs from 'fs';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { setupAllIpcHandlers } from './main/ipc';
import { floatingWindow } from './main/windows';
import { pushToTalkService } from './main/services';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Setup IPC handlers before app is ready
setupAllIpcHandlers();

// Global references for window and tray management
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

/**
 * Setup system tray with icon and context menu
 */
function setupTray(): void {
  // Don't create multiple tray icons
  if (tray) {
    return;
  }

  try {

  // Load tray icon from assets/tray-icon-*.png
  const iconSize = process.platform === 'win32' ? 16 : 32;
  const iconBaseName = `tray-icon-${iconSize}.png`;
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'assets', iconBaseName)
    : path.resolve(__dirname, '..', 'assets', iconBaseName);

  console.error('Loading tray icon from:', iconPath);
  console.error('File exists:', fs.existsSync(iconPath) ? 'Yes' : 'No');

  let trayIcon = nativeImage.createEmpty();

  if (fs.existsSync(iconPath)) {
    try {
      // Method 1: Try createFromPath
      trayIcon = nativeImage.createFromPath(iconPath);
      console.error('Method 1 (createFromPath): isEmpty:', trayIcon.isEmpty(), 'size:', trayIcon.getSize());

      // If method 1 fails, try method 2: read file and create from buffer
      if (trayIcon.isEmpty()) {
        console.error('Method 1 failed, trying method 2 (createFromBuffer)');
        const buffer = fs.readFileSync(iconPath);
        trayIcon = nativeImage.createFromBuffer(buffer);
        console.error('Method 2: isEmpty:', trayIcon.isEmpty(), 'size:', trayIcon.getSize());
      }

      // Resize tray icon to appropriate size if it loaded successfully
      if (!trayIcon.isEmpty()) {
        const currentSize = trayIcon.getSize();
        console.error(`Original icon size: ${currentSize.width}x${currentSize.height}`);
        // If the icon is not the right size, resize it
        if (currentSize.width !== iconSize || currentSize.height !== iconSize) {
          console.error(`Resizing tray icon to ${iconSize}x${iconSize}`);
          trayIcon = trayIcon.resize({ width: iconSize, height: iconSize, quality: 'best' });
        }
      }
    } catch (error) {
      console.error('Error loading tray icon:', error);
      trayIcon = nativeImage.createEmpty();
    }
  } else {
    console.error('Tray icon file does not exist:', iconPath);
    // Fallback: try to use tray-icon-32.png and resize if needed
    const fallbackIconName = 'tray-icon-32.png';
    const fallbackPath = app.isPackaged
      ? path.join(process.resourcesPath, 'assets', fallbackIconName)
      : path.resolve(__dirname, '..', 'assets', fallbackIconName);

    if (fs.existsSync(fallbackPath)) {
      console.error('Trying fallback icon:', fallbackPath);
      try {
        trayIcon = nativeImage.createFromPath(fallbackPath);
        if (!trayIcon.isEmpty() && iconSize !== 32) {
          console.error(`Resizing fallback icon from 32x32 to ${iconSize}x${iconSize}`);
          trayIcon = trayIcon.resize({ width: iconSize, height: iconSize, quality: 'best' });
        }
      } catch (error) {
        console.error('Error loading fallback icon:', error);
      }
    }
  }

  // If image fails to load, fall back to a simple programmatic icon
  if (trayIcon.isEmpty()) {
    console.error('Failed to load tray icon from', iconPath, 'using fallback icon');
    const iconSize = process.platform === 'win32' ? 16 : 32;
    const size = iconSize;
    const buffer = Buffer.alloc(size * size * 4); // RGBA

    // Create a simple microphone icon: blue circle with white outline
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const offset = (y * size + x) * 4;
        const centerX = size / 2;
        const centerY = size / 2;
        const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);

        // Create a blue circle with white outline
        if (distance < size / 2 - 1) {
          // Blue fill
          buffer[offset] = 0;     // R
          buffer[offset + 1] = 122; // G
          buffer[offset + 2] = 255; // B
          buffer[offset + 3] = 255; // A (fully opaque)
        } else if (distance < size / 2) {
          // White outline
          buffer[offset] = 255;     // R
          buffer[offset + 1] = 255; // G
          buffer[offset + 2] = 255; // B
          buffer[offset + 3] = 255; // A (fully opaque)
        } else {
          // Transparent background
          buffer[offset] = 0;
          buffer[offset + 1] = 0;
          buffer[offset + 2] = 0;
          buffer[offset + 3] = 0;
        }
      }
    }

    trayIcon = nativeImage.createFromBuffer(buffer, {
      width: size,
      height: size
    });
  }

  tray = new Tray(trayIcon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Window',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: 'Quit',
      click: () => {
        console.log('Quit menu item clicked. Setting isQuitting = true');
        // Set quitting flag to allow window to close
        isQuitting = true;
        // Clean up resources before quitting
        cleanup();
        console.log('Calling app.quit()');
        app.quit();
      }
    }
  ]);

  tray.setToolTip('Voice Typing Assistant');
  tray.setContextMenu(contextMenu);

  // On Windows, click on tray icon should show/hide window
  // On macOS, click on tray icon shows the context menu
  if (process.platform === 'win32') {
    tray.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    });
  }

  console.log('✅ System tray icon created');
} catch (error) {
  console.error('Failed to create system tray icon:', error);
}
}

const createWindow = async () => {
  console.error('=== createWindow called ===');
  // Create the browser window.
  const mainIconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'assets', 'tray-icon-32.png')
    : path.join(__dirname, '..', 'assets', 'tray-icon-32.png');
  console.error('Main window icon path:', mainIconPath);
  console.error('Main window icon exists:', fs.existsSync(mainIconPath) ? 'Yes' : 'No');

  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false, // Don't show until ready
    icon: mainIconPath,
    title: 'Open Typeless - Settings',
    // Hide menu bar (toolbar below title bar) completely
    autoHideMenuBar: true,
  });

  // Remove default menu completely
  mainWindow.setMenu(null);

  // Setup system tray icon
  setupTray();

  // Handle window close event - hide to tray instead of closing
  mainWindow.on('close', (event) => {
    console.log(`Window close event triggered. isQuitting: ${isQuitting}`);

    // If window is already destroyed or doesn't exist, allow close
    if (!mainWindow || mainWindow.isDestroyed()) {
      console.log('Window already destroyed, allowing close');
      return;
    }

    if (!isQuitting) {
      console.log('Preventing window close and hiding to tray');
      event.preventDefault();
      try {
        mainWindow.hide();
        console.log('Window hidden to tray');
      } catch (error) {
        console.error('Failed to hide window:', error);
      }
    } else {
      console.log('isQuitting is true, allowing window to close');
    }
    // If isQuitting is true, the window will be closed normally
  });

  // Handle window minimize event - optionally hide to tray
  // Note: 'minimize' event may not be available in Electron types
  // mainWindow?.on('minimize', (event: Event) => {
  //   // Optional: hide to tray on minimize
  //   // event.preventDefault();
  //   // mainWindow?.hide();
  // });

  // Create the floating window (hidden initially)
  floatingWindow.create();

  // Wait for both windows to load
  const mainWindowLoaded = new Promise<void>((resolve) => {
    mainWindow!.webContents.on('did-finish-load', () => {
      console.log('Main window loaded');
      resolve();
    });
  });

  const floatingWindowLoaded = new Promise<void>((resolve) => {
    const floatingWin = floatingWindow.getWindow();
    if (floatingWin) {
      floatingWin.webContents.on('did-finish-load', () => {
        console.log('Floating window loaded');
        resolve();
      });
    } else {
      // If floating window doesn't exist yet, resolve immediately
      resolve();
    }
  });

  // Load the main window
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Wait for both windows to load
  await Promise.all([mainWindowLoaded, floatingWindowLoaded]);

  // Show main window now that it's loaded
  mainWindow.show();

  // Enable DevTools for debugging (disabled as requested)
  // if (process.env.NODE_ENV === 'development') {
  //   mainWindow.webContents.openDevTools();
  // }

  // Give renderer processes extra time to fully initialize
  // This helps prevent race conditions where IPC listeners aren't set up yet
  const EXTRA_INIT_DELAY = process.env.NODE_ENV === 'development' ? 300 : 500;
  console.log(`Waiting ${EXTRA_INIT_DELAY}ms for renderer processes to fully initialize...`);
  await new Promise(resolve => setTimeout(resolve, EXTRA_INIT_DELAY));

  // Initialize push-to-talk service after windows are fully loaded and renderers are ready
  console.log('Initializing push-to-talk service...');
  try {
    pushToTalkService.initialize();
    console.log('✅ Push-to-talk service initialized successfully');
    console.log('✅ Application is ready to use!');
    console.log(`✅ Platform: ${process.platform}`);
    if (process.platform === 'win32') {
      console.log('✅ On Windows, hold Right Alt key to start speech recognition');
    } else if (process.platform === 'darwin') {
      console.log('✅ On macOS, hold Right Option key to start speech recognition');
    }
  } catch (error) {
    console.error('❌ Failed to initialize push-to-talk service:', error);
    console.error('❌ Application will run without push-to-talk functionality');
    console.error('❌ Check logs above for details and restart the application');
    // Don't quit the app - let it run without push-to-talk functionality
    // User can check logs and restart if needed
  }
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  createWindow().catch((error) => {
    console.error('Failed to create window:', error);
    app.quit();
  });
});

// Handle window close events - windows are hidden to tray instead of closed
// So this event may not fire, but we keep it for safety
app.on('window-all-closed', () => {
  console.log('All windows closed - keeping app running in system tray');
  // Don't quit - app stays running in system tray
  // On macOS, apps typically stay active when windows are closed
  // On Windows/Linux, we also keep the app running in tray
});

// Cleanup function for graceful shutdown
function cleanup(): void {
  isQuitting = true;

  // Clean up push-to-talk service
  pushToTalkService.dispose();

  // Destroy floating window
  floatingWindow.destroy();

  // Destroy main window if it exists
  if (mainWindow) {
    mainWindow.destroy();
    mainWindow = null;
  }

  // Remove tray icon if it exists
  if (tray) {
    tray.destroy();
    tray = null;
  }
}

// Clean up before quitting
app.on('before-quit', cleanup);

// Handle SIGINT (Ctrl+C) and SIGTERM for graceful shutdown
process.on('SIGINT', () => {
  cleanup();
  app.quit();
});

process.on('SIGTERM', () => {
  cleanup();
  app.quit();
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow().catch((error) => {
      console.error('Failed to create window on activate:', error);
    });
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
