// Excel 模板生成、解析
import * as XLSX from 'xlsx'
import dayjs from 'dayjs'
import type { TaskFormData } from '../types'
import { DEFAULT_CATEGORIES } from '../types/category'

const HEADERS = ['日期', '开始时间', '结束时间', '时长(分钟)', '标题', '分类', '优先级', '描述']

const CATEGORY_NAME_TO_ID: Record<string, string> = Object.fromEntries(
  DEFAULT_CATEGORIES.flatMap(c => [
    [c.name, c.id],
    [c.id, c.id],
    [c.name.toLowerCase(), c.id],
  ])
)

const PRIORITY_MAP: Record<string, 'high' | 'medium' | 'low'> = {
  '高': 'high', '中': 'medium', '低': 'low',
  'high': 'high', 'medium': 'medium', 'low': 'low',
  'H': 'high', 'M': 'medium', 'L': 'low',
}

export interface ParsedRow {
  row: number
  data?: TaskFormData
  error?: string
}

export interface ParseResult {
  valid: TaskFormData[]
  errors: { row: number; message: string }[]
  totalRows: number
}

// 下载导入模板
export function downloadTemplate(): void {
  const example = [
    HEADERS,
    ['2026-07-15', '09:00', '10:30', '', '例:晨会同步', '工作', '高', '每日站会'],
    ['2026-07-15', '14:00', '15:00', '', '例:阅读', '学习', '中', ''],
    ['2026/7/16', '', '', '30', '例:背单词(仅时长)', '学习', '中', '不定时,预计 30 分钟'],
    ['2026/7/17', '', '', '', '例:取快递(全天待办)', '生活', '低', '当天任意时间'],
  ]

  const ws = XLSX.utils.aoa_to_sheet(example)
  ws['!cols'] = [
    { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 12 },
    { wch: 28 }, { wch: 10 }, { wch: 8 }, { wch: 32 },
  ]

  const notes = [
    [''],
    ['填写说明:'],
    ['1. 日期格式支持 YYYY-MM-DD 或 YYYY/M/D 或 Excel 日期'],
    ['2. 时间格式 HH:mm(24 小时制)。三种填法:'],
    ['   - 同时填开始+结束时间 => 定时任务(显示在时间轴)'],
    ['   - 只填"时长(分钟)"(开始/结束留空) => 花费时长任务(归入未排时段)'],
    ['   - 都留空 => 全天待办'],
    ['3. 分类可选: ' + DEFAULT_CATEGORIES.map(c => c.name).join('、')],
    ['4. 优先级可选: 高、中、低(留空默认中)'],
    ['5. 描述可留空'],
    ['6. 从第 2 行开始写数据,首行不要改动'],
  ]
  const wsNotes = XLSX.utils.aoa_to_sheet(notes)
  wsNotes['!cols'] = [{ wch: 60 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '任务')
  XLSX.utils.book_append_sheet(wb, wsNotes, '说明')

  XLSX.writeFile(wb, `PlanFlow-导入模板-${dayjs().format('YYYYMMDD')}.xlsx`)
}

// 解析日期(支持字符串或 Excel 序列号)
function parseDate(value: any): string | null {
  if (value == null || value === '') return null

  if (typeof value === 'number') {
    const ms = (value - 25569) * 86400 * 1000
    const d = dayjs(new Date(ms))
    return d.isValid() ? d.format('YYYY-MM-DD') : null
  }

  const s = String(value).trim()
  // 支持 YYYY-M-D / YYYY/M/D / YYYY.M.D
  const m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (m) {
    const y = parseInt(m[1], 10)
    const mo = parseInt(m[2], 10)
    const d = parseInt(m[3], 10)
    const dj = dayjs(`${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
    if (dj.isValid()) return dj.format('YYYY-MM-DD')
  }
  const fallback = dayjs(s)
  return fallback.isValid() ? fallback.format('YYYY-MM-DD') : null
}

// 解析时间为 HH:mm
function parseTime(value: any): string | null {
  if (value == null || value === '') return null

  // Excel 时间小数(一天的分数)
  if (typeof value === 'number' && value >= 0 && value < 1) {
    const totalMin = Math.round(value * 24 * 60)
    const h = Math.floor(totalMin / 60)
    const m = totalMin % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  const s = String(value).trim()
  const m = s.match(/^(\d{1,2})[:：.](\d{1,2})/)
  if (m) {
    const h = parseInt(m[1], 10)
    const min = parseInt(m[2], 10)
    if (h >= 0 && h < 24 && min >= 0 && min < 60) {
      return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
    }
  }
  // 纯数字如 "9" → "09:00"
  const hOnly = s.match(/^(\d{1,2})$/)
  if (hOnly) {
    const h = parseInt(hOnly[1], 10)
    if (h >= 0 && h < 24) return `${String(h).padStart(2, '0')}:00`
  }
  return null
}

function parseCategory(value: any): string {
  if (value == null || value === '') return 'other'
  const s = String(value).trim()
  return CATEGORY_NAME_TO_ID[s] || CATEGORY_NAME_TO_ID[s.toLowerCase()] || 'other'
}

function parsePriority(value: any): 'high' | 'medium' | 'low' {
  if (value == null || value === '') return 'medium'
  const s = String(value).trim()
  return PRIORITY_MAP[s] || PRIORITY_MAP[s.toLowerCase()] || 'medium'
}

// 解析上传的 Excel 文件
export async function parseExcelFile(file: File): Promise<ParseResult> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false })
  const sheetName = wb.SheetNames.find(n => n === '任务') || wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]

  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

  const valid: TaskFormData[] = []
  const errors: { row: number; message: string }[] = []

  // 跳过表头行
  let startIdx = 0
  if (rows.length > 0 && String(rows[0][0]).includes('日期')) startIdx = 1

  for (let i = startIdx; i < rows.length; i++) {
    const row = rows[i]
    const excelRow = i + 1
    if (!row || row.every(v => v === '' || v == null)) continue

    const dateVal = parseDate(row[0])
    if (!dateVal) {
      errors.push({ row: excelRow, message: `日期无法识别: "${row[0]}"` })
      continue
    }

    // 三态时间: 开始+结束 / 只时长 / 全空
    const rawStart = row[1]
    const rawEnd = row[2]
    const rawDuration = row[3]
    const startTime = (rawStart !== '' && rawStart != null) ? parseTime(rawStart) : null
    const endTime = (rawEnd !== '' && rawEnd != null) ? parseTime(rawEnd) : null
    const durationRaw = (rawDuration !== '' && rawDuration != null) ? Number(rawDuration) : NaN
    const durationMinutes = Number.isFinite(durationRaw) && durationRaw > 0 ? Math.round(durationRaw) : undefined

    let mode: 'timed' | 'duration' | 'anytime'
    if ((rawStart !== '' && rawStart != null) || (rawEnd !== '' && rawEnd != null)) {
      // 用户填了时间字段,视为 timed,两端都必须解析成功
      if (!startTime) {
        errors.push({ row: excelRow, message: `开始时间无法识别: "${rawStart}"` })
        continue
      }
      if (!endTime) {
        errors.push({ row: excelRow, message: `结束时间无法识别: "${rawEnd}"` })
        continue
      }
      if (endTime <= startTime) {
        errors.push({ row: excelRow, message: `结束时间(${endTime})必须晚于开始时间(${startTime})` })
        continue
      }
      mode = 'timed'
    } else if (durationMinutes) {
      mode = 'duration'
    } else {
      mode = 'anytime'
    }

    const title = String(row[4] || '').trim()
    if (!title) {
      errors.push({ row: excelRow, message: '标题不能为空' })
      continue
    }

    valid.push({
      title,
      description: row[7] ? String(row[7]).trim() : undefined,
      category: parseCategory(row[5]),
      priority: parsePriority(row[6]),
      date: dateVal,
      startTime: mode === 'timed' ? startTime! : undefined,
      endTime: mode === 'timed' ? endTime! : undefined,
      durationMinutes: mode === 'duration' ? durationMinutes : undefined,
    })
  }

  return {
    valid,
    errors,
    totalRows: rows.length - startIdx,
  }
}

// 选择文件并解析
export function pickAndParseExcel(): Promise<ParseResult | null> {
  return new Promise(resolve => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.xlsx,.xls,.csv'
    input.onchange = async e => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return resolve(null)
      try {
        const result = await parseExcelFile(file)
        resolve(result)
      } catch (err) {
        resolve({ valid: [], errors: [{ row: 0, message: `文件读取失败: ${err}` }], totalRows: 0 })
      }
    }
    input.click()
  })
}
