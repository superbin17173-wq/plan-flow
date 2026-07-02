// UI 状态管理
import { defineStore } from 'pinia'
import { ref } from 'vue'
import dayjs from 'dayjs'

export const useUiStore = defineStore('ui', () => {
  const currentView = ref<'month' | 'week' | 'day' | 'year'>('month')
  const selectedDate = ref(dayjs().format('YYYY-MM-DD'))
  const selectedTaskId = ref<string | null>(null)
  const showTaskForm = ref(false)
  const showTaskCard = ref(false)
  const showStatsPanel = ref(false)
  const showSearchPanel = ref(false)
  const showBulkDialog = ref(false)
  const showProfileDialog = ref(false)
  const showMealLog = ref(false)
  const searchQuery = ref('')
  const filterCategory = ref<string | null>(null)
  const filterPriority = ref<string | null>(null)
  const filterCompleted = ref<boolean | null>(null)
  const previousView = ref<'month' | 'week' | 'day' | 'year'>('month')
  const prefillTime = ref<string | null>(null) // 预填充的开始时间

  // 切换视图
  function setView(view: 'month' | 'week' | 'day' | 'year') {
    previousView.value = currentView.value
    currentView.value = view
  }

  // 选择日期
  function selectDate(date: string, switchToDayView = true) {
    selectedDate.value = date
    if (switchToDayView && currentView.value !== 'day') {
      previousView.value = currentView.value
      currentView.value = 'day'
    }
  }

  // 返回上一视图
  function goBack() {
    currentView.value = previousView.value
  }

  // 前一个周期
  function goPrev() {
    const d = dayjs(selectedDate.value)
    switch (currentView.value) {
      case 'year':
        selectedDate.value = d.subtract(1, 'year').format('YYYY-MM-DD')
        break
      case 'month':
        selectedDate.value = d.subtract(1, 'month').format('YYYY-MM-DD')
        break
      case 'week':
        selectedDate.value = d.subtract(1, 'week').format('YYYY-MM-DD')
        break
      case 'day':
        selectedDate.value = d.subtract(1, 'day').format('YYYY-MM-DD')
        break
    }
  }

  // 后一个周期
  function goNext() {
    const d = dayjs(selectedDate.value)
    switch (currentView.value) {
      case 'year':
        selectedDate.value = d.add(1, 'year').format('YYYY-MM-DD')
        break
      case 'month':
        selectedDate.value = d.add(1, 'month').format('YYYY-MM-DD')
        break
      case 'week':
        selectedDate.value = d.add(1, 'week').format('YYYY-MM-DD')
        break
      case 'day':
        selectedDate.value = d.add(1, 'day').format('YYYY-MM-DD')
        break
    }
  }

  // 回到今天
  function goToday() {
    selectedDate.value = dayjs().format('YYYY-MM-DD')
  }

  // 打开新建任务表单
  function openTaskForm(taskId?: string, prefillDate?: string, time?: string) {
    selectedTaskId.value = taskId || null
    if (prefillDate) selectedDate.value = prefillDate
    prefillTime.value = time || null
    showTaskForm.value = true
  }

  // 关闭任务表单
  function closeTaskForm() {
    showTaskForm.value = false
    selectedTaskId.value = null
    prefillTime.value = null
  }

  // 打开任务详情
  function openTaskCard(taskId: string) {
    selectedTaskId.value = taskId
    showTaskCard.value = true
  }

  // 关闭任务详情
  function closeTaskCard() {
    showTaskCard.value = false
    selectedTaskId.value = null
  }

  // 切换统计面板
  function toggleStatsPanel() {
    showStatsPanel.value = !showStatsPanel.value
  }

  // 切换搜索面板
  function toggleSearchPanel() {
    showSearchPanel.value = !showSearchPanel.value
    if (!showSearchPanel.value) {
      searchQuery.value = ''
      filterCategory.value = null
      filterPriority.value = null
      filterCompleted.value = null
    }
  }

  // 当前视图标题
  function getViewTitle(): string {
    const d = dayjs(selectedDate.value)
    switch (currentView.value) {
      case 'year':
        return d.format('YYYY年')
      case 'month':
        return d.format('YYYY年MM月')
      case 'week': {
        const start = d.startOf('week')
        const end = d.endOf('week')
        return `${start.format('MM月DD日')} - ${end.format('MM月DD日')}`
      }
      case 'day':
        return d.format('YYYY年MM月DD日')
      default:
        return ''
    }
  }

  function openBulkDialog() { showBulkDialog.value = true }
  function closeBulkDialog() { showBulkDialog.value = false }
  function openProfileDialog() { showProfileDialog.value = true }
  function closeProfileDialog() { showProfileDialog.value = false }
  function openMealLog() { showMealLog.value = true }
  function closeMealLog() { showMealLog.value = false }

  return {
    currentView,
    selectedDate,
    selectedTaskId,
    showTaskForm,
    showTaskCard,
    showStatsPanel,
    showSearchPanel,
    showBulkDialog,
    showProfileDialog,
    showMealLog,
    searchQuery,
    filterCategory,
    filterPriority,
    filterCompleted,
    previousView,
    prefillTime,
    setView,
    selectDate,
    goBack,
    goPrev,
    goNext,
    goToday,
    openTaskForm,
    closeTaskForm,
    openTaskCard,
    closeTaskCard,
    toggleStatsPanel,
    toggleSearchPanel,
    openBulkDialog,
    closeBulkDialog,
    openProfileDialog,
    closeProfileDialog,
    openMealLog,
    closeMealLog,
    getViewTitle,
  }
})