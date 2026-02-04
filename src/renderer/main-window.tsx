/**
 * Main window renderer process.
 * Renders the settings page for the application and handles audio recording.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { SettingsPage } from './src/modules/settings/SettingsPage';
import { AudioRecorder } from './src/modules/asr';
import '../index.css';

console.log(
  '👋 Main window renderer loaded',
);

// ============================================================================
// Audio Recording Logic (from src/renderer.ts)
// ============================================================================

// Debug: check if window.api is available
console.log('[Renderer] Checking if window.api is available...');
if (window.api) {
  console.log('[Renderer] window.api is available:', {
    hasAsr: !!window.api.asr,
    hasAsrSendAudio: typeof window.api.asr?.sendAudio === 'function',
    hasAsrOnStatus: typeof window.api.asr?.onStatus === 'function'
  });
} else {
  console.error('[Renderer] ERROR: window.api is not available!');
}

// Debug: check AudioRecorder import
console.log('[Renderer] AudioRecorder imported?', typeof AudioRecorder);

// Audio recorder instance
let recorder: AudioRecorder | null = null;

/**
 * Initialize audio recorder with callback to send chunks to main process.
 */
function initRecorder(): AudioRecorder {
  return new AudioRecorder(
    (chunk) => {
      // Send audio chunk to main process via IPC
      console.log('[Renderer] Sending audio chunk to main process:', chunk.byteLength, 'bytes');
      window.api.asr.sendAudio(chunk);
    },
    (state) => {
      console.log('[Renderer] AudioRecorder state:', state);
    }
  );
}

/**
 * Start recording audio.
 */
async function startRecording(): Promise<void> {
  if (!recorder) {
    recorder = initRecorder();
  }

  try {
    console.log('[Renderer] Starting audio recording...');
    await recorder.start();
    console.log('[Renderer] Audio recording started');
  } catch (error) {
    console.error('[Renderer] Failed to start recording:', error);
  }
}

/**
 * Stop recording audio.
 */
function stopRecording(): void {
  if (recorder) {
    console.log('[Renderer] Stopping audio recording...');
    recorder.stop();
    console.log('[Renderer] Audio recording stopped');
  }
}

// Track current status to avoid duplicate operations
let currentStatus = 'idle';

// Listen for ASR status changes from main process
if (window.api && window.api.asr && typeof window.api.asr.onStatus === 'function') {
  window.api.asr.onStatus((status) => {
    console.log('[Renderer] ASR status changed:', status, 'previous status:', currentStatus);

    // Avoid duplicate handling
    if (status === currentStatus) {
      console.log('[Renderer] Status unchanged, skipping');
      return;
    }
    currentStatus = status;

    if (status === 'listening') {
      // Start recording when ASR is listening
      console.log('[Renderer] Starting recording due to listening status');
      startRecording();
    } else {
      // Stop recording for any other status
      console.log('[Renderer] Stopping recording due to status:', status);
      stopRecording();
    }
  });
} else {
  console.error('[Renderer] ERROR: Cannot set up ASR status listener - window.api.asr.onStatus not available');
}

// Cleanup on window unload
window.addEventListener('beforeunload', () => {
  if (recorder) {
    recorder.destroy();
    recorder = null;
  }
});

// ============================================================================
// Debug Functions (available in console via testAudioRecording())
// ============================================================================

/**
 * Test audio recording manually from the console.
 * Usage: testAudioRecording() in DevTools console
 */
async function testAudioRecording() {
  console.log('=== 手动测试音频录制 ===');

  try {
    // 检查环境
    if (!window.api) {
      console.error('❌ window.api 不存在');
      return;
    }

    if (!window.api.asr) {
      console.error('❌ window.api.asr 不存在');
      return;
    }

    if (typeof AudioRecorder === 'undefined') {
      console.error('❌ AudioRecorder 未定义');
      return;
    }

    console.log('✅ 环境检查通过');

    // 创建录音器
    const recorder = new AudioRecorder(
      (chunk) => {
        console.log('🎤 收到音频数据:', {
          大小: chunk.byteLength + '字节',
          时间: new Date().toLocaleTimeString()
        });

        // 发送到主进程（模拟正常流程）
        window.api.asr.sendAudio(chunk);
      },
      (state) => {
        console.log('📊 录音器状态:', state);
        if (state.error) {
          console.error('❌ 错误:', state.error);
        }
      }
    );

    // 开始录音
    console.log('⏺️  开始录音（5秒）...');
    await recorder.start();
    console.log('✅ 录音已开始，请对着麦克风说话...');

    // 等待5秒
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 停止录音
    console.log('⏹️  停止录音...');
    recorder.stop();
    console.log('✅ 录音已停止');

    // 清理
    recorder.destroy();
    console.log('🧹 录音器已清理');
    console.log('=== 测试完成 ===');

  } catch (error) {
    console.error('❌ 测试失败:', error);
    console.error('错误详情:', {
      名称: (error as any).name,
      消息: (error as any).message,
      堆栈: (error as any).stack
    });
  }
}

// 暴露给控制台
(window as any).testAudioRecording = testAudioRecording;
console.log('[Renderer] 调试函数已加载: testAudioRecording()');
console.log('[Renderer] Auto-recording initialized, waiting for ASR status...');

// ============================================================================
// React App Rendering
// ============================================================================

// Get the root element
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found. Make sure there is a div with id="root" in the HTML.');
}

// Create root and render
const root = createRoot(rootElement);
root.render(React.createElement(SettingsPage));