<template>
  <div class="streaming-container" ref="containerRef">
    <div 
      v-show="!renderedHtml && content" 
      class="markdown-body raw-text-fallback" 
      style="white-space: pre-wrap; word-break: break-word;"
    >
      {{ content }}
    </div>

    <!-- 🌟 统一事件代理入口 -->
    <div
      v-show="renderedHtml"
      ref="markdownRef"
      class="markdown-body"
      :class="{ 'is-generating-state': isGenerating }"
      v-html="renderedHtml"
      @click="handleDelegatedClicks"
    ></div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onMounted, onUnmounted } from "vue";
import { throttle } from "lodash-es";
import DOMPurify from "dompurify";
import "highlight.js/styles/atom-one-light.css";

import "katex/dist/katex.min.css";
import "../../node_modules/somarkdown/dist/somarkdown.css";

import mermaid from "mermaid";
import { renderMarkdownAsync, unregisterMarkdown } from "../markdown/markdownClient"; 

DOMPurify.addHook('uponSanitizeElement', (node, data) => {
  if (data.tagName && data.tagName.toLowerCase().startsWith('mjx-')) {
    data.allowedTags[data.tagName] = true;
  }
});
DOMPurify.addHook('uponSanitizeAttribute', (node, data) => {
  if (data.attrName && data.attrName.toLowerCase().startsWith('mjx-')) {
    data.allowedAttributes[data.attrName] = true;
  }
});

const purifyConfig = {
  ADD_TAGS: [
    'mjx-container', 'mjx-assistive-mml', 'math', 'mi', 'mo', 'mn', 'ms', 'mtext',
    'svg', 'path', 'g', 'defs', 'use', 'img',
    'span', 'annotation', 'semantics' 
  ], 
  ADD_ATTR: ['src', 'viewBox', 'd', 'style', 'data-tex', 'transform', 'display','target', 'rel','id', 'href', 'class'], 
  ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-]|$))/i,
  ADD_URI_SAFE_ATTR: ['src'],
  ALLOW_DATA_ATTR: true 
};

mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
});

const props = defineProps({
  content: { type: String, default: "" },
  maxWidth: { type: String, default: "100%" },
  isGenerating: { type: Boolean, default: false },
  isLocked: { type: Boolean, default: false },
  engine: { type: String, default: "somarkdown" }, 
});

const containerRef = ref(null);
const markdownRef = ref(null);
const renderedHtml = ref("");
const bubbleId = Math.random().toString(36).substring(2, 9);
const emit = defineEmits(['rendered']); 

// ==========================================
// 🌟 全局点击监听，控制代码块垂直滚动条的显隐
// ==========================================
const handleGlobalClick = (e) => {
  if (!markdownRef.value) return;
  
  const clickedPre = e.target.closest('pre');
  
  markdownRef.value.querySelectorAll('pre.is-active-scroll').forEach(p => {
    if (p !== clickedPre) {
      p.classList.remove('is-active-scroll');
    }
  });
  
  if (clickedPre && markdownRef.value.contains(clickedPre)) {
    clickedPre.classList.add('is-active-scroll');
  }
};

// ==========================================
// 🌟 准备你的两个图标常量 (放在 script 顶部区域即可)
// ==========================================
const iconCopy = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>`;
const iconCheck = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

// ==========================================
// 🌟 修改一：事件代理 (实现图标无缝切换)
// ==========================================
const handleDelegatedClicks = async (e) => {
  const btn = e.target.closest('.action-btn');
  if (!btn) return;

  const type = btn.getAttribute('data-type');
  
  if (type === 'image') {
    const wrapper = btn.closest('.image-download-wrapper');
    const img = wrapper ? wrapper.querySelector('img') : null;
    if (img) downloadFile(img.src, `image-${Date.now()}.png`);
  } 
  else if (type === 'svg') {
    const wrapper = btn.closest('.svg-download-wrapper');
    const svg = wrapper ? wrapper.querySelector('svg:not(.icon)') : null;
    if (svg) downloadSvg(svg, `diagram-${Date.now()}.svg`);
  } 
  else if (type === 'copy-code') {
    const wrapper = btn.closest('.code-block-wrapper');
    const codeEl = wrapper ? (wrapper.querySelector('pre code') || wrapper.querySelector('pre')) : null;
    
    if (codeEl) {
      try {
        await navigator.clipboard.writeText(codeEl.innerText || codeEl.textContent);
        // 🌟 成功后：直接将整个按钮的内部替换为打勾图标
        btn.innerHTML = iconCheck;
        // 🌟 2秒后恢复成原本的复制图标
        setTimeout(() => { btn.innerHTML = iconCopy; }, 2000);
      } catch (err) {
        console.error('复制失败:', err);
        showAlert("warning", `浏览器剪贴板权限受限，请手动框选复制`);
      }
    }
  }
};

// ==========================================
// 🌟 修改二：注入 Header (去掉 span 文字)
// ==========================================
const injectCodeBlockHeaders = () => {
  const container = markdownRef.value;
  if (!container) return;

  const pres = container.querySelectorAll('pre:not(.has-wrapper)');
  
  pres.forEach(pre => {
    if (pre.closest('.math-block-wrapper, .katex-display, .katex, .code-block, .somarkdown-code-block')) {
      return;
    }
    const code = pre.querySelector('code');
    if (code && code.className.includes('language-math')) return; 

    pre.classList.add('has-wrapper');

    let lang = 'Text';
    if (code && code.className) {
      const match = code.className.match(/language-(\w+)/);
      if (match) lang = match[1];
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'code-block-wrapper fade-in-smooth';
    
    pre.parentNode.insertBefore(wrapper, pre);
    
    const header = document.createElement('div');
    header.className = 'code-header';
    // 🌟 移除文字，只放 iconCopy 变量
    header.innerHTML = `
      <span class="code-lang">${lang}</span>
      <button class="action-btn copy-btn" data-type="copy-code" title="复制代码">
        ${iconCopy}
      </button>
    `;

    wrapper.appendChild(header);
    wrapper.appendChild(pre);
  });
};

// 用户的原始下载逻辑
const downloadFile = async (url, filename) => {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch (e) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.target = '_blank';
    a.click();
  }
};

const downloadSvg = (svgEl, filename) => {
  const clone = svgEl.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const svgData = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const injectDownloadButtons = () => {
  const container = markdownRef.value;
  if (!container) return;

  const images = container.querySelectorAll('img:not(.has-download)');
  images.forEach(img => {
    img.classList.add('has-download'); 
    const wrapper = document.createElement('div');
    wrapper.className = 'image-download-wrapper fade-in-smooth';

    img.parentNode.insertBefore(wrapper, img);
    wrapper.appendChild(img);

    const btn = document.createElement('button');
    btn.className = 'action-btn download-btn';
    btn.setAttribute('data-type', 'image');
    btn.title = "下载图片";
    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
    wrapper.appendChild(btn);
  });
};

const renderAllMermaid = () => {
  const container = markdownRef.value;
  if (!container) return;

  if (container.offsetWidth === 0) {
    setTimeout(renderAllMermaid, 50);
    return;
  }

  const blocks = container.querySelectorAll(".mermaid-block:not(.rendered)");
  if (!blocks || blocks.length === 0) return;

  blocks.forEach(async (block) => {
    const rawSource = block.getAttribute("data-source");
    if (!rawSource) return;

    try {
      block.classList.add("rendered"); 
      const { svg } = await mermaid.render(`mermaid-${Math.random().toString(36).substr(2, 9)}`, decodeURIComponent(rawSource));
      
      block.innerHTML = `
        <div class="svg-download-wrapper fade-in-smooth" style="position: relative; width: 100%;">
          <button class="action-btn download-btn" data-type="svg" title="下载图表">
            <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          </button>
          ${svg}
        </div>
      `;
    } catch (e) {
      block.innerHTML = `<div style="color:#ef4444; font-size:12px; padding:10px;">图表语法错误</div>`;
      console.error("Mermaid 渲染错误:", e);
    }
  });
};

const throttledRender = throttle(
  (newText) => {
    if (isDestroyed) return;
    renderMarkdownAsync(bubbleId, newText, props.isGenerating, props.engine, (data) => {
      if (isDestroyed || data.status !== 'success') return;
      
      const safeHtml = DOMPurify.sanitize(data.html, purifyConfig);
      renderedHtml.value = safeHtml;
      
      nextTick(() => {
        renderAllMermaid();
        if (!props.isGenerating) {
          injectDownloadButtons();
          injectCodeBlockHeaders(); 
        }
        emit('rendered'); 
      });
    });
  },
  80 
);

watch(
  () => props.engine,
  () => {
    if (props.content) throttledRender(props.content);
  }
);

onMounted(() => {
  document.addEventListener('click', handleGlobalClick);
});
let isDestroyed = false;
onUnmounted(() => {
  isDestroyed = true;
  document.removeEventListener('click', handleGlobalClick); 
  if (throttledRender && throttledRender.cancel) throttledRender.cancel();
  unregisterMarkdown(bubbleId);
});

watch(() => props.isGenerating, (val) => {
  if (!val) {
    throttledRender.flush(); 
    setTimeout(() => {
      renderAllMermaid();
      injectDownloadButtons(); 
      injectCodeBlockHeaders(); 
    }, 100);
    nextTick(() => {
      emit('rendered');
    });
  }
});

watch(
  () => props.content,
  (newText) => {
    if (!newText) return;
    throttledRender(newText);
  },
  { immediate: true }
);
</script>

<style scoped>
/* ==========================================
   全局与基础排版 (Gemini 极简风格)
   ========================================== */
.app-container,
.streaming-container {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  font-family: "Google Sans", "Segoe UI", Roboto, "Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif;
  letter-spacing: 0.2px;
  contain: layout;
  overflow-anchor: none;
  user-select: text;
}

.markdown-body {
  display: flow-root;
  color: #202124; 
  line-height: 1.75;
  font-size: 15px; 
}

/* 标题样式：清爽干净 */
.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4) {
  color: #202124;
  font-weight: 500; 
  margin-top: 1.6em;
  margin-bottom: 0.8em;
  line-height: 1.3;
}
.markdown-body :deep(h1) { font-size: 1.6em; }
.markdown-body :deep(h2) { font-size: 1.3em; padding-bottom: 0.3em; border-bottom: 1px solid #f1f3f4; }
.markdown-body :deep(h3) { font-size: 1.1em; }

.markdown-body :deep(p) { margin-top: 0; margin-bottom: 1.2em; }

/* 链接 */
.markdown-body :deep(a) { 
  color: #1a73e8; 
  text-decoration: none; 
}
.markdown-body :deep(a:hover) { 
  text-decoration: underline; 
}

.markdown-body :deep(ul), .markdown-body :deep(ol) { padding-left: 1.5em; margin-bottom: 1.2em; }
.markdown-body :deep(li) { margin-bottom: 0.4em; }

/* 引用块 */
.markdown-body :deep(blockquote) { 
  margin: 1.2em 0; 
  padding: 0.8em 1.2em; 
  color: #6c6c6c; 
  background-color: #f9f9f9; 
  border-left: 1px solid #dadce0; 
  border-radius: 0 4px 4px 0;
}
.markdown-body :deep(blockquote p:last-child) { margin-bottom: 0; }

.markdown-body :deep(img) {
  display: block;
  min-height: 120px;
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  background-color: #f8f9fa;
  cursor: pointer;
  transition: opacity 0.2s;
  border: 1px solid #f1f3f4;
}
.markdown-body :deep(img:hover) { opacity: 0.9; }

/* ==========================================
   图表与公式 (修正隐形、对齐与防抖)
   ========================================== */
.markdown-body :deep(.mermaid-block:not(.rendered)) {
  opacity: 0; height: 0; overflow: hidden; margin: 0 !important; padding: 0 !important;
}
.markdown-body :deep(svg) { max-width: 100% !important; height: auto !important; overflow: hidden; }
.markdown-body :deep(.mermaid-svg-wrapper svg),
.markdown-body :deep(.mermaid-block svg) { max-width: 100% !important; max-height: 70vh; display: block; margin: 0 auto; }
.markdown-body :deep(mjx-container svg) { max-width: 100% !important; height: auto !important; vertical-align: middle; }

.markdown-body :deep(.fade-in-smooth) { animation: smoothFade 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
@keyframes smoothFade {
  0% { opacity: 0; transform: translateY(4px) scale(0.98); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}

.markdown-body.is-generating-state :deep(.math-block-wrapper),
.markdown-body.is-generating-state :deep(mjx-container[display="true"]) { min-height: 3em; transform: translateZ(0); will-change: transform, opacity; }

/* 表格：淡边框 */
.markdown-body :deep(table) { border-collapse: collapse; width: max-content; max-width: 100%; margin: 1.5em 0; text-align: left; border: 1px solid #dadce0; border-radius: 8px; overflow: hidden; }
.markdown-body :deep(th), .markdown-body :deep(td) { padding: 10px 14px; border: 1px solid #dadce0; }
.markdown-body :deep(th) { font-weight: 500; background-color: #f8f9fa; }

/* 公式防丢与样式约束 */
.markdown-body :deep(.math-block-wrapper) { position: relative; margin: 0.8em 0 !important; padding: 4px 0 !important; border-radius: 8px; transition: background 0.2s; contain: layout style; transform: translateZ(0); }
.markdown-body :deep(.math-inline-wrapper) { contain: layout style; transform: translateZ(0); }
.markdown-body :deep(.math-block-wrapper:hover) { background-color: #f8f9fa; }
.markdown-body :deep(.math-block-wrapper:hover .copy-math-btn) { opacity: 1 !important; }
.markdown-body :deep(.math-inline-wrapper:hover) { background-color: #f1f3f4; }
.markdown-body :deep(.math-block-wrapper mjx-container), 
.markdown-body :deep(.math-block-wrapper mjx-assistive-mathml) { user-select: text !important; -webkit-user-select: text !important; }

.markdown-body :deep(mjx-assistive-mml) { display: none !important; opacity: 0 !important; pointer-events: none !important; }
.markdown-body :deep(.math-main-content) { display: flex; justify-content: center; align-items: center; width: 100%; }
.markdown-body :deep(.math-block-wrapper mjx-container[display="true"]) { margin: 0 auto !important; }
.markdown-body :deep(mjx-container[jax="SVG"]) { max-width: 100%; overflow-x: auto; overflow-y: hidden; padding-bottom: 8px !important; }

.markdown-body :deep(.math-block-wrapper .copy-math-btn) { position: absolute; top: 4px; right: 8px; opacity: 0; padding: 4px; cursor: pointer; transition: all 0.2s; border-radius: 4px; }
.markdown-body :deep(.math-block-wrapper), .markdown-body :deep(mjx-container[display="true"]), .markdown-body :deep(.katex-display) { display: block; margin: 1.2em 0 !important; padding: 12px 0 !important; line-height: 0 !important; min-height: 40px; text-align: center; }
.markdown-body :deep(.math-inline-wrapper), .markdown-body :deep(mjx-container:not([display="true"])), .markdown-body :deep(.katex) { vertical-align: middle !important; margin: 0 0.15em !important; padding: 0 2px !important; line-height: normal !important; }
.markdown-body :deep(mjx-container), .markdown-body :deep(.katex), .markdown-body :deep(mjx-container:focus) { outline: none !important; background: transparent !important; border: none !important; }
.markdown-body :deep(.katex) { font-size: 1.05em; }

/* 滚动条轻量化 */
.markdown-body :deep(mjx-container[jax="SVG"]), .markdown-body :deep(pre) { scrollbar-width: thin; scrollbar-color: #dadce0 transparent; }
.markdown-body :deep(mjx-container[jax="SVG"])::-webkit-scrollbar, .markdown-body :deep(pre)::-webkit-scrollbar { height: 6px; width: 6px; }
.markdown-body :deep(mjx-container[jax="SVG"])::-webkit-scrollbar-track, .markdown-body :deep(pre)::-webkit-scrollbar-track { background: transparent; }
.markdown-body :deep(mjx-container[jax="SVG"])::-webkit-scrollbar-thumb, .markdown-body :deep(pre)::-webkit-scrollbar-thumb { background: #dadce0; border-radius: 4px; }
.markdown-body :deep(mjx-container[jax="SVG"])::-webkit-scrollbar-thumb:hover, .markdown-body :deep(pre)::-webkit-scrollbar-thumb:hover { background: #bdc1c6; }

.markdown-body :deep(.mermaid-block), .markdown-body :deep(.mermaid-svg-wrapper) { margin: 1.5em 0 !important; padding: 12px !important; min-height: 100px; background-color: #ffffff; border-radius: 12px; border: 1px solid #dadce0;}

.streaming-container { transform: translateZ(0); overflow-anchor: auto; }

/* 打字机光标：Google 蓝色 */
.is-generating-state :deep(> *:last-child::after) { 
  content: "|"; 
  margin-left: 4px; 
  color: #cccccc; 
  animation: cursor-blink 0.8s infinite; 
}
@keyframes cursor-blink { 50% { opacity: 0; } }

/* ==========================================
   按钮与控件交互样式
   ========================================== */
.markdown-body :deep(.button-group) { display: flex; gap: 8px; }

.markdown-body :deep(.action-btn) { 
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #ffffff; 
  border: 0px solid #dadce0 !important; 
  color: #5f6368; 
  padding: 5px 10px; 
  border-radius: 6px; 
  cursor: pointer; 
  font-size: 12px; 
  font-weight: 500;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); 
  box-shadow: 0 1px 2px rgba(60,64,67,0.05) !important; 
}
.markdown-body :deep(.action-btn:hover) { 
  background: #f8f9fa; 
  color: #4a4a4a; 
  border-color: #d3d3d3 !important;
  box-shadow: 0 1px 3px rgba(60,64,67,0.1) !important; 
}
.markdown-body :deep(.action-btn:active) {
  background: #d1d1d1;
  transform: scale(0.97);
}

/* 🛑 核心：确保点击穿透内部元素直接落到 button 上 */
.markdown-body :deep(.action-btn svg),
.markdown-body :deep(.action-btn span) {
  pointer-events: none;
}

/* 图片/SVG上的悬浮下载按钮 */
.markdown-body :deep(.image-download-wrapper),
.markdown-body :deep(.svg-download-wrapper) {
  position: relative;
  display: inline-block;
  max-width: 100%;
}
.markdown-body :deep(.image-download-wrapper img) { margin: 0; }
.markdown-body :deep(.download-btn) {
  position: absolute !important;
  top: 10px !important;
  right: 10px !important;
  opacity: 0;
  border-radius: 8px;
  padding: 8px !important;
  z-index: 10;
  background: rgba(255, 255, 255, 0.715) !important;
  backdrop-filter: blur(4px);
}
.markdown-body :deep(.image-download-wrapper:hover .download-btn),
.markdown-body :deep(.svg-download-wrapper:hover .download-btn) { 
  opacity: 1; 
}

/* ==========================================
   代码块与公式块的统一外观 (白底 Header + 浅白内容区)
   ========================================== */

/* 1. 外层包裹器统一风格 */
.markdown-body :deep(.code-block),
.markdown-body :deep(.code-block-wrapper),
.markdown-body :deep(.math-block-wrapper) {
  background: #ffffff !important;
  border: 1px solid #dadce0 !important;
  border-radius: 12px !important; 
  margin: 1.5em 0 !important;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,0.02) !important;
  contain: layout;
}

/* 2. 统一头部 Header (白底) */
.markdown-body :deep(.code-header) {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #ffffff !important; 
  padding: 8px 12px 8px 16px;
  border-bottom: 1px solid #f1f3f4; 
}

/* 语言高亮 */
.markdown-body :deep(.code-lang) {
  color: #5f6368;
  font-size: 12px;
  font-family: ui-monospace, Consolas, monospace;
  font-weight: 500;
  letter-spacing: 0.5px;
}

/* 3. 代码专属的复制按钮（扁平化） */ 
.markdown-body :deep(.code-header .copy-btn) {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  color: #5f6368;
  padding: 6px; /* 🌟 改成等边距，变成完美的正方形图标按钮 */
  border-radius: 6px;
}
.markdown-body :deep(.code-header .copy-btn:hover) {
  background: #f4f4f4 !important;
  color: #202124;
}
/* 4. 强制重置 pre，使其完美贴合在 wrapper 内部 */
.markdown-body :deep(pre) {
  background: #fcfcfc !important; 
  margin: 0 !important;           
  padding: 16px !important;
  border: none !important;        
  border-radius: 0 0 12px 12px !important; 
  overflow-x: auto !important;    
  overflow-y: hidden !important;  
  max-height: 450px !important;   
  transition: box-shadow 0.2s ease;
}

/* 🌟 点击激活后允许垂直滚动 */
.markdown-body :deep(pre.is-active-scroll) {
  overflow-y: auto !important;
}

/* 5. 释放代码的高亮颜色 */
.markdown-body :deep(pre code),
.markdown-body :deep(pre code.hljs) {
  background: transparent !important;
  font-family: "JetBrains Mono", Consolas, monospace !important;
  font-size: 13.5px !important;
  line-height: 1.6 !important;
  text-shadow: none !important;
}

/* 6. 独立的行内代码保持灰底黑字 */
.markdown-body :deep(code:not(.hljs)):not([class*="language-"]) {
  background-color: #f1f3f4 !important;
  color: #202124 !important;
  padding: 0.15em 0.4em !important;
  border-radius: 4px !important;
  font-family: "JetBrains Mono", Consolas, monospace !important;
  border: none !important;
} 
</style>