import { createVNode, render } from 'vue'
import ConfirmDialog from '../ConfirmDialog.vue' // 路径根据你的实际情况改

export function showConfirm(options = {}) {
  // 💡 兼容处理：如果直接传字符串 showConfirm("确定吗？")，自动转成对象
  if (typeof options === 'string') {
    options = { message: options }
  }

  return new Promise((resolve) => {
    // 1. 创建临时的 DOM 容器
    const mountNode = document.createElement('div')
    document.body.appendChild(mountNode)

    // 2. 销毁函数（防止内存泄漏）
    const remove = () => {
      render(null, mountNode)
      mountNode.remove()
    }

    // 3. 将 Vue 组件转换为虚拟 DOM，把 options 全部当做 props 传进去
    const vnode = createVNode(ConfirmDialog, {
      ...options, // 展开所有配置：title, message, type, confirmText 等
      onConfirm: () => resolve(true),
      onCancel: () => resolve(false),
      remove
    })

    // 4. 渲染到页面上
    render(vnode, mountNode)
  })
}