/**
 * 纯 JS 八字排盘算法
 * 参考农历置闰法 + 天干地支推导
 */

const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
const WUXING_STEM = ['木', '木', '火', '火', '土', '土', '金', '金', '水', '水']
const WUXING_BRANCH = {
  '子': '水', '丑': '土', '寅': '木', '卯': '木',
  '辰': '土', '巳': '火', '午': '火', '未': '土',
  '申': '金', '酉': '金', '戌': '土', '亥': '水',
}
const SHISHEN = {
  '甲': '比', '乙': '劫', '丙': '食', '丁': '伤',
  '戊': '财', '己': '才', '庚': '官', '辛': '杀',
  '壬': '枭', '癸': '印',
}

// ── 公历转儒略日（简化版，1900-2100 范围内误差 <1天）────────────
function solarToJD(year, month, day) {
  const m = month <= 2 ? month + 12 : month
  const y = month <= 2 ? year - 1 : year
  const a = Math.floor(y / 100)
  const b = 2 - a + Math.floor(a / 4)
  return Math.floor(365.25 * (y + 4716))
       + Math.floor(30.6001 * (m + 1))
       + day + b - 1524.5
}

// ── 日柱：使用 1900-01-31 为甲子日的基准 ───────────────────────
function getDayStemBranch(jd) {
  const baseJD = 2415021 // 1900-01-31 儒略日（甲子日）
  const offset = Math.floor(jd + 0.5) - baseJD
  const stemIdx = offset % 10
  const branchIdx = offset % 12
  return {
    stem: STEMS[(stemIdx + 10) % 10],
    branch: BRANCHES[(branchIdx + 12) % 12],
  }
}

// ── 时辰地支：每2小时一个地支 ──────────────────────────────────
function getHourBranch(hour) {
  // 子时 23-1，丑时 1-3，寅时 3-5，...
  const idx = Math.floor((hour + 1) / 2) % 12
  return BRANCHES[idx]
}

// ── 年柱 ─────────────────────────────────────────────────────
function getYearPillar(year) {
  // 以立春为年分界（简化：1-2月用前一年）
  const stemIdx = (year - 4) % 10
  const branchIdx = (year - 4) % 12
  return {
    stem: STEMS[(stemIdx + 10) % 10],
    branch: BRANCHES[(branchIdx + 12) % 12],
  }
}

// ── 月柱：五虎遁 ──────────────────────────────────────────────
const MONTH_STEM_START = { '甲': 2, '乙': 4, '丙': 6, '丁': 8, '戊': 0, '己': 2, '庚': 4, '辛': 6, '壬': 8, '癸': 0 }

function getMonthPillar(year, month) {
  const yearStem = STEMS[((year - 4) % 10 + 10) % 10]
  const startIdx = MONTH_STEM_START[yearStem]
  const stemIdx = (startIdx + month - 1) % 10
  return { stem: STEMS[stemIdx], branch: BRANCHES[month % 12] }
}

// ── 日主对应的十神（简化：以日干为主）─────────────────────────
function getDayShishen(stem) {
  return SHISHEN[stem] || ''
}

// ── 五行统计 ─────────────────────────────────────────────────
function countWuxing(stem, branch) {
  return [WUXING_STEM[STEMS.indexOf(stem)], WUXING_BRANCH[branch]]
}

// ── 完整八字排盘 ─────────────────────────────────────────────
function getBaZi(year, month, day, hour = 12) {
  // 年柱（简化处理 1-2 月归属问题）
  const yearPillar = getYearPillar(year)
  // 月柱
  const monthPillar = getMonthPillar(year, month)
  // 日柱
  const jd = solarToJD(year, month, day)
  const dayPillar = getDayStemBranch(jd)
  // 时柱：五鼠遁时干 = (日干Index * 2 + 时辰Index) % 10
  const dayStemIdx = STEMS.indexOf(dayPillar.stem)
  const hourBranchIdx = BRANCHES.indexOf(getHourBranch(hour))
  const hourStemIdx = (dayStemIdx * 2 + hourBranchIdx) % 10
  const hourPillar = { stem: STEMS[hourStemIdx], branch: BRANCHES[hourBranchIdx] }

  // 五行统计
  const pillars = [yearPillar, monthPillar, dayPillar, hourPillar]
  const wuxingCount = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 }
  for (const p of pillars) {
    wuxingCount[WUXING_STEM[STEMS.indexOf(p.stem)]]++
    wuxingCount[WUXING_BRANCH[p.branch]]++
  }

  return {
    year: { ...yearPillar, wuxing: WUXING_STEM[STEMS.indexOf(yearPillar.stem)] },
    month: { ...monthPillar, wuxing: WUXING_STEM[STEMS.indexOf(monthPillar.stem)] },
    day: {
      ...dayPillar,
      wuxing: WUXING_STEM[STEMS.indexOf(dayPillar.stem)],
      shishen: getDayShishen(dayPillar.stem),
    },
    hour: { ...hourPillar, wuxing: WUXING_STEM[STEMS.indexOf(hourPillar.stem)] },
    wuxing: wuxingCount,
  }
}

module.exports = { getBaZi, STEMS, BRANCHES }
