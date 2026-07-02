// PushPlus 微信推送 API 封装
// 官方文档: https://www.pushplus.plus/doc/

export interface PushPlusPayload {
  token: string
  title: string
  content: string
  topic?: string
  template?: 'html' | 'txt' | 'json' | 'markdown'
}

export interface PushPlusResult {
  ok: boolean
  code: number
  msg: string
}

const PUSHPLUS_ENDPOINT = 'https://www.pushplus.plus/send'

// 发送微信推送
export async function sendPushPlus(payload: PushPlusPayload): Promise<PushPlusResult> {
  if (!payload.token) {
    return { ok: false, code: -1, msg: '缺少 PushPlus token' }
  }

  const body: Record<string, string> = {
    token: payload.token,
    title: payload.title,
    content: payload.content,
    template: payload.template || 'html',
  }
  if (payload.topic) body.topic = payload.topic

  try {
    const res = await fetch(PUSHPLUS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      return { ok: false, code: res.status, msg: `HTTP ${res.status}` }
    }

    const data = await res.json()
    return {
      ok: data.code === 200,
      code: data.code,
      msg: data.msg || (data.code === 200 ? '推送成功' : '推送失败'),
    }
  } catch (err) {
    // 浏览器 CORS 或网络错误
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, code: -2, msg: `请求失败: ${msg}` }
  }
}

// 生成任务提醒的 HTML 内容
export function buildReminderContent(opts: {
  title: string
  startTime: string
  description?: string
  category?: string
}): string {
  const rows: string[] = []
  rows.push(`<h3>${escapeHtml(opts.title)}</h3>`)
  rows.push(`<p><b>开始时间：</b>${escapeHtml(opts.startTime)}</p>`)
  if (opts.category) rows.push(`<p><b>分类：</b>${escapeHtml(opts.category)}</p>`)
  if (opts.description) rows.push(`<p><b>备注：</b>${escapeHtml(opts.description)}</p>`)
  rows.push(`<p style="color:#888;font-size:12px;">— 来自 PlanFlow</p>`)
  return rows.join('')
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
