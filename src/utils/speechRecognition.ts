// Web Speech API 语音输入封装
// 用于 AI 问答复习时用户语音回答

export interface SpeechResult {
  text: string
  confidence: number
  isFinal: boolean
}

export function startSpeechRecognition(
  onResult: (result: SpeechResult) => void,
  onError?: (error: string) => void,
  lang: string = 'zh-CN'
): { stop: () => void } {
  // 检查浏览器支持
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  if (!SpeechRecognition) {
    onError?.('浏览器不支持语音识别')
    return { stop: () => {} }
  }

  const recognition = new SpeechRecognition()
  recognition.lang = lang
  recognition.continuous = true
  recognition.interimResults = true

  recognition.onresult = (event: SpeechRecognitionEvent) => {
    const result = event.results[event.results.length - 1]
    const text = result[0].transcript
    const confidence = result[0].confidence
    const isFinal = result.isFinal

    onResult({ text, confidence, isFinal })
  }

  recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
    onError?.(event.error)
  }

  recognition.onend = () => {
    // 自动停止后不重新开始（用户需要手动点击）
  }

  recognition.start()

  return {
    stop: () => recognition.stop()
  }
}

// 简化的单次语音输入（适合短回答）
export function recordSinglePhrase(
  lang: string = 'zh-CN',
  timeoutMs: number = 10000
): Promise<string> {
  return new Promise((resolve, reject) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      reject('浏览器不支持语音识别')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = lang
    recognition.continuous = false
    recognition.interimResults = false

    let resolved = false

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      if (!resolved) {
        resolved = true
        resolve(event.results[0][0].transcript)
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (!resolved) {
        resolved = true
        reject(event.error)
      }
    }

    recognition.start()

    // 超时处理
    setTimeout(() => {
      if (!resolved) {
        resolved = true
        recognition.stop()
        reject('超时')
      }
    }, timeoutMs)
  })
}