// PDF 解析函数（使用 pdf.js）
// 用于学习材料上传时从 PDF 提取文本

import * as pdfjsLib from 'pdfjs-dist'

// 设置 worker（使用 CDN 或本地路径）
// pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
// 或者用本地：
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'

export async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  const textParts: string[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()

    const pageText = textContent.items
      .filter(item => 'str' in item)
      .map(item => (item as { str: string }).str)
      .join(' ')

    if (pageText.trim()) {
      textParts.push(`--- 第 ${i} 页 ---\n${pageText}`)
    }
  }

  return textParts.join('\n\n')
}

// 简化的检查函数（判断是否为 PDF）
export function isPDFFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}