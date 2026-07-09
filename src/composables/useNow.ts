import { ref, onMounted, onUnmounted } from 'vue'
import dayjs from 'dayjs'

const now = ref(new Date())
let timer: number | null = null
let refCount = 0

function ensureTicking() {
  if (timer !== null) return
  timer = window.setInterval(() => {
    now.value = new Date()
  }, 30 * 1000)
}

function stopTicking() {
  if (timer !== null && refCount === 0) {
    clearInterval(timer)
    timer = null
  }
}

export function useNow() {
  onMounted(() => {
    refCount++
    ensureTicking()
  })
  onUnmounted(() => {
    refCount--
    stopTicking()
  })
  return now
}

export function isPastDate(dateStr: string): boolean {
  return dayjs(dateStr).isBefore(dayjs(), 'day')
}

export function isPastHour(dateStr: string, hour: number, nowDate: Date = new Date()): boolean {
  const d = dayjs(dateStr)
  const n = dayjs(nowDate)
  if (d.isBefore(n, 'day')) return true
  if (d.isAfter(n, 'day')) return false
  return hour < n.hour()
}

export function isPastTime(dateStr: string, endTime: string | undefined, nowDate: Date = new Date()): boolean {
  if (!endTime) return false
  const [h, m] = endTime.split(':').map(Number)
  const end = dayjs(dateStr).hour(h).minute(m).second(0)
  return end.isBefore(dayjs(nowDate))
}
