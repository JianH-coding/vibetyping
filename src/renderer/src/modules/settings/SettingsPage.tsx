import React, { useState, useEffect } from 'react';
import './SettingsPage.css';
import type { EnvConfig as SharedEnvConfig } from '../../../../shared/types/settings';

// Environment configuration - all fields are required in the UI
type EnvConfig = Required<SharedEnvConfig>;

// Tab definition
type Tab = {
  id: string;
  label: string;
};

const tabs: Tab[] = [
  { id: 'api-settings', label: 'API设置' },
  { id: 'keyboard-settings', label: '键盘快捷键' },
  { id: 'llm-settings', label: 'LLM设置' },
  // More tabs can be added in the future
];

// Key options for push-to-talk trigger key
const keyOptions = [
  { value: '228', label: '右Ctrl键 (推荐)', description: '大多数程序中很少单独使用' },
  { value: '229', label: '右Shift键', description: '替代选择，通常用于组合键' },
  { value: '230', label: '右Alt键', description: '可能触发菜单快捷键（原默认）' },
  { value: '58', label: 'Caps Lock大写锁定', description: '需要小心避免误触切换' },
  { value: '70', label: 'Scroll Lock滚动锁定', description: '极少使用的功能键' },
  { value: '69', label: 'Pause/Break暂停键', description: '极少使用的功能键' },
  { value: '56', label: '左Alt键', description: '可能触发菜单快捷键' },
];

// LLM model options for volcano engine
const llmModelOptions = [
  { value: 'skylark2-pro-32k', label: 'Skylark2 Pro 32K', description: '通用大模型，32K上下文' },
  { value: 'skylark2-pro-128k', label: 'Skylark2 Pro 128K', description: '通用大模型，128K上下文' },
  { value: 'skylark2-lite-32k', label: 'Skylark2 Lite 32K', description: '轻量级模型，32K上下文' },
  { value: 'skylark-chat', label: 'Skylark Chat', description: '对话优化模型' },
  { value: 'ep-20250730192125-j4n46', label: '自定义模型', description: '自定义端点模型' },
];

export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('api-settings');
  const [config, setConfig] = useState<EnvConfig>({
    VOLCENGINE_APP_ID: '',
    VOLCENGINE_ACCESS_TOKEN: '',
    VOLCENGINE_RESOURCE_ID: '',
    PUSH_TO_TALK_KEY: '228', // Default Right Ctrl
    VOLCENGINE_LLM_ENABLED: 'false',
    VOLCENGINE_LLM_API_KEY: '',
    VOLCENGINE_LLM_MODEL: 'skylark2-pro-32k',
    VOLCENGINE_LLM_PROMPT: '请将以下口语化的文本优化为书面语，保持原意不变，修正语法错误，使表达更加流畅自然：',
    VOLCENGINE_LLM_BASE_URL: 'https://ark.cn-beijing.volces.com/api/v3',
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [defaultStatus, setDefaultStatus] = useState<'idle' | 'applying' | 'success' | 'error'>('idle');
  const [testLLMStatus, setTestLLMStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testLLMMessage, setTestLLMMessage] = useState<string>('');

  // Load current configuration on mount
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setIsLoading(true);
      const currentConfig = await window.api.settings.getEnvConfig() as EnvConfig;
      console.log('Loaded config:', {
        LLM_ENABLED: currentConfig.VOLCENGINE_LLM_ENABLED,
        LLM_API_KEY: currentConfig.VOLCENGINE_LLM_API_KEY ? '***' : 'empty',
      });
      setConfig(currentConfig);
    } catch (error) {
      console.error('Failed to load configuration:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (key: keyof EnvConfig, value: string) => {
    console.log('handleInputChange:', key, 'value:', value);
    setConfig(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSave = async () => {
    try {
      setSaveStatus('saving');
      await window.api.settings.updateEnvConfig(config);
      setSaveStatus('success');

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSaveStatus('idle');
      }, 3000);

      // Reload configuration to ensure consistency
      await loadConfig();
    } catch (error) {
      console.error('Failed to save configuration:', error);
      setSaveStatus('error');

      // Clear error message after 3 seconds
      setTimeout(() => {
        setSaveStatus('idle');
      }, 3000);
    }
  };

  const handleUseDefault = async () => {
    try {
      setDefaultStatus('applying');
      await window.api.settings.applyDefaultConfig();
      setDefaultStatus('success');

      // Clear success message after 3 seconds
      setTimeout(() => {
        setDefaultStatus('idle');
      }, 3000);

      // Reload configuration
      await loadConfig();
    } catch (error) {
      console.error('Failed to apply default configuration:', error);
      setDefaultStatus('error');

      // Clear error message after 3 seconds
      setTimeout(() => {
        setDefaultStatus('idle');
      }, 3000);
    }
  };

  const handleTestLLMConnection = async () => {
    if (config.VOLCENGINE_LLM_ENABLED !== 'true') {
      setTestLLMStatus('error');
      setTestLLMMessage('请先启用LLM优化功能');

      setTimeout(() => {
        setTestLLMStatus('idle');
        setTestLLMMessage('');
      }, 3000);
      return;
    }

    if (!config.VOLCENGINE_LLM_API_KEY) {
      setTestLLMStatus('error');
      setTestLLMMessage('请先填写LLM API密钥');

      setTimeout(() => {
        setTestLLMStatus('idle');
        setTestLLMMessage('');
      }, 3000);
      return;
    }

    try {
      setTestLLMStatus('testing');
      setTestLLMMessage('正在测试LLM连接...');

      const result = await window.api.llm.testConnection();

      if (result.success) {
        setTestLLMStatus('success');
        setTestLLMMessage(result.message);
      } else {
        setTestLLMStatus('error');
        setTestLLMMessage(result.message);
      }

      // Clear message after 5 seconds
      setTimeout(() => {
        setTestLLMStatus('idle');
        setTestLLMMessage('');
      }, 5000);
    } catch (error) {
      console.error('Failed to test LLM connection:', error);
      setTestLLMStatus('error');
      setTestLLMMessage('连接测试失败');

      setTimeout(() => {
        setTestLLMStatus('idle');
        setTestLLMMessage('');
      }, 3000);
    }
  };

  const renderApiSettings = () => (
    <div className="settings-form">
      <h2 className="form-title">火山引擎豆包语音识别配置</h2>
      <p className="form-description">
        请填写以下配置信息以启用语音识别功能。
        配置信息保存在项目的 .env 文件中。
      </p>

      <div className="form-group">
        <label htmlFor="app-id" className="form-label">
          APP ID
          <span className="form-hint">（从应用管理获取）</span>
        </label>
        <input
          id="app-id"
          type="text"
          className="form-input"
          value={config.VOLCENGINE_APP_ID}
          onChange={(e) => handleInputChange('VOLCENGINE_APP_ID', e.target.value)}
          placeholder="例如：4120356295"
        />
      </div>

      <div className="form-group">
        <label htmlFor="access-token" className="form-label">
          Access Token
          <span className="form-hint">（从流式语音识别大模型页面获取，点击眼睛图标查看）</span>
        </label>
        <input
          id="access-token"
          type="password"
          className="form-input"
          value={config.VOLCENGINE_ACCESS_TOKEN}
          onChange={(e) => handleInputChange('VOLCENGINE_ACCESS_TOKEN', e.target.value)}
          placeholder="请输入您的Access Token"
        />
      </div>

      <div className="form-group">
        <label htmlFor="resource-id" className="form-label">
          Resource ID
          <span className="form-hint">（volc.bigasr.sauc.duration = 大模型1.0 流式识别）</span>
        </label>
        <input
          id="resource-id"
          type="text"
          className="form-input"
          value={config.VOLCENGINE_RESOURCE_ID}
          onChange={(e) => handleInputChange('VOLCENGINE_RESOURCE_ID', e.target.value)}
          placeholder="例如：volc.bigasr.sauc.duration"
        />
      </div>
    </div>
  );

  const renderKeyboardSettings = () => (
    <div className="settings-form">
      <h2 className="form-title">键盘快捷键设置</h2>
      <p className="form-description">
        配置语音输入的触发键。按下触发键开始录音，松开停止录音。
        配置信息保存在项目的 .env 文件中。
      </p>

      <div className="form-group">
        <label htmlFor="push-to-talk-key" className="form-label">
          触发键
          <span className="form-hint">（按住此键开始语音输入）</span>
        </label>
        <select
          id="push-to-talk-key"
          className="form-input"
          value={config.PUSH_TO_TALK_KEY}
          onChange={(e) => handleInputChange('PUSH_TO_TALK_KEY', e.target.value)}
        >
          {keyOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label} - {option.description}
            </option>
          ))}
        </select>
        <div className="form-help">
          <p><strong>推荐使用右Ctrl键</strong>，因为它很少单独使用，且不会与系统快捷键冲突。</p>
          <p><strong>避免使用Alt键</strong>，因为Alt键会激活Windows菜单栏，导致光标丢失焦点。</p>
          <p>修改设置后需要重启应用才能生效。</p>
        </div>
      </div>

      <div className="form-group">
        <h3 className="form-subtitle">当前键位说明</h3>
        <div className="key-info">
          <p>当前选择的键位码: <code>{config.PUSH_TO_TALK_KEY}</code></p>
          <p>对应键位: {keyOptions.find(opt => opt.value === config.PUSH_TO_TALK_KEY)?.label || '未知键位'}</p>
          <p>描述: {keyOptions.find(opt => opt.value === config.PUSH_TO_TALK_KEY)?.description || '无描述'}</p>
        </div>
      </div>

      <div className="form-group">
        <h3 className="form-subtitle">注意事项</h3>
        <ul className="form-notes">
          <li>全局键盘钩子需要相应权限，Windows可能需要以管理员权限运行</li>
          <li>如果触发键无效，请检查是否有其他程序占用了该键位</li>
          <li>修改键位后，请确保新键位不会与常用快捷键冲突</li>
          <li>应用重启后新设置才会生效</li>
        </ul>
      </div>
    </div>
  );

  const renderLLMSettings = () => (
    <div className="settings-form">
      <h2 className="form-title">火山引擎豆包大语言模型配置</h2>
      <p className="form-description">
        启用LLM优化功能，将语音识别结果通过大语言模型优化为更流畅的书面语。
        配置信息保存在项目的 .env 文件中。
      </p>

      <div className="form-group">
        <div className="form-row">
          <span className="form-label">
            启用LLM优化
            <span className="form-hint">（启用后语音识别结果将通过LLM优化）</span>
          </span>
          <label htmlFor="llm-enabled" className="form-toggle">
            <input
              id="llm-enabled"
              type="checkbox"
              className="toggle-input"
              checked={config.VOLCENGINE_LLM_ENABLED === 'true'}
              onChange={(e) => {
                console.log('LLM toggle changed, checked:', e.target.checked);
                handleInputChange('VOLCENGINE_LLM_ENABLED', e.target.checked ? 'true' : 'false');
              }}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
        <div className="form-help">
          <p>启用后，语音识别结果将通过火山引擎大语言模型进行优化，使表达更加流畅自然。</p>
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="llm-api-key" className="form-label">
          LLM API密钥
          <span className="form-hint">（从火山引擎控制台获取）</span>
        </label>
        <input
          id="llm-api-key"
          type="password"
          className="form-input"
          value={config.VOLCENGINE_LLM_API_KEY}
          onChange={(e) => handleInputChange('VOLCENGINE_LLM_API_KEY', e.target.value)}
          placeholder="请输入您的LLM API密钥"
          disabled={config.VOLCENGINE_LLM_ENABLED !== 'true'}
        />
        <div className="form-help">
          <p>需要在火山引擎控制台创建应用并获取API密钥。</p>
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="llm-model" className="form-label">
          LLM模型
          <span className="form-hint">（选择要使用的模型）</span>
        </label>
        <select
          id="llm-model"
          className="form-input"
          value={config.VOLCENGINE_LLM_MODEL}
          onChange={(e) => handleInputChange('VOLCENGINE_LLM_MODEL', e.target.value)}
          disabled={config.VOLCENGINE_LLM_ENABLED !== 'true'}
        >
          {llmModelOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label} - {option.description}
            </option>
          ))}
        </select>
        <div className="form-help">
          <p>Skylark2 Pro 32K是推荐的通用模型，支持32K上下文长度。</p>
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="llm-prompt" className="form-label">
          LLM优化提示词
          <span className="form-hint">（指导LLM如何优化文本）</span>
        </label>
        <textarea
          id="llm-prompt"
          className="form-input form-textarea"
          value={config.VOLCENGINE_LLM_PROMPT}
          onChange={(e) => handleInputChange('VOLCENGINE_LLM_PROMPT', e.target.value)}
          placeholder="请输入优化提示词"
          rows={4}
          disabled={config.VOLCENGINE_LLM_ENABLED !== 'true'}
        />
        <div className="form-help">
          <p>提示词将指导LLM如何优化文本。例如："请将以下口语化的文本优化为书面语，保持原意不变，修正语法错误，使表达更加流畅自然："</p>
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="llm-base-url" className="form-label">
          LLM API基础URL
          <span className="form-hint">（火山引擎API地址）</span>
        </label>
        <input
          id="llm-base-url"
          type="text"
          className="form-input"
          value={config.VOLCENGINE_LLM_BASE_URL}
          onChange={(e) => handleInputChange('VOLCENGINE_LLM_BASE_URL', e.target.value)}
          placeholder="例如：https://ark.cn-beijing.volces.com/api/v3"
          disabled={config.VOLCENGINE_LLM_ENABLED !== 'true'}
        />
        <div className="form-help">
          <p>默认使用火山引擎官方API地址，通常不需要修改。</p>
        </div>
      </div>

      <div className="form-group">
        <div className="button-group">
          <button
            className="btn btn-secondary"
            onClick={handleTestLLMConnection}
            disabled={testLLMStatus === 'testing' || config.VOLCENGINE_LLM_ENABLED !== 'true'}
          >
            {testLLMStatus === 'testing' ? '测试中...' : '测试LLM连接'}
          </button>
        </div>
        {testLLMMessage && (
          <div className={`status-message ${testLLMStatus === 'success' ? 'success' : 'error'}`}>
            {testLLMMessage}
          </div>
        )}
      </div>

      <div className="form-group">
        <h3 className="form-subtitle">使用说明</h3>
        <div className="form-help">
          <p><strong>工作流程：</strong>语音识别 → LLM优化 → 文本插入</p>
          <p><strong>优化效果：</strong>将口语化文本转换为流畅的书面语，修正语法错误，保持原意不变。</p>
          <p><strong>响应时间：</strong>LLM优化会增加约1-3秒的处理时间。</p>
          <p><strong>隐私说明：</strong>文本内容会发送到火山引擎服务器进行优化处理。</p>
          <p><strong>费用说明：</strong>使用火山引擎LLM服务会产生相应费用，请关注火山引擎控制台的用量统计。</p>
          <p><strong>测试连接：</strong>配置完成后，点击"测试LLM连接"按钮验证配置是否正确。</p>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'api-settings':
        return renderApiSettings();
      case 'keyboard-settings':
        return renderKeyboardSettings();
      case 'llm-settings':
        return renderLLMSettings();
      default:
        return <div>未知标签</div>;
    }
  };

  if (isLoading) {
    return (
      <div className="settings-container">
        <div className="loading">加载配置中...</div>
      </div>
    );
  }

  return (
    <div className="settings-container">
      <div className="settings-layout">
        {/* Left sidebar - Tabs */}
        <div className="settings-sidebar">
          <div className="sidebar-header">
            <h2 className="sidebar-title">设置</h2>
          </div>
          <nav className="tabs">
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Right content area */}
        <div className="settings-content">
          <header className="content-header">
            <h1 className="content-title">
              {tabs.find(tab => tab.id === activeTab)?.label || '设置'}
            </h1>
          </header>

          <div className="content-body">
            {renderContent()}
          </div>

          {/* Footer with action buttons */}
          <footer className="content-footer">
            <div className="button-group">
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saveStatus === 'saving'}
              >
                {saveStatus === 'saving' ? '保存中...' : '保存设置'}
              </button>

              <button
                className="btn btn-secondary"
                onClick={handleUseDefault}
                disabled={defaultStatus === 'applying'}
              >
                {defaultStatus === 'applying' ? '应用默认中...' : '使用默认'}
              </button>
            </div>

            {/* Status messages */}
            <div className="status-messages">
              {saveStatus === 'success' && (
                <div className="status-message success">设置保存成功！</div>
              )}
              {saveStatus === 'error' && (
                <div className="status-message error">保存失败，请重试。</div>
              )}
              {defaultStatus === 'success' && (
                <div className="status-message success">默认设置应用成功！</div>
              )}
              {defaultStatus === 'error' && (
                <div className="status-message error">应用默认设置失败。</div>
              )}
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
};