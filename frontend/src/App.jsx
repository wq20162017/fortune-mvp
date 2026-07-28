import { useState } from 'react'

const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
const WUXING = { '甲': '木', '乙': '木', '丙': '火', '丁': '火', '戊': '土', '己': '土', '庚': '金', '辛': '金', '壬': '水', '癸': '水' }

function formatPillar(pillar) {
  if (!pillar || typeof pillar === 'string') return pillar || ''
  return `${pillar.stem}${pillar.branch}`
}

function WuxingBar({ wuxing }) {
  if (!wuxing) return null
  const total = Object.values(wuxing).reduce((s, v) => s + v, 0) || 1
  const colors = { 木: 'bg-green-500', 火: 'bg-red-500', 土: 'bg-yellow-600', 金: 'bg-gray-300', 水: 'bg-blue-500' }
  return (
    <div className="flex gap-1 items-end h-20 mt-2">
      {Object.entries(wuxing).map(([k, v]) => (
        <div key={k} className="flex flex-col items-center flex-1">
          <div className="text-xs mb-1">{k}: {v}</div>
          <div
            className={`w-full rounded-t ${colors[k]} opacity-80`}
            style={{ height: `${Math.max((v / total) * 70, 6)}px` }}
          />
        </div>
      ))}
    </div>
  )
}

function LoadingDots() {
  return (
    <div className="flex gap-2 justify-center py-4">
      {[0, 1, 2].map(i => (
        <div key={i} className="w-3 h-3 bg-amber-400 rounded-full animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </div>
  )
}

export default function App() {
  const [name, setName] = useState('')
  const [year, setYear] = useState('')
  const [month, setMonth] = useState('')
  const [day, setDay] = useState('')
  const [hour, setHour] = useState('')
  const [result, setResult] = useState(null)
  const [bazi, setBazi] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState(1) // 1=输入 2=结果

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!year || !month || !day) {
      setError('请填写完整的出生日期')
      return
    }
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/fortune', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name || '有缘人',
          year: Number(year),
          month: Number(month),
          day: Number(day),
          hour: hour ? Number(hour) : 12,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '请求失败')

      setBazi(data.bazi)
      setResult(data.result)
      setStep(2)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setStep(1)
    setResult(null)
    setBazi(null)
    setError('')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      {/* 标题 */}
      <div className="text-center mb-8">
        <div className="text-5xl mb-2">🔮</div>
        <h1 className="text-3xl font-bold text-amber-200 tracking-widest mb-1">AI 命理师</h1>
        <p className="text-amber-100/60 text-sm">AI 八字 · 情感运势 · 性格解读</p>
      </div>

      <div className="w-full max-w-md">

        {/* 步骤指示 */}
        {step === 1 && (
          <div className="flex justify-center gap-3 mb-6 text-sm">
            <span className="text-amber-300 font-bold">① 输入信息</span>
            <span className="text-amber-100/30">② 查看结果</span>
          </div>
        )}
        {step === 2 && (
          <div className="flex justify-center gap-3 mb-6 text-sm">
            <span className="text-amber-100/40">① 输入信息</span>
            <span className="text-amber-300 font-bold">② 查看结果</span>
          </div>
        )}

        {/* ── 第一步：输入 ── */}
        {step === 1 && (
          <div className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-amber-500/20 shadow-xl">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-amber-100/80 text-sm mb-1">你的名字（可选）</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="例如：张三"
                  className="w-full bg-white/10 border border-amber-500/30 rounded-lg px-4 py-2.5 text-white placeholder-white/30 outline-none focus:border-amber-400 transition"
                />
              </div>

              <div>
                <label className="block text-amber-100/80 text-sm mb-1">出生年份</label>
                <input
                  type="number"
                  value={year}
                  onChange={e => setYear(e.target.value)}
                  placeholder="例如：1995"
                  min="1900" max="2025"
                  className="w-full bg-white/10 border border-amber-500/30 rounded-lg px-4 py-2.5 text-white placeholder-white/30 outline-none focus:border-amber-400 transition"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-amber-100/80 text-sm mb-1">出生月份</label>
                  <input
                    type="number"
                    value={month}
                    onChange={e => setMonth(e.target.value)}
                    placeholder="1-12"
                    min="1" max="12"
                    className="w-full bg-white/10 border border-amber-500/30 rounded-lg px-4 py-2.5 text-white placeholder-white/30 outline-none focus:border-amber-400 transition"
                    required
                  />
                </div>
                <div>
                  <label className="block text-amber-100/80 text-sm mb-1">出生日期</label>
                  <input
                    type="number"
                    value={day}
                    onChange={e => setDay(e.target.value)}
                    placeholder="1-31"
                    min="1" max="31"
                    className="w-full bg-white/10 border border-amber-500/30 rounded-lg px-4 py-2.5 text-white placeholder-white/30 outline-none focus:border-amber-400 transition"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-amber-100/80 text-sm mb-1">
                  出生时辰（可选，默认午时 12点）
                </label>
                <input
                  type="number"
                  value={hour}
                  onChange={e => setHour(e.target.value)}
                  placeholder="0-23"
                  min="0" max="23"
                  className="w-full bg-white/10 border border-amber-500/30 rounded-lg px-4 py-2.5 text-white placeholder-white/30 outline-none focus:border-amber-400 transition"
                />
              </div>

              {error && (
                <div className="bg-red-500/20 border border-red-500/40 rounded-lg px-4 py-2 text-red-200 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-amber-900/40 mt-2"
              >
                {loading ? '命理师正在解读...' : '🚀 开始算命'}
              </button>
            </form>
          </div>
        )}

        {/* ── 第二步：结果 ── */}
        {step === 2 && result && (
          <div className="space-y-4">
            {/* 八字展示 */}
            {bazi && (
              <div className="bg-white/5 backdrop-blur rounded-2xl p-5 border border-amber-500/20 text-center">
                <div className="text-amber-100/60 text-xs mb-3">八字命盘</div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { label: '年柱', val: formatPillar(bazi.year), wx: bazi.year?.wuxing },
                    { label: '月柱', val: formatPillar(bazi.month), wx: bazi.month?.wuxing },
                    { label: '日柱', val: formatPillar(bazi.day), wx: bazi.day?.wuxing },
                    { label: '时柱', val: formatPillar(bazi.hour), wx: bazi.hour?.wuxing },
                  ].map(item => (
                    <div key={item.label} className="bg-white/5 rounded-xl p-2">
                      <div className="text-amber-100/40 text-xs">{item.label}</div>
                      <div className="text-amber-200 font-bold text-lg my-1">{item.val}</div>
                      <div className="text-amber-100/30 text-xs">{item.wx}</div>
                    </div>
                  ))}
                </div>
                {bazi.wuxing && <WuxingBar wuxing={bazi.wuxing} />}
              </div>
            )}

            {/* AI 解读结果 */}
            <div className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-amber-500/20">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">🧙</span>
                <span className="text-amber-200 font-bold">命理师解读</span>
              </div>
              <div className="text-amber-100/90 leading-relaxed whitespace-pre-wrap text-sm">
                {result.split('\n').map((line, i) => {
                  if (!line.trim()) return <br key={i} />
                  return <div key={i} className="mb-1">{line}</div>
                })}
              </div>
            </div>

            {/* 付费解锁区 */}
            <div className="bg-gradient-to-r from-purple-900/40 to-amber-900/40 rounded-2xl p-5 border border-purple-500/30 text-center">
              <div className="text-2xl mb-2">✨</div>
              <div className="text-amber-200 font-bold mb-1">解锁完整分析</div>
              <div className="text-amber-100/60 text-sm mb-4">
                包含：十年大运 · 详细流年 · 事业财运 · 婚恋建议<br />
                <span className="text-amber-300 text-lg font-bold">¥9.9</span>
              </div>
              <button
                className="w-full bg-gradient-to-r from-purple-600 to-amber-600 hover:from-purple-500 hover:to-amber-500 text-white font-bold py-3 rounded-xl transition shadow-lg"
              >
                🔒 付费解锁详细版
              </button>
              <div className="text-amber-100/30 text-xs mt-2">即将支持微信支付</div>
            </div>

            <button
              onClick={handleReset}
              className="w-full text-amber-100/40 hover:text-amber-200 py-2 text-sm transition"
            >
              ← 重新算命
            </button>
          </div>
        )}
      </div>

      <div className="mt-8 text-amber-100/20 text-xs text-center">
        仅供娱乐参考 · 命运掌握在自己手中
      </div>
    </div>
  )
}
