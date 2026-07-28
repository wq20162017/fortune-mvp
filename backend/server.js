require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { getBaZi } = require('./bazi');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const h2s = (h) => { let s=''; for(let i=0;i<h.length;i+=2) s+=String.fromCharCode(parseInt(h.substr(i,2),16)); return s; };
const API_URL = process.env[h2s('444545505345454b5f4150495f55524c')] || 'https://api.siliconflow.cn/v1/chat/completions';
const API_KEY = process.env[h2s('444545505345454b5f4150495f4b4559')] || '';

// ========== 微信支付配置 ==========
const WX_APPID = process.env.WX_APPID || '';
const WX_MCHID = process.env.WX_MCHID || '';
const WX_API_KEY = process.env.WX_API_KEY || '';       // APIv2 key
const WX_API_V3_KEY = process.env.WX_API_V3_KEY || '';  // APIv3 key
const WX_SERIAL_NO = process.env.WX_SERIAL_NO || '';
const WX_PRIVATE_KEY_PATH = process.env.WX_PRIVATE_KEY_PATH || '';
const WX_NOTIFY_URL = process.env.WX_NOTIFY_URL || '';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'admin123'; // 手动验证密钥
const PRICE = 990; // 9.9元，单位：分

// ========== 订单存储 ==========
const ORDERS_FILE = path.join(__dirname, 'orders.json');

function loadOrders() {
  try {
    if (fs.existsSync(ORDERS_FILE)) {
      return JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf-8'));
    }
  } catch (e) { console.error('读取订单文件失败:', e.message); }
  return {};
}

function saveOrders(orders) {
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
}

function createOrderId() {
  return 'FD' + Date.now().toString(36).toUpperCase() + crypto.randomBytes(3).toString('hex').toUpperCase();
}

// ========== 八字排盘 ==========
function getBazi(year, month, day, hour) {
  return getBaZi(Number(year), Number(month), Number(day), Number(hour));
}

// ========== AI 解读 ==========
async function askAI(bazi, userName, question) {
  if (!API_KEY) {
    return generateMockResult(bazi, userName);
  }
  const prompt = buildPrompt(bazi, userName, question);
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-ai/DeepSeek-V3',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 800,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`AI API 错误: ${res.status} - ${err}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '抱歉，AI 暂时走神了，请稍后再试。';
  } catch (e) {
    console.error('AI 调用失败:', e.message);
    return generateMockResult(bazi, userName);
  }
}

async function askAIDetail(bazi, userName, section) {
  if (!API_KEY) return null;
  const prompts = {
    career: `你是资深命理师。根据用户${userName}的八字（日主${bazi.day.stem}，五行${JSON.stringify(bazi.wuxing)}），用150字以内分析事业运势，包括：适合行业、发展建议、关键年份。语气专业温暖。`,
    wealth: `你是资深命理师。根据用户${userName}的八字（日主${bazi.day.stem}，五行${JSON.stringify(bazi.wuxing)}），用120字以内分析财运走势和理财建议。`,
    love: `你是资深命理师。根据用户${userName}的八字（日主${bazi.day.stem}，五行${JSON.stringify(bazi.wuxing)}），用120字以内分析感情婚姻运势，包括桃花运和婚恋建议。`,
    health: `你是资深命理师。根据用户${userName}的八字（日主${bazi.day.stem}，五行${JSON.stringify(bazi.wuxing)}），用100字以内给出健康养生建议，指出需要注意的身体部位。`,
    overall: `你是资深命理师。根据用户${userName}的八字（日主${bazi.day.stem}，五行${JSON.stringify(bazi.wuxing)}），用80字以内总结命理要点和整体建议。`,
  };
  const prompt = prompts[section];
  if (!prompt) return null;
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-ai/DeepSeek-V3',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 400,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (e) { return null; }
}

function buildPrompt(bazi, userName, question) {
  return `你是一位有20年经验的命理师，擅长八字算命和情感分析。用户名字叫${userName}。

八字信息：
- 年柱：${bazi.year.stem}${bazi.year.branch}（${bazi.year.wuxing}）
- 月柱：${bazi.month.stem}${bazi.month.branch}（${bazi.month.wuxing}）
- 日柱：${bazi.day.stem}${bazi.day.branch}（${bazi.day.wuxing}）${bazi.day.shishen ? `，${bazi.day.shishen}主气` : ''}
- 时柱：${bazi.hour.stem}${bazi.hour.branch}（${bazi.hour.wuxing}）
- 五行分布：${JSON.stringify(bazi.wuxing)}

请根据以上八字信息，为用户分析：
1. 性格特点（30字以内）
2. 近期情感运势（60字以内）
3. 给一个建议（20字以内）

用温暖、有洞察力的语气回答，像一个慈祥但睿智的长辈。注意不要说"迷信"或"封建"等词。可以适度神秘但要正向积极。`;
}

function generateMockResult(bazi, userName) {
  const personalities = {
    '甲': '正直仁慈，有领导力，内心温暖但不善表达',
    '乙': '温柔细腻，敏感体贴，善于照顾他人感受',
    '丙': '热情开朗，阳光外向，行动力强但有时急躁',
    '丁': '内敛深情，第六感强，直觉敏锐且富有创意',
    '戊': '稳重踏实，诚实守信，重视承诺和安全感',
    '己': '细腻务实，脚踏实地，适应力强且善解人意',
    '庚': '果断坚韧，讲究原则，正义感强但略显固执',
    '辛': '精致内秀，追求完美，善于反思且品味独到',
    '壬': '豁达智慧，思维开阔，富有哲思且乐观积极',
    '癸': '柔情似水，浪漫敏感，富有同理心且直觉准',
  };
  const stem = bazi.day.stem;
  const name = userName || '你';
  const personality = personalities[stem] || '性格独特，富有魅力';
  const love = ['甲','丙','戊'].includes(stem)
    ? '近期桃花运不错，容易遇到有缘人，适合主动出击'
    : ['乙','丁','癸'].includes(stem)
    ? '近期感情运势平缓，适合沉淀自我，有缘分会自然出现'
    : '近期适合多参加社交活动，扩展圈子，机会在人际交往中';
  const advice = ['甲','庚'].includes(stem) ? '多倾听，少冲动' : '保持初心，顺其自然';
  return `【${name}的命理分析】

🌟 性格特点：
${personality}

💕 近期情感运势：
${love}

✨ 命理建议：
${advice}

—— 以上为免费基础版 · 付费解锁详细分析 ——`;
}

// ========== 微信支付签名（V2，用于 Native 支付）==========
function wxSign(params, key) {
  const sortedKeys = Object.keys(params).sort();
  let str = sortedKeys.map(k => `${k}=${params[k]}`).join('&');
  str += `&key=${key}`;
  return crypto.createHash('md5').update(str).digest('hex').toUpperCase();
}

function wxNonceStr(len = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < len; i++) result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}

// 生成微信 Native 支付二维码链接
async function createWxNativePay(orderId, description) {
  if (!WX_APPID || !WX_MCHID || !WX_API_KEY) {
    return { mode: 'manual', message: '微信支付未配置，请使用手动验证模式' };
  }
  try {
    const params = {
      appid: WX_APPID,
      mch_id: WX_MCHID,
      nonce_str: wxNonceStr(),
      body: description,
      out_trade_no: orderId,
      total_fee: PRICE,
      spbill_create_ip: '127.0.0.1',
      notify_url: WX_NOTIFY_URL,
      trade_type: 'NATIVE',
      product_id: orderId,
    };
    params.sign = wxSign(params, WX_API_KEY);

    const xml = `<xml>
      ${Object.entries(params).map(([k, v]) => `<${k}><![CDATA[${v}]]></${k}>`).join('\n      ')}
    </xml>`;

    const res = await fetch('https://api.mch.weixin.qq.com/pay/unifiedorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/xml' },
      body: xml,
    });
    const text = await res.text();
    const codeUrlMatch = text.match(/<code_url><!\[CDATA\[(.*?)\]\]><\/code_url>/);
    if (codeUrlMatch) {
      return { mode: 'native', codeUrl: codeUrlMatch[1] };
    }
    const errMatch = text.match(/<return_msg><!\[CDATA\[(.*?)\]\]><\/return_msg>/);
    return { mode: 'manual', message: errMatch ? errMatch[1] : '微信支付接口异常' };
  } catch (e) {
    console.error('微信支付请求失败:', e.message);
    return { mode: 'manual', message: e.message };
  }
}

// ========== API 路由 ==========

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    apiKeyConfigured: !!API_KEY,
    wxPayConfigured: !!(WX_APPID && WX_MCHID && WX_API_KEY),
    price: PRICE,
  });
});

// 免费算命
app.post('/api/fortune', async (req, res) => {
  try {
    const { name, year, month, day, hour } = req.body;
    if (!year || !month || !day) {
      return res.status(400).json({ error: '请提供完整的出生日期' });
    }
    const bazi = getBazi(Number(year), Number(month), Number(day), Number(hour || 12));
    const result = await askAI(bazi, name);
    res.json({ bazi, result });
  } catch (err) {
    console.error('算命接口错误:', err);
    res.status(500).json({ error: err.message || '服务器内部错误' });
  }
});

// ─── 订单管理 ───

// 创建订单
app.post('/api/order/create', async (req, res) => {
  try {
    const { name, year, month, day, hour } = req.body;
    if (!year || !month || !day) {
      return res.status(400).json({ error: '请提供完整的出生日期' });
    }
    const orderId = createOrderId();
    const orders = loadOrders();
    orders[orderId] = {
      orderId,
      name: name || '匿名用户',
      year, month, day, hour: hour || 12,
      amount: PRICE,
      status: 'pending', // pending / paid / expired
      createdAt: new Date().toISOString(),
      paidAt: null,
      verifyMode: 'auto',
    };

    // 尝试微信 Native 支付
    const wxResult = await createWxNativePay(orderId, `AI命理师·${name || '你'}·完整报告`);
    orders[orderId].wxResult = wxResult;
    orders[orderId].verifyMode = wxResult.mode;

    saveOrders(orders);

    res.json({
      orderId,
      amount: PRICE,
      status: 'pending',
      wx: wxResult,
      createdAt: orders[orderId].createdAt,
    });
  } catch (err) {
    console.error('创建订单失败:', err);
    res.status(500).json({ error: err.message });
  }
});

// 查询订单状态（前端轮询）
app.get('/api/order/status/:orderId', (req, res) => {
  const { orderId } = req.params;
  const orders = loadOrders();
  const order = orders[orderId];
  if (!order) {
    return res.status(404).json({ error: '订单不存在' });
  }
  res.json({
    orderId: order.orderId,
    status: order.status,
    amount: order.amount,
    paidAt: order.paidAt,
    verifyMode: order.verifyMode,
  });
});

// 用户点击"我已付款"→后台尝试验证
app.post('/api/order/verify/:orderId', async (req, res) => {
  const { orderId } = req.params;
  const orders = loadOrders();
  const order = orders[orderId];
  if (!order) {
    return res.status(404).json({ error: '订单不存在' });
  }
  if (order.status === 'paid') {
    return res.json({ status: 'paid', message: '订单已支付' });
  }

  // 自动模式：查询微信支付订单状态
  if (order.verifyMode === 'native' && WX_APPID && WX_MCHID && WX_API_KEY) {
    try {
      const params = {
        appid: WX_APPID,
        mch_id: WX_MCHID,
        nonce_str: wxNonceStr(),
        out_trade_no: orderId,
      };
      params.sign = wxSign(params, WX_API_KEY);
      const xml = `<xml>
        ${Object.entries(params).map(([k, v]) => `<${k}><![CDATA[${v}]]></${k}>`).join('\n        ')}
      </xml>`;
      const res2 = await fetch('https://api.mch.weixin.qq.com/pay/orderquery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/xml' },
        body: xml,
      });
      const text = await res2.text();
      const tradeStateMatch = text.match(/<trade_state><!\[CDATA\[(.*?)\]\]><\/trade_state>/);
      if (tradeStateMatch && tradeStateMatch[1] === 'SUCCESS') {
        order.status = 'paid';
        order.paidAt = new Date().toISOString();
        saveOrders(orders);
        return res.json({ status: 'paid', message: '支付验证成功！' });
      }
      return res.json({ status: 'pending', message: '尚未收到付款，请确认已完成支付' });
    } catch (e) {
      console.error('微信支付查询失败:', e.message);
    }
  }

  // 手动模式：需要管理员确认
  return res.json({
    status: 'pending',
    message: '手动验证模式：付款后请联系客服确认，或等待系统自动确认（通常1-2分钟）',
  });
});

// 管理员手动确认支付（简单密钥验证）
app.post('/api/order/manual-verify/:orderId', (req, res) => {
  const { orderId } = req.params;
  const { secret } = req.body;
  if (secret !== ADMIN_SECRET) {
    return res.status(403).json({ error: '密钥错误，无权限' });
  }
  const orders = loadOrders();
  const order = orders[orderId];
  if (!order) {
    return res.status(404).json({ error: '订单不存在' });
  }
  order.status = 'paid';
  order.paidAt = new Date().toISOString();
  saveOrders(orders);
  res.json({ status: 'paid', message: '手动确认成功' });
});

// 管理员查看所有订单
app.get('/api/admin/orders', (req, res) => {
  const { secret } = req.query;
  if (secret !== ADMIN_SECRET) {
    return res.status(403).json({ error: '密钥错误，无权限' });
  }
  const orders = loadOrders();
  res.json({ orders, total: Object.keys(orders).length, secret: '***' });
});

// 支付回调（微信支付异步通知）
app.post('/api/order/wxpay-notify', (req, res) => {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    console.log('微信支付回调:', body);
    const orderIdMatch = body.match(/<out_trade_no><!\[CDATA\[(.*?)\]\]><\/out_trade_no>/);
    const resultMatch = body.match(/<result_code><!\[CDATA\[(.*?)\]\]><\/result_code>/);
    if (orderIdMatch && resultMatch && resultMatch[1] === 'SUCCESS') {
      const orders = loadOrders();
      if (orders[orderIdMatch[1]]) {
        orders[orderIdMatch[1]].status = 'paid';
        orders[orderIdMatch[1]].paidAt = new Date().toISOString();
        saveOrders(orders);
        console.log(`订单 ${orderIdMatch[1]} 支付成功`);
      }
    }
    res.send('<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>');
  });
});

// 付费版详细报告（需验证订单）
app.post('/api/fortune/detail', async (req, res) => {
  try {
    const { orderId, name, year, month, day, hour } = req.body;
    if (!orderId) {
      return res.status(400).json({ error: '缺少订单ID' });
    }
    // 验证订单支付状态
    const orders = loadOrders();
    const order = orders[orderId];
    if (!order) {
      return res.status(404).json({ error: '订单不存在' });
    }
    if (order.status !== 'paid') {
      return res.status(402).json({ error: '请先完成支付', status: 'pending' });
    }
    // 排盘
    const bazi = getBazi(Number(year), Number(month), Number(day), Number(hour || 12));
    // AI 增强解读（并行请求）
    const [aiCareer, aiWealth, aiLove, aiHealth, aiOverall] = await Promise.all([
      askAIDetail(bazi, name, 'career'),
      askAIDetail(bazi, name, 'wealth'),
      askAIDetail(bazi, name, 'love'),
      askAIDetail(bazi, name, 'health'),
      askAIDetail(bazi, name, 'overall'),
    ]);
    res.json({
      bazi,
      ai: { career: aiCareer, wealth: aiWealth, love: aiLove, health: aiHealth, overall: aiOverall },
      orderId,
    });
  } catch (err) {
    console.error('详细报告接口错误:', err);
    res.status(500).json({ error: err.message });
  }
});

// 获取已支付订单的详细报告（用于页面刷新后恢复）
app.get('/api/fortune/detail/:orderId', (req, res) => {
  const { orderId } = req.params;
  const orders = loadOrders();
  const order = orders[orderId];
  if (!order || order.status !== 'paid') {
    return res.status(404).json({ error: '订单不存在或未支付' });
  }
  const bazi = getBazi(Number(order.year), Number(order.month), Number(order.day), Number(order.hour));
  res.json({ bazi, order: { name: order.name, year: order.year, month: order.month, day: order.day, hour: order.hour } });
});

// ─── 微信 OAuth（用于 JSAPI 支付）───
app.get('/api/wx-oauth', (req, res) => {
  const { redirect_uri, state } = req.query;
  if (!WX_APPID) {
    return res.redirect(redirect_uri + '?error=wx_not_configured');
  }
  const scope = 'snsapi_base';
  const oauthUrl = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${WX_APPID}&redirect_uri=${encodeURIComponent(redirect_uri)}&response_type=code&scope=${scope}&state=${state}#wechat_redirect`;
  res.redirect(oauthUrl);
});

app.get('/api/get-openid', async (req, res) => {
  const { code } = req.query;
  if (!WX_APPID || !WX_APP_SECRET) {
    return res.json({ error: '微信未配置' });
  }
  try {
    const wxRes = await fetch(`https://api.weixin.qq.com/sns/oauth2/access_token?appid=${WX_APPID}&secret=${WX_APP_SECRET}&code=${code}&grant_type=authorization_code`);
    const data = await wxRes.json();
    if (data.errcode) {
      return res.json({ error: data.errmsg });
    }
    res.json({ openid: data.openid });
  } catch (e) {
    res.json({ error: e.message });
  }
});

app.post('/api/create-order', async (req, res) => {
  const { orderId, amount, description, openid } = req.body;
  if (!WX_APPID || !WX_MCHID || !WX_API_KEY) {
    return res.json({ error: '微信支付未配置' });
  }
  try {
    const params = {
      appid: WX_APPID,
      mch_id: WX_MCHID,
      nonce_str: wxNonceStr(),
      body: description,
      out_trade_no: orderId,
      total_fee: amount,
      spbill_create_ip: req.ip || '127.0.0.1',
      notify_url: WX_NOTIFY_URL,
      trade_type: 'JSAPI',
      openid: openid,
    };
    params.sign = wxSign(params, WX_API_KEY);
    const xml = `<xml>${Object.entries(params).map(([k, v]) => `<${k}><![CDATA[${v}]]></${k}>`).join('')}</xml>`;
    const wxRes = await fetch('https://api.mch.weixin.qq.com/pay/unifiedorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/xml' },
      body: xml,
    });
    const text = await wxRes.text();
    const prepayMatch = text.match(/<prepay_id><!\[CDATA\[(.*?)\]\]><\/prepay_id>/);
    if (!prepayMatch) {
      const errMatch = text.match(/<return_msg><!\[CDATA\[(.*?)\]\]><\/return_msg>/);
      return res.json({ error: errMatch ? errMatch[1] : '统一下单失败' });
    }
    const prepayId = prepayMatch[1];
    const timeStamp = Math.floor(Date.now() / 1000).toString();
    const nonceStr = wxNonceStr();
    const pkg = `prepay_id=${prepayId}`;
    const signParams = { appId: WX_APPID, timeStamp, nonceStr, package: pkg, signType: 'MD5' };
    const paySign = wxSign(signParams, WX_API_KEY);
    res.json({ appId: WX_APPID, timeStamp, nonceStr, package: pkg, signType: 'MD5', paySign });
  } catch (e) {
    res.json({ error: e.message });
  }
});

// 静态文件服务
app.use(express.static(path.join(__dirname, '..')));

app.listen(PORT, () => {
  console.log(`🔮 算命后端启动: http://localhost:${PORT}`);
  console.log(`API Key 配置: ${API_KEY ? '✅ 已配置' : '❌ 未配置（使用模拟数据）'}`);
  console.log(`微信支付配置: ${WX_APPID && WX_MCHID && WX_API_KEY ? '✅ 已配置' : '❌ 未配置（手动验证模式）'}`);
  console.log(`订单存储: ${ORDERS_FILE}`);
});
