<template>
  <transition name="fade">
    <div v-if="visible" class="confirm-overlay" @click.self="handleOverlayClick">
      <div class="confirm-box" :class="{ 'shake-animation': isShaking }" @click.stop>
        <div class="confirm-header">{{ title }}</div>
        
        <div class="confirm-content">{{ content || message }}</div> 
        
        <div class="confirm-footer">
          <button class="btn cancel-btn" @click="handleCancel">{{ cancelText }}</button>
          <button class="btn confirm-btn" :class="type" @click="handleConfirm">{{ confirmText }}</button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, onMounted } from 'vue'

// 动态接收所有配置项
const props = defineProps({
  title: { type: String, default: '安全提示' },
  content: { type: String, default: '' },
  message: { type: String, default: '' }, // 兼容不同的命名习惯
  type: { type: String, default: 'danger' }, // primary, danger 等
  confirmText: { type: String, default: '确定' }, // 💡 动态按钮文字
  cancelText: { type: String, default: '取消' },
  closeOnClickModal: { type: Boolean, default: false }, // 是否允许点击背景关闭
  onConfirm: Function,
  onCancel: Function,
  remove: Function // 用于销毁 DOM 的回调
})

const visible = ref(false)
const isShaking = ref(false)

// 挂载后触发动画
onMounted(() => {
  visible.value = true
})

// 关闭弹窗的统一逻辑
const close = () => {
  visible.value = false
  // 等待 300ms 离场动画播放完毕后，彻底销毁 DOM
  setTimeout(() => {
    if (props.remove) props.remove()
  }, 300)
}

const handleConfirm = () => {
  if (props.onConfirm) props.onConfirm()
  close()
}

const handleCancel = () => {
  if (props.onCancel) props.onCancel()
  close()
}

// 遮罩层点击逻辑
const handleOverlayClick = () => {
  if (props.closeOnClickModal) {
    handleCancel()
  } else {
    // 触发抖动反馈
    isShaking.value = true
    setTimeout(() => { isShaking.value = false }, 400)
  }
}
</script>

<style scoped>
/* 遮罩层：毛玻璃效果 */
.confirm-overlay {
  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
  background-color: rgba(0, 0, 0, 0.4); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center; z-index: 9999;
}

/* 弹窗卡片：类似 iOS 的圆润质感 */
.confirm-box {
  width: 320px; background: #ffffff; border-radius: 16px; padding: 24px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15); transform-origin: center;
}

.confirm-header {
  font-size: 18px; font-weight: 600; color: #1a1a1a; margin-bottom: 12px;
}

.confirm-content {
  font-size: 15px; color: #666666; line-height: 1.5; margin-bottom: 24px;
}

/* 底部按钮区 */
.confirm-footer {
  display: flex; justify-content: flex-end; gap: 12px;
}

.btn {
  padding: 8px 20px; border-radius: 20px; font-size: 14px; font-weight: 500;
  cursor: pointer; border: none; transition: all 0.2s;
}

.cancel-btn { background-color: #f4f4f5; color: #606266; }
.cancel-btn:hover { background-color: #e9e9eb; }

/* 💡 动态颜色类名支持 */
.confirm-btn { background-color: #525252; color: #ffffff; } /* 默认蓝色 */
.confirm-btn:hover { background-color: rgb(126, 126, 126); }
.confirm-btn.danger { background-color: #f56c6c; } /* 如果传了 type: 'danger' 变红 */
.confirm-btn.danger:hover { background-color: #e55c5c; }

/* Vue 的 Transition 动画：淡入放大 */
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-active .confirm-box, .fade-leave-active .confirm-box {
  transition: transform 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28);
}
.fade-enter-from, .fade-leave-to { opacity: 0; }
.fade-enter-from .confirm-box, .fade-leave-to .confirm-box { transform: scale(0.8); }

/* 抖动动画 */
.shake-animation { animation: shake 0.4s both !important; }
@keyframes shake {
  10%, 90% { transform: translate3d(-2px, 0, 0); }
  20%, 80% { transform: translate3d(4px, 0, 0); }
  30%, 50%, 70% { transform: translate3d(-8px, 0, 0); }
  40%, 60% { transform: translate3d(8px, 0, 0); }
}
</style>