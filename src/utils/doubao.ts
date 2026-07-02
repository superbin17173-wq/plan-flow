// 豆包（Doubao）视觉 API 客户端 - 火山方舟 ARK
// https://www.volcengine.com/docs/82379/1330310
//
// 注意：ARK 不支持浏览器直连（无 CORS 头）。
// - 开发环境：走 Vite dev proxy: /api/ark/chat/completions → ARK
// - 生产环境：需要自建反向代理（可用 Cloudflare Workers / Nginx / Node 服务）
//   把 /api/ark/* 转发到 https://ark.cn-beijing.volces.com/api/v3/*

const ARK_PROXY_PATH = '/api/ark/chat/completions'

export interface DoubaoFoodItem {
  name: string
  amount?: string
  calories?: number
  protein?: number
  carbs?: number
  fat?: number
}

export interface DoubaoFoodResult {
  items: DoubaoFoodItem[]
  totalCalories?: number
  raw: string // 原始文本
}

const SYSTEM_PROMPT = `你是一个食物识别专家。用户会发送一张餐食照片，请识别出图中的每一道菜/食物，估算份量和热量、蛋白质、碳水、脂肪。

要求：
1. 仅根据图片估算，不确定的字段可留空。
2. 返回严格 JSON 格式（不要 markdown 代码块），schema:
{
  "items": [
    { "name": "菜名", "amount": "份量描述", "calories": 数字(kcal), "protein": 数字(g), "carbs": 数字(g), "fat": 数字(g) }
  ],
  "totalCalories": 数字
}
3. 数字用整数或一位小数，不带单位。
4. 如果图中不是食物，返回 {"items":[]}。`

// 图片转 base64 data URL
export function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

// 调用豆包识别食物
export async function analyzeFoodImage(opts: {
  apiKey: string
  model: string // 接入点 ID (ep-xxxx) 或模型名
  imageDataUrl: string
  extraPrompt?: string
}): Promise<DoubaoFoodResult> {
  const { apiKey, model, imageDataUrl, extraPrompt } = opts

  const userContent: Array<Record<string, unknown>> = [
    { type: 'image_url', image_url: { url: imageDataUrl } },
    { type: 'text', text: extraPrompt || '请识别这张图中的食物，估算热量和营养素。' },
  ]

  const body = {
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
    temperature: 0.2,
  }

  const res = await fetch(ARK_PROXY_PATH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let errMsg = `HTTP ${res.status}`
    try {
      const errJson = JSON.parse(text)
      errMsg = errJson.error?.message || errJson.message || errMsg
    } catch {
      if (text) errMsg = text.slice(0, 200)
    }
    throw new Error(`豆包 API 错误: ${errMsg}`)
  }

  const data = await res.json()
  const rawContent = data.choices?.[0]?.message?.content || ''

  // 尝试解析 JSON（模型可能带上 ```json 包裹，做一层清理）
  let jsonStr = rawContent.trim()
  const codeBlock = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (codeBlock) jsonStr = codeBlock[1]

  let parsed: { items?: DoubaoFoodItem[]; totalCalories?: number } = {}
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    return { items: [], raw: rawContent }
  }

  const items = Array.isArray(parsed.items) ? parsed.items : []
  const totalCalories =
    typeof parsed.totalCalories === 'number'
      ? parsed.totalCalories
      : items.reduce((s, it) => s + (it.calories || 0), 0)

  return { items, totalCalories, raw: rawContent }
}
