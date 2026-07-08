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
// iOS 风格首页
.home-view {
  min-height: 100vh;
  padding: 48px 24px;
  background: #F2F2F7;
  color: #1A1A1A;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.hero {
  width: 100%;
  max-width: 960px;
  margin-bottom: 40px;
}

.hero-title {
  font-size: 40px;
  font-weight: 700;
  margin: 0 0 8px;
  letter-spacing: -0.02em;
  color: #1A1A1A;
}

.hero-subtitle {
  font-size: 15px;
  color: #8E8E93;
  margin: 0;
}

.projects-grid {
  width: 100%;
  max-width: 960px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.project-card {
  --accent: #007AFF;
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 20px;
  background: #FFFFFF;
  border: none;
  border-radius: 16px;
  text-align: left;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  font-family: inherit;
  color: #1A1A1A;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);

  &.featured {
    background: linear-gradient(135deg, #FFFFFF 0%, #F8FCFD 100%);
    border: 2px solid var(--accent);
    box-shadow: 0 4px 16px rgba(129, 201, 216, 0.25);
    padding: 24px;

    .card-icon {
      background: linear-gradient(135deg, var(--accent) 0%, #A5D6E2 100%);
      color: white;
    }

    .card-title {
      color: #1A1A1A;
      font-size: 18px;
    }
  }

  &:active:not(.disabled):not(.placeholder) {
    transform: scale(0.98);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
  }

  &.disabled,
  &.placeholder {
    cursor: default;
    opacity: 0.55;
  }
}

.card-action {
  margin-top: 12px;
  font-size: 14px;
  color: var(--accent);
  font-weight: 500;
}

.card-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: #F2F2F7;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  flex-shrink: 0;
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
}

.card-title {
  font-size: 17px;
  font-weight: 600;
}

.card-desc {
  font-size: 14px;
  color: #8E8E93;
  margin: 0 0 10px;
  line-height: 1.5;
}

.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 8px;
  background: #E5E5EA;
  color: #007AFF;
}

.badge {
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 6px;

  &.badge-active { background: #D4EDDA; color: #155724; font-weight: 500; }
  &.badge-wip { background: #FFF3CD; color: #856404; }
  &.badge-planned { background: #E5E5EA; color: #8E8E93; }
}

.card-action {
  margin-top: 12px;
  font-size: 14px;
  color: var(--accent);
  font-weight: 500;
}

.card-arrow {
  display: none;
}

.footer {
  margin-top: auto;
  padding-top: 48px;
  font-size: 13px;
  color: #8E8E93;
}

@media (max-width: 768px) {
  .home-view { padding: 32px 16px; }
  .hero-title { font-size: 32px; }
  .projects-grid { grid-template-columns: 1fr; }
  .project-card { padding: 16px; }
}
</style>
