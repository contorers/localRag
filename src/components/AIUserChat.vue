<template>
  <div class="app-container">
    <!-- ================= 左侧边栏 ================= -->
    <aside :class="['sidebar', { collapsed: isCollapsed }]">
      <div class="sidebar-header">
        <router-link to="/" class="icon-btn" title="返回主页">
          <Icon icon="lucide:arrow-left" />
        </router-link>
        <button class="icon-btn" @click="toggleCollapse" title="折叠侧边栏">
          <Icon icon="lucide:arrow-left-right" />
        </button>
      </div>

      <div class="sidebar-actions">
        <div class="action-row">
          <button class="action-btn primary" @click="freshNewChat">
            <Icon icon="lucide:message-square-plus" /> 新聊天
          </button>
          <button
            class="action-btn icon-only tooltip-container"
            data-tooltip="临时聊天"
            :class="{ active: isTemporary }"
            @click="temporaryNewChat"
          >
            <Icon icon="lucide:timer" />
          </button>
        </div>
        <button
          class="action-btn secondary tooltip-container"
          data-tooltip="关于 AI 模型"
        >
          <Icon icon="lucide:info" /> 关于 AI
        </button>
      </div>

      <!-- 聊天历史列表 -->
      <div class="chat-list-container">
        <div class="list-title">近期聊天</div>
        <div class="chat-list">
          <div
            v-for="chat in userChats"
            :key="chat.id"
            class="chat-item"
            :class="{ active: chat.id === chatIdNum }"
            @click="selectCharIds(chat.id, chat.modelId)"
          >
            <input
              v-if="editingChatId === chat.id"
              v-model="editTitleValue"
              @blur="submitRename(chat)"
              @keyup.enter="submitRename(chat)"
              @keyup.esc="cancelRename"
              @click.stop
              class="rename-input"
              autofocus
            />
            <template v-else>
              <span class="chat-title" :title="chat.title">{{
                chat.title
              }}</span>
              <div class="menu-wrapper">
                <button class="menu-trigger" @click.stop="togglePanel(chat.id)">
                  <Icon icon="lucide:more-vertical" />
                </button>
                <div v-if="activePanelId === chat.id" class="dropdown-menu">
                  <div class="menu-item info" @click.stop="startRename(chat)">
                    更改标题
                  </div>
                  <div
                    class="menu-item danger"
                    @click.stop="deleteChatListByChatId(chat.id)"
                  >
                    删除对话
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- 底部用户与设置 -->
      <div class="sidebar-footer">
        <div class="user-profile" @click="togglePanelUser">
          <img
            :src="
              userStore.avatarBlobUrl ||
              'https://api.dicebear.com/7.x/notionists/svg'
            "
            alt="头像"
            class="avatar"
          />
          <span class="username">{{ userStore.name || "User" }}</span>
          <Icon icon="lucide:more-horizontal" class="dots" />
        </div>

        <div v-if="isPanelVisible" class="user-popup-menu">
          <div class="menu-info">
            <!-- 第一个页面：用户配 API Key 和具体模型的 -->
            <button class="menu-item" @click="router.push('/apiSettings')">
              <Icon icon="lucide:blocks" class="icon" /> 厂商与模型管理
            </button>
          </div>

          <div class="menu-info">
            <!-- 第二个页面：系统全局的高级底层参数 -->
            <button class="menu-item" @click="router.push('/aiHybrdSettings')">
              <Icon icon="lucide:cpu" class="icon" /> 全局系统与 RAG 配置
            </button>
          </div>
          <div class="menu-divider"></div>

          <div class="menu-item engine-control-row" @click.stop>
            <span class="label-with-icon"> 渲染引擎 </span>
            <div class="segmented-control">
              <button
                :class="{ active: currentEngine === 'somarkdown' }"
                @click="currentEngine = 'somarkdown'"
              >
                SoMd
              </button>
              <button
                :class="{ active: currentEngine === 'markdown-it' }"
                @click="currentEngine = 'markdown-it'"
              >
                KaTeX
              </button>
            </div>
          </div>

          <div class="menu-divider"></div>
          <button class="menu-item danger" @click.stop="deleteAllChat">
            <Icon icon="lucide:alert-triangle" class="icon" /> 清空历史记录
          </button>
        </div>
      </div>

      <!-- 全局遮罩 -->
      <div
        v-if="activePanelId !== null || isPanelVisible"
        class="global-overlay"
        @click="closeAllPanels"
      ></div>
    </aside>

    <!-- ================= 主内容区 ================= -->
    <main class="main-content">
      <header class="main-header">
        <button
          v-show="isCollapsed"
          class="icon-btn expand-btn"
          @click="toggleCollapse"
          title="展开侧边栏"
        >
          <Icon icon="lucide:panel-left-open" />
        </button>
        <!-- 顶部标题 -->
        <div class="header-center">
          <h3
            v-if="chatIdNum"
            style="font-size: 15px; font-weight: 500; color: #555"
          >
            {{ !isTemporary ? currentChatList?.title : "临时聊天" }}
          </h3>
        </div>
        <div style="width: 32px"></div>
      </header>

      <div class="flowing-line" v-show="isFetchingHistory"></div>

      <!-- 聊天消息展示区 -->
      <div class="chat-wrapper" :class="{ 'is-homepage': !chatIdNum }">
        <div
          v-if="chatIdNum"
          class="message-list h-full"
          :class="{ 'chat-invisible': !isChatVisible }"
        >
          <DynamicScroller
            :key="chatIdNum || 'empty-chat'"
            :items="currentChat"
            :min-item-size="54"
            :buffer="1000"
            key-field="id"
            class="scroller"
            ref="scrollerRef"
            @scroll.passive="handleScroll"
            @wheel="handleUserInteraction"
          >
            <template v-slot="{ item, index, active }">
              <DynamicScrollerItem
                :item="item"
                :active="active"
                :data-index="index"
                :size-dependencies="[
                  item.isExpanded,
                  item.isExpandUserMsg,
                  item.isGenerating,
                  item.reasoning,
                  item.content,
                  item.token,
                ]"
              >
                <div :class="['message-row', item.role]">
                  <div class="message-body">
                    <!-- 用户消息气泡 -->
                    <template v-if="item.role === 'user'">
                      
                      <!-- ================= 1. 独立的附件区块 (无灰色背景) ================= -->
                      <div
                        v-if="item.attachments && item.attachments.length > 0"
                        class="user-attachments standalone"
                      >
                        <template
                          v-for="(fileItem, attIdx) in item.attachments"
                          :key="attIdx"
                        >
                          <!-- 图片展示 -->
                          <img
                            v-if="fileItem.isImage"
                            :src="fileItem.url"
                            class="user-msg-img"
                            alt="上传的图片"
                            @load="() => scrollerRef?.scrollToBottom()"
                          />
                          <!-- 文档展示 -->
                          <div v-else class="user-msg-doc">
                            <Icon icon="lucide:file-text" class="doc-icon" />
                            <span class="doc-name">{{ fileItem.file.name }}</span>
                          </div>
                        </template>
                      </div>

                      <!-- ================= 2. 独立的文本气泡块 (有灰色背景) ================= -->
                      <div
                        v-if="
                          item.content &&
                          item.content !== '[发送了文件]' &&
                          item.content !== '[发送了图片]'
                        "
                        class="message-content user-msg"
                        :class="{
                          'is-collapsed':
                            item.isExpandUserMsg || item.content.length <= 300,
                        }"
                      >
                        {{ item.content }}
                        <div class="collapsed-mask"></div>
                      </div>

                      <!-- ================= 3. 底部操作按钮 ================= -->
                      <div class="message-actions">
                        <!-- 复制按钮 -->
                        <span
                          class="action-btn copy-btn tooltip-container"
                          :data-tooltip="item.copied ? '已复制' : '复制内容'"
                          @click="copyToClipboard(item, index)"
                        >
                          <Icon
                            :icon="item.copied ? 'lucide:check' : 'lucide:copy'"
                            :style="{ color: item.copied ? '#4caf50' : '' }"
                          />
                        </span>

                        <!-- 折叠按钮 -->
                        <span
                          v-if="item.content.length > 300"
                          class="action-btn toggle-btn tooltip-container"
                          :data-tooltip="
                            item.isExpandUserMsg ? '收起内容' : '展开全文'
                          "
                          @click="toggleUserMsg(item, index)"
                        >
                          <Icon
                            :icon="
                              item.isExpandUserMsg
                                ? 'lucide:chevron-up'
                                : 'lucide:chevron-down'
                            "
                          />
                        </span>
                      </div>
                    </template>

                    <!-- AI 消息气泡 -->
                    <template v-else-if="item.role === 'assistant'">
                      <!-- 思考过程 -->
                      <div
                        v-if="
                          (item.reasoning !== undefined && !item.content) ||
                          (item.reasoning && item.reasoning.length > 0)
                        "
                        class="reasoning-section"
                      >
                        <div
                          class="reasoning-title"
                          @click="toggleReasoning(item, index)"
                        >
                          <div class="title-left">
                            <Icon
                              :icon="
                                !item.reasoning && item.isGenerating
                                  ? 'lucide:loader-2'
                                  : 'lucide:brain'
                              "
                              :class="[
                                'brain-icon',
                                {
                                  spinning:
                                    !item.reasoning && item.isGenerating,
                                },
                              ]"
                            />
                            <span>{{
                              !item.reasoning && item.isGenerating
                                ? "正在连接 AI..."
                                : "思考过程"
                            }}</span>
                          </div>
                          <Icon
                            :icon="
                              item.isExpanded
                                ? 'lucide:chevron-up'
                                : 'lucide:chevron-down'
                            "
                            class="toggle-icon"
                          />
                        </div>
                        <div
                          class="reasoning-collapse-wrapper"
                          :class="{ 'is-open': item.isExpanded }"
                        >
                          <div class="reasoning-content">
                            <StreamingMarkdown
                              v-if="item.reasoning && item.reasoning.length > 0"
                              :key="`reasoning-${item.id || index}`"
                              :content="item.reasoning"
                              :isGenerating="item.isGenerating"
                              :is-locked="isAutoScrollLocked"
                              :engine="currentEngine"
                              @rendered="() => handleMarkdownRendered(item)"
                            />
                            <div
                              v-show="
                                !item.reasoning || item.reasoning.length === 0
                              "
                              class="reasoning-placeholder"
                            >
                              <span
                                v-show="item.isGenerating"
                                class="pulse-dot"
                              ></span>
                              <span>{{
                                item.isGenerating
                                  ? "正在组织语言..."
                                  : "思考已中止"
                              }}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <!-- 正文内容 -->
                      <div class="message-content">
                        <StreamingMarkdown
                          v-if="item.content && item.content.length > 0"
                          :key="`content-${item.id || index}`"
                          :content="item.content"
                          :isGenerating="item.isGenerating"
                          :is-locked="isAutoScrollLocked"
                          :engine="currentEngine"
                          @rendered="() => handleMarkdownRendered(item)"
                        />
                        <span
                          v-show="!item.content && item.isGenerating"
                          class="typing-placeholder"
                        >
                          <span class="blinking-cursor">...</span>
                        </span>
                      </div>

                      <!-- Token 消耗估算（可保留做参考展示） -->
                      <div v-if="item.token" class="token-info">
                        <Icon icon="lucide:coins" class="meta-icon" />
                        <span>{{ item.token }}</span>
                      </div>
                    </template>
                  </div>
                </div>
              </DynamicScrollerItem>
            </template>
          </DynamicScroller>
        </div>

        <!-- 首页问候 -->
        <div v-else class="homepage-greeting">
          <template v-if="isTemporary">
            <h2>🕵️‍♂️ 已进入临时对话模式</h2>
            <p class="temp-tip">
              您当前的聊天记录阅后即焚，不会保留在历史列表中，也不会影响 AI
              的长期记忆。
            </p>
          </template>
          <template v-else>
            <h2>你好！我们先从哪里开始呢？</h2>
          </template>
        </div>

        <!-- ================= Gemini 风格两行输入区 ================= -->
        <div class="input-area">
          <!-- ================== 1. 隐藏的 File Input ================== -->
          <input
            type="file"
            ref="fileInputRef"
            style="display: none"
            :accept="fileAccept"
            multiple
            @change="handleFileChange"
          />
          <div class="input-box" :class="{ 'is-focused': isInputFocused }">
            <!-- ================== 2. 新增：文件预览区 ================== -->
            <div v-if="selectedFiles.length > 0" class="file-preview-area">
              <div
                v-for="(fileItem, index) in selectedFiles"
                :key="index"
                class="preview-item"
              >
                <!-- 图片预览 -->
                <img
                  v-if="fileItem.isImage"
                  :src="fileItem.url"
                  class="preview-img"
                  alt="preview"
                />
                <!-- 文档图标 -->
                <div v-else class="preview-doc">
                  <Icon icon="lucide:file-text" class="doc-icon" />
                  <span class="doc-name">{{ fileItem.file.name }}</span>
                </div>
                <!-- 删除按钮 -->
                <button class="remove-file-btn" @click.stop="removeFile(index)">
                  <Icon icon="lucide:x" />
                </button>
              </div>
            </div>
            <!-- 上半部：文本输入 -->
            <div class="input-row">
              <textarea
                ref="inputRef"
                v-model="inputText"
                :placeholder="
                  isTemporary
                    ? '在临时模式中畅所欲言 (阅后即焚)...'
                    : '给 AI 发送消息...'
                "
                rows="1"
                maxlength="100000"
                @input="autoResize"
                @keydown.enter.exact.prevent="sendMessage"
                @focus="isInputFocused = true"
                @blur="isInputFocused = false"
              ></textarea>
            </div>

            <!-- 下半部：工具与发送 -->
            <div class="toolbar-row">
              <div class="toolbar-left">
                <!-- 附件菜单 -->
                <div class="tool-wrapper">
                  <button
                    class="action-circle-btn ghost"
                    @click.stop="toggleToolsMenu"
                    :class="{ 'is-active': isToolsOpen }"
                  >
                    <Icon icon="lucide:plus" class="plus-icon" />
                  </button>
                  <!-- ... 你的 plus 按钮代码保持不变 ... -->
                  <transition name="fade-up">
                    <div v-if="isToolsOpen" class="popover-menu tools-menu">
                      <!-- ================== 3. 修改：绑定点击事件 ================== -->
                      <div
                        class="popover-item"
                        @click.stop="triggerFileInput('image/*')"
                      >
                        <Icon icon="lucide:image" class="menu-icon" /> 上传图片
                      </div>
                      <div
                        class="popover-item"
                        @click.stop="
                          triggerFileInput('.pdf,.txt,.doc,.docx,.csv')
                        "
                      >
                        <Icon icon="lucide:file-text" class="menu-icon" />
                        上传文档
                      </div>
                      <!-- <div class="popover-item">
                        <Icon icon="lucide:folder-up" class="menu-icon" />
                        从云盘选择
                      </div> -->
                    </div>
                  </transition>
                </div>
                <!-- 🌟 新增：上下文与缓存控制面板 -->
                <div class="tool-wrapper">
                  <button
                    class="action-circle-btn ghost tooltip-container"
                    data-tooltip="上下文与缓存策略"
                    @click.stop="toggleContextMenu"
                    :class="{ 'is-active': isContextOpen }"
                  >
                    <!-- 使用 CPU 或 Zap 图标代表算力/缓存 -->
                    <Icon icon="lucide:cpu" class="plus-icon" />
                  </button>
                  <transition name="fade-up">
                    <div
                      v-if="isContextOpen"
                      class="popover-menu context-menu"
                      @click.stop
                    >
                      <!-- 面板标题 -->
                      <div class="context-header">
                        <Icon icon="lucide:database" class="header-icon" />
                        <span>记忆与缓存状态</span>
                      </div>
                      <!-- 控制项 1：缓存引擎切换 (复用你现有的 segmented-control 样式) -->
                      <div class="context-row">
                        <span class="row-label">前缀缓存 (长文优化)</span>

                        <!-- 这样写更健壮，防止变量是 1/0 或 "true"/"false" 字符串 -->
                        <div class="segmented-control">
                          <button
                            :class="{
                              active:
                                String(currentModel.enablePrefixCaching) ===
                                'true',
                            }"
                            @click="toggleCacheMode(true)"
                          >
                            开启
                          </button>
                          <button
                            :class="{
                              active:
                                String(currentModel.enablePrefixCaching) !==
                                'true',
                            }"
                            @click="toggleCacheMode(false)"
                          >
                            关闭
                          </button>
                        </div>
                      </div>

                      <!-- 控制项 2：窗口与记忆状态指示 -->
                      <div
                        class="context-row info-row"
                        v-if="currentModel.enablePrefixCaching"
                      >
                        <span
                          class="row-label tooltip-container"
                          data-tooltip="携带几轮最新对话"
                          >携带窗口大小</span
                        >
                        <div class="number-input-wrapper">
                          <input
                            type="number"
                            v-model.number="currentModel.cacheMessageLimit"
                            @change="updateModelConfig('cacheMessageLimit')"
                            min="1"
                            max="50"
                            class="limit-input"
                          />
                          <span class="unit">轮</span>
                        </div>
                      </div>

                      <!-- 新增 控制项 3：摘要折叠长度限制 (可选) -->
                      <div
                        class="context-row info-row"
                        v-if="currentModel.enablePrefixCaching"
                      >
                        <span
                          class="row-label tooltip-container"
                          data-tooltip="字数最大限制"
                          >字数最大限制</span
                        >
                        <div class="number-input-wrapper">
                          <input
                            type="number"
                            v-model.number="currentModel.cacheTokenLimit"
                            @change="updateModelConfig('cacheTokenLimit')"
                            min="100"
                            max="3000"
                            step="100"
                            class="limit-input"
                            style="width: 50px"
                          />
                          <span class="unit">字</span>
                        </div>
                      </div>

                      <!-- 提示文案 -->
                      <div class="context-tip">
                        {{
                          currentModel.enablePrefixCaching
                            ? "当前为追加模式，长对话首次较慢，后续响应极快且节省 Token。"
                            : "当前为滑动节约模式，自动遗忘早期对话以控制最大算力开销。"
                        }}
                      </div>
                    </div>
                  </transition>
                </div>
                <!-- 🌟 模型选择 (已打通本地数据库) -->
                <div class="tool-wrapper">
                  <button
                    class="model-selector-btn ghost"
                    @click.stop="toggleModelDropdown"
                  >
                    <Icon icon="lucide:sparkles" class="model-icon" />
                    <span class="model-text">{{ currentModelLabel }}</span>
                    <Icon
                      icon="lucide:chevron-down"
                      class="chevron"
                      :class="{ 'is-open': isModelDropdownOpen }"
                    />
                  </button>
                  <transition name="fade-up">
                    <div
                      v-if="isModelDropdownOpen"
                      class="popover-menu model-menu"
                    >
                      <div
                        v-if="modelList.length === 0"
                        class="popover-item"
                        style="color: #999"
                        @click.stop="router.push('/apiSettings')"
                      >
                        去设置中添加模型...
                      </div>
                      <div
                        v-else
                        v-for="model in modelList"
                        :key="model.value"
                        class="popover-item"
                        :class="{ 'is-selected': isModelActive(model) }"
                        @click.stop="selectModel(model)"
                      >
                        <span>{{ model.label }}</span>
                        <Icon
                          v-if="isModelActive(model)"
                          icon="lucide:check"
                          class="check-icon"
                        />
                      </div>
                    </div>
                  </transition>
                </div>
              </div>

              <!-- 右侧：发送按钮 -->
              <div class="toolbar-right">
                <button
                  class="send-btn"
                  :class="{
                    active:
                      (inputText.trim().length > 0 || isSending) &&
                      isEmbeddingReady &&
                      modelList.length > 0,
                    loading: !isEmbeddingReady,
                  }"
                  @click="handleButtonClick"
                  :disabled="!isEmbeddingReady && !isSending"
                >
                  <Icon
                    v-if="isSending"
                    icon="lucide:square"
                    class="stop-icon"
                  />
                  <Icon
                    v-else-if="!isEmbeddingReady"
                    icon="lucide:loader-2"
                    class="animate-spin"
                  />
                  <Icon v-else icon="lucide:send" />
                  <span
                    v-if="!isEmbeddingReady && downloadPercent < 100"
                    style="font-size: 10px; margin-left: 2px"
                  >
                    {{ Math.round(downloadPercent) }}%
                  </span>
                </button>
              </div>
            </div>
          </div>
          <div class="footer-hint">
            内容基于您本地提供的 API Key 生成，请妥善保管您的密钥。
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import {
  ref,
  reactive,
  nextTick,
  computed,
  onMounted,
  onUnmounted,
  watch,
  markRaw,
} from "vue";
import { Icon } from "@iconify/vue";
import { useUserStore } from "../store/useStore.js";
import { useRouter } from "vue-router";
import { DynamicScroller, DynamicScrollerItem } from "vue-virtual-scroller";
import "vue-virtual-scroller/dist/vue-virtual-scroller.css";

import StreamingMarkdown from "./StreamingMarkdown.vue";
import { chatDB } from "../Indexdb/db/chatDB.js";
import { vectorDB } from "../Indexdb/db/vectorDB.js"; 
import { apiModelDB } from "../Indexdb/db/apiModelDB.js";
import { globalKeyManager } from "../utils/keyManager.js";

import { debounce, throttle } from "lodash-es";
import { AIUserService } from "../service/aiUserService.js";
import {
  checkEmbeddingReady,
  initEmbeddingEngine,
} from "../embedding/workerClient.js";
import { clearAllEchartsInstances } from "../markdown/renderers.js";
import { showConfirm } from "./ui/ui-js/confirm.js";

const router = useRouter();
const userStore = useUserStore();
const currentEngine = ref("somarkdown");

// ==========================================
// 新增：文件上传状态与逻辑
// ==========================================
const fileInputRef = ref(null);
const fileAccept = ref("*/*");
const selectedFiles = ref([]);

// 触发原生文件选择框
function triggerFileInput(acceptType) {
  fileAccept.value = acceptType;
  isToolsOpen.value = false; // 关闭菜单
  nextTick(() => {
    if (fileInputRef.value) {
      fileInputRef.value.click();
    }
  });
}

// 处理文件选择
function handleFileChange(event) {
  const files = Array.from(event.target.files);
  if (!files.length) return;

  files.forEach((file) => {
    const isImage = file.type.startsWith("image/");

    // 生成本地预览 URL
    const url = isImage ? URL.createObjectURL(file) : null;

    selectedFiles.value.push({
      file: file,
      url: url,
      isImage: isImage,
    });
  });

  // 清空 input 的 value，确保选同一个文件也能触发 change 事件
  event.target.value = "";
  // 如果输入框没有焦点，自动对焦，提升体验
  nextTick(() => inputRef.value?.focus());
}

// 移除已选文件 (包含内存回收)
function removeFile(index) {
  const fileItem = selectedFiles.value[index];
  // 释放 URL 对象，防止内存泄漏
  if (fileItem.url) {
    URL.revokeObjectURL(fileItem.url);
  }
  selectedFiles.value.splice(index, 1);
}

// ==========================================
// 3. UI 布局交互状态
// ==========================================
const isCollapsed = ref(false);
const isTemporary = ref(false);
const activePanelId = ref(null);
const isPanelVisible = ref(false);

const isInputFocused = ref(false);
const isToolsOpen = ref(false);
const isModelDropdownOpen = ref(false);
const isContextOpen = ref(false);

function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value;
}
function toggleToolsMenu() {
  isToolsOpen.value = !isToolsOpen.value;
  if (isToolsOpen.value) {
    isModelDropdownOpen.value = false;
    isContextOpen.value = false;
  }
}

function toggleModelDropdown() {
  isModelDropdownOpen.value = !isModelDropdownOpen.value;
  if (isModelDropdownOpen.value) {
    isToolsOpen.value = false;
    isContextOpen.value = false;
  }
}
function toggleContextMenu() {
  isContextOpen.value = !isContextOpen.value;
  if (isContextOpen.value) {
    isToolsOpen.value = false;
    isModelDropdownOpen.value = false;
  }
}
function closeDropdownOnClickOutside() {
  isModelDropdownOpen.value = false;
  isToolsOpen.value = false;
  isContextOpen.value = false;
}
// 处理开关切换
async function toggleCacheMode(enable) {
  if (currentModel.value.enablePrefixCaching === enable) return;

  // 1. 准备要更新的数据包
  const updates = { enablePrefixCaching: enable };

  // 2. 🌟 核心：如果缺失字段，直接在内存里补齐，并放入更新包
  if (
    currentModel.value.cacheMessageLimit === undefined ||
    currentModel.value.cacheTokenLimit === undefined
  ) {
    // 同步更新内存，这样 UI 才会立刻显示出 50 和 20000
    currentModel.value.cacheMessageLimit = 50;
    currentModel.value.cacheTokenLimit = 20000;

    // 放入数据库更新包
    updates.cacheMessageLimit = 50;
    updates.cacheTokenLimit = 20000;
  }

  // 3. 同步内存开关状态
  currentModel.value.enablePrefixCaching = enable;

  // 4. 🌟 一次性写入数据库
  try {
    await apiModelDB.updateModel(currentModel.value.modelId, updates);
  } catch (e) {
    console.error("更新模型配置失败", e);
  }

  showAlert(
    "success",
    enable ? "已切换至全量缓存模式" : "已切换至滑动节约模式"
  );
}

// 处理数字输入框修改
async function updateModelConfig(field) {
  if (!currentModel.value || !currentModel.value.modelId) return;

  // 1. 获取当前值并做防爆校验
  let val = currentModel.value[field];

  // 针对不同字段做不同的安全拦截
  if (field === "cacheMessageLimit") {
    if (!val || val < 10) val = 10; // 缓存起点太低没意义
    if (val > 500) val = 500; // 防止超大数值导致账单爆炸
  } else if (field === "recentLimit") {
    if (!val || val < 1) val = 1;
    if (val > 100) val = 100;
  } else if (field === "summaryInjectStrictLen") {
    if (!val || val < 100) val = 100;
    if (val > 10000) val = 10000;
  }

  // 强制修正前端显示的数值
  currentModel.value[field] = val;

  // 2. 🌟 依然写入模型数据库，让这个模型的专属配置永久生效
  try {
    await apiModelDB.updateModel(currentModel.value.modelId, {
      [field]: val,
    });
    console.log(
      `[Config] 已更新模型 ${currentModel.value.label} 的 ${field} 为:`,
      val
    );
  } catch (error) {
    console.error("更新模型底层配置失败:", error);
  }
}
function togglePanel(id) {
  isPanelVisible.value = false;
  activePanelId.value = activePanelId.value === id ? null : id;
}
function togglePanelUser() {
  activePanelId.value = null;
  isPanelVisible.value = !isPanelVisible.value;
}
function closeAllPanels() {
  activePanelId.value = null;
  isPanelVisible.value = false;
}

// ==========================================
// 4. 对话列表与历史管理
// ==========================================
const userChats = ref([]);
const chatIdNum = ref(null);
const editingChatId = ref(null);
const editTitleValue = ref("");

async function getChatListByUserId() {
  try {
    userChats.value = await chatDB.queryChatList();
  } catch (error) {
    console.error("查询列表失败:", error);
  }
}
getChatListByUserId();

function freshNewChat() {
  if (!chatIdNum.value) {
    nextTick(() => inputRef.value?.focus());
    return;
  }
  chatIdNum.value = null;
  isTemporary.value = false;
  setTimeout(() => {
    if (!chatIdNum.value) currentChat.value = [];
  }, 300);
  nextTick(() => inputRef.value?.focus());
}

function temporaryNewChat() {
  isTemporary.value = !isTemporary.value;
  if (isTemporary.value) {
    currentChat.value = [];
    chatIdNum.value = "temp_" + Date.now();
  } else {
    currentChat.value = [];
    chatIdNum.value = null;
  }
}

const startRename = (chat) => {
  editingChatId.value = chat.id;
  editTitleValue.value = chat.title;
  activePanelId.value = null;
};
const submitRename = async (chat) => {
  const newTitle = editTitleValue.value.trim();
  if (!newTitle || newTitle === chat.title) return cancelRename();
  await chatDB.updateChatList(chat.id, { title: newTitle });
  const targetChat = userChats.value.find((c) => c.id === chat.id);
  if (targetChat) targetChat.title = newTitle;
  cancelRename();
};
const cancelRename = () => {
  editingChatId.value = null;
  editTitleValue.value = "";
};

async function deleteChatListByChatId(id) {
  const isConfirm = await showConfirm({
    title: "删除",
    message: `确定要删除此对话吗？`,
    type: "info",
  });
  if (!isConfirm) return;
  userChats.value = userChats.value.filter((c) => c.id !== id);
  await chatDB.deleteChatListById(id);
  await vectorDB.deleteVectorsByChatId(id);
  closeAllPanels();
  if (chatIdNum.value === id) freshNewChat();
}
async function deleteAllChat() {
  await chatDB.clearAllChatData();
  await vectorDB.clearAllVectors();
  userChats.value = [];
  closeAllPanels();
  freshNewChat();
}

// ==========================================
// 5. 模型配置与选择 (全面对接嵌套 Schema)
// ==========================================
const modelList = ref([]);
const selectedModelValue = ref(""); // 存储选中模型的 id

const currentModel = computed(() => {
  return (
    modelList.value.find((m) => m.value === selectedModelValue.value) ||
    modelList.value[0] ||
    {}
  );
});

const isModelActive = (modelItem) =>
  currentModel.value.value === modelItem.value;
const currentModelLabel = computed(
  () => currentModel.value.label || "请前往设置中心配置模型"
);
const currentModelId = computed(() => currentModel.value.modelId);

// 🌟 核心修改点：将嵌套的厂商模型拍平，继承厂商配置并挂载所有高级参数
// 从 IndexedDB 加载厂商和模型，并处理 URL 继承
const loadModelsFromDB = async () => {
  try {
    const providers = await apiModelDB.getAllProviders();
    const flatModels = [];
    let defaultModelVal = null;

    for (const provider of providers) {
      if (provider.models && Array.isArray(provider.models)) {
        for (const model of provider.models) {
          const modelVal = model.id;

          flatModels.push({
            // 基础信息
            label: `${provider.name} - ${model.name}`,
            value: modelVal,
            modelId: model.id,
            providerId: provider.id,
            name: model.name,
            modelType: model.modelType || "text",

            // 🌟 网络请求核心：优先用模型的 URL，没有则用厂商的官网地址(假设你把根地址填在了officialUrl)
            // 如果你厂商表单里改名成了 baseUrl，这里也要对应改
            baseUrl: model.baseUrl || provider.officialUrl || "",
            path: model.path || "/chat/completions",

            // 鉴权
            encryptedApiKey: provider.apiKey,
            isDefault: model.isDefault,

            // 高级参数下发
            recentLimit: model.recentLimit,
            searchLimit: model.searchLimit,
            cacheMessageLimit: model.cacheMessageLimit,
            cacheTokenLimit: model.cacheTokenLimit,
            enablePrefixCaching: model.enablePrefixCaching,
          });

          // 只有文本模型才能作为默认聊天的初始选中
          if (
            model.isDefault &&
            (!model.modelType || model.modelType === "text")
          ) {
            defaultModelVal = modelVal;
          }
        }
      }
    }

    modelList.value = flatModels;
    if (flatModels.length > 0) {
      // 优先选全局默认，其次选第一个模型
      selectedModelValue.value = defaultModelVal || flatModels[0].value;
    }
  } catch (error) {
    console.error("加载模型列表失败", error);
  }
};

function selectModel(model) {
  if (selectedModelValue.value === model.value) {
    isModelDropdownOpen.value = false;
    return;
  }
  selectedModelValue.value = model.value;
  isModelDropdownOpen.value = false;
  freshNewChat();
}

// ==========================================
// 6. 聊天核心引擎 (滚动、上下文查询)
// ==========================================
const scrollerRef = ref(null);
const currentChat = ref([]);
const isLoadingMore = ref(false);
const currentOffset = ref(0);
const pageSize = 50;
const isLoadAll = ref(false);
const isFetchingHistory = ref(false);
const isChatVisible = ref(true);
const isAutoScrollLocked = ref(false);

// ==========================================
// 🌟 修复：Markdown 渲染防抖与精准滚底
// ==========================================
const handleMarkdownRendered = debounce((item) => {
  if (!scrollerRef.value) return;
  scrollerRef.value.forceUpdate();

  if (item && item.isGenerating && !isAutoScrollLocked.value) {
    scrollerRef.value.scrollToBottom();
  }

  // 🌟 修复切换时的闪烁
  if (!isChatVisible.value) {
    // 1. 趁着黑屏（还没显示），强行计算高度并滚到底
    scrollerRef.value.forceUpdate();
    scrollerRef.value.scrollToBottom();

    // 2. 等待 50 毫秒，让浏览器把那些复杂的代码块、公式真正撑开并在后台完成滚动
    setTimeout(() => {
      if (scrollerRef.value) {
        scrollerRef.value.scrollToBottom(); // 最后补一枪，确保严丝合缝
      }

      // 3. 彻底滚好之后，再把黑幕揭开（解除隐藏），这样就绝对不会看到跳动的过程了！
      requestAnimationFrame(() => {
        isChatVisible.value = true;
        isFetchingHistory.value = false;
      });
    }, 50);
  }
}, 300);

const currentChatList = ref(null);

async function selectCharIds(id, modelIdNum) {
  if (chatIdNum.value === id) return;
  try {
    isTemporary.value = false;

    isFetchingHistory.value = true;
    isChatVisible.value = false;

    // 当切换历史会话时，自动将底部的下拉框选中到该会话原来用的模型
    const selectModelItem = modelList.value.find(
      (m) => m.modelId === modelIdNum
    );
    if (selectModelItem) {
      selectedModelValue.value = selectModelItem.value;
    }

    currentChatList.value = await chatDB.queryChatListById(id);
    chatIdNum.value = id;
    currentChat.value = [];
    await new Promise(resolve => setTimeout(resolve, 32))
    await nextTick();
    const pageChats = await chatDB.queryChatMessagesByPage(id, 0, pageSize);
    currentOffset.value = pageChats.length;
    isLoadAll.value = pageChats.length < pageSize;

    const rawChats = pageChats.map((chat) => markRaw(chat));
    const CHUNK_SIZE = 10;

    const injectChunk = (startIndex) => {
      if (rawChats.length === 0) {
        isChatVisible.value = true;
        isFetchingHistory.value = false;
        return;
      }

      if (startIndex >= rawChats.length) {
        // 数据注入完毕，给 DOM 留一点渲染时间
        setTimeout(() => {
          if (!isChatVisible.value) {
            // 先在后台强行滚动
            if (scrollerRef.value) {
              scrollerRef.value.forceUpdate();
              scrollerRef.value.scrollToBottom();
            }

            // 滚完了，下一帧再显示界面
            requestAnimationFrame(() => {
              isChatVisible.value = true;
              isFetchingHistory.value = false;
            });
          }
        }, 150); // 150ms 足够让 Vue 完成初步的 DOM 挂载
        return;
      }

      const chunk = rawChats.slice(startIndex, startIndex + CHUNK_SIZE);
      currentChat.value.push(...chunk);
      requestAnimationFrame(() => injectChunk(startIndex + CHUNK_SIZE));
    };
    injectChunk(0);
  } catch (error) {
    console.error("切换失败:", error);
    isFetchingHistory.value = false;
    isChatVisible.value = true;
  }
}

const checkLoadMoreHistory = throttle((el) => {
  if (el.scrollTop <= 50 && !isLoadingMore.value && !isLoadAll.value)
    triggerLoadMoreHistory(el);
}, 150);

const handleScroll = (e) => {
  const el = e.target;
  if (!el) return;
  const distanceToBottom = Math.ceil(
    el.scrollHeight - el.scrollTop - el.clientHeight
  );
  isAutoScrollLocked.value = distanceToBottom > 2;
  checkLoadMoreHistory(el);
};

const handleUserInteraction = (e) => {
  if (e.type === "wheel" && e.deltaY < 0) isAutoScrollLocked.value = true;
};

async function triggerLoadMoreHistory(scrollElement) {
  if (!chatIdNum.value || isLoadAll.value) return;
  isLoadingMore.value = true;
  const oldScrollHeight = scrollElement.scrollHeight;
  const oldScrollTop = scrollElement.scrollTop;

  try {
    const olderChats = await chatDB.queryChatMessagesByPage(
      chatIdNum.value,
      currentOffset.value,
      pageSize
    );
    if (olderChats.length > 0) {
      const uniqueOlderChats = olderChats.filter(
        (oldMsg) =>
          !currentChat.value.some((existMsg) => existMsg.id === oldMsg.id)
      );
      const rawOlderChats = uniqueOlderChats.map((chat) => markRaw(chat));
      currentChat.value = [...rawOlderChats, ...currentChat.value];
      currentOffset.value += olderChats.length;

      await nextTick();
      setTimeout(() => {
        requestAnimationFrame(() => {
          const newScrollHeight = scrollElement.scrollHeight;
          scrollElement.scrollTop =
            newScrollHeight - oldScrollHeight + oldScrollTop;
        });
      }, 50);
    }
    if (olderChats.length < pageSize) isLoadAll.value = true;
  } catch (error) {
    console.error("加载历史记录失败:", error);
  } finally {
    setTimeout(() => (isLoadingMore.value = false), 200);
  }
}

// ==========================================
// 7. 发送消息机制 (动态解密 API Key)
// ==========================================
const inputText = ref("");
const inputRef = ref(null);
let abortController = null;
const isSending = ref(false);

function autoResize() {
  const textarea = inputRef.value;
  if (!textarea) return;
  textarea.style.height = "auto";
  const newHeight = textarea.scrollHeight;
  textarea.style.height = newHeight + "px";
  textarea.style.overflowY = newHeight >= 200 ? "auto" : "hidden";
}

function handleButtonClick() {
  if (isSending.value) stopMessage();
  else if (isEmbeddingReady.value) sendMessage();
}

function stopMessage() {
  if (abortController) abortController.abort();
}
function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64); // 解码 base64
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
const formatModelType = (type) => {
  const map = {
    text: "文本",
    image: "绘图",
    video: "视频",
    embedding: "向量",
  };
  return map[type] || "未知";
};
async function sendMessage() {
  if (isSending.value) return;
  const text = inputText.value.trim();
  if (!text && selectedFiles.value.length === 0) return;

  // 1. 发送前校验模型库和选中状态
  if (modelList.value.length === 0 || !currentModel.value.value) {
    showAlert("warning", `请先前往左下角设置中配置并选择一个模型`);
    router.push("/apiSettings");
    return;
  } 
  // 2. 内存解密逻辑：获取当前模型对应的私钥并解密
  let decryptedApiKey = "";
  if (currentModel.value.encryptedApiKey) {
    try {
      const myPrivateKey = await globalKeyManager.getEncryptPrivateKey();

      const encryptedBytes = Uint8Array.from(
        atob(currentModel.value.encryptedApiKey),
        (c) => c.charCodeAt(0)
      );

      const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: "RSA-OAEP" },
        myPrivateKey,
        encryptedBytes
      );
      decryptedApiKey = new TextDecoder().decode(decryptedBuffer);
    } catch (error) {
      console.error("解密 API Key 失败:", error);
      showAlert(
        "warning",
        `API Key 解密失败，这可能是因为您的本地安全环境重置，请去配置中心重新输入。`
      );
      return;
    }
  } else {
    showAlert("warning", `当前厂商未配置有效的 API Key，请去设置中心完善配置`);
    return;
  }

  const originalText = text;
  isSending.value = true;
  abortController = new AbortController();
  isAutoScrollLocked.value = false;
  inputText.value = "";

  // 🌟 新增：提取待发送的文件，并立即清空前端 UI 状态
  const filesToSend = [...selectedFiles.value];
  selectedFiles.value = []; // 清空预览
  inputText.value = ""; // 清空输入框内容

  nextTick(() => autoResize());

  currentChat.value.push({
    id: Date.now(),
    chatId: chatIdNum.value,
    role: "user",
    content: text || "[发送了文件]",
    timestamp: Date.now(),
    isExpandUserMsg: false,
    attachments: filesToSend,
  });

  let baseHistoryTokens = 0;
  let localContentBuffer = "";
  let localReasoningBuffer = "";

  const localThrottledUpdateUI = throttle(
    (targetMessage, baseTokens) => {
      let hasChanged = false;
      if (localContentBuffer) {
        targetMessage.content += localContentBuffer;
        localContentBuffer = "";
        hasChanged = true;
      }
      if (localReasoningBuffer) {
        targetMessage.reasoning += localReasoningBuffer;
        localReasoningBuffer = "";
        hasChanged = true;
      }
      if (hasChanged) {
        const currentOutputTokens = estimateTokens(
          targetMessage.content + targetMessage.reasoning
        );
        const totalEstimatedTokens = baseTokens + currentOutputTokens;
        targetMessage.token = `[ ⚡ 正在生成... 预估: ${totalEstimatedTokens} ]`;
        scrollToBottomIfNeeded();
      }
    },
    150,
    { leading: true, trailing: true }
  );

  const aiMessage = reactive({
    id: Date.now() + 1,
    chatId: chatIdNum.value,
    role: "assistant",
    content: "",
    reasoning: "",
    token: "",
    isExpanded: false,
    isGenerating: true,
  });
  currentChat.value.push(aiMessage);

  if (!isTemporary.value) currentOffset.value += 2;
  scrollToBottomIfNeeded();

  try {
    // 3. 将解密好的 key 和完整的模型对象传给 Service
    // 此时 currentModel.value 中已经包含了 url、temperature 等所有高级参数
    await AIUserService.sendAIMessage({
      systemRole: "system",
      text: text,
      files: filesToSend.map((f) => f.file),
      chatId: chatIdNum.value,
      model: {
        ...currentModel.value,
        apiKey: decryptedApiKey,
      },
      signal: abortController.signal,
      isTemporary: isTemporary.value,
      tempMessages: currentChat.value,

      onChatCreated: (newId) => {
        chatIdNum.value = newId;
        aiMessage.chatId = newId;
        if (!isTemporary.value) {
          userChats.value.unshift({
            id: newId,
            title: text.slice(0, 15),
            modelId: currentModelId.value,
            timestamp: Date.now(),
          });
        }
      },
      onContextAssembled: (finalPromptText) => {
        baseHistoryTokens = estimateTokens(finalPromptText);
      },
      onStreamContent: (chunk) => {
        localContentBuffer += chunk;
        localThrottledUpdateUI(aiMessage, baseHistoryTokens);
      },
      onStreamReasoning: (chunk) => {
        localReasoningBuffer += chunk;
        localThrottledUpdateUI(aiMessage, baseHistoryTokens);
      },
      onStreamFinish: async (finalTokenString, tokenUsage) => {
        localThrottledUpdateUI.flush();
        aiMessage.token = finalTokenString;
        aiMessage.isGenerating = false;
      },
      onError: (err) => {
        localThrottledUpdateUI.cancel();
        aiMessage.isGenerating = false;
        const isAbort = err.name === "AbortError" || err.message === "abort";

        if (isAbort) {
          currentChat.value.pop();
          currentChat.value.pop();
          inputText.value = originalText;
          if (currentChat.value.length === 0) {
            userChats.value = userChats.value.filter(
              (chat) => chat.id !== chatIdNum.value
            );
            chatIdNum.value = null;
          }
        } else {
          aiMessage.content += " [已停止或遇到错误]";
        }
        nextTick(() => {
          inputRef.value?.focus();
          autoResize();
        });
      },
    });
  } catch (e) {
    console.error("消息发送异常:", e);
  } finally {
    isSending.value = false;
  }
}

function estimateTokens(text) {
  if (!text) return 0;
  const chineseMatches = text.match(/[\u0100-\uffff]/g);
  const chineseCount = chineseMatches ? chineseMatches.length : 0;
  const asciiCount = text.length - chineseCount;
  return Math.ceil(chineseCount * 0.7 + asciiCount * 0.3);
}

const scrollToBottomIfNeeded = throttle(() => {
  if (!isAutoScrollLocked.value && scrollerRef.value) {
    scrollerRef.value.scrollToBottom();
  }
}, 150);

const copyToClipboard = (item, index) => {
  navigator.clipboard.writeText(item.content).then(() => {
    const newItem = markRaw({ ...item, copied: true });
    currentChat.value.splice(index, 1, newItem);
    setTimeout(() => {
      const latestItem = currentChat.value[index];
      if (latestItem) {
        const resetItem = markRaw({ ...latestItem, copied: false });
        currentChat.value.splice(index, 1, resetItem);
      }
    }, 2000);
  });
};

const toggleReasoning = (item, index) => {
  if (item.isGenerating) item.isExpanded = !item.isExpanded;
  else {
    const newItem = markRaw({ ...item, isExpanded: !item.isExpanded });
    currentChat.value.splice(index, 1, newItem);
  }
};

const toggleUserMsg = (item, index) => {
  const newItem = markRaw({ ...item, isExpandUserMsg: !item.isExpandUserMsg });
  currentChat.value.splice(index, 1, newItem);
};

// ==========================================
// 8. 生命周期与全局监听
// ==========================================
watch(
  () => [chatIdNum.value, currentModelId.value],
  async ([newId, newModelId], oldValues, onCleanup) => {
    if (!newId || !newModelId) return;
    let isExpired = false;
    onCleanup(() => (isExpired = true));
    try {
      await AIUserService.activateChatSearch(newId, newModelId, "assistant");
      if (!isExpired) console.log(`[Search] 已为会话 ${newId} 激活索引`);
    } catch (err) {
      if (!isExpired) console.error(`激活搜索索引失败 (会话: ${newId}):`, err);
    }
  },
  { immediate: true }
);

const isEmbeddingReady = ref(true);
const downloadPercent = ref(100);

onMounted(async () => {
  window.addEventListener("click", closeDropdownOnClickOutside);

  // 初始化从 IndexedDB 加载模型数据
  await loadModelsFromDB();

  if (checkEmbeddingReady()) {
    isEmbeddingReady.value = true;
    downloadPercent.value = 100;
    return;
  }

  try {
    isEmbeddingReady.value = false;
    downloadPercent.value = 0;
    await initEmbeddingEngine((data) => {
      if (data.status === "progress") {
        downloadPercent.value = ((data.loaded / data.total) * 100).toFixed(1);
      }
    }, 300000);
    isEmbeddingReady.value = true;
    downloadPercent.value = 100;
  } catch (error) {
    isEmbeddingReady.value = false;
    downloadPercent.value = 0;
    console.error("AI 引擎加载失败:", error.message);
  }
});

onUnmounted(() => {
  window.removeEventListener("click", closeDropdownOnClickOutside);
  clearAllEchartsInstances();
  if (abortController) abortController.abort();
});
</script>

<style scoped>
/* ==========================================
   1. 全局与基础组件变量
   ========================================== */
.app-container {
  display: flex;
  height: 100vh;
  width: 100vw;
  background-color: #ffffff;
  color: #ececec;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica,
    Arial, sans-serif;
  overflow: hidden;
}

/* 幽灵按钮通用样式 */
.ghost {
  border: none;
  background: transparent;
  cursor: pointer;
  transition: all 0.2s ease;
}
.ghost:hover {
  background: rgba(0, 0, 0, 0.05);
}

/* ==========================================
   2. 左侧边栏 (Sidebar)
   ========================================== */
.sidebar {
  display: flex;
  flex-direction: column;
  width: 260px;
  background-color: #f9f9f9;
  border-right: 1px solid #e5e5e5;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  z-index: 10;
  white-space: nowrap;
}
.sidebar.collapsed {
  width: 0;
  border-right: none;
  overflow: hidden;
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  height: 60px;
}

.sidebar-actions {
  padding: 0 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.action-row {
  display: flex;
  gap: 8px;
}
.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: none;
  border-radius: 8px;
  padding: 10px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}
.action-btn.primary {
  background-color: #ffffff;
  color: #333;
  border: 1px solid #e5e5e5;
  flex: 1;
}
.action-btn.primary:hover {
  background-color: #f3f3f3;
}
.action-btn.secondary {
  background-color: #ffffff;
  color: #333;
  border: 1px solid #e5e5e5;
}
.action-btn.secondary:hover {
  background-color: #f3f3f3;
}
.action-btn.icon-only {
  width: 40px;
  background-color: #ffffff;
  border: 1px solid #e5e5e5;
}
.action-btn.icon-only.active {
  background-color: #e9eaea;
  border-color: #929292;
  color: #8e8f8f;
}

/* 图标按钮基础 */
.icon-btn {
  background: transparent;
  border: none;
  color: #666;
  font-size: 18px;
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
}
.icon-btn:hover {
  background-color: #e5e5e5;
  color: #333;
}
.icon-btn:active {
  transform: scale(0.92);
}

/* ==========================================
   3. 历史对话列表区
   ========================================== */
.chat-list-container {
  flex: 1;
  overflow-y: auto;
  padding: 0 12px;
}
.chat-list-container::-webkit-scrollbar {
  width: 4px;
}
.chat-list-container::-webkit-scrollbar-thumb {
  background: #dcdcdc;
  border-radius: 4px;
}

.list-title {
  font-size: 12px;
  color: #888;
  font-weight: 600;
  margin: 16px 0 8px 8px;
}
.chat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  color: #333;
  margin-bottom: 4px;
  transition: background 0.2s;
  position: relative;
}
.chat-item:hover {
  background-color: #ececec;
}
.chat-item.active {
  background-color: #e5e5e5;
  font-weight: 500;
}
.chat-title {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 14px;
}

/* 菜单触发图标 */
.menu-trigger {
  background: transparent;
  border: none;
  color: #888;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}
.chat-item:hover .menu-trigger,
.chat-item.active .menu-trigger {
  opacity: 1;
}
.menu-trigger:hover {
  background-color: #dcdcdc;
  color: #333;
}

/* 重命名输入框 */
.rename-input {
  width: 100%;
  padding: 8px 12px;
  font-size: 14px;
  line-height: 1.5;
  color: #334155;
  background-color: #ffffff;
  font-family: inherit;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  outline: none;
  transition: all 0.2s ease-in-out;
}
.rename-input:hover {
  border-color: #94a3b8;
}
.rename-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
  background-color: #ffffff;
}

/* ==========================================
   4. 底部用户与设置面板
   ========================================== */
.sidebar-footer {
  padding: 12px;
  border-top: 1px solid #e5e5e5;
  position: relative;
}
.user-profile {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}
.user-profile:hover {
  background-color: #ececec;
}
.avatar {
  width: 32px;
  height: 32px;
  border-radius: 10%;
  object-fit: cover;
}
.username {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  color: #333;
}
.dots {
  color: #888;
}

.user-popup-menu {
  position: absolute;
  background: white;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 100;
  overflow: hidden;
  bottom: 60px;
  left: 12px;
  width: calc(100% - 24px);
  padding: 8px 0;
}

.menu-info {
  padding: 8px 16px;
  font-size: 13px;
  color: #666;
}
.token-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}
.label-with-icon {
  display: flex;
  align-items: center;
  gap: 4px;
}
.token-val {
  font-weight: 500;
}
.token-val.free {
  color: #10a37f;
}
.token-val.paid {
  color: #f59e0b;
}
.menu-divider {
  height: 1px;
  background: #e5e5e5;
  margin: 4px 0;
}

.menu-item {
  display: flex;
  align-items: center;
  width: 100%;
  box-sizing: border-box;
  padding: 10px 16px;
  font-size: 14px;
  color: #333;
  cursor: pointer;
  transition: all 0.2s;
  border: none !important;
  outline: none !important;
  background: transparent;
  text-align: left;
}
.menu-item:hover {
  background-color: #f3f3f3;
}
.menu-item.info {
  justify-content: center;
}
.menu-item.danger {
  justify-content: center;
  color: #ef4444;
}
.menu-item.danger:hover {
  background-color: #fef2f2;
}
.menu-item.danger .icon {
  margin-right: 8px;
  font-size: 1.1em;
}

/* 🌟 分段式引擎切换器 */
.engine-control-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  cursor: default;
}
.engine-control-row:hover {
  background-color: transparent !important;
}
.segmented-control {
  display: flex;
  background-color: #f1f5f9;
  border-radius: 6px;
  padding: 2px;
  gap: 2px;
}
.segmented-control button {
  border: none;
  background: transparent;
  padding: 4px 10px;
  font-size: 12px;
  color: #64748b;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 500;
}
.segmented-control button.active {
  background-color: #ffffff;
  color: #0f172a;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

/* ==========================================
   5. 弹出菜单与气泡组件
   ========================================== */
.dropdown-menu {
  position: absolute;
  background: white;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 100;
  overflow: hidden;
  right: 12px;
  top: 36px;
  min-width: 100px;
}

.popover-menu {
  position: absolute;
  bottom: calc(100% + 12px);
  left: 0;
  background: white;
  border-radius: 16px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  padding: 6px;
  z-index: 100;
  border: 1px solid #f0f0f0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.tools-menu {
  min-width: 140px;
}
.model-menu {
  min-width: 200px;
  max-height: 250px;
  overflow-y: auto;
}
.popover-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 14px;
  color: #333;
  transition: background 0.2s;
  white-space: nowrap;
}
.popover-item:hover {
  background: #f0f4f9;
}
.popover-item.is-selected {
  background: #e8f0fe;
  color: #1a73e8;
  font-weight: 500;
}
.popover-item .menu-icon {
  font-size: 16px;
  color: #666;
}

/* 纯 CSS Tooltip */
.tooltip-container {
  position: relative;
}
.tooltip-container:hover::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: 110%;
  left: 50%;
  transform: translateX(-50%);
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
  pointer-events: none;
  z-index: 1000;
}

/* ==========================================
   6. 主区域容器与 Header
   ========================================== */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: #ffffff;
  position: relative;
  transition: all 0.3s;
  overflow: hidden;
}

.main-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 60px;
  padding: 0 16px;
  border-bottom: 1px solid transparent;
  flex-shrink: 0;
}
.header-center {
  flex: 1;
  display: flex;
  justify-content: center;
}

.expand-btn {
  background: transparent;
  color: #555;
  padding: 6px 8px;
}
.expand-btn:hover {
  background-color: #f3f3f3;
  color: #111;
}

.global-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 90;
}

/* ==========================================
   7. 聊天消息区 (Scroller)
   ========================================== */
.chat-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
.chat-wrapper.is-homepage {
  justify-content: center;
  align-items: center;
  padding-bottom: 5vh;
}

.homepage-greeting {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  margin-bottom: 40px;
}
.homepage-greeting h2 {
  font-size: 28px;
  font-weight: 600;
  color: #111;
  letter-spacing: 0.5px;
}

.message-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
  opacity: 1;
  transition: opacity 0.2s ease-in-out;
  min-height: 0;
}
.message-list.chat-invisible {
  opacity: 0;
  pointer-events: none;
}
.message-list.is-loading-batches .message-row {
  transition: none !important;
}

.scroller {
  flex: 1;
  height: 100%;
  overflow-y: auto;
  overflow-anchor: auto;
  padding: 24px 16px;
  transition: opacity 0.25s ease-in-out;
}

/* 自定义气泡滚动条 */
.message-list::-webkit-scrollbar {
  width: 6px;
}
.message-list::-webkit-scrollbar-track {
  background: transparent;
}
.message-list::-webkit-scrollbar-thumb {
  background: #d3d3d3;
  border-radius: 6px;
}
.message-list::-webkit-scrollbar-thumb:hover {
  background: #c7c8c8;
}

.scroller::-webkit-scrollbar {
  width: 16px;
}
.scroller::-webkit-scrollbar-track {
  background: transparent;
}
.scroller::-webkit-scrollbar-thumb {
  background-color: transparent;
  background-clip: padding-box;
  border: 4px solid transparent;
  border-radius: 12px;
  min-height: 50px;
}
.scroller:hover::-webkit-scrollbar-thumb {
  background-color: rgba(211, 211, 211, 0.7);
}
.scroller::-webkit-scrollbar-thumb:hover {
  background-color: rgba(199, 200, 200, 1);
}

/* 聊天气泡布局 */
.message-row {
  display: flex;
  width: 100%;
  max-width: 850px;
  margin: 0 auto;
  padding: 16px 20px;
  box-sizing: border-box;
  gap: 16px;
  align-items: flex-start;
}
.message-row.user {
  flex-direction: row-reverse;
}

.message-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 100%;
  flex: 1;
  min-width: 0;
}
.message-row.assistant .message-body {
  align-items: flex-start;
}
.message-row.user .message-body {
  align-items: flex-end;
}

.message-content {
  font-size: 15px;
  line-height: 1.6;
  color: #1a1a1a;
  word-wrap: break-word;
  overflow-wrap: break-word;
}
.message-row.user .message-content {
  background-color: #f4f4f4;
  padding: 10px 16px;
  border-radius: 18px 18px 2px 18px;
  width: fit-content;
  text-align: left;
  max-width: 80%;
}
.message-row.assistant .message-content {
  width: 100%;
  padding: 4px 0;
}
.message-row.assistant .message-content :deep(.markdown-body > *:first-child) {
  margin-top: 0 !important;
}
.message-row.assistant .message-content :deep(.markdown-body > *:last-child) {
  margin-bottom: 0 !important;
}

/* 用户长文折叠 */
.user-msg {
  white-space: pre-wrap;
  position: relative;
  overflow: hidden;
  max-height: 250px;
  will-change: auto;
}
.user-msg.is-collapsed {
  max-height: 70vh !important;
  overflow-y: auto !important;
  transition: none !important;
}
/* ==========================================
   用户长文折叠的滚动条美化 (悬浮胶囊风格)
   ========================================== */
.user-msg.is-collapsed::-webkit-scrollbar {
  width: 8px; /* 整体宽度变细 */
}

.user-msg.is-collapsed::-webkit-scrollbar-track {
  background: transparent; /* 轨道完全透明，融入背景 */
}

.user-msg.is-collapsed::-webkit-scrollbar-thumb {
  background-color: rgba(0, 0, 0, 0.15); /* 干净的半透明浅黑 */
  background-clip: padding-box;
  border: 2px solid transparent; /* 🌟 核心：用透明边框挤出悬浮距离，不贴边 */
  border-radius: 8px; /* 完美的圆角胶囊 */
  min-height: 40px;
}

.user-msg.is-collapsed::-webkit-scrollbar-thumb:hover {
  background-color: rgba(0, 0, 0, 0.25); /* 鼠标悬浮时稍微加深，提供交互反馈 */
}

.collapsed-mask {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 40px;
  background: linear-gradient(to bottom, rgba(229, 244, 255, 0), #ececec);
  transition: opacity 0.3s ease;
  pointer-events: none;
}
.is-collapsed .collapsed-mask {
  opacity: 0;
}

.message-actions {
  display: flex;
  gap: 12px;
  margin-top: 4px;
}
.toggle-btn {
  color: #111;
  font-weight: bold;
}
.copy-btn {
  color: #111;
}
.copy-btn:hover {
  background-color: #f4f4f4;
}

/* 思考过程区 */
.reasoning-section {
  background-color: #ffffff;
  border-left: 1px solid #e2e8f0;
  padding: 10px 14px;
  border-radius: 6px 12px 12px 6px;
  width: 100%;
  box-sizing: border-box;
}
.reasoning-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #8c8c8c;
  font-weight: 600;
  margin-bottom: 6px;
  cursor: pointer;
  user-select: none;
  transition: color 0.2s;
}
.reasoning-title:hover {
  color: #555555;
}
.toggle-icon {
  font-size: 14px;
  opacity: 0.8;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.toggle-icon.is-open {
  transform: rotate(180deg);
}

.reasoning-collapse-wrapper {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transition: opacity 0.3s ease;
  overflow: hidden;
}
.reasoning-collapse-wrapper.is-open {
  grid-template-rows: 1fr;
  opacity: 1;
  margin-top: 8px;
}
.reasoning-collapse-wrapper > .reasoning-content {
  min-height: 0;
}
.reasoning-content :deep(.markdown-body) {
  font-size: 13.5px;
  line-height: 1.6;
  color: #475569;
}
.reasoning-content :deep(.markdown-body > *:last-child) {
  margin-bottom: 0;
}

.title-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* Token 及辅助信息 */
.token-info {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #939393;
  margin-top: 4px;
  padding-top: 6px;
  border-top: 1px dashed #e2e8f0;
  font-family: "JetBrains Mono", "Fira Code", monospace !important;
}
.meta-icon {
  font-size: 12px;
}

/* ==========================================
   8. Gemini 风格两行输入区
   ========================================== */
.chat-wrapper.is-homepage .input-area {
  flex: none;
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
  background: transparent;
}
.input-area {
  width: 100%;
  padding: 16px 0 24px 0;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, #ffffff 20%);
  flex-shrink: 0;
}

/* 输入框大容器 */
.input-box {
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background-color: #f9f9f9;
  border-radius: 24px;
  padding: 12px 14px 10px 14px;
  box-sizing: border-box;
  transition: background-color 0.3s ease, box-shadow 0.3s ease;
  border: 1px solid transparent;
}
.input-box.is-focused {
  background-color: #ffffff;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.08);
  border: 1px solid #cecece;
}

.input-row {
  width: 100%;
}
textarea {
  width: 100%;
  border: none;
  background: transparent;
  padding: 4px 8px;
  font-size: 15.5px;
  line-height: 1.5;
  font-family: inherit;
  color: #111;
  outline: none;
  resize: none;
  box-sizing: border-box;
  min-height: 24px;
  max-height: 300px;
  overflow-y: hidden;
  white-space: pre-wrap;
  word-wrap: break-word;
  word-break: break-all;
}
textarea::placeholder {
  color: #8c8c8c;
}

/* 工具条与按钮 */
.toolbar-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  width: 100%;
}
.toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.tool-wrapper {
  position: relative;
}

/* 附件展开 + 号圆圈 */
.action-circle-btn {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  color: #444746;
  display: flex;
  align-items: center;
  justify-content: center;
}
.action-circle-btn .plus-icon {
  font-size: 20px;
  transition: transform 0.3s ease;
}
.action-circle-btn.is-active .plus-icon {
  transform: rotate(45deg);
}
/* 上下文面板专属样式 */
.context-menu {
  min-width: 240px;
  padding: 12px;
  cursor: default; /* 防止鼠标变成手指 */
}

.context-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #111;
  padding-bottom: 10px;
  border-bottom: 1px solid #f0f0f0;
  margin-bottom: 8px;
}
.context-header .header-icon {
  color: #3b82f6;
  font-size: 16px;
}

.context-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
}
.row-label {
  font-size: 13px;
  color: #333;
}
.row-value {
  font-size: 12px;
  font-weight: 600;
  color: #8b5cf6;
  background: #f3e8ff;
  padding: 2px 8px;
  border-radius: 12px;
}

.context-tip {
  margin-top: 8px;
  padding: 8px;
  font-size: 11.5px;
  color: #666;
  background-color: #f8fafc;
  border-radius: 6px;
  line-height: 1.4;
  border: 1px solid #f1f5f9;
}
/* 自定义数字输入框包装器 */
.number-input-wrapper {
  display: flex;
  align-items: center;
  background: #f3e8ff; /* 跟你原本 row-value 的紫色背景一致 */
  border-radius: 6px;
  padding: 2px 8px;
  border: 1px solid transparent;
  transition: all 0.2s ease;
}

.number-input-wrapper:focus-within {
  border-color: #a78bfa; /* 获取焦点时外发光 */
  background: #fff;
  box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.1);
}

.limit-input {
  width: 32px;
  border: none;
  background: transparent;
  color: #8b5cf6;
  font-weight: 600;
  font-size: 13px;
  text-align: right;
  outline: none;
  padding: 0;
  margin-right: 4px;
  font-family: "JetBrains Mono", "Fira Code", monospace;
}

.limit-input::-webkit-outer-spin-button,
.limit-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.limit-input[type="number"] {
  appearance: textfield; /* 标准属性放在最后 */
  -moz-appearance: textfield; /* 火狐专用 */
}
.unit {
  font-size: 12px;
  color: #8b5cf6;
  font-weight: 500;
}
/* 模型选择极简胶囊 */
.model-selector-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 12px;
  color: #444746;
  font-size: 13.5px;
  font-weight: 500;
  height: 34px;
  box-sizing: border-box;
}
.model-icon {
  font-size: 14px;
  color: #8b5cf6;
}
.model-selector-btn .chevron {
  font-size: 14px;
  color: #888;
  transition: transform 0.2s;
}
.model-selector-btn .chevron.is-open {
  transform: rotate(180deg);
}

/* 发送按钮 */
.send-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: none;
  background: #e0e0e0;
  color: #fff;
  cursor: not-allowed;
  transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
}
.send-btn.active {
  background: #111;
  cursor: pointer;
}
.send-btn.active:hover {
  background: #333;
  transform: scale(1.05);
}
.send-btn .lucide {
  font-size: 18px;
}

.footer-hint {
  text-align: center;
  font-size: 12px;
  color: #999;
  margin-top: 12px;
}

/* ==========================================
   9. 动画与特效类
   ========================================== */
.fade-up-enter-active,
.fade-up-leave-active {
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.fade-up-enter-from,
.fade-up-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.96);
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.25s cubic-bezier(0.2, 0, 0, 1);
}
.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(15px);
}
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-15px);
}

.flowing-line {
  width: 100% !important;
  height: 4px !important;
  flex-shrink: 0 !important;
  z-index: 9999 !important;
  background-image: linear-gradient(
    to right,
    transparent 0%,
    #808080 50%,
    transparent 100%
  ) !important;
  background-size: 200% 100% !important;
  animation: light-flow-test 1.5s linear infinite !important;
}
@keyframes light-flow-test {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: -100% 0;
  }
}

.spinning {
  animation: rotate 2s linear infinite;
}
@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.pulse-dot {
  width: 6px;
  height: 6px;
  background-color: #3b82f6;
  border-radius: 50%;
  position: relative;
}
.pulse-dot::after {
  content: "";
  position: absolute;
  width: 100%;
  height: 100%;
  background: inherit;
  border-radius: inherit;
  animation: pulse-wave 1.5s infinite;
}
@keyframes pulse-wave {
  0% {
    transform: scale(1);
    opacity: 0.5;
  }
  100% {
    transform: scale(3);
    opacity: 0;
  }
}

.typing-placeholder {
  display: inline-block;
  font-size: 20px;
  font-weight: 600;
  color: #949494;
  letter-spacing: 4px;
  line-height: 1;
  margin-left: 4px;
  animation: ai-thinking 1.2s infinite ease-in-out;
}
@keyframes ai-thinking {
  0%,
  100% {
    opacity: 0.3;
    transform: translateY(0);
  }
  50% {
    opacity: 1;
    color: #454545;
    transform: translateY(-2px);
  }
}
/* ==========================================
   文件预览区样式
   ========================================== */
.file-preview-area {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 4px 8px 12px 8px;
  border-bottom: 1px solid transparent;
}

.preview-item {
  position: relative;
  width: 64px;
  height: 64px;
  border-radius: 12px;
  background-color: #f1f5f9;
  border: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 11px; /* 比外框稍微小一点，避免溢出 */
}

.preview-doc {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  padding: 4px;
}

.preview-doc .doc-icon {
  font-size: 24px;
  color: #3b82f6;
}

.preview-doc .doc-name {
  font-size: 10px;
  color: #64748b;
  width: 90%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
}

.remove-file-btn {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-color: #64748b;
  color: white;
  border: 2px solid #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  transition: all 0.2s;
  z-index: 2;
}

.remove-file-btn:hover {
  background-color: #ef4444;
  transform: scale(1.1);
}

.remove-file-btn .lucide {
  font-size: 12px;
}
/* ==========================================
   用户消息气泡内的附件样式 (Google 分离风格)
   ========================================== */
   .user-attachments.standalone {
  display: flex;
  flex-direction: row; /* 🌟 核心修改 1：改为横向排布 */
  flex-wrap: wrap;     /* 🌟 核心修改 2：如果图片太多，允许自动换行 */
  justify-content: flex-end; /* 🌟 核心修改 3：整体靠右对齐 */
  gap: 10px;
}

/* 独立的图片卡片 */
.user-msg-img {
  width: 120px;  /* 🌟 核心修改 4：写死宽度 */
  height: 120px; /* 🌟 核心修改 5：写死高度，与宽度一致形成正方形 */
  border-radius: 14px;
  object-fit: cover; /* 🌟 核心保留：保证图片被裁切填满正方形，绝对不会被拉伸压扁！ */
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
  background-color: #f8f9fa;
  cursor: pointer; /* 加个小手，以后如果想做点击放大功能可以用 */
}

/* 独立的文件卡片 */
.user-msg-doc {
  display: flex;
  align-items: center;
  gap: 10px;
  background-color: #ffffff; /* 白底 */
  padding: 12px 16px;
  border-radius: 14px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
  min-width: 200px;
  max-width: 300px;
}

.user-msg-doc .doc-icon {
  font-size: 24px;
  color: #ea4335; /* Google 经典的文档/PDF 红色 (或者你可以保留蓝色 #3b82f6) */
  flex-shrink: 0;
}

.user-msg-doc .doc-name {
  font-size: 14px;
  font-weight: 500;
  color: #3c4043; /* Google 灰色文字 */
  word-break: break-all;
  line-height: 1.3;
}
</style>
