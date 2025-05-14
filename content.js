function findFormElements() {
  const formElements = [];
  const inputs = document.querySelectorAll('input, textarea, select');
  inputs.forEach(element => {
    // 检查元素是否可见
    const style = window.getComputedStyle(element);
    if (element.offsetParent === null || style.display === 'none' || style.visibility === 'hidden' || 
       (element.type === 'submit' || element.type === 'button' || element.type === 'reset')) {
      return;
    }
    const label = element.labels ? Array.from(element.labels).map(label => label.textContent).join(', ') : '';
    const elementInfo = {
      id: element.id,
      name: element.name || element.getAttribute('data-name') || element.getAttribute('aria-label') || '',
      type: element.type,
      value: element.value,
      tagName: element.tagName,
      label: label
    };
    
    // 添加对select元素的特殊处理
    if (element.tagName === 'SELECT') {
      elementInfo.options = Array.from(element.options).map(option => ({
        text: option.text,
        value: option.value
      }));
    }
    
    if (element.type === 'radio' || element.type === 'checkbox') {
      const name = element.name;
      const group = document.querySelectorAll(`input[name='${name}']`);
      if (!formElements.some(e => e.name === name)) {
        elementInfo.options = Array.from(group).map(option => option.value);
        formElements.push(elementInfo);
      }
    } else {
      formElements.push(elementInfo);
    }
  });
  return formElements;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getFormElements') {
    sendResponse(findFormElements());
  }
  if (request.action === 'fillForm') {
    const inputs = document.querySelectorAll('input, textarea, select');
    const data = request.data;
    let filledCount = 0;
    inputs.forEach(input => {
      if (input.name || input.id) {
        try {
          const fieldName = input.name || input.id;
          const labelText = input.labels ? Array.from(input.labels).map(label => label.textContent.trim()).join(', ') : '';
          const fieldValue = data[fieldName] || (labelText ? data[labelText] : undefined);
          if (fieldValue === undefined) {
            throw new Error(`未找到匹配的字段值: ${fieldName} 或 ${labelText}。请确保输入数据包含此字段，格式为"字段名: 值"或"标签文本: 值"`);
          }
          
          if (input.type === 'checkbox' || input.type === 'radio') {
            if (input.checked !== (fieldValue === input.value || fieldValue === 'true')) {
              input.checked = fieldValue === input.value || fieldValue === 'true';
              filledCount++;
            }
          } else {
            if (input.value !== fieldValue) {
              input.value = fieldValue;
              filledCount++;
            }
          }
        } catch (error) {
          // 静默处理错误
        }
      }
    });
    sendResponse({success: filledCount > 0});
  }
});