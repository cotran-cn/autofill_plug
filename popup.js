document.addEventListener('DOMContentLoaded', function() {
  async function getFormElements() {
    return await new Promise(resolve => {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {action: 'getFormElements'}, resolve);
      });
    });
  }

  // 修改文件顶部的配置存储变量
  let apiConfig = {
    baseUrl: 'https://api.openai-proxy.com/',
    apiKey: ''
  };
  
  // 从chrome.storage加载保存的配置
  chrome.storage.sync.get(['apiConfig'], function(result) {
    if (result.apiConfig) {
      apiConfig = result.apiConfig;
    }
  });
  
  // 修改callAI函数使用配置
  async function callAI(prompt) {
    try {
      const response = await fetch(`${apiConfig.baseUrl}v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiConfig.apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{role: 'user', content: prompt}],
          temperature: 0.7
        })
      });
      return await response.json();
    } catch (error) {
      console.error('AI解析失败:', error);
      throw error;
    }
  }
  
  // 修改设置按钮点击事件
  document.getElementById('settingsButton').addEventListener('click', function() {
    const panel = document.getElementById('settingsPanel');
    panel.classList.toggle('show'); // 确保这行代码被执行
    document.getElementById('apiBaseUrl').value = apiConfig.baseUrl;
    document.getElementById('apiKey').value = apiConfig.apiKey;
  });
  
  // 修改保存按钮点击事件
  document.getElementById('saveSettings').addEventListener('click', function() {
    let baseUrlInput = document.getElementById('apiBaseUrl').value.trim();
    if (baseUrlInput === '') {
      baseUrlInput = 'https://api.openai-proxy.com/';
    }

    apiConfig = {
      baseUrl: baseUrlInput,
      apiKey: document.getElementById('apiKey').value
    };
    
    chrome.storage.sync.set({ apiConfig: apiConfig }, function() {
      alert('设置已保存');
      document.getElementById('settingsPanel').classList.remove('show');
    });
  });

  document.getElementById('aiButton').addEventListener('click', async function() {
    try {
      const aiInput = document.getElementById('aiInput').value;
      const formElements = await getFormElements();
      
      const prompt = `##角色\n表单分析助手\n##任务\n将用户输入的信息填充到对应表单\n##输出格式示例\nadmin:administrator\n##注意事项\n1、优先输出element_name,若element_name值为无则输出ID值:内容\n2、直接输出结果，无需任何样式、无需任何多余字符\n##表单信息如下\n${JSON.stringify(formElements)}\n##用户输入如下\n${aiInput}`;
      
      const data = await callAI(prompt);
      const result = data.choices[0].message.content;
      document.getElementById('inputData').value = result;
    } catch (error) {
      alert('AI解析失败，请重试');
    }
  });

  document.getElementById('fillButton').addEventListener('click', async function() {
    const inputData = document.getElementById('inputData').value;
    try {
      const parsedData = {};
      const lines = inputData.split('\n');
      lines.forEach(line => {
        // 支持多种分隔符格式：冒号、等号、箭头等
        const separatorIndex = Math.max(
          line.indexOf(':'),
          line.indexOf('='),
          line.indexOf('->')
        );
        if (separatorIndex > 0) {
          const key = line.substring(0, separatorIndex).trim();
          const value = line.substring(separatorIndex + (line[separatorIndex] === '=' ? 1 : 
                         line[separatorIndex] === '-' ? 2 : 1)).trim();
          if (key && value) {
            parsedData[key] = value;
          }
        }
      });
      const data = parsedData;
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs && tabs.length > 0) {
          chrome.tabs.sendMessage(tabs[0].id, {action: 'fillForm', data: parsedData}, function(response) {
            if (chrome.runtime.lastError) {
              console.error(chrome.runtime.lastError);
              chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                if (request.action === 'fillFormError') {
                  alert(`填充失败：字段 ${request.field} 出错，原因：${request.error}`);
                }
              });
              alert('填充失败，请刷新页面后重试。');
            } else if (response && response.success) {
              alert('填充成功！');
            } else {
              alert('填充完成，但可能有部分字段未匹配成功');
            }
          });
        }
      });
    } catch (error) {
      // 静默处理错误，不显示console.error
      return null;
    }
  });
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs && tabs.length > 0) {
      chrome.tabs.sendMessage(tabs[0].id, {action: 'getFormElements'}, function(response) {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError);
          const formInfo = document.getElementById('formInfo');
          formInfo.innerHTML = '<p>无法连接到内容脚本，请刷新页面后重试。</p>';
          return;
        }
        const formInfo = document.getElementById('formInfo');
        if (response && Array.isArray(response) && response.length > 0) {
          formInfo.innerHTML = '<h3>检测到的表单元素：</h3>' + response.map(element => 
            `<div>ID: ${element.id || '无'}, element_name: ${element.name || '无'}, 类型: ${element.type}, 标签名: ${element.tagName}, 标签: ${element.label || '无'}</div>`
          ).join('');
        } else if (!response || !Array.isArray(response)) {
          formInfo.innerHTML = '<p>获取表单元素数据格式错误。</p>';
        } else {
          formInfo.innerHTML = '<p>未检测到表单元素。</p>';
        }
      });
    } else {
      const formInfo = document.getElementById('formInfo');
      formInfo.innerHTML = '<p>无法获取当前标签页，请刷新页面后重试。</p>';
    }
  });
});