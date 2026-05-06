<template>
  <div class="settings-page">
    <!-- 头部导航 -->
    <header class="settings-header">
      <div class="header-left">
        <button class="icon-btn back-btn" @click="goBack" title="返回">
          <Icon icon="lucide:arrow-left" />
        </button>
        <h2>系统全局与上下文配置</h2>
      </div>
      <div class="header-right">
        <button class="ghost-btn" @click="restoreDefaults" style="margin-right: 12px;">
          <Icon icon="lucide:rotate-ccw" /> 恢复默认
        </button>
        <button class="primary-btn" @click="handleSave" :disabled="isSaving">
          <Icon v-if="isSaving" icon="lucide:loader-2" class="spin-icon" />
          <Icon v-else icon="lucide:save" />
          {{ isSaving ? '保存中...' : '保存配置' }}
        </button>
      </div>
    </header>

    <main class="settings-content">
      <div class="form-container" v-if="!isLoading">
        
        <!-- ================= 模块一：核心系统提示词 ================= -->
        <div class="form-card">
          <div class="card-header-row">
            <div>
              <h3 class="card-title">
                <Icon icon="lucide:terminal-square" class="title-icon" /> 
                系统核心提示词 (System Prompts)
              </h3>
              <p class="card-desc">控制后台静默任务中，大模型进行数据压缩和提取时的行为准则。</p>
            </div>
            <button class="ghost-btn small-btn" @click="toggleAllPrompts">
              {{ isAllPromptsExpanded ? '全部收起' : '全部展开' }}
            </button>
          </div>

          <div class="prompt-grid">
            <!-- Prompt 1: 全局长效摘要 -->
            <div class="prompt-card" :class="{ 'is-expanded': expandedPrompts.global }">
              <div class="prompt-header" @click="expandedPrompts.global = !expandedPrompts.global">
                <div class="prompt-title">
                  <Icon icon="lucide:globe" class="prompt-icon" />
                  <span>全局长效摘要合并</span>
                </div>
                <Icon :icon="expandedPrompts.global ? 'lucide:chevron-up' : 'lucide:chevron-down'" class="chevron" />
              </div>
              <div class="prompt-body">
                <textarea 
                  v-model="systemForm.promptGlobalSummary" 
                  class="custom-textarea prompt-editor" 
                  placeholder="输入全局摘要的提示词..."
                ></textarea>
                <div class="prompt-actions">
                  <button class="action-text-btn" @click="resetPrompt('promptGlobalSummary')" title="重置为此项默认值">
                    <Icon icon="lucide:rotate-ccw" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Prompt 2: 缓存摘要 -->
            <div class="prompt-card" :class="{ 'is-expanded': expandedPrompts.epoch }">
              <div class="prompt-header" @click="expandedPrompts.epoch = !expandedPrompts.epoch">
                <div class="prompt-title">
                  <Icon icon="lucide:archive" class="prompt-icon" />
                  <span>全量缓存纪元合并</span>
                </div>
                <Icon :icon="expandedPrompts.epoch ? 'lucide:chevron-up' : 'lucide:chevron-down'" class="chevron" />
              </div>
              <div class="prompt-body">
                <textarea 
                  v-model="systemForm.promptEpochSummary" 
                  class="custom-textarea prompt-editor" 
                  placeholder="输入全局缓存摘要的提示词..."
                ></textarea>
                <div class="prompt-actions">
                  <button class="action-text-btn" @click="resetPrompt('promptEpochSummary')" title="重置为此项默认值">
                    <Icon icon="lucide:rotate-ccw" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Prompt 3: 增量短片段 -->
            <div class="prompt-card" :class="{ 'is-expanded': expandedPrompts.segment }">
              <div class="prompt-header" @click="expandedPrompts.segment = !expandedPrompts.segment">
                <div class="prompt-title">
                  <Icon icon="lucide:file-text" class="prompt-icon" />
                  <span>增量短片段提取</span>
                </div>
                <Icon :icon="expandedPrompts.segment ? 'lucide:chevron-up' : 'lucide:chevron-down'" class="chevron" />
              </div>
              <div class="prompt-body">
                <textarea 
                  v-model="systemForm.promptSegmentSummary" 
                  class="custom-textarea prompt-editor" 
                  placeholder="输入片段提取的提示词..."
                ></textarea>
                <div class="prompt-actions">
                  <button class="action-text-btn" @click="resetPrompt('promptSegmentSummary')" title="重置为此项默认值">
                    <Icon icon="lucide:rotate-ccw" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Prompt 4: 事实提取 -->
            <div class="prompt-card" :class="{ 'is-expanded': expandedPrompts.fact }">
              <div class="prompt-header" @click="expandedPrompts.fact = !expandedPrompts.fact">
                <div class="prompt-title">
                  <Icon icon="lucide:user-check" class="prompt-icon" />
                  <span>用户长期事实提取</span>
                </div>
                <Icon :icon="expandedPrompts.fact ? 'lucide:chevron-up' : 'lucide:chevron-down'" class="chevron" />
              </div>
              <div class="prompt-body">
                <textarea 
                  v-model="systemForm.promptFactExtraction" 
                  class="custom-textarea prompt-editor" 
                  placeholder="输入事实提取的提示词..."
                ></textarea>
                <div class="prompt-actions">
                  <button class="action-text-btn" @click="resetPrompt('promptFactExtraction')" title="重置为此项默认值">
                    <Icon icon="lucide:rotate-ccw" />
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>

        <!-- ================= 模块二：RAG 算法与本地数据库上限 ================= -->
        <div class="form-card">
          <h3 class="card-title">
            <Icon icon="lucide:database" class="title-icon" /> 
            底层检索算法与数据库限制
          </h3>
          <p class="card-desc">防止本地 IndexedDB 查询和 Web Worker 向量计算时导致浏览器内存溢出。</p>
          
          <div class="grid-2-cols">
            <div class="form-group">
              <label title="捞取最近的会话消息向量的最大条数">消息向量读取上限 (条)</label>
              <input type="number" v-model.number="systemForm.dbMessageVectorLimit" min="100" step="100" />
            </div>
            <div class="form-group">
              <label title="捞取长期记忆事实向量的最大条数">事实向量读取上限 (条)</label>
              <input type="number" v-model.number="systemForm.dbFactVectorLimit" min="100" step="100" />
            </div>
            <div class="form-group">
              <label title="RRF 排序算法的平滑常数">RRF 融合常数 (K值)</label>
              <input type="number" v-model.number="systemForm.rrfConstantK" min="1" max="100" />
            </div>
            <div class="form-group">
              <label title="MiniSearch 的模糊匹配容错率">文本模糊匹配容忍度</label>
              <input type="number" v-model.number="systemForm.fuzzyMatchRate" min="0" max="1" step="0.1" />
            </div>
          </div>
        </div>

        <!-- ================= 模块三：UI 调度与摘要防爆机制 ================= -->
        <div class="form-card">
          <h3 class="card-title">
            <Icon icon="lucide:cpu" class="title-icon" /> 
            系统性能与上下文调度
          </h3>
          <p class="card-desc">控制 UI 交互延迟以及历史摘要注入 Prompt 时的折叠逻辑。</p>
          
          <div class="grid-2-cols">
            <div class="form-group">
              <label title="新建会话时，自动截取用户首句话作为标题的最大长度">自动生成标题长度</label>
              <input type="number" v-model.number="systemForm.chatTitleMaxLength" min="5" max="50" />
            </div>
            <div class="form-group">
              <label title="AI 回复结束后，延迟多久触发后台静默压缩 (防卡顿)">后台压缩延迟 (毫秒)</label>
              <input type="number" v-model.number="systemForm.backgroundTaskDelay" min="0" step="500" />
            </div>
          </div>

          <div class="divider"></div>
          <h4 class="sub-title">历史摘要注入控制</h4>

          <div class="grid-3-cols">
            <div class="form-group">
              <label title="对话超过此轮数，开启严格摘要折叠">严格折叠触发轮数</label>
              <input type="number" v-model.number="systemForm.summaryInjectThreshold" min="1" />
            </div>
            <div class="form-group">
              <label title="严格折叠模式下，最多注入字符">严格注入长度 (字符)</label>
              <input type="number" v-model.number="systemForm.summaryInjectStrictLen" min="100" step="100" />
            </div>
            <div class="form-group">
              <label title="未达阈值的宽松模式下，最多注入字符">宽松注入长度 (字符)</label>
              <input type="number" v-model.number="systemForm.summaryInjectLooseLen" min="100" step="100" />
            </div>
          </div>
        </div>

        <!-- ================= 模块四：Token 防爆与截断保护 ================= -->
        <div class="form-card">
          <h3 class="card-title">
            <Icon icon="lucide:scissors" class="title-icon" /> 
            记忆压缩与 Token 防爆截断
          </h3>
          <p class="card-desc">控制大模型滚动压缩的时机，以及单条历史记录的最大保留长度，严防爆 Token。</p>
          
          <div class="grid-3-cols">
            <div class="form-group">
              <label title="超过此字符数将触发后台自动滚动压缩">触发压缩阈值 (字符)</label>
              <input type="number" v-model.number="systemForm.compressThreshold" min="1000" step="500" />
            </div>
            <div class="form-group">
              <label title="限制大模型生成的全局摘要长度">摘要输出上限 (Tokens)</label>
              <input type="number" v-model.number="systemForm.maxSummaryTokens" min="100" step="50" />
            </div>
            <div class="form-group">
              <label title="限制大模型提取事实时的长度">事实提取上限 (Tokens)</label>
              <input type="number" v-model.number="systemForm.maxExtractionTokens" min="50" step="10" />
            </div>
          </div>

          <div class="divider"></div>
          <h4 class="sub-title">片段保留截断线</h4>
          
          <div class="grid-3-cols">
            <div class="form-group">
              <label title="召回的纯文本部分单条最多保留多少字">纯文本片段限制</label>
              <input type="number" v-model.number="systemForm.qaSnippetTextLimit" min="50" step="50" />
            </div>
            <div class="form-group">
              <label title="召回的用户提问中，代码部分最多保留多少字">用户代码截断限制</label>
              <input type="number" v-model.number="systemForm.qaSnippetUserCodeLimit" min="100" step="100" />
            </div>
            <div class="form-group">
              <label title="召回的 AI 回答中，代码部分最多保留多少字">AI 代码截断限制</label>
              <input type="number" v-model.number="systemForm.qaSnippetAICodeLimit" min="100" step="100" />
            </div>
          </div>
        </div>

        <!-- ================= 模块五：高级 RAG 与上下文注入策略 ================= -->
        <div class="form-card">
          <h3 class="card-title">
            <Icon icon="lucide:network" class="title-icon" /> 
            上下文检索与注入策略
          </h3>
          <p class="card-desc">深度控制每次大模型对话前，如何从海量记忆中组装 Prompt。</p>
          
          <div class="grid-3-cols">
            <div class="form-group">
              <label title="常规对话时，每次必定带入大模型的最近历史记录数量">近期无损记忆 (轮)</label>
              <input type="number" v-model.number="systemForm.recentLimit" min="1" max="20" />
            </div>
            <div class="form-group">
              <label title="RAG 向量召回时，屏蔽最近 N 轮，防止把刚才说的话当历史查出来">隐式检索屏蔽区 (轮)</label>
              <input type="number" v-model.number="systemForm.searchLimit" min="1" max="20" />
            </div>
            <div class="form-group">
              <label title="从向量库中进行语义检索时，初步捞取的候选数量">向量检索候选数</label>
              <input type="number" v-model.number="systemForm.vectorSearchLimit" min="1" max="30" />
            </div>
          </div>

          <div class="grid-2-cols" style="margin-top: 16px;">
            <div class="form-group">
              <label title="经过 RRF 重排衰减后，最终真正塞进提示词的问答对上限">最终注入历史上下文数量</label>
              <input type="number" v-model.number="systemForm.finalContextLimit" min="1" max="15" />
            </div>
            <div class="form-group">
              <label title="数值越大，越旧的历史对话分数下降越快 (0为不衰减)">时间衰减率 (Time Decay)</label>
              <input type="number" v-model.number="systemForm.timeDecayRate" min="0" max="0.5" step="0.01" />
            </div>
          </div>

          <div class="divider"></div>
          <h4 class="sub-title">个人长期事实库 (Long-term Facts)</h4>
          
          <div class="grid-2-cols">
            <div class="form-group">
              <label title="每次对话最多召唤几条关于用户的长期事实">事实召回上限 (条)</label>
              <input type="number" v-model.number="systemForm.factSearchLimit" min="1" max="10" />
            </div>
            <div class="form-group">
              <label title="余弦相似度低于此值的事实将被抛弃">事实匹配及格线 (0~1)</label>
              <input type="number" v-model.number="systemForm.factSimilarityThreshold" min="0" max="1" step="0.01" />
            </div>
          </div>
        </div>

      </div>
      
      <!-- 加载状态 -->
      <div v-else class="loading-state">
        <Icon icon="lucide:loader-2" class="spin-icon large-spin" />
        <p>正在加载系统配置...</p>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { Icon } from '@iconify/vue';
import { systemSetDB } from '../Indexdb/db/systemSetDB.js';
import { showConfirm } from "./ui/ui-js/confirm.js";
const router = useRouter();

const isLoading = ref(true);
const isSaving = ref(false);

const DEFAULT_CONFIG = {
  // === 模块一：Prompts ===
  promptGlobalSummary: `任务：更新并压缩全局对话摘要。\n规则：\n1. 新旧融合：将【旧摘要】与【新对话】无缝合并。\n2. 提炼核心：保留核心的技术决策、关键事实和上下文。\n3. 严格限字：绝对不能超过 200 字！尽量压缩旧信息，给新信息腾出空间。\n4. 格式要求：输出一段连贯的简体中文。直接写正文，绝对不要加“摘要：”或“总结：”这种多余的前缀。`,
  promptEpochSummary: `你是一个无损记忆压缩引擎。请将【过去的记忆摘要】与【最新的一大段对话记录】进行合并与提炼。\n规则：\n1. 严格保留核心事实、用户偏好设定、关键数据（如代码逻辑、关键日期等）。\n2. 抛弃无用的客套话和重复性对话。\n3. 如果最新的对话颠覆了过去的设定，以最新对话为准。\n4. 输出连贯的文本，直接写正文，不要带“总结：”等前缀。`,
  promptSegmentSummary: `任务：从简短的对话片段中提取核心信息。\n规则：\n1. 只抓重点：只提取核心的技术决策、待办事项或结论。\n2. 挤干水分：删掉所有的客套话、日常闲聊和当下的思考过程。\n3. 严格限字：绝对不能超过 50 字！\n4. 格式要求：输出 1 到 2 个核心要点（使用条目列表形式，如 - xxx），用简体中文。直接写正文，不要加任何前缀。`,
  promptFactExtraction: `任务：提取对话中仅关于【用户】的长期事实、偏好和状态。\n严格规则：\n1. 角色隔离：只提取【用户】本人的信息！绝对不要记录【AI助手】的能力、身份或回复。\n2. 拒绝脑补：只提取用户明确说过的或确认过的事实。\n3. 纯 JSON 输出：只能输出合法的 JSON 对象。不要带任何解释、语气词或 Markdown 代码块包裹。\n格式参考：\n{\n  "facts": [\n    "用户喜欢早上喝咖啡"\n  ]\n}\n交白卷格式：\n{\n  "facts": []\n}`,
  
  // === 模块二：Database Limits ===
  dbMessageVectorLimit: 500,
  dbFactVectorLimit: 1000,
  rrfConstantK: 30,
  fuzzyMatchRate: 0.2,
  
  // === 模块三：UI & Performance ===
  chatTitleMaxLength: 15,
  backgroundTaskDelay: 2000,
  summaryInjectThreshold: 10,
  summaryInjectStrictLen: 500,
  summaryInjectLooseLen: 1000,

  // === 模块四：防爆与截断默认值 ===
  compressThreshold: 4000,
  maxSummaryTokens: 600,
  maxExtractionTokens: 150,
  qaSnippetTextLimit: 150,
  qaSnippetUserCodeLimit: 600,
  qaSnippetAICodeLimit: 1500,

  // === 模块五：上下文与 RAG 检索默认值 ===
  recentLimit: 6,
  searchLimit: 5,
  vectorSearchLimit: 8,
  finalContextLimit: 5,
  factSearchLimit: 5,
  factSimilarityThreshold: 0.82,
  timeDecayRate: 0.04
};
// 控制 Prompt 卡片展开状态
const expandedPrompts = reactive({
  global: false,
  epoch: false,
  segment: false,
  fact: false
});

// 计算属性：判断是否全部展开
const isAllPromptsExpanded = computed(() => {
  return expandedPrompts.global && expandedPrompts.epoch && expandedPrompts.segment && expandedPrompts.fact;
});

// 切换所有 Prompt 的展开状态
const toggleAllPrompts = () => {
  const targetState = !isAllPromptsExpanded.value;
  expandedPrompts.global = targetState;
  expandedPrompts.epoch = targetState;
  expandedPrompts.segment = targetState;
  expandedPrompts.fact = targetState;
};

// 单独重置某个 Prompt
const resetPrompt = (key) => {
  systemForm[key] = DEFAULT_CONFIG[key];
};
// 响应式表单数据
const systemForm = reactive({ ...DEFAULT_CONFIG });

onMounted(async () => {
  await loadSettings();
});

const loadSettings = async () => {
  isLoading.value = true;
  try {
    const savedConfig = await systemSetDB.getSystemSettings('default');
    if (savedConfig) {
      Object.assign(systemForm, { ...DEFAULT_CONFIG, ...savedConfig });
    }
  } catch (error) {
    console.error("加载系统配置失败:", error);
  } finally {
    isLoading.value = false;
  }
};

const handleSave = async () => {
  isSaving.value = true;
  try {
    const dataToSave = JSON.parse(JSON.stringify(systemForm));
    dataToSave.id = 'default';
    
    await systemSetDB.saveSystemSettings(dataToSave);
    showAlert("success", `系统配置已成功保存！`); 
  } catch (error) {
    console.error("保存配置失败:", error);
    showAlert("warning", `保存失败，请检查控制台。`); 
  } finally {
    isSaving.value = false;
  }
};

const restoreDefaults = async () => {
  const isConfirm = await showConfirm({
        title: "恢复",
        message: `确定要恢复所有系统参数和提示词到出厂默认状态吗？\n此操作不可逆！`,
        type: "info",
      });
   if(!isConfirm)return;
   Object.assign(systemForm, DEFAULT_CONFIG);
};

const goBack = () => {
  router.push('/aiUserChat');
};
</script>

<style scoped>
/* ==========================================
   全局与基础布局
   ========================================== */
.settings-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
  background-color: #f7f9fa;
  color: #333;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  overflow: hidden;
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background-color: #ffffff;
  border-bottom: 1px solid #e5e8eb;
  flex-shrink: 0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-left h2 {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  color: #111827;
}

.header-right {
  display: flex;
  align-items: center;
}

/* ==========================================
   按钮样式
   ========================================== */
.icon-btn {
  background: transparent;
  border: none;
  font-size: 20px;
  color: #6b7280;
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  transition: background 0.2s;
  display: flex;
}
.icon-btn:hover { background-color: #f3f4f6; color: #111827; }

.primary-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background-color: #111827;
  color: #fff;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}
.primary-btn:hover:not(:disabled) { background-color: #374151; }
.primary-btn:disabled { opacity: 0.7; cursor: not-allowed; }

.ghost-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: 1px solid #d1d5db;
  color: #4b5563;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}
.ghost-btn:hover { background: #f3f4f6; color: #111827; }
.small-btn {
  padding: 4px 10px;
  font-size: 12px;
}

/* ==========================================
   主内容区容器
   ========================================== */
.settings-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  display: flex;
  justify-content: center;
}

.form-container {
  width: 100%;
  max-width: 760px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-bottom: 40px;
}

.form-card {
  background: #ffffff;
  border: 1px solid #e5e8eb;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
}

.card-title {
  margin: 0 0 6px 0;
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  display: flex;
  align-items: center;
  gap: 8px;
}

.title-icon {
  color: #3b82f6;
  font-size: 18px;
}

.card-desc {
  font-size: 13px;
  color: #6b7280;
  margin: 0 0 20px 0;
  line-height: 1.5;
}

.card-header-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

/* ==========================================
   Prompt 折叠卡片专属样式
   ========================================== */
.prompt-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.prompt-card {
  border: 1px solid #e5e8eb;
  border-radius: 8px;
  background-color: #fcfcfc;
  transition: all 0.2s ease;
  overflow: hidden; /* 防止内容撑破卡片圆角 */
}

.prompt-card:hover {
  border-color: #d1d5db;
}

.prompt-card.is-expanded {
  border-color: #3b82f6;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.08);
}

.prompt-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  background-color: #ffffff;
  user-select: none;
  border-bottom: 1px solid transparent;
  transition: background-color 0.2s, border-bottom-color 0.2s;
}

.prompt-card.is-expanded .prompt-header {
  border-bottom-color: #e5e8eb;
  background-color: #f0fdf4;
}

.prompt-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.prompt-icon {
  color: #6b7280;
  font-size: 16px;
  transition: color 0.2s;
}
.prompt-card.is-expanded .prompt-icon {
  color: #3b82f6;
}

.chevron {
  color: #9ca3af;
  font-size: 18px;
  transition: transform 0.3s ease; /* 添加箭头旋转的平滑过渡 */
}

/* 🌟 核心：使用 Grid 实现高度平滑动画 */
.prompt-body {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.prompt-card.is-expanded .prompt-body {
  grid-template-rows: 1fr;
  opacity: 1;
}

.prompt-body > .custom-textarea {
  min-height: 0; /* 这是 Grid 动画生效的关键 */
  overflow: hidden; /* 收起时隐藏内容 */
  padding-top: 0; 
  padding-bottom: 0;
  border-width: 0;
  transition: all 0.3s ease;
  margin: 0;
}

.prompt-card.is-expanded .prompt-body > .custom-textarea {
  height: 150px;
  padding: 12px;
  border-width: 1px;
  margin: 12px; /* 展开后加上外边距 */
  overflow-y: auto; /* 展开后允许内部滚动 */
}

/* 编辑器外观 */
.prompt-editor {
  background-color: #ffffff !important;
  color: #3d3d3d !important;
  border: none !important;
  border-radius: 6px !important;
  font-family: "JetBrains Mono", "Fira Code", Consolas, monospace !important;
  font-size: 13px !important;
  line-height: 1.6 !important;
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
  resize: vertical;
}

.prompt-editor:focus {
  box-shadow: 0 0 0 2px rgba(189, 189, 189, 0.5) !important;
  background-color: #ffffff !important;
}

/* 悬浮重置按钮 */
.prompt-actions {
  position: absolute;
  top: 24px;
  right: 28px;
  opacity: 0;
  transition: opacity 0.2s;
  pointer-events: none; /* 收起时不遮挡点击 */
}

.prompt-card.is-expanded:hover .prompt-actions {
  opacity: 1;
  pointer-events: auto;
}

.action-text-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #d4d4d4;
  border-radius: 4px;
  padding: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.action-text-btn:hover {
  background: rgba(255, 255, 255, 0.25);
  color: #ffffff;
}

/* ==========================================
   常规表单元素
   ========================================== */
.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}
.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}

input[type="number"], .custom-textarea {
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  transition: all 0.2s;
  background-color: #f9fafb;
  color: #111827;
  width: 100%;
  box-sizing: border-box;
}
input[type="number"]:focus, .custom-textarea:focus {
  outline: none;
  border-color: #3b82f6;
  background-color: #ffffff;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.grid-2-cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.grid-3-cols {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.divider {
  height: 1px;
  background-color: #e5e8eb;
  margin: 24px 0 16px 0;
}

.sub-title {
  margin: 0 0 16px 0;
  font-size: 14px;
  font-weight: 600;
  color: #4b5563;
}

/* ==========================================
   加载动画
   ========================================== */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 50vh;
  color: #6b7280;
}
.spin-icon { animation: spin 1s linear infinite; }
.large-spin { font-size: 32px; margin-bottom: 12px; color: #9ca3af; }

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>