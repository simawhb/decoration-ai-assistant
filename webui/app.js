// app.js - 装修公司五Agent系统主逻辑 v1.3
// 功能：对话、案例推荐、案例库、手绘草图、流水线、项目管理

// ========== 客户信息管理 ==========
var customerInfo = {};

function updateCustomerInfo(newInfo) {
  // 合并新信息
  for (var key in newInfo) {
    if (newInfo[key]) customerInfo[key] = newInfo[key];
  }
  localStorage.setItem('decoration-customer', JSON.stringify(customerInfo));
  renderCustomerInfo();
}

function renderCustomerInfo() {
  var el = document.getElementById('customer-info-panel');
  if (!el) return;
  var keys = Object.keys(customerInfo);
  if (keys.length === 0) {
    el.innerHTML = '<div style="color:var(--text-light);font-size:13px;padding:8px;">对话中自动提取客户信息...</div>';
    return;
  }
  var labels = { layout:'户型', area:'面积', budget:'预算', style:'风格', city:'城市' };
  var units = { area:'㎡', budget:'元' };
  var html = '';
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    var label = labels[k] || k;
    var val = customerInfo[k];
    if (k === 'budget') val = (val / 10000).toFixed(1) + '万';
    else if (k === 'area') val = val + '㎡';
    html += '<span style="display:inline-block;background:var(--accent);color:#fff;padding:3px 10px;border-radius:12px;font-size:12px;margin:2px;">' + label + '：' + val + '</span>';
  }
  el.innerHTML = html;
}

function clearCustomerInfo() {
  customerInfo = {};
  localStorage.removeItem('decoration-customer');
  renderCustomerInfo();
}

// ========== 页面切换 ==========
function showPage(pageId) {
  var pages = document.querySelectorAll('.page');
  for (var i = 0; i < pages.length; i++) { pages[i].classList.remove('active'); }
  var target = document.getElementById('page-' + pageId);
  if (target) target.classList.add('active');
  var btns = document.querySelectorAll('.nav-btn');
  for (var i = 0; i < btns.length; i++) { btns[i].classList.remove('active'); }
  // 高亮当前导航按钮
  for (var i = 0; i < btns.length; i++) {
    if (btns[i].getAttribute('onclick') && btns[i].getAttribute('onclick').indexOf("'" + pageId + "'") >= 0) {
      btns[i].classList.add('active');
      break;
    }
  }
  // 切换到首页时刷新统计
  if (pageId === 'home') renderHome();
}

// ========== XSS 安全转义 ==========
function escapeHtml(text) {
  var d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}

// ========== 首页统计 ==========
function renderHome() {
  // 更新首页公司名称
  var nameEl = document.getElementById('home-company-name');
  if (nameEl && config.company.name) nameEl.textContent = config.company.name;
}

// ========== 输入内容判断 ==========
function isEmptyInput(text) {
  var greetings = /^(你好|hi|hello|嗨|哈喽|您好|hey|喂|在吗|在不在|test|测试)$/i;
  if (greetings.test(text.trim())) return true;
  if (text.trim().length < 3) return true;
  return false;
}

// 意图匹配：判断某个Agent是否应该回答
function shouldAgentRespond(agentKey, userText) {
  var t = userText.toLowerCase();
  // 关键词 → Agent 映射
  var intentMap = {
    scout:  ['竞品','市场','楼盘','促销','同行','对手','行情','获客','线索','邻居'],
    digit:  ['报价','预算','价格','多少钱','费用','造价','材料','面积','瓷砖','地板','涂料','估算'],
    nova:   ['设计','风格','效果','方案','现代简约','北欧','新中式','轻奢','日式','工业风','美式','好看','布局','收纳','颜色','色彩','搭配'],
    lex:    ['合同','报价单','合规','审核','增项','保修','付款','违约','陷阱','坑','模糊','条款','法律','消保','权益','风险'],
    memo:   ['工期','多久','延期','延期','进度','节点','开工','竣工','验收','水电','泥木','油漆','售后','回访','项目经理','沟通','安排','计划']
  };
  var keywords = intentMap[agentKey];
  if (!keywords) return true;
  for (var i = 0; i < keywords.length; i++) {
    if (t.indexOf(keywords[i]) >= 0) return true;
  }
  return false;
}

// ========== AI 设置页面 ==========
function loadAPIConfig() {
  fetch('/api/config')
    .then(function(r) { return r.json(); })
    .then(function(cfg) {
      document.getElementById('api-base').value = cfg.api_base || '';
      document.getElementById('api-key').value = cfg.api_key || '';
      document.getElementById('api-model').value = cfg.model || '';
      // 更新混合模式状态
      updateHybridStatus();
    })
    .catch(function() {
      document.getElementById('cloud-status-text').textContent = '未连接后端';
      document.getElementById('ollama-status-text').textContent = '未连接后端';
    });
}

async function saveAPIConfig() {
  var cfg = {
    api_base: document.getElementById('api-base').value.trim(),
    api_key: document.getElementById('api-key').value.trim(),
    model: document.getElementById('api-model').value.trim(),
  };
  if (!cfg.api_base || !cfg.model) {
    alert('请填写 API 地址和模型名称');
    return;
  }
  try {
    var resp = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cfg)
    });
    await resp.json();
    // 保存后自动测试
    await testAPIConnection();
  } catch (e) {
    alert('保存失败，请确保后端服务已启动（双击「启动服务.bat」）。');
  }
}

async function testAPIConnection() {
  var cloudDot = document.getElementById('cloud-status-dot');
  var cloudText = document.getElementById('cloud-status-text');

  if (cloudDot) cloudDot.style.background = '#d48a30';
  if (cloudText) cloudText.textContent = '测试中...';

  try {
    var resp = await fetch('/api/test', { method: 'POST' });
    var data = await resp.json();
    if (data.ok) {
      if (cloudDot) cloudDot.style.background = '#52c41a';
      if (cloudText) cloudText.textContent = '已连接 — ' + (data.reply || '正常');
      apiMode = true;
    } else {
      if (cloudDot) cloudDot.style.background = '#d45050';
      if (cloudText) cloudText.textContent = '连接失败：' + (data.error || '未知错误');
    }
  } catch (e) {
    if (cloudDot) cloudDot.style.background = '#d45050';
    if (cloudText) cloudText.textContent = '未连接后端服务';
  }
  // 同时更新 Ollama 状态
  try {
    var stResp = await fetch('/api/status');
    if (stResp.ok) {
      window._backendStatus = await stResp.json();
      updateHybridStatus();
    }
  } catch (e) {}
}

function presetAPI(provider) {
  var presets = {
    groq:        { base: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile', key: '' },
    siliconflow: { base: 'https://api.siliconflow.cn/v1', model: 'Qwen/Qwen2.5-7B-Instruct', key: '' },
    mimo:        { base: 'https://token-plan-cn.xiaomimimo.com/v1', model: 'mimo-v2.5-pro', key: '' },
    ollama:      { base: 'http://localhost:11434/v1', model: 'qwen2.5:latest', key: '' },
    openai:      { base: 'https://api.openai.com/v1', model: 'gpt-4o-mini', key: '' },
  };
  var p = presets[provider];
  if (!p) return;
  document.getElementById('api-base').value = p.base;
  document.getElementById('api-model').value = p.model;
  if (p.key !== undefined) document.getElementById('api-key').value = p.key;
}

// ========== 清空对话 ==========
function clearChat() {
  var msgs = document.getElementById('chat-messages');
  msgs.innerHTML = '<div style="text-align:center;color:#bbb;padding:40px 20px;font-size:14px;">'
    + '👋 欢迎使用五Agent对话系统<br><br>'
    + '请在下方输入客户需求或想法，<br>'
    + '五个Agent将分别从专业角度给出响应。<br>'
    + '<span style="color:#eb2f96;">娜娜(Nova)会额外推荐案例 + 生成手绘草图。</span>'
    + '</div>';
}

// ========== 快捷输入 ==========
function quickInput(btn) {
  var text = btn.textContent || btn.innerText;
  document.getElementById('chat-input').value = text;
  sendChat();
}

// ========== 后端 API 调用 ==========
var apiMode = false; // 是否连接后端

// 构建对话历史（最近10轮，OpenAI格式）
function buildChatHistory() {
  var history = [];
  var recent = chatHistory.slice(-20); // 最近20条
  for (var i = 0; i < recent.length; i++) {
    var item = recent[i];
    if (item.role === 'user') {
      history.push({ role: 'user', content: item.text });
    } else if (item.role === 'agent') {
      history.push({ role: 'assistant', content: item.response });
    }
  }
  return history;
}

async function callBackendAPI(text) {
  try {
    var resp = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, history: buildChatHistory() })
    });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    var data = await resp.json();
    // 处理客户信息
    if (data.customer_info && Object.keys(data.customer_info).length > 0) {
      updateCustomerInfo(data.customer_info);
    }
    return data.responses || [];
  } catch (e) {
    return null;
  }
}

function updateHybridStatus() {
  var st = window._backendStatus || {};
  // 云端状态
  var cloudDot = document.getElementById('cloud-status-dot');
  var cloudText = document.getElementById('cloud-status-text');
  if (cloudDot && cloudText) {
    if (st.cloud_configured) {
      cloudDot.style.background = '#52c41a';
      cloudText.textContent = '已配置 · ' + (st.cloud_model || '');
    } else {
      cloudDot.style.background = '#d48a30';
      cloudText.textContent = '未配置（下方注册）';
    }
  }
  // 本地 Ollama 状态
  var ollamaDot = document.getElementById('ollama-status-dot');
  var ollamaText = document.getElementById('ollama-status-text');
  if (ollamaDot && ollamaText) {
    if (st.ollama_running) {
      ollamaDot.style.background = '#52c41a';
      ollamaText.textContent = '运行中 · ' + (st.ollama_model || '');
    } else if (st.portable_ollama) {
      ollamaDot.style.background = '#d48a30';
      ollamaText.textContent = '已安装，未启动';
    } else {
      ollamaDot.style.background = '#d9d9d9';
      ollamaText.textContent = '未安装';
    }
  }
}

async function testBackendConnection() {
  try {
    var resp = await fetch('/api/status');
    if (resp.ok) {
      var status = await resp.json();
      apiMode = true;
      window._backendStatus = status;
      return true;
    }
  } catch (e) {}
  apiMode = false;
  return false;
}

// ========== 对话发送 ==========
function sendChat() {
  var input = document.getElementById('chat-input');
  var text = input.value.trim();
  if (!text) return;
  input.value = '';
  addUserMessage(text);
  addChatHistory('user', text);

  // 寒暄/无实质内容 → 单条提示
  if (isEmptyInput(text)) {
    var hint = '您好！请描述您的装修需求，例如：\n- 户型和面积（如"三室两厅110㎡"）\n- 预算范围（如"预算15万"）\n- 风格偏好（如"喜欢北欧风"）\n\n五个Agent会根据您的具体需求给出专业分析。';
    addAgentMessage('memo', hint);
    addChatHistory('agent', 'memo', hint);
    return;
  }

  // 根据意图筛选Agent
  var keys = config.pipeline.filter(function(key) {
    return config.agents[key].enabled && shouldAgentRespond(key, text);
  });
  if (keys.length === 0) keys = ['memo'];

  if (apiMode) {
    // 后端模式：调用真实 AI
    sendChatBackend(text, keys);
  } else {
    // 本地模式：使用硬编码回复
    sendChatLocal(text, keys);
  }
}

// 后端 AI 模式
async function sendChatBackend(text, keys) {
  // 显示所有相关Agent的打字指示器
  var typingIds = [];
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var typingId = 'typing-' + key;
    typingIds.push(typingId);
    var msgs = document.getElementById('chat-messages');
    msgs.innerHTML += '<div class="agent-response ' + key + '" id="' + typingId + '">' +
      '<div class="agent-resp-header">' +
        '<span style="font-size:20px;">⏳</span>' +
        '<span class="agent-resp-name">' + config.agents[key].name + '</span>' +
        '<span class="agent-resp-role">思考中...</span>' +
      '</div>' +
      '<div class="typing-indicator"><span></span><span></span><span></span></div>' +
    '</div>';
    msgs.scrollTop = msgs.scrollHeight;
  }

  // 调用后端
  var responses = await callBackendAPI(text);

  // 移除打字指示器
  for (var i = 0; i < typingIds.length; i++) {
    var el = document.getElementById(typingIds[i]);
    if (el) el.remove();
  }

  if (responses && responses.length > 0) {
    // 显示 AI 回复
    for (var i = 0; i < responses.length; i++) {
      var r = responses[i];
      addAgentMessage(r.agent, r.response);
      addChatHistory('agent', r.agent, r.response);
    }
  } else {
    // 后端失败，降级到本地模式
    addAgentMessage('memo', '⚠️ AI 服务暂不可用，已切换到本地模式。\n如需 AI 功能，请启动后端服务（双击「启动服务.bat」）。');
    sendChatLocal(text, keys);
  }
}

// 本地模拟模式
function sendChatLocal(text, keys) {
  var i = 0;
  function nextAgent() {
    if (i >= keys.length) return;
    var key = keys[i];
    i++;
    var msgs = document.getElementById('chat-messages');
    var typingId = 'typing-' + key;
    msgs.innerHTML += '<div class="agent-response ' + key + '" id="' + typingId + '">' +
      '<div class="agent-resp-header">' +
        '<span style="font-size:20px;">⏳</span>' +
        '<span class="agent-resp-name">' + config.agents[key].name + '</span>' +
        '<span class="agent-resp-role">思考中...</span>' +
      '</div>' +
      '<div class="typing-indicator"><span></span><span></span><span></span></div>' +
    '</div>';
    msgs.scrollTop = msgs.scrollHeight;
    var delay = 400 + Math.random() * 600;
    setTimeout(function() {
      var el = document.getElementById(typingId);
      if (el) el.remove();
      var response = generateAgentResponse(key, text);
      addAgentMessage(key, response);
      addChatHistory('agent', key, response);
      nextAgent();
    }, delay);
  }
  nextAgent();
}

// ========== 对话UI函数 ==========
function addUserMessage(text) {
  const msgs = document.getElementById('chat-messages');
  const welcome = msgs.querySelector('div[style*="text-align:center"]');
  if (welcome) welcome.remove();
  msgs.innerHTML += '<div class="user-msg">' + escapeHtml(text) + '</div>';
  msgs.scrollTop = msgs.scrollHeight;
}

function addAgentMessage(key, html) {
  const msgs = document.getElementById('chat-messages');
  const colors = { scout:'var(--scout)', digit:'var(--digit)', nova:'var(--nova)', lex:'var(--lex)', memo:'var(--memo)' };
  const icons  = { scout:'🔍', digit:'📐', nova:'🎨', lex:'🛡️', memo:'📋' };
  const agent = config.agents[key];
  const formatted = formatResponseText(html);
  const titleStr = agent.title ? '（' + agent.title + '）' : '';
  msgs.innerHTML += '<div class="agent-response ' + key + '">' +
    '<div class="agent-resp-header">' +
      '<span style="font-size:20px;">' + icons[key] + '</span>' +
      '<span class="agent-resp-name" style="color:' + colors[key] + ';">' + agent.name + titleStr + '</span>' +
      '<span class="agent-resp-role">' + agent.role + '</span>' +
    '</div>' +
    '<div class="agent-resp-body">' + formatted + '</div>' +
  '</div>';
  msgs.scrollTop = msgs.scrollHeight;
}

function formatResponseText(text) {
  // 先提取案例按钮和草图按钮占位符
  var safeText = text;
  // 案例详情按钮
  safeText = safeText.replace(/CASE_BTN_(\w+)_END/g, function(match, id) {
    return '___CASE_BTN_' + id + '___';
  });
  // 草图按钮
  safeText = safeText.replace(/SKETCH_BTN_END/g, '___SKETCH_BTN___');

  var html = escapeHtml(safeText);
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\n/g, '<br>');
  html = html.replace(/- (.*?)(<br>|$)/gm, '• $1<br>');

  // 还原案例按钮
  html = html.replace(/___CASE_BTN_(\w+)___/g, function(match, id) {
    return '<a href="javascript:openCaseDetail(\'' + id + '\')" style="display:inline-block;margin:4px 0;padding:4px 14px;background:#1a1a2e;color:#fff;border-radius:14px;font-size:12px;text-decoration:none;cursor:pointer;">查看详情 + 草图</a>';
  });
  // 还原草图按钮
  html = html.replace(/___SKETCH_BTN___/g,
    '<a href="javascript:void(0)" style="display:inline-block;margin:8px 0;padding:6px 18px;background:#eb2f96;color:#fff;border-radius:14px;font-size:13px;text-decoration:none;cursor:pointer;">🎨 生成手绘草图</a>'
  );

  return html;
}

function addChatHistory(role, keyOrText, response) {
  if (role === 'user') {
    chatHistory.push({ role:'user', text: keyOrText, time: new Date().toISOString() });
  } else {
    chatHistory.push({ role:'agent', agent:keyOrText, response:response, time:new Date().toISOString() });
  }
  if (chatHistory.length > 100) chatHistory.shift();
  localStorage.setItem('decoration-chat', JSON.stringify(chatHistory));
}

function renderChatHistory() {
  if (chatHistory.length === 0) return;
  const msgs = document.getElementById('chat-messages');
  msgs.innerHTML = '';
  for (let i = 0; i < chatHistory.length; i++) {
    const item = chatHistory[i];
    if (item.role === 'user') { addUserMessage(item.text); }
    else { addAgentMessage(item.agent, item.response); }
  }
}

// ========== Agent响应生成（含案例推荐）==========
function generateAgentResponse(key, userText) {
  const styleMap = { '现代简约':'现代简约','北欧':'北欧','新中式':'新中式','轻奢':'轻奢','日式':'日式','工业':'工业风','美式':'美式' };
  let matchedStyle = '';
  const styleKeys = Object.keys(styleMap);
  for (let i = 0; i < styleKeys.length; i++) {
    if (userText.indexOf(styleKeys[i]) >= 0) { matchedStyle = styleMap[styleKeys[i]]; break; }
  }

  const responses = {
    scout: function() {
      let base = '根据您的需求，我帮您分析了本地市场行情和竞品报价。';
      if (userText.indexOf('三室') >= 0) base = '三室两厅属于主流户型，本地市场精装报价区间在12–18万。';
      else if (userText.indexOf('预算') >= 0) base = '根据您提到的预算，我帮您分析本地市场行情：同档次装修均价约1000–1500元/㎡。';
      return base + '\n\n**市场情报分析：**\n- 您所在楼盘已有' + (Math.floor(Math.random()*5)+1) + '家邻居选择我们公司\n- 同户型竞品报价区间：¥' + Math.floor(800+Math.random()*800) + '/㎡\n- 近期促销活动：本月签单送全屋美缝\n\n**建议：** 可以安排免费量房，出具精准报价单。';
    },
    digit: function() {
      let area = '100';
      if (userText.indexOf('三室') >= 0) area = '110';
      else if (userText.indexOf('两室') >= 0) area = '85';
      else if (userText.indexOf('一室') >= 0) area = '50';
      else if (userText.indexOf('四室') >= 0) area = '145';
      let budget = '150000';
      const bMatch = userText.match(/(\d+)万/);
      if (bMatch) budget = String(parseInt(bMatch[1]) * 10000);
      const areaNum = parseInt(area);
      const budNum  = parseInt(budget);
      const avg = Math.round(budNum / areaNum);
      const level = avg > 1500 ? '精装' : avg > 1000 ? '中装' : '简装';
      // 分项报价
      const baseCost = Math.round(areaNum * (avg > 1500 ? 500 : 350));
      const materialCost = Math.round(areaNum * (avg > 1500 ? 600 : 400));
      const furnitureCost = Math.round(budNum * 0.2);
      const applianceCost = Math.round(budNum * 0.12);
      const softCost = Math.round(budNum * 0.08);
      const designCost = Math.round(budNum * 0.03);
      const total = baseCost + materialCost + furnitureCost + applianceCost + softCost + designCost;
      return '**预算分析**\n'
        + '- 面积：' + area + '㎡\n'
        + '- 档次：' + level + '\n'
        + '- 您的预算：¥' + parseInt(budget).toLocaleString() + '\n\n'
        + '**分项报价清单：**\n'
        + '- 基础工程（水电/泥木/油漆）：¥' + baseCost.toLocaleString() + ' — 含人工+辅材\n'
        + '- 主材（瓷砖/地板/卫浴/橱柜）：¥' + materialCost.toLocaleString() + ' — 品牌环保级\n'
        + '- 家具（柜体/沙发/床等）：¥' + furnitureCost.toLocaleString() + '\n'
        + '- 家电（空调/厨电等）：¥' + applianceCost.toLocaleString() + '\n'
        + '- 软装（窗帘/灯具/装饰）：¥' + softCost.toLocaleString() + '\n'
        + '- 设计费：¥' + designCost.toLocaleString() + '\n'
        + '- **合计：¥' + total.toLocaleString() + '**（约¥' + Math.round(total/areaNum) + '/㎡）\n\n'
        + '**材料用量估算：**\n'
        + '- 瓷砖：' + Math.ceil(areaNum*1.1) + '㎡（含5%损耗）\n'
        + '- 地板：' + Math.ceil(areaNum*0.5) + '㎡\n'
        + '- 涂料：' + Math.ceil(areaNum*2.5/5) + '桶（5L/桶）\n'
        + '- 防水涂料：' + Math.ceil(areaNum*0.3) + 'kg\n\n'
        + '**省钱建议：**\n'
        + '- 主材可选国产一线品牌（如圣象、大自然），性价比高于进口\n'
        + '- 水电建议走横平竖直，预算预留10%应急\n\n'
        + '> 以上为预估价格，精准报价需上门量房后确认。';
    },
    nova: function() {
      const style = matchedStyle || '现代简约';
      const recommended = recommendCases(userText, 2);
      let caseHTML = '';
      if (recommended.length > 0) {
        caseHTML = '\n\n**📁 相关案例推荐：**\n';
        for (let i = 0; i < recommended.length; i++) {
          const c = recommended[i];
          caseHTML += '- **' + c.title + '** (' + c.area + '㎡ / ¥' + (c.budget/10000).toFixed(1) + '万)\n';
          caseHTML += '  CASE_BTN_' + c.id + '_END\n';
        }
      }
      return '**设计方案建议（' + style + '）：**\n\n' +
        (userText.indexOf('三室') >= 0 || userText.indexOf('两室') >= 0 ? '**空间规划建议：**\n- 客厅：开放式设计，增加视觉通透感\n- 餐厅：卡座设计，增加收纳\n- 主卧：整面衣柜，充分利用墙面\n\n' : '') +
        '**风格要点：**\n- 色彩：以' + (style==='现代简约'?'黑白灰':'原木色') + '为主调\n- 材料：' + (style==='现代简约'?'大理石+金属':'原木+棉麻') + '元素\n- 收纳：隐藏式收纳，保持空间整洁\n\n> 我们可以安排设计师免费上门量房，出具3D效果图，您看满意再决定。' +
        caseHTML + '\n\nSKETCH_BTN_END';
    },
    lex: function() {
      return '**⚠️ 合规提醒（保护您的权益）：**\n\n'
        + '**增项风险检查：**\n'
        + '- 水电预估不足 | 风险：高 — 是否按实际米数结算？有无上限？\n'
        + '- 防水面积缩水 | 风险：高 — 卫生间防水是否做到1.8m？\n'
        + '- 拆改费用遗漏 | 风险：中 — 墙体拆除、垃圾清运是否包含？\n'
        + '- 主材升级套路 | 风险：中 — 合同品牌型号是否明确？\n'
        + '- 管理费/税金 | 风险：低 — 是否单独收取？比例多少？\n\n'
        + '**合同签订建议：**\n'
        + '1. 付款节点：开工≤30%、中期≤50%、竣工≥20%（法定建议）\n'
        + '2. 增项条款：必须书面确认，单次不超总价10%\n'
        + '3. 保修条款：基础工程≥2年，防水≥5年（法定最低）\n'
        + '4. 材料品牌：合同中必须明确标注品牌、型号、环保等级\n\n'
        + '**我们的承诺：**\n'
        + '- 合同模板经法务审核，条款对等\n'
        + '- 报价单无模糊项，所有材料明确标注\n'
        + '- 增项需您书面签字确认，否则免费整改\n\n'
        + '> 雷虎审核是我们的标准流程，保障双方权益。';
    },
    memo: function() {
      const days = 45 + Math.floor(Math.random()*15);
      return '**项目规划（如您选择我们）：**\n\n**预计工期：' + days + '天**（自开工日起）\n\n**关键节点计划：**\n1. 签约后3天内安排量房\n2. 量房后5天内出具设计方案\n3. 方案确认后7天内完成报价单\n4. 合同签订后约定开工日期\n5. 施工中每7天向您汇报进度\n\n**节点提醒服务：**\n- 水电验收前1天提醒\n- 材料进场前确认\n- 每个节点完成后发送进度报告\n\n**您的专属项目经理：** 全程一对一服务，微信/电话随时沟通。';
    }
  };
  try {
    if (responses[key]) return responses[key]();
    return '[' + config.agents[key].name + '响应生成中...（实际接入AI模型后将自动生成）]';
  } catch(e) { return '[响应生成出错：' + e.message + ']'; }
}

// ========== 案例推荐算法 ==========
function recommendCases(userText, maxResults) {
  maxResults = maxResults || 3;
  const scored = casesData.map(function(c) {
    let score = 0;
    // 风格匹配
    var styleMap = { '现代简约':'现代简约','北欧':'北欧','新中式':'新中式','轻奢':'轻奢','日式':'日式','工业':'工业风','美式':'美式' };
    var keys = Object.keys(styleMap);
    for (var i = 0; i < keys.length; i++) {
      if (userText.indexOf(keys[i]) >= 0 && c.style === styleMap[keys[i]]) { score += 5; break; }
    }
    // 户型匹配
    if (userText.indexOf('三室') >= 0 && c.layout.indexOf('三室') >= 0) score += 4;
    if (userText.indexOf('两室') >= 0 && c.layout.indexOf('两室') >= 0) score += 4;
    if (userText.indexOf('一室') >= 0 && c.layout.indexOf('一室') >= 0) score += 4;
    if (userText.indexOf('四室') >= 0 && c.layout.indexOf('四室') >= 0) score += 4;
    // 面积区间匹配
    var areaM = userText.match(/(\d+)㎡/);
    if (areaM) {
      var area = parseInt(areaM[1]);
      if (Math.abs(c.area - area) < 20) score += 3;
    }
    // 预算区间匹配
    var budM = userText.match(/(\d+)万/);
    if (budM) {
      var budget = parseInt(budM[1]) * 10000;
      if (Math.abs(c.budget - budget) / c.budget < 0.3) score += 3;
    }
    // 标签关键词匹配
    for (var j = 0; j < c.tags.length; j++) {
      if (userText.indexOf(c.tags[j]) >= 0) score += 2;
    }
    return { case: c, score: score };
  });
  var filtered = scored.filter(function(s) { return s.score > 0; });
  filtered.sort(function(a, b) { return b.score - a.score; });
  return filtered.slice(0, maxResults).map(function(s) { return s.case; });
}

// ========== 案例库渲染 ==========
function renderCases() {
  var grid = document.getElementById('case-grid');
  var countEl = document.getElementById('case-count');
  var search = document.getElementById('case-search').value.trim().toLowerCase();
  var filtered = casesData;
  if (currentCaseFilter !== 'all') {
    filtered = filtered.filter(function(c) { return c.style === currentCaseFilter; });
  }
  if (search) {
    filtered = filtered.filter(function(c) {
      return c.title.toLowerCase().indexOf(search) >= 0
        || c.style.indexOf(search) >= 0
        || c.layout.indexOf(search) >= 0
        || c.location.toLowerCase().indexOf(search) >= 0
        || c.tags.join('').indexOf(search) >= 0;
    });
  }
  countEl.textContent = filtered.length;
  grid.innerHTML = filtered.map(function(c) {
    var stars = '';
    for (var i = 0; i < c.satisfaction; i++) stars += '★';
    for (var i = c.satisfaction; i < 5; i++) stars += '☆';
    var safeTitle = escapeHtml(c.title);
    var safeLayout = escapeHtml(c.layout);
    var safeLocation = escapeHtml(c.location);
    var safeId = escapeHtml(c.id);
    return '<div class="case-card" onclick="openCaseDetail(\'' + safeId + '\')">'
      + '<canvas class="case-card-canvas" id="case-thumb-' + safeId + '" width="300" height="180"></canvas>'
      + '<div class="case-card-body">'
        + '<div class="case-card-title">' + safeTitle + '</div>'
        + '<div class="case-card-sub">' + safeLayout + ' · ' + c.area + '㎡ · ' + safeLocation + '</div>'
        + '<div class="case-card-tags">' + c.tags.map(function(t) { return '<span class="case-tag">' + escapeHtml(t) + '</span>'; }).join('') + '</div>'
        + '<div style="display:flex;justify-content:space-between;align-items:center;">'
          + '<span class="case-card-budget">¥' + (c.budget/10000).toFixed(1) + '万</span>'
          + '<span style="font-size:12px;color:#faad14;">' + stars + '</span>'
        + '</div>'
      + '</div>'
    + '</div>';
  }).join('');
  // 为每个案例生成缩略草图
  filtered.forEach(function(c) {
    var canvas = document.getElementById('case-thumb-' + c.id);
    if (canvas) drawCaseThumb(canvas, c);
  });
}

function filterCases(style, btn) {
  currentCaseFilter = style;
  document.querySelectorAll('.case-filter-btn').forEach(function(b) { b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  renderCases();
}

// ========== 手绘草图：缩略图 ==========
function drawCaseThumb(canvas, caseItem) {
  var ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f8f8f8';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  var theme = getThemeByStyleName(caseItem.style || '');
  var layout = caseItem.layout;
  var ox = 40, oy = 30, uw = 220, uh = 120;
  // 外墙
  roughRect(canvas, ox, oy, uw, uh, { stroke: theme.wall, strokeWidth: 2, roughness: 1.8 });
  // 内墙（根据户型）
  if (layout.indexOf('三室') >= 0 || layout.indexOf('四室') >= 0) {
    roughLine(canvas, ox + 60, oy, ox + 60, oy + uh, { stroke: theme.wall, strokeWidth: 1.2 });
    roughLine(canvas, ox + 120, oy, ox + 120, oy + uh, { stroke: theme.wall, strokeWidth: 1.2 });
    roughLine(canvas, ox, oy + 50, ox + uw, oy + 50, { stroke: theme.wall, strokeWidth: 1.2 });
  } else if (layout.indexOf('两室') >= 0) {
    roughLine(canvas, ox + 110, oy, ox + 110, oy + uh, { stroke: theme.wall, strokeWidth: 1.2 });
    roughLine(canvas, ox, oy + 55, ox + uw, oy + 55, { stroke: theme.wall, strokeWidth: 1.2 });
  } else {
    roughLine(canvas, ox, oy + 60, ox + uw, oy + 60, { stroke: theme.wall, strokeWidth: 1.2 });
  }
  // 标注
  ctx.fillStyle = theme.label;
  ctx.font = '10px Microsoft YaHei';
  ctx.fillText(caseItem.area + '㎡', ox + uw/2 - 15, oy + uh/2 + 5);
  ctx.fillText(caseItem.style, ox + 5, oy - 8);
}

// Rough.js 封装：手绘风格矩形/线条
function roughRect(canvas, x, y, w, h, opts) {
  var rc = rough.canvas(canvas);
  var o = Object.assign({ roughness: 1.5, bowing: 1, strokeWidth: 1.5, stroke: '#555' }, opts || {});
  rc.rectangle(x, y, w, h, o);
}

function roughLine(canvas, x1, y1, x2, y2, opts) {
  var rc = rough.canvas(canvas);
  var o = Object.assign({ roughness: 1.5, bowing: 1, strokeWidth: 1.5, stroke: '#555' }, opts || {});
  rc.line(x1, y1, x2, y2, o);
}

function roughCircle(canvas, cx, cy, d, opts) {
  var rc = rough.canvas(canvas);
  var o = Object.assign({ roughness: 1.5, strokeWidth: 1, stroke: '#555' }, opts || {});
  rc.circle(cx, cy, d, o);
}

function roughEllipse(canvas, cx, cy, w, h, opts) {
  var rc = rough.canvas(canvas);
  var o = Object.assign({ roughness: 1.5, strokeWidth: 1, stroke: '#555' }, opts || {});
  rc.ellipse(cx, cy, w, h, o);
}

// ========== 案例详情弹窗 ==========
function openCaseDetail(caseId) {
  var c = casesData.find(function(x) { return x.id === caseId; });
  if (!c) return;
  document.getElementById('case-detail-title').textContent = c.title + ' — 详情';
  var body = document.getElementById('case-detail-body');
  body.innerHTML = '<div style="margin-bottom:8px;"><strong>户型：</strong>' + escapeHtml(c.layout) + '（' + c.area + '㎡）</div>'
    + '<div style="margin-bottom:8px;"><strong>风格：</strong>' + escapeHtml(c.style) + '</div>'
    + '<div style="margin-bottom:8px;"><strong>总造价：</strong><span style="color:#e94560;font-weight:700;">¥' + c.budget.toLocaleString() + '</span>（¥' + Math.round(c.budget / c.area) + '/㎡）</div>'
    + '<div style="margin-bottom:8px;"><strong>工期：</strong>' + c.duration + '天</div>'
    + '<div style="margin-bottom:8px;"><strong>楼盘：</strong>' + escapeHtml(c.location) + '</div>'
    + '<div style="margin-bottom:8px;"><strong>竣工：</strong>' + escapeHtml(c.completion_date || '') + '</div>'
    + '<div style="margin-bottom:8px;"><strong>亮点：</strong>' + c.highlights.map(function(h) { return escapeHtml(h); }).join('、') + '</div>'
    + '<div style="margin-bottom:8px;"><strong>主材：</strong>' + escapeHtml(c.materials || '') + '</div>'
    + '<div style="background:#fafafa;border-radius:8px;padding:12px;margin-top:12px;font-size:13px;color:#666;line-height:1.8;">"' + escapeHtml(c.customer_quote || '') + '"</div>';
  // 绘制手绘草图
  var canvas = document.getElementById('case-sketch-canvas');
  setTimeout(function() { drawDetailSketch(canvas, c); }, 100);
  document.getElementById('modal-case-detail').classList.add('show');
}

function getThemeByStyleName(styleName) {
  if (styleName.indexOf('北欧') >= 0) return styleThemes.nordic;
  if (styleName.indexOf('新中式') >= 0) return styleThemes.chinese;
  if (styleName.indexOf('轻奢') >= 0) return styleThemes.luxury;
  return styleThemes.modern;
}

function drawDetailSketch(canvas, caseItem) {
  var ctx = canvas.getContext('2d');
  var theme = getThemeByStyleName(caseItem.style || '');
  var layout = caseItem.layout;

  // 背景
  ctx.fillStyle = theme.floor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // 手绘网格
  ctx.strokeStyle = 'rgba(0,0,0,0.04)';
  ctx.lineWidth = 0.5;
  for (var x = 0; x < canvas.width; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
  for (var y = 0; y < canvas.height; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }

  var ox = 40, oy = 30;
  var uw = canvas.width - 80, uh = canvas.height - 80;
  // 外墙
  roughRect(canvas, ox, oy, uw, uh, { stroke: theme.wall, strokeWidth: 2.5, roughness: 1.8 });

  // 内墙
  var rooms = [];
  var wallOpts = { stroke: theme.wall, strokeWidth: 1.5, roughness: 1.2 };

  if (layout.indexOf('一室') >= 0) {
    roughLine(canvas, ox + Math.round(uw * 0.5), oy, ox + Math.round(uw * 0.5), oy + uh, wallOpts);
    roughLine(canvas, ox, oy + Math.round(uh * 0.6), ox + Math.round(uw * 0.5), oy + Math.round(uh * 0.6), wallOpts);
    rooms = [
      { name:'卧室/客厅', x:ox+10, y:oy+Math.round(uh*0.4) },
      { name:'厨房', x:ox+10, y:oy+Math.round(uh*0.8) },
      { name:'卫生间', x:ox+Math.round(uw*0.5)+10, y:oy+Math.round(uh*0.8) }
    ];
  } else if (layout.indexOf('两室') >= 0) {
    roughLine(canvas, ox + Math.round(uw * 0.5), oy, ox + Math.round(uw * 0.5), oy + uh, wallOpts);
    roughLine(canvas, ox, oy + Math.round(uh * 0.55), ox + uw, oy + Math.round(uh * 0.55), wallOpts);
    rooms = [
      { name:'客厅', x:ox+Math.round(uw*0.6)+10, y:oy+Math.round(uh*0.4) },
      { name:'主卧', x:ox+10, y:oy+Math.round(uh*0.35) },
      { name:'次卧', x:ox+10, y:oy+Math.round(uh*0.65)+10 },
      { name:'厨卫', x:ox+Math.round(uw*0.6)+10, y:oy+Math.round(uh*0.65)+10 }
    ];
  } else if (layout.indexOf('三室') >= 0) {
    roughLine(canvas, ox + Math.round(uw * 0.55), oy, ox + Math.round(uw * 0.55), oy + uh, wallOpts);
    roughLine(canvas, ox, oy + Math.round(uh * 0.5), ox + Math.round(uw * 0.55), oy + Math.round(uh * 0.5), wallOpts);
    rooms = [
      { name:'客厅+餐厅', x:ox+Math.round(uw*0.58)+5, y:oy+Math.round(uh*0.4) },
      { name:'主卧', x:ox+10, y:oy+Math.round(uh*0.25) },
      { name:'次卧1', x:ox+10, y:oy+Math.round(uh*0.55)+10 },
      { name:'次卧2/书房', x:ox+Math.round(uw*0.25)+5, y:oy+Math.round(uh*0.55)+10 },
      { name:'厨卫', x:ox+Math.round(uw*0.58)+5, y:oy+Math.round(uh*0.55)+10 }
    ];
  } else {
    roughLine(canvas, ox + Math.round(uw * 0.5), oy, ox + Math.round(uw * 0.5), oy + uh, wallOpts);
    roughLine(canvas, ox, oy + Math.round(uh * 0.5), ox + uw, oy + Math.round(uh * 0.5), wallOpts);
    rooms = [
      { name:'客厅', x:ox+Math.round(uw*0.52)+5, y:oy+Math.round(uh*0.3) },
      { name:'主卧', x:ox+10, y:oy+Math.round(uh*0.25) },
      { name:'次卧', x:ox+10, y:oy+Math.round(uh*0.55)+10 }
    ];
  }

  // 家具
  drawStyleDecor(canvas, ox, oy, uw, uh, theme, layout);

  // 标注
  ctx.fillStyle = theme.label;
  ctx.font = '12px Microsoft YaHei';
  for (var i = 0; i < rooms.length; i++) {
    ctx.fillText(rooms[i].name, rooms[i].x, rooms[i].y);
  }

  // 标题
  ctx.fillStyle = theme.label;
  ctx.font = 'bold 13px Microsoft YaHei';
  ctx.fillText(caseItem.title + ' · 手绘草图', ox, oy - 10);
}

// ========== 流水线 ==========
function renderPipelineCards() {
  var box = document.getElementById('pipeline-cards');
  var icons = { scout:'🔍', digit:'📐', nova:'🎨', lex:'🛡️', memo:'📋' };
  box.innerHTML = config.pipeline.map(function(key, i) {
    var a = config.agents[key];
    var titleStr = a.title ? '（' + a.title + '）' : '';
    return '<div class="pipeline-card" id="pcard-' + key + '">'
      + '<div class="astatus" id="pstatus-' + key + '" style="background:var(--border);"></div>'
      + '<div style="font-size:28px;margin-bottom:8px;">' + icons[key] + '</div>'
      + '<div style="font-weight:700;font-size:15px;">' + a.name + titleStr + '</div>'
      + '<div style="font-size:12px;color:var(--text-sub);margin:4px 0 8px 0;">' + a.role + '</div>'
      + '<div id="presult-' + key + '" style="font-size:12px;color:#999;">等待运行</div>'
    + '</div>'
    + (i < config.pipeline.length - 1 ? '<div class="pipeline-arrow">→</div>' : '');
  }).join('');
}

async function runPipeline() {
  var logEl = document.getElementById('pipeline-log');
  logEl.innerHTML = '';
  function log(msg, color) {
    var t = new Date().toTimeString().slice(0, 8);
    logEl.innerHTML += '<div><span style="color:#569cd6;">[' + t + ']</span> <span style="color:' + (color || '#d4d4d4') + ';">' + msg + '</span></div>';
    logEl.scrollTop = logEl.scrollHeight;
  }
  for (var i = 0; i < config.pipeline.length; i++) {
    var key = config.pipeline[i];
    var a = config.agents[key];
    if (!a.enabled) { log('[跳过] ' + a.name + ' 已禁用', '#999'); continue; }
    document.getElementById('pstatus-' + key).style.background = '#faad14';
    document.getElementById('presult-' + key).textContent = '运行中...';
    log('[启动] ' + a.name + '（' + a.role + '）...', '#4ec9b0');
    await sleep(900 + Math.random() * 1200);
    var results = {
      scout: '发现3个新盘，12条客户线索',
      digit: '报价单已生成，总价 ¥86,500',
      nova:  '设计方案说明已完成，营销文案2篇',
      lex:   '审核通过：报价单+合同无风险',
      memo:  '项目档案已建立，节点提醒已设置'
    };
    document.getElementById('pstatus-' + key).style.background = '#52c41a';
    document.getElementById('presult-' + key).textContent = results[key];
    log('[完成] ' + a.name + '：' + results[key], '#4ec9b0');
    if (key === 'lex' && a.blocking && results[key].indexOf('不通过') >= 0) {
      log('[阻塞] 雷虎审核未通过，流水线终止', '#f44747');
      break;
    }
  }
  log('[完成] 流水线全部执行完毕！', '#4ec9b0');
}

function resetPipeline() {
  config.pipeline.forEach(function(key) {
    var s = document.getElementById('pstatus-' + key);
    if (s) s.style.background = '#d9d9d9';
    var r = document.getElementById('presult-' + key);
    if (r) r.textContent = '等待运行';
  });
  var logEl = document.getElementById('pipeline-log');
  if (logEl) logEl.innerHTML = '';
}

// ========== 系统配置 ==========
function renderAgentConfigs() {
  var box = document.getElementById('agent-cfgs');
  box.innerHTML = config.pipeline.map(function(key) {
    var a = config.agents[key];
    var titleStr = a.title ? '（' + a.title + '）' : '';
    return '<div style="background:var(--warm-white);border:1px solid var(--border-light);border-radius:10px;padding:16px;margin-bottom:12px;">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">'
        + '<div style="font-size:16px;font-weight:600;">' + a.name + titleStr + ' — ' + a.role + '</div>'
        + '<div onclick="toggleAgent(\'' + key + '\',this)" style="width:44px;height:24px;background:' + (a.enabled ? '#52c41a' : '#ccc') + ';border-radius:12px;position:relative;cursor:pointer;">'
          + '<div style="position:absolute;top:2px;' + (a.enabled ? 'left:22px;' : 'left:2px;') + 'width:20px;height:20px;background:white;border-radius:50%;transition:left 0.2s;"></div>'
        + '</div>'
      + '</div>'
      + '<div class="form-row"><label>温度参数</label><input type="number" step="0.1" min="0" max="1" value="' + a.temp + '" onchange="config.agents[\'' + key + '\'].temp=parseFloat(this.value)"></div>'
      + (a.blocking ? '<div style="font-size:12px;color:#fa8c16;margin-top:8px;">⚠ 阻塞环节：审核不通过则流程终止</div>' : '')
    + '</div>';
  }).join('');
}

function toggleAgent(key, el) {
  config.agents[key].enabled = !config.agents[key].enabled;
  el.style.background = config.agents[key].enabled ? '#52c41a' : '#ccc';
  var dot = el.querySelector('div');
  dot.style.left = config.agents[key].enabled ? '22px' : '2px';
}

function saveConfig() {
  config.company.name = document.getElementById('cfg-name').value;
  config.company.address = document.getElementById('cfg-addr').value;
  config.company.phone = document.getElementById('cfg-phone').value;
  config.company.owner = document.getElementById('cfg-owner').value;
  localStorage.setItem('decoration-config', JSON.stringify(config));
  alert('配置已保存到浏览器本地存储（localStorage）\n\n如需持久化，请手动更新 decoration-agents/config.json 文件。');
  renderPipelineCards();
  addLog('配置已保存', 'success');
}

// ========== 项目管理 ==========
function renderProjects() {
  var tbody = document.getElementById('project-tbody');
  if (projects.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#999;padding:40px;">暂无项目，点击「新建项目」开始</td></tr>';
    return;
  }
  tbody.innerHTML = projects.map(function(p, i) {
    return '<tr>'
      + '<td style="padding:12px 16px;">' + escapeHtml(p.client || '') + '</td>'
      + '<td style="padding:12px 16px;">' + escapeHtml(p.community || '') + '</td>'
      + '<td style="padding:12px 16px;">' + escapeHtml(p.layout || '') + '</td>'
      + '<td style="padding:12px 16px;">¥' + (parseInt(p.amount) || 0).toLocaleString() + '</td>'
      + '<td style="padding:12px 16px;">' + escapeHtml(p.stage || '线索获取') + '</td>'
      + '<td style="padding:12px 16px;"><button class="btn btn-sm" style="background:#f0f0f0;" onclick="viewProject(' + i + ')">查看</button> <button class="btn btn-sm btn-danger" onclick="deleteProject(' + i + ')">删除</button></td>'
    + '</tr>';
  }).join('');
}

function showAddProject() {
  document.getElementById('modal-project').classList.add('show');
}

function addProject() {
  var client = document.getElementById('p-client').value.trim();
  if (!client) { alert('请输入客户姓名'); return; }
  projects.push({
    client: client,
    phone: document.getElementById('p-phone').value,
    community: document.getElementById('p-community').value,
    layout: document.getElementById('p-layout').value,
    area: document.getElementById('p-area').value,
    level: document.getElementById('p-level').value,
    amount: parseInt(document.getElementById('p-amount').value) || 0,
    startDate: document.getElementById('p-start').value,
    stage: '线索获取',
    status: '正常',
    createdAt: new Date().toISOString()
  });
  localStorage.setItem('decoration-projects', JSON.stringify(projects));
  closeModal('modal-project');
  renderProjects();
  renderHome();
  addLog('新建项目：' + client, 'success');
}

function viewProject(index) {
  var p = projects[index];
  if (!p) return;
  var info = '【项目详情】\n\n'
    + '客户：' + (p.client || '-') + '\n'
    + '电话：' + (p.phone || '-') + '\n'
    + '楼盘：' + (p.community || '-') + '\n'
    + '户型：' + (p.layout || '-') + '\n'
    + '面积：' + (p.area || '-') + '㎡\n'
    + '档次：' + (p.level || '-') + '\n'
    + '金额：¥' + (parseInt(p.amount) || 0).toLocaleString() + '\n'
    + '开工：' + (p.startDate || '-') + '\n'
    + '节点：' + (p.stage || '线索获取') + '\n'
    + '状态：' + (p.status || '正常') + '\n'
    + '创建：' + (p.createdAt || '-');
  alert(info);
}

function deleteProject(index) {
  var p = projects[index];
  if (!p) return;
  if (!confirm('确认删除项目「' + (p.client || '') + '」？此操作不可撤销。')) return;
  projects.splice(index, 1);
  localStorage.setItem('decoration-projects', JSON.stringify(projects));
  renderProjects();
  renderHome();
  addLog('删除项目：' + (p.client || ''), 'warn');
}

// ========== 模板中心 ==========
function renderTemplates() {
  var templates = [
    { name:'报价单模板', desc:'标准装修报价单，含基础工程、主材清单、费用汇总', icon:'📋', file:'quote_template.md' },
    { name:'设计方案说明书', desc:'客户版设计说明，非专业术语，突出设计亮点', icon:'🎨', file:'design_brief_template.md' },
    { name:'合同合规审核报告', desc:'雷虎审核模板，含条款审核清单和风险预警', icon:'🛡️', file:'contract_check_template.md' },
    { name:'项目周报模板', desc:'Memo项目周报，含进度、验收、收款、待办', icon:'📊', file:'project_report_template.md' }
  ];
  document.getElementById('tpl-cards').innerHTML = templates.map(function(t) {
    return '<div style="background:white;border-radius:12px;padding:24px;width:260px;box-shadow:0 2px 12px rgba(0,0,0,0.08);">'
      + '<div style="font-size:36px;margin-bottom:12px;">' + t.icon + '</div>'
      + '<div style="font-size:16px;font-weight:600;margin-bottom:8px;">' + t.name + '</div>'
      + '<div style="font-size:13px;color:#999;margin-bottom:16px;">' + t.desc + '</div>'
      + '<div style="font-size:12px;color:#bbb;">templates/' + t.file + '</div>'
    + '</div>';
  }).join('');
}

// ========== 日志 ==========
function renderLog() {
  var el = document.getElementById('system-log');
  if (!el) return;
  if (logs.length === 0) {
    el.innerHTML = '<div><span style="color:#569cd6;">[System]</span> <span style="color:#999;">日志将在此显示</span></div>';
  } else {
    el.innerHTML = logs.map(function(l) { return '<div>' + l + '</div>'; }).join('');
  }
}

function addLog(msg, type) {
  var colors = { info:'#d4d4d4', success:'#4ec9b0', warn:'#ce9178', error:'#f44747' };
  var t = new Date().toTimeString().slice(0, 8);
  logs.push('<span style="color:#569cd6;">[' + t + ']</span> <span style="color:' + (colors[type] || '#d4d4d4') + ';">' + msg + '</span>');
  if (logs.length > 200) logs.shift();
  renderLog();
}

// ========== 手绘草图弹窗 ==========
function openSketchModal(style) {
  document.getElementById('modal-sketch').classList.add('show');
  if (style) {
    var sel = document.getElementById('sketch-style');
    var opts = ['modern', 'nordic', 'chinese', 'luxury'];
    var labels = ['现代简约', '北欧', '新中式', '轻奢'];
    for (var i = 0; i < opts.length; i++) {
      if (style.indexOf(labels[i]) >= 0) { sel.value = opts[i]; break; }
    }
  }
  setTimeout(function() { generateSketch(); }, 100);
}

// 风格配色方案
var styleThemes = {
  modern:  { wall:'#555', floor:'#e8e8e8', furn:'#444', accent:'#1a1a2e', label:'#333', name:'现代简约', furnStyle:'rect' },
  nordic:  { wall:'#8b7355', floor:'#f5e6d3', furn:'#c9a96e', accent:'#6b8e7b', label:'#5a4a3a', name:'北欧', furnStyle:'round' },
  chinese: { wall:'#5c3a21', floor:'#f0e4d4', furn:'#3e2723', accent:'#b71c1c', label:'#4e342e', name:'新中式', furnStyle:'rect' },
  luxury:  { wall:'#555', floor:'#e8e4e0', furn:'#333', accent:'#c9a96e', label:'#2c2c2c', name:'轻奢', furnStyle:'rect' }
};

function getStyleTheme() {
  var sel = document.getElementById('sketch-style');
  var key = sel ? sel.value : 'modern';
  return styleThemes[key] || styleThemes.modern;
}

function drawFurniture(canvas, type, x, y, w, h, theme) {
  var rc = rough.canvas(canvas);
  var fillOpts = { fill: theme.furn, fillStyle: 'hachure', fillWeight: 0.5, strokeWidth: 0.8, stroke: theme.furn, roughness: 1, bowing: 0.5 };
  if (type === 'sofa') {
    rc.rectangle(x, y, w, h * 0.4, fillOpts);
    rc.rectangle(x, y, w * 0.3, h, fillOpts);
  } else if (type === 'bed') {
    rc.rectangle(x, y, w, h, fillOpts);
    // 枕头
    rc.rectangle(x + w * 0.1, y + 2, w * 0.35, h * 0.15, { fill: theme.accent, fillStyle: 'solid', strokeWidth: 0.5, stroke: theme.accent, roughness: 0.8 });
    rc.rectangle(x + w * 0.55, y + 2, w * 0.35, h * 0.15, { fill: theme.accent, fillStyle: 'solid', strokeWidth: 0.5, stroke: theme.accent, roughness: 0.8 });
  } else if (type === 'table') {
    if (theme.furnStyle === 'round') {
      rc.circle(x + w/2, y + h/2, Math.min(w,h), fillOpts);
    } else {
      rc.rectangle(x, y, w, h, fillOpts);
    }
  } else if (type === 'tv') {
    rc.rectangle(x, y, w, h * 0.15, fillOpts);
  } else if (type === 'wardrobe') {
    rc.rectangle(x, y, w, h, fillOpts);
  } else if (type === 'tub') {
    rc.ellipse(x + w/2, y + h/2, w, h, { fill: theme.accent, fillStyle: 'hachure', fillWeight: 0.3, strokeWidth: 0.8, stroke: theme.accent, roughness: 1 });
  } else if (type === 'sink') {
    rc.rectangle(x, y, w, h, fillOpts);
  }
}

function drawStyleDecor(canvas, ox, oy, uw, uh, theme, layout) {
  var ctx = canvas.getContext('2d');
  var style = document.getElementById('sketch-style').value;
  // 客厅区域坐标（右侧上部）
  var lx = ox + uw * 0.55, ly = oy + 5;
  var lw = uw * 0.43, lh = uh * 0.45;

  if (style === 'modern') {
    drawFurniture(canvas, 'sofa', lx + lw*0.1, ly + lh*0.5, lw*0.6, lh*0.35, theme);
    drawFurniture(canvas, 'tv', lx + lw*0.1, ly + lh*0.1, lw*0.6, lh*0.1, theme);
  } else if (style === 'nordic') {
    drawFurniture(canvas, 'sofa', lx + lw*0.1, ly + lh*0.5, lw*0.55, lh*0.3, theme);
    drawFurniture(canvas, 'table', lx + lw*0.3, ly + lh*0.25, lw*0.25, lh*0.2, theme);
    // 绿植
    roughCircle(canvas, lx + lw*0.85, ly + lh*0.2, 16, { fill: theme.accent, fillStyle: 'solid', stroke: theme.accent, strokeWidth: 0.5, roughness: 1.5 });
  } else if (style === 'chinese') {
    drawFurniture(canvas, 'table', lx + lw*0.25, ly + lh*0.3, lw*0.35, lh*0.3, theme);
    // 屏风线
    ctx.save();
    ctx.strokeStyle = theme.accent;
    ctx.globalAlpha = 0.3;
    ctx.setLineDash([4,3]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(lx + lw*0.7, ly);
    ctx.lineTo(lx + lw*0.7, ly + lh);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  } else if (style === 'luxury') {
    drawFurniture(canvas, 'sofa', lx + lw*0.08, ly + lh*0.5, lw*0.6, lh*0.35, theme);
    drawFurniture(canvas, 'tv', lx + lw*0.08, ly + lh*0.08, lw*0.6, lh*0.1, theme);
    // 大理石纹理
    ctx.save();
    ctx.strokeStyle = theme.accent;
    ctx.globalAlpha = 0.12;
    ctx.lineWidth = 0.8;
    for (var i = -5; i < 10; i++) {
      ctx.beginPath();
      ctx.moveTo(lx + i*12, ly);
      ctx.lineTo(lx + i*12 + lh, ly + lh);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 卧室家具（左侧上部）
  var bx = ox + 5, by = oy + 5;
  var bw = uw * 0.48, bh = uh * 0.45;
  drawFurniture(canvas, 'bed', bx + bw*0.15, by + bh*0.2, bw*0.5, bh*0.6, theme);
  drawFurniture(canvas, 'wardrobe', bx + bw*0.75, by + bh*0.1, bw*0.18, bh*0.7, theme);
}

function generateSketch() {
  var canvas = document.getElementById('sketch-canvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var theme = getStyleTheme();
  var layoutSel = document.getElementById('sketch-layout');
  var layout = layoutSel ? layoutSel.value : '2b1l';
  var styleLabel = document.getElementById('sketch-style');
  var label = styleLabel ? styleLabel.options[styleLabel.selectedIndex].text : '手绘草图';

  // 背景填充（风格色调）
  ctx.fillStyle = theme.floor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // 手绘网格背景
  ctx.strokeStyle = 'rgba(0,0,0,0.04)';
  ctx.lineWidth = 0.5;
  for (var x = 0; x < canvas.width; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
  for (var y = 0; y < canvas.height; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }

  var ox = 60, oy = 40;
  var uw = canvas.width - 120, uh = canvas.height - 100;
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = theme.wall;
  // 外墙
  roughRect(canvas, ox, oy, uw, uh, { stroke: theme.wall, strokeWidth: 2.5, roughness: 1.8 });

  // 根据户型绘制内墙
  var wallOpts = { stroke: theme.wall, strokeWidth: 1.5, roughness: 1.2 };
  var rooms = [];

  if (layout === '1b1l') {
    roughLine(canvas, ox + Math.round(uw * 0.5), oy, ox + Math.round(uw * 0.5), oy + uh, wallOpts);
    roughLine(canvas, ox, oy + Math.round(uh * 0.6), ox + Math.round(uw * 0.5), oy + Math.round(uh * 0.6), wallOpts);
    rooms = [
      { name:'卧室/客厅', x:ox+10, y:oy+Math.round(uh*0.4) },
      { name:'厨房', x:ox+10, y:oy+Math.round(uh*0.8) },
      { name:'卫生间', x:ox+Math.round(uw*0.5)+10, y:oy+Math.round(uh*0.8) }
    ];
  } else if (layout === '2b1l') {
    roughLine(canvas, ox + Math.round(uw * 0.5), oy, ox + Math.round(uw * 0.5), oy + uh, wallOpts);
    roughLine(canvas, ox, oy + Math.round(uh * 0.55), ox + uw, oy + Math.round(uh * 0.55), wallOpts);
    rooms = [
      { name:'客厅', x:ox+Math.round(uw*0.52)+5, y:oy+Math.round(uh*0.4) },
      { name:'主卧', x:ox+10, y:oy+Math.round(uh*0.35) },
      { name:'次卧', x:ox+10, y:oy+Math.round(uh*0.65)+10 },
      { name:'厨卫', x:ox+Math.round(uw*0.52)+5, y:oy+Math.round(uh*0.65)+10 }
    ];
  } else if (layout === '3b2l' || layout === '3b1l') {
    roughLine(canvas, ox + Math.round(uw * 0.55), oy, ox + Math.round(uw * 0.55), oy + uh, wallOpts);
    roughLine(canvas, ox, oy + Math.round(uh * 0.5), ox + Math.round(uw * 0.55), oy + Math.round(uh * 0.5), wallOpts);
    rooms = [
      { name:'客厅+餐厅', x:ox+Math.round(uw*0.58)+5, y:oy+Math.round(uh*0.4) },
      { name:'主卧', x:ox+10, y:oy+Math.round(uh*0.25) },
      { name:'次卧1', x:ox+10, y:oy+Math.round(uh*0.55)+10 },
      { name: layout==='3b2l'?'次卧2':'书房', x:ox+Math.round(uw*0.25)+5, y:oy+Math.round(uh*0.55)+10 },
      { name:'厨卫', x:ox+Math.round(uw*0.58)+5, y:oy+Math.round(uh*0.55)+10 }
    ];
  } else { // 4b2l
    roughLine(canvas, ox + Math.round(uw * 0.5), oy, ox + Math.round(uw * 0.5), oy + uh, wallOpts);
    roughLine(canvas, ox, oy + Math.round(uh * 0.5), ox + uw, oy + Math.round(uh * 0.5), wallOpts);
    roughLine(canvas, ox + Math.round(uw * 0.25), oy + Math.round(uh * 0.5), ox + Math.round(uw * 0.25), oy + uh, wallOpts);
    rooms = [
      { name:'客厅', x:ox+Math.round(uw*0.52)+5, y:oy+Math.round(uh*0.3) },
      { name:'主卧', x:ox+10, y:oy+Math.round(uh*0.25) },
      { name:'次卧1', x:ox+10, y:oy+Math.round(uh*0.55)+10 },
      { name:'次卧2', x:ox+Math.round(uw*0.27)+5, y:oy+Math.round(uh*0.55)+10 },
      { name:'厨卫', x:ox+Math.round(uw*0.52)+5, y:oy+Math.round(uh*0.55)+10 }
    ];
  }

  // 绘制风格化家具
  drawStyleDecor(canvas, ox, oy, uw, uh, theme, layout);

  // 房间标注
  ctx.fillStyle = theme.label;
  ctx.font = '13px Microsoft YaHei';
  for (var i = 0; i < rooms.length; i++) {
    ctx.fillText(rooms[i].name, rooms[i].x, rooms[i].y);
  }

  // 风格特征标注
  ctx.fillStyle = theme.accent;
  ctx.globalAlpha = 0.5;
  ctx.font = '11px Microsoft YaHei';
  var features = { modern:'简洁线条 | 中性色调', nordic:'原木暖色 | 绿植点缀', chinese:'深木色 | 屏风茶室', luxury:'大理石纹 | 金属线条' };
  ctx.fillText('风格特征：' + (features[document.getElementById('sketch-style').value] || ''), ox, oy + uh + 25);
  ctx.globalAlpha = 1;

  // 标题
  ctx.fillStyle = theme.label;
  ctx.font = 'bold 14px Microsoft YaHei';
  ctx.fillText(label + ' · 手绘草图', ox, oy - 12);
  // 水印
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  ctx.font = '56px Microsoft YaHei';
  ctx.fillText('示意图', canvas.width / 2 - 75, canvas.height / 2 + 20);
}

function downloadSketch() {
  var canvas = document.getElementById('sketch-canvas');
  if (!canvas) return;
  var link = document.createElement('a');
  link.download = '手绘草图_' + new Date().getTime() + '.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

// ========== 工具函数 ==========
function sleep(ms) {
  return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

function isThisWeek(dateStr) {
  if (!dateStr) return false;
  var d = new Date(dateStr);
  var now = new Date();
  var start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  start.setHours(0, 0, 0, 0);
  return d >= start;
}

function closeModal(id) {
  document.getElementById(id).classList.remove('show');
}

// ========== 初始化完成后绑定娜娜的草图链接 ==========
// 用事件委托处理动态生成的草图链接
document.addEventListener('click', function(e) {
  var target = e.target;
  if (!target || !target.getAttribute) return;
  var href = target.getAttribute('href') || '';
  if (href.indexOf('javascript') < 0) return;
  e.preventDefault();
  var text = target.textContent || '';
  // "查看详情+草图" → href 中直接带 openCaseDetail 调用
  if (text.indexOf('查看详情') >= 0) {
    var match = href.match(/openCaseDetail\(["'](\w+)["']\)/);
    if (match) { openCaseDetail(match[1]); }
    return;
  }
  // "生成手绘草图" → 打开草图弹窗
  if (text.indexOf('手绘') >= 0 || text.indexOf('草图') >= 0) {
    var style = '';
    var novaMsgs = document.querySelectorAll('.agent-response.nova .agent-resp-body');
    if (novaMsgs.length > 0) {
      var lastMsg = novaMsgs[novaMsgs.length - 1].textContent || '';
      if (lastMsg.indexOf('现代') >= 0) style = '现代简约';
      else if (lastMsg.indexOf('北欧') >= 0) style = '北欧';
      else if (lastMsg.indexOf('新中式') >= 0) style = '新中式';
      else if (lastMsg.indexOf('轻奢') >= 0) style = '轻奢';
    }
    openSketchModal(style);
  }
});

