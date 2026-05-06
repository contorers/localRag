<script setup>
import { ref, watch,computed } from 'vue';
import { useUserStore } from './store/useStore'; // 假设你用 Pinia
import Alert from "./components/ui/Alert.vue";

const userStore = useUserStore();
const isLoading = computed(() => userStore.isLoading);

// --- 进度条逻辑 ---
const progress = ref(0);      // 进度值 0-100
const isVisible = ref(false); // 控制容器显示/隐藏
let timer = null;             // 定时器引用

watch(isLoading, (newVal) => {
  if (newVal) {
    // === 开始加载 ===
    isVisible.value = true;
    progress.value = 0; // 重置

    // 🔥 关键 1：起步直接跳到 30%！
    // 稍微给点延迟让浏览器反应过来
    setTimeout(() => {
      progress.value = 30; 
    }, 20);

    // 🔥 关键 2：开启“假进度”，慢慢蹭到 90%
    // 这样如果接口慢，用户也能看到进度条在动
    timer = setInterval(() => {
      if (progress.value < 90) {
        progress.value += (Math.random() * 5); // 随机增加一点点
      }
    }, 400);

  } else {
    // === 加载结束 ===
    // 清除假进度定时器
    if (timer) clearInterval(timer);
    
    // 🔥 关键 3：强制瞬间拉满到 100%
    progress.value = 100;

    // 🔥 关键 4：等 100% 动画跑完后（比如 300ms），再隐藏整个条
    setTimeout(() => {
      isVisible.value = false;
      // 动画结束后归零，为下一次做准备
      setTimeout(() => { progress.value = 0; }, 300);
    }, 300); 
  }
});
</script>

<template>
  <div>
   <div class="global-progress-bar" :class="{ 'hidden': !isVisible }">
      <div 
        class="bar-inner" 
        :style="{ width: progress + '%' }"
      ></div>
    </div>
    <router-view v-slot="{ Component, route }">
      <transition name="fade" mode="out-in">
        <keep-alive
          :include="[
            
          ]"
        >
          <component :is="Component" :key="route.path" />
        </keep-alive>
      </transition>
    </router-view>
    <Alert />
  </div>
</template>

<style scoped>
/* 进度条容器 */
.global-progress-bar {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 3px;
  z-index: 9999;
  background: transparent;
  /* 控制容器本身的淡入淡出 */
  transition: opacity 0.3s ease; 
  opacity: 1;
}

/* 隐藏状态 */
.global-progress-bar.hidden {
  opacity: 0;
  pointer-events: none; /* 隐藏时禁止点击穿透 */
}

/* 进度条本体 */
.bar-inner {
  height: 100%;
  background: #1877f2; /* 你的主题色 */
  
  /* 🔥 关键：CSS 过渡，让 width 的变化丝滑 */
  transition: width 0.3s ease-out;
  
  /* 增加一个阴影，让它看起来会发光（类似 YouTube） */
  box-shadow: 0 0 10px rgba(24, 119, 242, 0.7);
}
</style>
