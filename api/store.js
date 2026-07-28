/**
 * 订单存储层 — Upstash Redis (生产) / 内存 Map (fallback)
 *
 * 通过环境变量启用 Redis：
 *   UPSTASH_REDIS_REST_URL    例 https://us1-xxx-xxx.upstash.io
 *   UPSTASH_REDIS_REST_TOKEN  例 2553feg6a2d9842h2a0gcdb5f8efe9934
 *
 * 未配置时自动 fallback 到进程内存 Map（本地开发可用；
 * 生产环境 Vercel 多实例/冷启动会丢订单，请务必配置 Upstash）。
 *
 * 用原生 fetch 调 Upstash REST API，不引入任何 npm 依赖，
 * 兼容当前 Vercel legacy builds 模式。
 */

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || '';
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';
const REDIS_ENABLED = !!(REDIS_URL && REDIS_TOKEN);
const HASH_KEY = 'fortune:orders';

// 内存 fallback（仅本地/未配 Redis 时；生产环境冷启动会丢）
const memOrders = new Map();

function getStorageMode() {
  return REDIS_ENABLED ? 'redis' : 'memory';
}

// ── Upstash REST 调用 ──
// body 为 JSON 数组：["CMD", "arg1", "arg2", ...]
// 返回 data.result（成功）或抛出 data.error（失败）
async function redisCmd(...args) {
  const res = await fetch(REDIS_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Redis HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  if (data && data.error) throw new Error(`Redis error: ${data.error}`);
  return data ? data.result : null;
}

// ── 统一接口（async）──
async function getOrder(id) {
  if (REDIS_ENABLED) {
    const val = await redisCmd('HGET', HASH_KEY, id);
    if (!val) return null;
    try { return JSON.parse(val); } catch { return null; }
  }
  return memOrders.get(id) || null;
}

async function setOrder(order) {
  if (!order || !order.orderId) throw new Error('setOrder: 缺少 orderId');
  if (REDIS_ENABLED) {
    await redisCmd('HSET', HASH_KEY, order.orderId, JSON.stringify(order));
    return;
  }
  memOrders.set(order.orderId, order);
}

// 读取并合并 patch 后整体写回（Redis 无原地 mutate）
async function updateOrder(id, patch) {
  const cur = await getOrder(id);
  if (!cur) return null;
  const updated = { ...cur, ...patch };
  await setOrder(updated);
  return updated;
}

async function listOrders() {
  let list;
  if (REDIS_ENABLED) {
    const arr = await redisCmd('HGETALL', HASH_KEY);
    list = [];
    if (Array.isArray(arr)) {
      // HGETALL 返回扁平数组 [field1, value1, field2, value2, ...]
      for (let i = 0; i < arr.length; i += 2) {
        try { list.push(JSON.parse(arr[i + 1])); } catch {}
      }
    }
  } else {
    list = Array.from(memOrders.values());
  }
  return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

async function countOrders() {
  if (REDIS_ENABLED) {
    const n = await redisCmd('HLEN', HASH_KEY);
    return typeof n === 'number' ? n : 0;
  }
  return memOrders.size;
}

async function deleteOrder(id) {
  if (REDIS_ENABLED) {
    await redisCmd('HDEL', HASH_KEY, id);
    return;
  }
  memOrders.delete(id);
}

module.exports = {
  getStorageMode,
  REDIS_ENABLED,
  getOrder,
  setOrder,
  updateOrder,
  listOrders,
  countOrders,
  deleteOrder,
};
