<script setup lang="ts">
import { ref } from 'vue'

const selectedStyle = ref<'neumorphism' | 'glassmorphism' | 'minimal' | 'ios'>('neumorphism')
</script>

<template>
  <div class="style-preview">
    <header class="preview-header">
      <h2>UI 风格预览</h2>
      <div class="style-tabs">
        <button
          :class="{ active: selectedStyle === 'neumorphism' }"
          @click="selectedStyle = 'neumorphism'"
        >新拟态</button>
        <button
          :class="{ active: selectedStyle === 'glassmorphism' }"
          @click="selectedStyle = 'glassmorphism'"
        >玻璃拟态</button>
        <button
          :class="{ active: selectedStyle === 'minimal' }"
          @click="selectedStyle = 'minimal'"
        >极简风</button>
        <button
          :class="{ active: selectedStyle === 'ios' }"
          @click="selectedStyle = 'ios'"
        >iOS风格</button>
      </div>
    </header>

    <!-- 手机模拟器框架 -->
    <div class="phone-frame">
      <div class="phone-screen" :class="selectedStyle">
        <!-- 新拟态风格 -->
        <div v-if="selectedStyle === 'neumorphism'" class="neumorphism-ui">
          <header class="neo-header">
            <span class="neo-title">PlanFlow</span>
            <div class="neo-stats">
              <div class="neo-stat-card">
                <span class="neo-icon">📖</span>
                <span class="neo-value">12</span>
                <span class="neo-label">学习</span>
              </div>
              <div class="neo-stat-card">
                <span class="neo-icon">✅</span>
                <span class="neo-value">8</span>
                <span class="neo-label">完成</span>
              </div>
              <div class="neo-stat-card">
                <span class="neo-icon">🔥</span>
                <span class="neo-value">3</span>
                <span class="neo-label">今日</span>
              </div>
            </div>
          </header>

          <section class="neo-month">
            <span class="neo-month-title">2026 年 07 月</span>
            <div class="neo-nav">
              <button class="neo-btn">‹</button>
              <button class="neo-btn neo-today">今天</button>
              <button class="neo-btn">›</button>
            </div>
          </section>

          <section class="neo-tasks">
            <div class="neo-task-card">
              <div class="neo-task-dot"></div>
              <div class="neo-task-info">
                <span class="neo-task-name">复习算法 List 3</span>
                <span class="neo-task-time">09:00 · 学习</span>
              </div>
              <span class="neo-task-badge">进行中</span>
            </div>
            <div class="neo-task-card">
              <div class="neo-task-dot work"></div>
              <div class="neo-task-info">
                <span class="neo-task-name">项目会议</span>
                <span class="neo-task-time">14:00 · 工作</span>
              </div>
            </div>
            <div class="neo-task-card">
              <div class="neo-task-dot health"></div>
              <div class="neo-task-info">
                <span class="neo-task-name">健身运动</span>
                <span class="neo-task-time">18:30 · 运动</span>
              </div>
            </div>
          </section>

          <nav class="neo-bottom-nav">
            <div class="neo-nav-item active">
              <span>📅</span>
              <span>日历</span>
            </div>
            <div class="neo-nav-item">
              <span>📊</span>
              <span>统计</span>
            </div>
            <div class="neo-nav-item">
              <span>💬</span>
              <span>AI</span>
            </div>
            <div class="neo-nav-item">
              <span>⚙️</span>
              <span>设置</span>
            </div>
          </nav>
        </div>

        <!-- 玻璃拟态风格 -->
        <div v-if="selectedStyle === 'glassmorphism'" class="glass-ui">
          <div class="glass-bg"></div>
          <header class="glass-header">
            <span class="glass-date">07月8日 周三</span>
            <div class="glass-actions">
              <button class="glass-btn">🔍</button>
              <button class="glass-btn">+</button>
            </div>
          </header>

          <section class="glass-hero">
            <div class="glass-progress-card">
              <span class="glass-progress-title">今日进度</span>
              <div class="glass-progress-bar">
                <div class="glass-progress-fill" style="width: 60%"></div>
              </div>
              <span class="glass-progress-text">3/5 任务完成</span>
            </div>
          </section>

          <section class="glass-stats">
            <div class="glass-stat">
              <span class="glass-stat-icon">📖</span>
              <span class="glass-stat-num">12</span>
              <span class="glass-stat-label">学习计划</span>
            </div>
            <div class="glass-stat">
              <span class="glass-stat-icon">🔥</span>
              <span class="glass-stat-num">7</span>
              <span class="glass-stat-label">连续天数</span>
            </div>
          </section>

          <section class="glass-tasks">
            <div class="glass-task">
              <div class="glass-task-left">
                <span class="glass-task-time">09:00</span>
                <div class="glass-task-dot study"></div>
              </div>
              <div class="glass-task-content">
                <span class="glass-task-name">复习算法</span>
                <span class="glass-task-tag">学习</span>
              </div>
            </div>
            <div class="glass-task">
              <div class="glass-task-left">
                <span class="glass-task-time">14:00</span>
                <div class="glass-task-dot work"></div>
              </div>
              <div class="glass-task-content">
                <span class="glass-task-name">项目会议</span>
                <span class="glass-task-tag">工作</span>
              </div>
            </div>
          </section>
        </div>

        <!-- 极简风格 -->
        <div v-if="selectedStyle === 'minimal'" class="minimal-ui">
          <header class="min-header">
            <span class="min-logo">PlanFlow</span>
            <div class="min-actions">
              <span>🔍</span>
              <span class="min-add">+</span>
            </div>
          </header>

          <section class="min-month">
            <span class="min-month-text">2026年07月</span>
            <div class="min-divider"></div>
          </section>

          <section class="min-day">
            <span class="min-day-label">今天 · Wed 7月8日</span>
            <div class="min-tasks">
              <div class="min-task">
                <span class="min-time">09:00</span>
                <div class="min-dot study"></div>
                <span class="min-name">复习算法 List 3</span>
                <span class="min-meta">学习 · 30分钟</span>
              </div>
              <div class="min-task">
                <span class="min-time">14:00</span>
                <div class="min-dot work"></div>
                <span class="min-name">项目会议</span>
                <span class="min-meta">工作 · 60分钟</span>
              </div>
              <div class="min-task">
                <span class="min-time">18:30</span>
                <div class="min-dot health"></div>
                <span class="min-name">健身运动</span>
                <span class="min-meta">运动 · 45分钟</span>
              </div>
            </div>
          </section>

          <section class="min-tomorrow">
            <span class="min-day-label">明天 · Thu 7月9日</span>
            <div class="min-tasks">
              <div class="min-task future">
                <span class="min-time">10:00</span>
                <div class="min-dot empty"></div>
                <span class="min-name">团队周会</span>
              </div>
            </div>
          </section>
        </div>

        <!-- iOS风格 -->
        <div v-if="selectedStyle === 'ios'" class="ios-ui">
          <header class="ios-header">
            <span class="ios-month">7月</span>
            <span class="ios-year">2026年</span>
            <div class="ios-actions">
              <span>⚙️</span>
              <span>🔍</span>
              <span class="ios-add">＋</span>
            </div>
          </header>

          <section class="ios-calendar-strip">
            <div class="ios-day-col">
              <span class="ios-day-name">一</span>
              <span class="ios-day-num">6</span>
            </div>
            <div class="ios-day-col">
              <span class="ios-day-name">二</span>
              <span class="ios-day-num">7</span>
            </div>
            <div class="ios-day-col today">
              <span class="ios-day-name">三</span>
              <span class="ios-day-num active">8</span>
              <div class="ios-indicator"></div>
            </div>
            <div class="ios-day-col">
              <span class="ios-day-name">四</span>
              <span class="ios-day-num">9</span>
            </div>
            <div class="ios-day-col">
              <span class="ios-day-name">五</span>
              <span class="ios-day-num">10</span>
            </div>
          </section>

          <section class="ios-content">
            <div class="ios-section-header">
              <span>今天</span>
              <span class="ios-section-count">3项</span>
            </div>
            <div class="ios-card">
              <div class="ios-task-row">
                <div class="ios-task-dot study"></div>
                <div class="ios-task-main">
                  <span class="ios-task-name">复习算法 List 3</span>
                  <span class="ios-task-time">9:00 AM</span>
                </div>
              </div>
              <div class="ios-divider"></div>
              <div class="ios-task-row">
                <div class="ios-task-dot work"></div>
                <div class="ios-task-main">
                  <span class="ios-task-name">项目会议</span>
                  <span class="ios-task-time">2:00 PM</span>
                </div>
              </div>
              <div class="ios-divider"></div>
              <div class="ios-task-row">
                <div class="ios-task-dot health"></div>
                <div class="ios-task-main">
                  <span class="ios-task-name">健身运动</span>
                  <span class="ios-task-time">6:30 PM</span>
                </div>
              </div>
            </div>
          </section>

          <nav class="ios-bottom">
            <div class="ios-nav-item active">
              <div class="ios-nav-icon">📅</div>
              <span>日历</span>
            </div>
            <div class="ios-nav-item">
              <div class="ios-nav-icon">📊</div>
              <span>统计</span>
            </div>
            <div class="ios-nav-item">
              <div class="ios-nav-icon">💬</div>
              <span>AI</span>
            </div>
            <div class="ios-nav-item">
              <div class="ios-nav-icon">⚙️</div>
              <span>设置</span>
            </div>
          </nav>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.style-preview {
  padding: 20px;
  background: #1a1a2e;
  min-height: 100vh;
}

.preview-header {
  text-align: center;
  margin-bottom: 30px;

  h2 {
    color: #fff;
    font-size: 24px;
    margin-bottom: 20px;
  }
}

.style-tabs {
  display: flex;
  gap: 10px;
  justify-content: center;

  button {
    padding: 10px 20px;
    border-radius: 10px;
    background: #2a2a4a;
    color: #888;
    border: none;
    cursor: pointer;
    transition: all 0.3s;

    &:hover { background: #3a3a5a; }
    &.active {
      background: #6C9BEB;
      color: #fff;
    }
  }
}

.phone-frame {
  width: 375px;
  height: 750px;
  margin: 0 auto;
  border-radius: 40px;
  border: 8px solid #333;
  background: #000;
  overflow: hidden;
  position: relative;
}

.phone-screen {
  width: 100%;
  height: 100%;
  overflow-y: auto;
}

// ========== 新拟态风格 ==========
.neumorphism-ui {
  background: #e8e8f0;
  padding: 20px;
  min-height: 100%;

  .neo-header {
    margin-bottom: 20px;

    .neo-title {
      font-size: 22px;
      font-weight: 700;
      color: #6C9BEB;
      display: block;
      margin-bottom: 15px;
    }

    .neo-stats {
      display: flex;
      gap: 12px;

      .neo-stat-card {
        background: #e8e8f0;
        border-radius: 16px;
        padding: 15px 12px;
        text-align: center;
        box-shadow:
          8px 8px 16px #c5c5d0,
          -8px -8px 16px #fff;
        flex: 1;

        .neo-icon { font-size: 24px; }
        .neo-value {
          font-size: 24px;
          font-weight: 700;
          color: #333;
          display: block;
        }
        .neo-label {
          font-size: 12px;
          color: #888;
        }
      }
    }
  }

  .neo-month {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;

    .neo-month-title {
      font-size: 18px;
      font-weight: 600;
      color: #333;
    }

    .neo-nav {
      display: flex;
      gap: 8px;

      .neo-btn {
        width: 36px;
        height: 36px;
        border-radius: 12px;
        background: #e8e8f0;
        border: none;
        box-shadow:
          4px 4px 8px #c5c5d0,
          -4px -4px 8px #fff;
        cursor: pointer;
        font-size: 16px;

        &:active {
          box-shadow:
            inset 4px 4px 8px #c5c5d0,
            inset -4px -4px 8px #fff;
        }

        &.neo-today {
          width: auto;
          padding: 0 16px;
          background: #6C9BEB;
          color: #fff;
          box-shadow:
            4px 4px 8px #c5c5d0;
        }
      }
    }
  }

  .neo-tasks {
    .neo-task-card {
      background: #e8e8f0;
      border-radius: 16px;
      padding: 16px;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 12px;
      box-shadow:
        6px 6px 12px #c5c5d0,
        -6px -6px 12px #fff;

      .neo-task-dot {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #6C9BEB;

        &.work { background: #FF6B6B; }
        &.health { background: #4CAF50; }
      }

      .neo-task-info {
        flex: 1;

        .neo-task-name {
          font-size: 16px;
          font-weight: 500;
          color: #333;
        }
        .neo-task-time {
          font-size: 12px;
          color: #888;
          display: block;
        }
      }

      .neo-task-badge {
        font-size: 12px;
        padding: 4px 12px;
        border-radius: 8px;
        background: #6C9BEB;
        color: #fff;
      }
    }
  }

  .neo-bottom-nav {
    display: flex;
    justify-content: space-around;
    padding: 15px 0;
    margin-top: 30px;
    background: #e8e8f0;
    border-radius: 20px;
    box-shadow:
      8px -8px 16px #c5c5d0;

    .neo-nav-item {
      text-align: center;
      color: #888;

      span:first-child { font-size: 24px; }
      span:last-child { font-size: 12px; display: block; }

      &.active { color: #6C9BEB; }
    }
  }
}

// ========== 玻璃拟态风格 ==========
.glass-ui {
  min-height: 100%;
  position: relative;

  .glass-bg {
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    z-index: 0;
  }

  .glass-header, .glass-hero, .glass-stats, .glass-tasks {
    position: relative;
    z-index: 1;
  }

  .glass-header {
    padding: 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;

    .glass-date {
      font-size: 18px;
      font-weight: 600;
      color: #fff;
    }

    .glass-actions {
      display: flex;
      gap: 10px;

      .glass-btn {
        width: 40px;
        height: 40px;
        border-radius: 12px;
        background: rgba(255,255,255,0.2);
        backdrop-filter: blur(10px);
        border: none;
        color: #fff;
        font-size: 18px;
      }
    }
  }

  .glass-hero {
    padding: 20px;

    .glass-progress-card {
      background: rgba(255,255,255,0.15);
      backdrop-filter: blur(20px);
      border-radius: 24px;
      padding: 20px;
      border: 1px solid rgba(255,255,255,0.2);

      .glass-progress-title {
        color: #fff;
        font-size: 14px;
        display: block;
        margin-bottom: 15px;
      }

      .glass-progress-bar {
        height: 8px;
        background: rgba(255,255,255,0.2);
        border-radius: 4px;

        .glass-progress-fill {
          height: 100%;
          background: #fff;
          border-radius: 4px;
        }
      }

      .glass-progress-text {
        color: rgba(255,255,255,0.8);
        font-size: 12px;
        display: block;
        margin-top: 10px;
      }
    }
  }

  .glass-stats {
    display: flex;
    gap: 15px;
    padding: 0 20px;

    .glass-stat {
      flex: 1;
      background: rgba(255,255,255,0.15);
      backdrop-filter: blur(10px);
      border-radius: 20px;
      padding: 15px;
      text-align: center;

      .glass-stat-icon { font-size: 28px; }
      .glass-stat-num {
        font-size: 28px;
        font-weight: 700;
        color: #fff;
        display: block;
      }
      .glass-stat-label {
        font-size: 12px;
        color: rgba(255,255,255,0.7);
      }
    }
  }

  .glass-tasks {
    padding: 20px;

    .glass-task {
      background: rgba(255,255,255,0.15);
      backdrop-filter: blur(10px);
      border-radius: 16px;
      padding: 15px;
      display: flex;
      gap: 15px;
      margin-bottom: 12px;

      .glass-task-left {
        .glass-task-time {
          font-size: 14px;
          color: rgba(255,255,255,0.8);
          font-weight: 600;
        }
        .glass-task-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          margin-top: 5px;

          &.study { background: #6C9BEB; }
          &.work { background: #FF6B6B; }
        }
      }

      .glass-task-content {
        .glass-task-name {
          color: #fff;
          font-size: 16px;
          font-weight: 500;
        }
        .glass-task-tag {
          font-size: 12px;
          color: rgba(255,255,255,0.6);
          display: block;
        }
      }
    }
  }
}

// ========== 极简风格 ==========
.minimal-ui {
  background: #fff;
  padding: 20px;
  min-height: 100%;

  .min-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;

    .min-logo {
      font-size: 20px;
      font-weight: 700;
      color: #1a1a1a;
    }

    .min-actions {
      display: flex;
      gap: 15px;
      color: #666;
      font-size: 18px;

      .min-add {
        width: 28px;
        height: 28px;
        border-radius: 6px;
        background: #1a1a1a;
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
      }
    }
  }

  .min-month {
    .min-month-text {
      font-size: 16px;
      font-weight: 600;
      color: #1a1a1a;
    }
    .min-divider {
      height: 1px;
      background: #e0e0e0;
      margin-top: 15px;
    }
  }

  .min-day {
    margin-top: 20px;

    .min-day-label {
      font-size: 14px;
      color: #666;
      display: block;
      margin-bottom: 15px;
    }

    .min-tasks {
      .min-task {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 12px 0;
        border-bottom: 1px solid #f0f0f0;

        .min-time {
          font-size: 13px;
          color: #999;
          width: 50px;
        }

        .min-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          margin-top: 4px;

          &.study { background: #6C9BEB; }
          &.work { background: #FF6B6B; }
          &.health { background: #4CAF50; }
          &.empty { border: 2px solid #ccc; background: transparent; }
        }

        .min-name {
          font-size: 15px;
          color: #1a1a1a;
          flex: 1;
        }

        .min-meta {
          font-size: 12px;
          color: #999;
        }

        &.future {
          .min-name { color: #666; }
        }
      }
    }
  }

  .min-tomorrow {
    margin-top: 30px;
  }
}

// ========== iOS风格 ==========
.ios-ui {
  background: #F2F2F7;
  min-height: 100%;

  .ios-header {
    padding: 15px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;

    .ios-month {
      font-size: 28px;
      font-weight: 700;
      color: #1a1a1a;
    }

    .ios-year {
      font-size: 14px;
      color: #666;
      position: absolute;
      left: 20px;
      top: 45px;
    }

    .ios-actions {
      display: flex;
      gap: 15px;
      font-size: 20px;
      color: #007AFF;

      .ios-add {
        font-weight: 700;
      }
    }
  }

  .ios-calendar-strip {
    display: flex;
    justify-content: space-around;
    padding: 10px;

    .ios-day-col {
      text-align: center;
      padding: 8px;
      border-radius: 12px;

      .ios-day-name {
        font-size: 12px;
        color: #666;
        display: block;
      }

      .ios-day-num {
        font-size: 18px;
        font-weight: 500;
        color: #1a1a1a;
      }

      &.today {
        .ios-day-num.active {
          width: 36px;
          height: 36px;
          background: #007AFF;
          color: #fff;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 5px auto;
        }

        .ios-indicator {
          height: 4px;
          width: 4px;
          background: #007AFF;
          border-radius: 50%;
          margin: 4px auto 0;
        }
      }
    }
  }

  .ios-content {
    padding: 20px;

    .ios-section-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;

      span:first-child {
        font-size: 18px;
        font-weight: 600;
        color: #1a1a1a;
      }

      .ios-section-count {
        font-size: 14px;
        color: #007AFF;
      }
    }

    .ios-card {
      background: #fff;
      border-radius: 12px;
      padding: 0;

      .ios-task-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 15px;

        .ios-task-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;

          &.study { background: #6C9BEB; }
          &.work { background: #FF6B6B; }
          &.health { background: #4CAF50; }
        }

        .ios-task-main {
          .ios-task-name {
            font-size: 16px;
            color: #1a1a1a;
          }
          .ios-task-time {
            font-size: 12px;
            color: #666;
            display: block;
          }
        }
      }

      .ios-divider {
        height: 1px;
        background: #E5E5EA;
        margin-left: 40px;
      }
    }
  }

  .ios-bottom {
    display: flex;
    justify-content: space-around;
    background: #fff;
    border-top: 1px solid #E5E5EA;
    padding: 10px 0;
    margin-top: 30px;

    .ios-nav-item {
      text-align: center;

      .ios-nav-icon { font-size: 24px; }
      span:last-child {
        font-size: 10px;
        color: #666;
        display: block;
      }

      &.active {
        .ios-nav-icon { color: #007AFF; }
        span:last-child { color: #007AFF; }
      }
    }
  }
}
</style>