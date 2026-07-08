// 知识库合并工具函数
import type { Task } from '../types'
import type { StudySession, SM2State, MasteryRecord } from '../types/study'
import type { AIMessage } from '../types/ai'
import { getMessagesBySession, clearSessionMessages, saveAIMessages } from './aiStorage'
import { getDB } from './db'

/**
 * 合并两个学习任务
 * @param targetId 目标任务 ID（保留方）
 * @param sourceId 源任务 ID（被合并归档方）
 * @returns 合并后的目标任务
 */
export async function mergeStudyTasks(targetId: string, sourceId: string): Promise<Task | null> {
  const db = await getDB()

  // 获取两个任务
  const targetTask = await db.get('tasks', targetId) as Task | undefined
  const sourceTask = await db.get('tasks', sourceId) as Task | undefined

  if (!targetTask?.study || !sourceTask?.study) {
    throw new Error('两个任务都必须是学习任务')
  }

  // 合并材料
  const mergedMaterialText = (targetTask.study.materialText || '') +
    '\n\n--- 合并自 ' + sourceTask.study.subject + ' ---\n\n' +
    (sourceTask.study.materialText || '')

  // 合并复习历史（取较早的作为首学）
  const targetHistory = targetTask.study.ebbinghaus?.masteryHistory || []
  const sourceHistory = sourceTask.study.ebbinghaus?.masteryHistory || []
  const mergedHistory: MasteryRecord[] = [...targetHistory, ...sourceHistory]
    .sort((a, b) => a.date.localeCompare(b.date))

  // SM-2 状态取保守值（较低的 EF）
  const targetSm2 = targetTask.study.ebbinghaus?.sm2
  const sourceSm2 = sourceTask.study.ebbinghaus?.sm2
  const mergedSm2: SM2State = {
    easinessFactor: Math.min(
      targetSm2?.easinessFactor || 2.5,
      sourceSm2?.easinessFactor || 2.5
    ),
    repetitions: Math.max(targetSm2?.repetitions || 0, sourceSm2?.repetitions || 0),
    interval: Math.min(targetSm2?.interval || 0, sourceSm2?.interval || 0),
  }

  // 合并 AI 会话消息
  const targetSessionId = targetTask.study.ebbinghaus?.aiSessionId
  const sourceSessionId = sourceTask.study.ebbinghaus?.aiSessionId
  let mergedMessages: AIMessage[] = []

  if (targetSessionId && sourceSessionId) {
    const targetMsgs = await getMessagesBySession(targetSessionId)
    const sourceMsgs = await getMessagesBySession(sourceSessionId)
    // 按时间排序合并，统一到 targetSessionId
    mergedMessages = [...targetMsgs, ...sourceMsgs]
      .sort((a, b) => a.createdAt - b.createdAt)
      .map(m => ({ ...m, sessionId: targetSessionId }))

    // 清空源会话
    await clearSessionMessages(sourceSessionId)

    // 保存合并后的消息到目标会话
    await saveAIMessages(mergedMessages)
  }

  // 构建合并后的 study
  const mergedStudy: StudySession = {
    subject: `${targetTask.study.subject} + ${sourceTask.study.subject}`,
    materialText: mergedMaterialText,
    materialFileName: undefined,
    ebbinghaus: {
      enabled: true,
      studyGroupId: targetTask.study.ebbinghaus?.studyGroupId || '',
      originTaskId: targetTask.study.ebbinghaus?.originTaskId || targetId,
      reviewIndex: Math.max(
        targetTask.study.ebbinghaus?.reviewIndex || 0,
        sourceTask.study.ebbinghaus?.reviewIndex || 0
      ),
      sm2: mergedSm2,
      masteryHistory: mergedHistory,
      aiSessionId: targetSessionId,
    },
    mergedFrom: [
      ...(targetTask.study.mergedFrom || []),
      {
        taskId: sourceId,
        subject: sourceTask.study.subject,
        mergedAt: Date.now(),
      }
    ],
  }

  // 更新目标任务
  const updatedTarget: Task = {
    ...targetTask,
    title: `📚 ${mergedStudy.subject}`,
    study: mergedStudy,
    updatedAt: Date.now(),
  }
  await db.put('tasks', updatedTarget)

  // 标记源任务为已合并归档
  const archivedSource: Task = {
    ...sourceTask,
    study: {
      ...sourceTask.study,
      isMerged: true,
      mergedTo: targetId,
    },
    updatedAt: Date.now(),
  }
  await db.put('tasks', archivedSource)

  // 删除源任务的所有未来复习任务（保留 history）
  // 找到属于 source studyGroupId 的任务
  const sourceGroupId = sourceTask.study.ebbinghaus?.studyGroupId
  if (sourceGroupId) {
    const allTasks = await db.getAll('tasks') as Task[]
    for (const t of allTasks) {
      if (t.study?.ebbinghaus?.studyGroupId === sourceGroupId && !t.isCompleted && t.id !== sourceId) {
        await db.delete('tasks', t.id)
      }
    }
  }

  return updatedTarget
}

/**
 * 获取可合并的学习任务列表
 */
export async function getMergeableStudyTasks(): Promise<Task[]> {
  const db = await getDB()
  const allTasks = await db.getAll('tasks') as Task[]
  return allTasks.filter(t =>
    t.study?.ebbinghaus?.enabled &&
    !t.study?.isMerged &&
    t.study.ebbinghaus.reviewIndex === 0 // 只取首学任务
  )
}