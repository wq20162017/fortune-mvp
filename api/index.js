/**
 * Vercel Serverless API — 主路由入口
 * 通过 vercel.json rewrites，所有 /api/* 请求都透明转发到这里
 * handler 收到的 req.url 为原始请求路径
 */

const crypto = require('crypto');
const { getBaZi } = require('./bazi');
const store = require('./store');

// ── 环境变量 ──
const API_KEY = process.env.DEEPSEEK_API_KEY || '';
const API_URL = process.env.DEEPSEEK_API_URL || 'https://api.siliconflow.cn/v1/chat/completions';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'admin123';
const PRICE = 990;
// 默认用 SiliconFlow 免费档模型（限速内免费、不消耗付费额度）；
// 可通过 LLM_MODEL 环境变量切换其它免费模型，如 Qwen/Qwen2-7B-Instruct / THUDM/glm-4-9b-chat
const LLM_MODEL = process.env.LLM_MODEL || 'Qwen/Qwen2.5-7B-Instruct';

// ── 工具 ──
function createOrderId() {
  return 'FD' + Date.now().toString(36).toUpperCase() + crypto.randomBytes(3).toString('hex').toUpperCase();
}

function getBazi(year, month, day, hour) {
  return getBaZi(Number(year), Number(month), Number(day), Number(hour));
}

// ── JSON 工具 ──
function json(res, data, status) {
  res.writeHead(status || 200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); } catch (e) { resolve({}); }
    });
  });
}

// ── AI 解读 ──
const PERSONALITIES = {
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

// ── AI 调用层 ──
// 优先级：配了 DEEPSEEK_API_KEY → SiliconFlow/DeepSeek（OpenAI 兼容）；
// 没配 → Pollinations 免费、免 key（https://text.pollinations.ai/openai）；
// 两者都失败 → 调用方走本地 mock。永远有兜底，绝不空响应。
const POLLINATIONS_URL = 'https://text.pollinations.ai/openai';
const POLLINATIONS_MODEL = 'openai-fast';

function withTimeout(ms) {
  return typeof AbortSignal !== 'undefined' && AbortSignal.timeout
    ? AbortSignal.timeout(ms) : undefined;
}

async function callLLM(messages, maxTokens = 400) {
  // 1) 配了 key → SiliconFlow / DeepSeek
  if (API_KEY) {
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: LLM_MODEL, messages, temperature: 0.7, max_tokens: maxTokens }),
      });
      if (res.ok) {
        const data = await res.json();
        const c = data.choices?.[0]?.message?.content;
        if (c) return c;
      }
    } catch (e) { /* fall through */ }
  }
  // 2) 免费免 key → Pollinations（OpenAI 兼容端点）
  try {
    const res = await fetch(POLLINATIONS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: POLLINATIONS_MODEL, messages, temperature: 0.7, max_tokens: maxTokens }),
      signal: withTimeout(20000),
    });
    if (res.ok) {
      const text = await res.text();
      try {
        const j = JSON.parse(text);
        const c = j.choices?.[0]?.message?.content;
        if (c) return c;
      } catch { /* 非标准 JSON，当纯文本 */ }
      if (text && text.trim() && !text.trim().startsWith('{')) return text.trim();
    }
  } catch (e) { /* fall through */ }
  // 3) 全失败
  return null;
}

async function askAI(bazi, userName) {
  const prompt = `你是有20年经验的命理师。用户${userName || '匿名'}。八字：年${bazi.year.stem}${bazi.year.branch} 月${bazi.month.stem}${bazi.month.branch} 日${bazi.day.stem}${bazi.day.branch} 时${bazi.hour.stem}${bazi.hour.branch}，五行${JSON.stringify(bazi.wuxing)}。分析：1.性格（30字）2.近期情感（60字）3.建议（20字）。语气温暖睿智，用简体中文。`;
  const content = await callLLM([{ role: 'user', content: prompt }]);
  return content || generateMockResult(bazi, userName);
}

async function askAIDetail(bazi, userName, section) {
  const prompts = {
    career: `你是资深命理师。根据${userName}的八字（日主${bazi.day.stem}，五行${JSON.stringify(bazi.wuxing)}），150字内分析事业运势，简体中文。`,
    wealth: `你是资深命理师。根据${userName}的八字（日主${bazi.day.stem}，五行${JSON.stringify(bazi.wuxing)}），120字内分析财运，简体中文。`,
    love: `你是资深命理师。根据${userName}的八字（日主${bazi.day.stem}，五行${JSON.stringify(bazi.wuxing)}），120字内分析感情运势，简体中文。`,
    health: `你是资深命理师。根据${userName}的八字（日主${bazi.day.stem}，五行${JSON.stringify(bazi.wuxing)}），100字内给出健康建议，简体中文。`,
    overall: `你是资深命理师。根据${userName}的八字（日主${bazi.day.stem}，五行${JSON.stringify(bazi.wuxing)}），80字内总结命理要点，简体中文。`,
  };
  const prompt = prompts[section];
  if (!prompt) return null;
  const content = await callLLM([{ role: 'user', content: prompt }]);
  return content || null;
}

function generateMockResult(bazi, userName) {
  const stem = bazi.day.stem;
  const name = userName || '你';
  const personality = PERSONALITIES[stem] || '性格独特，富有魅力';
  const love = ['甲','丙','戊'].includes(stem) ? '近期桃花运不错，容易遇到有缘人，适合主动出击'
    : ['乙','丁','癸'].includes(stem) ? '近期感情运势平缓，适合沉淀自我，有缘分会自然出现'
    : '近期适合多参加社交活动，扩展圈子，机会在人际交往中';
  const advice = ['甲','庚'].includes(stem) ? '多倾听，少冲动' : '保持初心，顺其自然';
  return `【${name}的命理分析】\n\n🌟 性格特点：\n${personality}\n\n💕 近期情感运势：\n${love}\n\n✨ 命理建议：\n${advice}\n\n—— 以上为免费基础版 · 付费解锁详细分析 ——`;
}

// ── 路由匹配 ──
function matchRoute(url, pattern) {
  const paramNames = [];
  const regexStr = pattern.replace(/:([^/]+)/g, (_, name) => {
    paramNames.push(name);
    return '([^/]+)';
  });
  const regex = new RegExp('^' + regexStr + '$');
  const match = url.match(regex);
  if (!match) return null;
  const params = {};
  paramNames.forEach((name, i) => { params[name] = match[i + 1]; });
  return params;
}

// ── 主处理函数 ──
module.exports = async function handler(req, res) {
  // 去掉 query string
  const url = req.url.split('?')[0];
  const method = req.method;

  try {
    // ---- GET /api/health ----
    if (method === 'GET' && url === '/api/health') {
      return json(res, { status: 'ok', storageMode: store.getStorageMode(), redisConfigured: store.REDIS_ENABLED, aiMode: API_KEY ? 'siliconflow' : 'pollinations-free(fallback)', llmModel: LLM_MODEL, apiKeyConfigured: !!API_KEY, price: PRICE, orderCount: await store.countOrders() });
    }

    // ---- GET /api/ai-probe ---- (诊断：实测当前 AI 链路是否能出文本)
    if (method === 'GET' && url === '/api/ai-probe') {
      const t0 = Date.now();
      try {
        const content = await callLLM([{ role: 'user', content: '用一句话（15字内）祝我好运，简体中文。' }], 60);
        return json(res, { ok: !!content, aiSource: API_KEY ? 'siliconflow' : (content ? 'pollinations' : 'mock-or-failed'), llmModel: LLM_MODEL, latencyMs: Date.now() - t0, preview: content ? content.slice(0, 120) : null });
      } catch (e) {
        return json(res, { ok: false, aiSource: 'error', latencyMs: Date.now() - t0, error: e.message }, 500);
      }
    }

    // ---- POST /api/fortune ----
    if (method === 'POST' && url === '/api/fortune') {
      const body = await readBody(req);
      const { name, year, month, day, hour } = body;
      if (!year || !month || !day) return json(res, { error: '请提供完整的出生日期' }, 400);
      const bazi = getBazi(year, month, day, hour || 12);
      const result = await askAI(bazi, name);
      return json(res, { bazi, result });
    }

    // ---- POST /api/order/create ----
    if (method === 'POST' && url === '/api/order/create') {
      const body = await readBody(req);
      const { name, year, month, day, hour } = body;
      if (!year || !month || !day) return json(res, { error: '请提供完整的出生日期' }, 400);
      const orderId = createOrderId();
      const now = new Date().toISOString();
      const order = {
        orderId, name: name || '匿名用户', year, month, day, hour: hour || 12,
        amount: PRICE, status: 'pending', createdAt: now, paidAt: null, verifyMode: 'manual',
      };
      await store.setOrder(order);
      return json(res, { orderId, amount: PRICE, status: 'pending', verifyMode: 'manual', createdAt: now });
    }

    // ---- GET /api/order/status/:orderId ----
    let params = matchRoute(url, '/api/order/status/:orderId');
    if (method === 'GET' && params) {
      const order = await store.getOrder(params.orderId);
      if (!order) return json(res, { error: '订单不存在' }, 404);
      return json(res, { orderId: order.orderId, status: order.status, amount: order.amount, paidAt: order.paidAt, verifyMode: order.verifyMode });
    }

    // ---- POST /api/order/verify/:orderId ----
    params = matchRoute(url, '/api/order/verify/:orderId');
    if (method === 'POST' && params) {
      const order = await store.getOrder(params.orderId);
      if (!order) return json(res, { error: '订单不存在' }, 404);
      if (order.status === 'paid') return json(res, { status: 'paid', message: '订单已支付' });
      return json(res, { status: 'pending', message: '手动验证模式：付款后请联系客服确认' });
    }

    // ---- POST /api/order/manual-verify/:orderId ----
    params = matchRoute(url, '/api/order/manual-verify/:orderId');
    if (method === 'POST' && params) {
      const body = await readBody(req);
      if (body.secret !== ADMIN_SECRET) return json(res, { error: '密钥错误' }, 403);
      const order = await store.getOrder(params.orderId);
      if (!order) return json(res, { error: '订单不存在' }, 404);
      const updated = await store.updateOrder(params.orderId, { status: 'paid', paidAt: new Date().toISOString() });
      return json(res, { status: 'paid', message: '手动确认成功', orderId: updated.orderId, paidAt: updated.paidAt });
    }

    // ---- GET /api/admin/orders ----
    if (method === 'GET' && url.startsWith('/api/admin/orders')) {
      const queryStr = req.url.includes('?') ? req.url.split('?')[1] : '';
      const query = queryStr ? Object.fromEntries(new URLSearchParams(queryStr)) : {};
      if (query.secret !== ADMIN_SECRET) return json(res, { error: '密钥错误' }, 403);
      const list = await store.listOrders();
      return json(res, { orders: list, total: list.length, storageMode: store.getStorageMode() });
    }

    // ---- POST /api/fortune/detail ----
    if (method === 'POST' && url === '/api/fortune/detail') {
      const body = await readBody(req);
      const { orderId, name, year, month, day, hour } = body;
      if (!orderId) return json(res, { error: '缺少订单ID' }, 400);
      const order = await store.getOrder(orderId);
      if (!order) return json(res, { error: '订单不存在' }, 404);
      if (order.status !== 'paid') return json(res, { error: '请先完成支付', status: 'pending' }, 402);
      const bazi = getBazi(year, month, day, hour || 12);
      const [aiCareer, aiWealth, aiLove, aiHealth, aiOverall] = await Promise.all([
        askAIDetail(bazi, name, 'career'), askAIDetail(bazi, name, 'wealth'),
        askAIDetail(bazi, name, 'love'), askAIDetail(bazi, name, 'health'), askAIDetail(bazi, name, 'overall'),
      ]);
      return json(res, { bazi, ai: { career: aiCareer, wealth: aiWealth, love: aiLove, health: aiHealth, overall: aiOverall }, orderId });
    }

    // ---- GET /api/fortune/detail/:orderId ----
    params = matchRoute(url, '/api/fortune/detail/:orderId');
    if (method === 'GET' && params) {
      const order = await store.getOrder(params.orderId);
      if (!order || order.status !== 'paid') return json(res, { error: '订单不存在或未支付' }, 404);
      const bazi = getBazi(order.year, order.month, order.day, order.hour);
      return json(res, { bazi, order: { name: order.name, year: order.year, month: order.month, day: order.day, hour: order.hour } });
    }

    // ---- 404 ----
    return json(res, { error: '接口不存在: ' + method + ' ' + url }, 404);
  } catch (err) {
    console.error('API Error:', err);
    return json(res, { error: err.message || '服务器内部错误' }, 500);
  }
};
