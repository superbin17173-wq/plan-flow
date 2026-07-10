<script setup lang="ts">
import { useRouter } from 'vue-router'
import { projects } from '../projects/registry'

const router = useRouter()

function openProject(route: string, status: string) {
  if (status !== 'active') return
  router.push(route)
}
</script>

<template>
  <div class="home-view">
    <header class="hero">
      <h1 class="hero-title">我的项目</h1>
      <p class="hero-subtitle">SuperBin's Workspace · 选择一个项目开始</p>
    </header>

    <main class="projects-grid">
      <button
        v-for="p in projects"
        :key="p.id"
        class="project-card"
        :class="{ disabled: p.status !== 'active', featured: p.status === 'active' }"
        :style="{ '--accent': p.color }"
        @click="openProject(p.route, p.status)"
      >
        <div class="card-icon">{{ p.icon }}</div>
        <div class="card-body">
          <div class="card-title-row">
            <span class="card-title">{{ p.name }}</span>
            <span v-if="p.status === 'wip'" class="badge badge-wip">开发中</span>
            <span v-else-if="p.status === 'planned'" class="badge badge-planned">规划中</span>
            <span v-else class="badge badge-active">可用</span>
          </div>
          <p class="card-desc">{{ p.description }}</p>
          <div v-if="p.tags?.length" class="card-tags">
            <span v-for="t in p.tags" :key="t" class="tag">{{ t }}</span>
          </div>
          <div v-if="p.status === 'active'" class="card-action">点击进入 →</div>
        </div>
      </button>

      <div class="project-card placeholder">
        <div class="card-icon">✨</div>
        <div class="card-body">
          <div class="card-title">更多项目</div>
          <p class="card-desc">敬请期待</p>
        </div>
      </div>
    </main>

    <footer class="footer">
      <span>© {{ new Date().getFullYear() }} SuperBin</span>
    </footer>
  </div>
</template>

<style lang="scss" scoped>
// iOS 首页
.home-view {
  min-height: 100vh;
  padding: calc(56px + var(--safe-top)) 24px 40px;
  background: var(--bg-primary);
  color: var(--text-primary);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.hero {
  width: 100%;
  max-width: 960px;
  margin-bottom: 32px;
}

.hero-title {
  font-size: var(--font-size-largetitle);
  font-weight: 700;
  margin: 0 0 6px;
  letter-spacing: -0.03em;
  color: var(--text-primary);
}

.hero-subtitle {
  font-size: var(--font-size-sub);
  color: var(--text-tertiary);
  margin: 0;
  letter-spacing: -0.01em;
}

.projects-grid {
  width: 100%;
  max-width: 960px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 14px;
}

.project-card {
  --accent: var(--ios-blue);
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 20px;
  background: var(--bg-card);
  border: none;
  border-radius: var(--radius-lg);
  text-align: left;
  cursor: pointer;
  transition: transform var(--spring), box-shadow var(--transition-normal);
  font-family: inherit;
  color: var(--text-primary);
  box-shadow: var(--shadow-sm);

  &.featured {
    padding: 22px;
    background: var(--bg-card);
    box-shadow: 0 6px 20px rgba(0, 122, 255, 0.14), var(--shadow-sm);

    .card-icon {
      background: linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 70%, white) 100%);
      color: #fff;
      box-shadow: 0 4px 12px color-mix(in srgb, var(--accent) 32%, transparent);
    }

    .card-title { font-size: var(--font-size-title3); }
  }

  &:hover:not(.disabled):not(.placeholder) {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }

  &:active:not(.disabled):not(.placeholder) {
    transform: scale(0.98);
    box-shadow: var(--shadow-xs);
  }

  &.disabled, &.placeholder {
    cursor: default;
    opacity: 0.55;
  }
}

.card-icon {
  width: 52px;
  height: 52px;
  border-radius: var(--radius-md);
  background: var(--bg-fill-quaternary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
  flex-shrink: 0;
  transition: transform var(--spring);
}

.card-body {
  flex: 1;
  min-width: 0;
}

.card-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  flex-wrap: wrap;
}

.card-title {
  font-size: var(--font-size-body);
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--text-primary);
}

.card-desc {
  font-size: var(--font-size-sub);
  color: var(--text-tertiary);
  margin: 0 0 10px;
  line-height: 1.5;
}

.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag {
  font-size: var(--font-size-caption);
  padding: 3px 10px;
  border-radius: var(--radius-full);
  background: rgba(0, 122, 255, 0.10);
  color: var(--ios-blue);
  font-weight: 500;
}
.dark .tag { background: rgba(10, 132, 255, 0.20); }

.badge {
  font-size: var(--font-size-caption2);
  padding: 3px 8px;
  border-radius: var(--radius-full);
  font-weight: 600;

  &.badge-active {
    background: rgba(52, 199, 89, 0.16);
    color: var(--ios-green);
  }
  &.badge-wip {
    background: rgba(255, 149, 0, 0.16);
    color: var(--ios-orange);
  }
  &.badge-planned {
    background: var(--bg-fill-quaternary);
    color: var(--text-tertiary);
  }
}

.card-action {
  margin-top: 12px;
  font-size: var(--font-size-sub);
  color: var(--accent);
  font-weight: 600;
  letter-spacing: -0.01em;
}

.card-arrow { display: none; }

.footer {
  margin-top: auto;
  padding-top: 48px;
  font-size: var(--font-size-footnote);
  color: var(--text-tertiary);
}

@media (max-width: 768px) {
  .home-view { padding: calc(32px + var(--safe-top)) 16px 32px; }
  .hero-title { font-size: 32px; }
  .projects-grid { grid-template-columns: 1fr; }
  .project-card { padding: 18px; }
}
</style>
