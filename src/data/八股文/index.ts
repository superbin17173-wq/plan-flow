// 八股文原始数据索引
// 通过 Vite 的 ?raw 导入将所有 md 文件打包为字符串
// 供 baguInitializer 在应用启动时导入到知识库

export interface BaguFileDef {
  fileName: string   // 文件名 (不含路径)
  title: string      // 显示标题
  content: string    // md 原文
}

// 懒加载: 首次调用时才加载原始内容,避免影响首屏
let _cached: BaguFileDef[] | null = null

export async function getBaguFiles(): Promise<BaguFileDef[]> {
  if (_cached) return _cached

  // Vite ?raw 导入 - 编译为字符串
  const [
    mysql,
    redis,
    ssm,
    weifuwu,
    xiaoxi,
    duoxiancheng,
    jihe,
    jvm,
    sheji,
    changjing,
  ] = await Promise.all([
    import('./MySQL篇.md?raw'),
    import('./Redis篇.md?raw'),
    import('./SSM框架.md?raw'),
    import('./微服务篇.md?raw'),
    import('./消息中间件篇.md?raw'),
    import('./多线程篇.md?raw'),
    import('./常见集合篇.md?raw'),
    import('./JVM虚拟机篇.md?raw'),
    import('./设计模式篇.md?raw'),
    import('./技术场景篇.md?raw'),
  ])

  _cached = [
    { fileName: 'MySQL篇.md', title: '八股文 · MySQL篇', content: mysql.default },
    { fileName: 'Redis篇.md', title: '八股文 · Redis篇', content: redis.default },
    { fileName: 'SSM框架.md', title: '八股文 · SSM框架', content: ssm.default },
    { fileName: '微服务篇.md', title: '八股文 · 微服务篇', content: weifuwu.default },
    { fileName: '消息中间件篇.md', title: '八股文 · 消息中间件篇', content: xiaoxi.default },
    { fileName: '多线程篇.md', title: '八股文 · 多线程篇', content: duoxiancheng.default },
    { fileName: '常见集合篇.md', title: '八股文 · 常见集合篇', content: jihe.default },
    { fileName: 'JVM虚拟机篇.md', title: '八股文 · JVM虚拟机篇', content: jvm.default },
    { fileName: '设计模式篇.md', title: '八股文 · 设计模式篇', content: sheji.default },
    { fileName: '技术场景篇.md', title: '八股文 · 技术场景篇', content: changjing.default },
  ]

  return _cached
}
