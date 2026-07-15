<script setup lang="ts">
import type { FlashcardRating } from '../../types'
import { RATING_EMOJIS } from '../../types'

defineProps<{
  show: boolean
  rating: FlashcardRating
  streak: number
}>()
</script>

<template>
  <Transition name="celebrate">
    <div v-if="show" class="celebration-overlay">
      <!-- 粒子 -->
      <div class="particles">
        <span
          v-for="i in 14"
          :key="i"
          class="particle"
          :style="{
            '--dx': `${(Math.random() - 0.5) * 280}px`,
            '--dy': `${(Math.random() - 0.5) * 280}px`,
            '--color': ['#FFD700', '#FF6B6B', '#5AC8FA', '#34C759', '#AF52DE', '#FF9500'][i % 6],
            '--delay': `${Math.random() * 0.2}s`,
          }"
        />
      </div>
      <!-- 主内容 -->
      <div class="celebrate-content">
        <div class="celebrate-emoji">{{ RATING_EMOJIS[rating] }}</div>
        <div class="celebrate-text">
          {{ rating === 'instant' ? '秒答!' : '答对了!' }}
        </div>
        <div v-if="streak >= 2" class="celebrate-streak">
          🔥 连续 {{ streak }} 次正确
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped lang="scss">
.celebration-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(4px);
}

.particles {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.particle {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--color);
  animation: particleBurst 0.9s ease-out var(--delay) forwards;
}

@keyframes particleBurst {
  0% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }
  100% {
    transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(0);
    opacity: 0;
  }
}

.celebrate-content {
  text-align: center;
  z-index: 1;
}

.celebrate-emoji {
  font-size: 72px;
  animation: bounceIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

.celebrate-text {
  font-size: 28px;
  font-weight: 700;
  color: #fff;
  margin-top: 8px;
  animation: fadeInUp 0.4s ease 0.2s both;
}

.celebrate-streak {
  font-size: 18px;
  font-weight: 600;
  color: #FFD700;
  margin-top: 8px;
  animation: fadeInUp 0.4s ease 0.35s both;
}

@keyframes bounceIn {
  0% { transform: scale(0); }
  60% { transform: scale(1.25); }
  100% { transform: scale(1); }
}

@keyframes fadeInUp {
  0% { opacity: 0; transform: translateY(12px); }
  100% { opacity: 1; transform: translateY(0); }
}

.celebrate-enter-active { transition: opacity 0.2s ease; }
.celebrate-leave-active { transition: opacity 0.3s ease; }
.celebrate-enter-from,
.celebrate-leave-to { opacity: 0; }
</style>
