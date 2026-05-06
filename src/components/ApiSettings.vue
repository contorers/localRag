<template>
  <div class="settings-page">
    <!-- 头部导航 -->
    <header class="settings-header">
      <div class="header-left">
        <button class="icon-btn back-btn" @click="goBack" title="返回">
          <Icon icon="lucide:arrow-left" />
        </button>
        <h2>厂商与模型配置管理</h2>
      </div>
      <button v-if="currentView === 'list'" class="primary-btn" @click="openProviderForm(null)">
        <Icon icon="lucide:plus" /> 新增厂商
      </button>
    </header>

    <main class="settings-content">
      <transition name="fade" mode="out-in">
        <!-- ================= 列表视图 ================= -->
        <div v-if="currentView === 'list'" class="list-view">
          <div v-if="providersList.length === 0" class="empty-state">
            <Icon icon="lucide:server" class="empty-icon" />
            <p>暂无任何厂商及模型配置</p>
            <button class="ghost-btn" @click="openProviderForm(null)">添加第一个厂商</button>
          </div>

          <div v-else class="provider-grid">
            <!-- 厂商卡片 (可折叠) -->
            <div 
              v-for="provider in providersList" 
              :key="provider.id" 
              class="provider-card"
              :class="{ 'is-expanded': expandedProviders.includes(provider.id) }"
            >
              <!-- 厂商头部 -->
              <div class="provider-header" @click="toggleProvider(provider.id)">
                <div class="provider-title-wrapper">
                  <Icon 
                    icon="lucide:chevron-right" 
                    class="chevron-icon" 
                    :class="{ 'rotate-90': expandedProviders.includes(provider.id) }" 
                  />
                  <div class="provider-title">
                    <div class="title-icon-box">
                      <Icon icon="lucide:building-2" class="provider-icon" />
                    </div>
                    <div class="title-text-group">
                      <h3>{{ provider.name }}</h3>
                      <div class="key-mask-wrapper">
                        <a v-if="provider.officialUrl" :href="provider.officialUrl" target="_blank" class="meta-link" @click.stop>
                          <Icon icon="lucide:external-link" /> 官网
                        </a>
                        <span class="key-mask">Key: ••••••••</span>
                        <span class="model-count-badge">{{ provider.models?.length || 0 }} 个模型</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div class="provider-actions" @click.stop>
                  <button class="icon-btn edit" @click="openProviderForm(provider)" title="编辑厂商">
                    <Icon icon="lucide:edit" />
                  </button>
                  <button class="icon-btn delete" @click="handleDeleteProvider(provider.id, provider.name)" title="删除厂商">
                    <Icon icon="lucide:trash-2" />
                  </button>
                </div>
              </div>

              <!-- 模型列表 (子级) -->
              <div class="models-collapse-wrapper" :class="{ 'open': expandedProviders.includes(provider.id) }">
                <div class="models-container">
                  
                  <div class="provider-defaults-bar" v-if="getTextModels(provider.models).length > 0">
                    <!-- 自定义下拉：默认对话模型 -->
                    <div class="default-select-item">
                      <span class="select-label">默认对话模型:</span>
                      <div class="custom-dropdown" @click.stop>
                        <button class="dropdown-trigger" @click="toggleDropdown(`chat_${provider.id}`)">
                          <span class="trigger-text">{{ getModelName(provider.models, provider.defaultChatModelId, '-- 请选择 --') }}</span>
                          <Icon icon="lucide:chevron-down" class="trigger-icon" :class="{ 'rotate-180': activeDropdown === `chat_${provider.id}` }" />
                        </button>
                        <transition name="dropdown-fade">
                          <ul v-if="activeDropdown === `chat_${provider.id}`" class="dropdown-menu">
                            <li 
                              v-for="m in getTextModels(provider.models)" 
                              :key="m.id"
                              class="dropdown-item"
                              :class="{ 'is-active': provider.defaultChatModelId === m.id }"
                              @click="selectModel(provider, 'chat', m.id)"
                            >
                              <span class="item-name">{{ m.name }}</span>
                              <Icon v-if="provider.defaultChatModelId === m.id" icon="lucide:check" class="check-icon" />
                            </li>
                          </ul>
                        </transition>
                      </div>
                    </div>

                    <!-- 自定义下拉：默认压缩模型 -->
                    <div class="default-select-item">
                      <span class="select-label">默认压缩模型:</span>
                      <div class="custom-dropdown" @click.stop>
                        <button class="dropdown-trigger" @click="toggleDropdown(`compress_${provider.id}`)">
                          <span class="trigger-text">{{ getModelName(provider.models, provider.defaultCompressModelId, '(与对话模型相同)') }}</span>
                          <Icon icon="lucide:chevron-down" class="trigger-icon" :class="{ 'rotate-180': activeDropdown === `compress_${provider.id}` }" />
                        </button>
                        <transition name="dropdown-fade">
                          <ul v-if="activeDropdown === `compress_${provider.id}`" class="dropdown-menu">
                            <li 
                              class="dropdown-item"
                              :class="{ 'is-active': !provider.defaultCompressModelId }"
                              @click="selectModel(provider, 'compress', '')"
                            >
                              <span class="item-name text-gray">(与对话模型相同)</span>
                              <Icon v-if="!provider.defaultCompressModelId" icon="lucide:check" class="check-icon" />
                            </li>
                            <li 
                              v-for="m in getTextModels(provider.models)" 
                              :key="m.id"
                              class="dropdown-item"
                              :class="{ 'is-active': provider.defaultCompressModelId === m.id }"
                              @click="selectModel(provider, 'compress', m.id)"
                            >
                              <span class="item-name">{{ m.name }}</span>
                              <Icon v-if="provider.defaultCompressModelId === m.id" icon="lucide:check" class="check-icon" />
                            </li>
                          </ul>
                        </transition>
                      </div>
                    </div>
                  </div>

                  <div class="models-header">
                    <h4>已配置的模型节点</h4>
                    <button class="action-btn text-blue" @click.stop="openModelForm(provider.id, null)">
                      <Icon icon="lucide:plus-circle" /> 添加模型
                    </button>
                  </div>
                  
                  <div v-if="provider.models && provider.models.length > 0" class="model-list">
                    <div 
                      v-for="model in provider.models" 
                      :key="model.id" 
                      class="model-item" 
                      :class="{'is-default': model.isDefault}"
                    >
                      <div class="model-info">
                        <div class="model-name-row">
                          <span class="model-name">{{ model.name }}</span>
                          <span class="type-badge" :class="model.modelType || 'text'">
                            {{ formatModelType(model.modelType) }}
                          </span>
                          <span v-if="model.isDefault" class="badge default-badge">
                            <Icon icon="lucide:check-circle-2" style="font-size: 10px; margin-right: 2px;" />默认
                          </span>
                        </div>
                        <div class="model-meta">
                          <span class="meta-item" title="完整接口地址">
                            <Icon icon="lucide:link" /> 
                            {{ model.baseUrl || '未配置 URL' }}
                          </span>
                        </div>
                      </div>
                      <div class="model-actions">
                        <button 
                          v-if="(!model.modelType || model.modelType === 'text')"
                          class="action-btn" 
                          :class="model.isDefault ? 'text-gray' : 'text-blue'"
                          :disabled="model.isDefault" 
                          @click.stop="handleSetDefaultModel(provider.id, model.id)"
                          title="设为文本对话默认模型"
                        >
                          <Icon :icon="model.isDefault ? 'lucide:check-circle' : 'lucide:circle'" />
                        </button>
                        <button class="icon-btn edit" @click.stop="openModelForm(provider.id, model)" title="编辑模型">
                          <Icon icon="lucide:edit-3" />
                        </button>
                        <button class="icon-btn delete" @click.stop="handleDeleteModel(provider.id, model.id)" title="删除模型">
                          <Icon icon="lucide:x" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div v-else class="empty-models">该厂商下暂无模型配置</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ================= 厂商表单视图 ================= -->
        <div v-else-if="currentView === 'provider-form'" class="form-view">
          <div class="form-card">
            <h3 class="form-title">{{ isNewRecord ? '新增厂商' : '编辑厂商' }}</h3>
            <p class="form-desc">配置厂商的基础信息，API Key 将在本地进行高强度加密。</p>

            <div class="api-form">
              <div class="form-group">
                <label>厂商名称<span class="required">*</span></label>
                <input v-model.trim="providerForm.name" type="text" placeholder="例如: OpenAI / 阿里云" />
              </div>

              <div class="form-group">
                <label>官网地址 (URL)</label>
                <input v-model.trim="providerForm.officialUrl" type="url" placeholder="例如: https://openai.com" />
              </div>

              <div class="form-group">
                <label>厂商 API Key<span class="required">*</span></label>
                <div class="input-with-icon">
                  <input 
                    v-model.trim="providerForm.apiKey" 
                    :type="showKey ? 'text' : 'password'" 
                    placeholder="sk-xxxxxxxxxxxxxxxx" 
                  />
                  <button type="button" class="toggle-eye" @click="showKey = !showKey">
                    <Icon :icon="showKey ? 'lucide:eye-off' : 'lucide:eye'" />
                  </button>
                </div>
              </div>

              <div class="form-footer">
                <button type="button" class="cancel-btn" @click="closeForm">取消</button>
                <button type="button" class="submit-btn" @click="handleSaveProvider" :disabled="isSaving">
                  <Icon v-if="isSaving" icon="lucide:loader-2" class="spin-icon" />
                  {{ isSaving ? '保存加密中...' : '保存厂商' }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- ================= 模型表单视图 ================= -->
        <div v-else-if="currentView === 'model-form'" class="form-view">
          <div class="form-card model-form-card">
            <h3 class="form-title">{{ isNewRecord ? '新增模型' : '编辑模型' }}</h3>
            <p class="form-desc">配置该模型的接口地址及专属参数重写。</p>

            <div class="api-form">
              <!-- 基础配置 -->
              <!-- 基础配置 -->
              <div class="grid-2-cols">
                <div class="form-group">
                  <label>模型类型<span class="required">*</span></label>
                  
                  <!-- 自定义下拉：模型类型 -->
                  <div class="custom-dropdown" @click.stop>
                    <button class="dropdown-trigger" @click="toggleDropdown('modelType')">
                      <span class="trigger-text">{{ formatModelType(modelForm.modelType) }}</span>
                      <Icon icon="lucide:chevron-down" class="trigger-icon" :class="{ 'rotate-180': activeDropdown === 'modelType' }" />
                    </button>
                    <transition name="dropdown-fade">
                      <ul v-if="activeDropdown === 'modelType'" class="dropdown-menu">
                        <li class="dropdown-item" :class="{ 'is-active': modelForm.modelType === 'text' }" @click="selectModelType('text')">
                          <span class="item-name">对话/文本 (Text)</span>
                          <Icon v-if="modelForm.modelType === 'text'" icon="lucide:check" class="check-icon" />
                        </li>
                        <li class="dropdown-item" :class="{ 'is-active': modelForm.modelType === 'image' }" @click="selectModelType('image')">
                          <span class="item-name">图像生成 (Image)</span>
                          <Icon v-if="modelForm.modelType === 'image'" icon="lucide:check" class="check-icon" />
                        </li>
                        <li class="dropdown-item" :class="{ 'is-active': modelForm.modelType === 'video' }" @click="selectModelType('video')">
                          <span class="item-name">视频生成 (Video)</span>
                          <Icon v-if="modelForm.modelType === 'video'" icon="lucide:check" class="check-icon" />
                        </li>
                        <li class="dropdown-item" :class="{ 'is-active': modelForm.modelType === 'embedding' }" @click="selectModelType('embedding')">
                          <span class="item-name">向量化 (Embedding)</span>
                          <Icon v-if="modelForm.modelType === 'embedding'" icon="lucide:check" class="check-icon" />
                        </li>
                      </ul>
                    </transition>
                  </div>

                </div>
                <div class="form-group">
                  <label>模型名称<span class="required">*</span></label>
                  <input v-model.trim="modelForm.name" type="text" placeholder="例如: gpt-4o / sora" />
                </div>
              </div>

              <div class="form-group">
                <label>完整接口地址 (URL)<span class="required">*</span></label>
                <input v-model.trim="modelForm.baseUrl" type="url" placeholder="例如: https://api.openai.com/v1/chat/completions" />
              </div>

              <div class="form-group" v-if="modelForm.modelType === 'text'">
                <label class="switch-label-wrapper">
                  <div class="switch-container">
                    <input type="checkbox" v-model="modelForm.isDefault" class="switch-input" />
                    <span class="switch-slider"></span>
                  </div>
                  <span class="switch-text">保存并设为文本对话的全局默认模型</span>
                </label>
              </div>

              <!-- ================= 高级/自定义参数面板 ================= -->
              <div class="advanced-panel">
                
                <!-- 1. 本地逻辑配置 (重写系统默认值) -->
                <h5 class="section-title">
                  <Icon icon="lucide:monitor-dot" style="margin-right:4px;" />
                  本地系统控制 (模型专属重写)
                </h5>
                <div class="dynamic-params" v-if="modelForm.modelType === 'text'">
                  
                  <div class="form-group" style="margin-bottom: 20px;">
                    <label class="switch-label-wrapper">
                      <div class="switch-container">
                        <input type="checkbox" v-model="modelForm.enableThinking" class="switch-input" />
                        <span class="switch-slider"></span>
                      </div>
                      <span class="switch-text">启用深度思考模式 <span class="text-gray-400 font-normal ml-1">(开启后解析 Reasoning / 思维链字段)</span></span>
                    </label>
                  </div>

                  <!-- 分组 A：上下文与压缩 -->
                  <div class="params-card-group">
                    <div class="group-header">
                      <Icon icon="lucide:brain-circuit" /> 记忆与压缩阈值
                    </div>
                    <div class="grid-2-cols">
                      <div class="form-group">
                        <label title="每次对话固定携带的最近上下文轮数。数值越大，近期连贯性越好，但更耗费 Token。">短期记忆保留 (轮)</label>
                        <input type="number" v-model.number="modelForm.recentLimit" min="1" max="50" />
                      </div>
                      <div class="form-group">
                        <label title="当总对话长度超过此值时，系统将在后台触发“旧对话总结”任务，以节省长对话的 Token 消耗。">上下文压缩阈值 (字符)</label>
                        <input type="number" v-model.number="modelForm.compressThreshold" min="1000" step="500" />
                      </div>
                      <div class="form-group">
                        <label title="自动压缩旧对话时，生成的总结文本的最大长度限制，防止摘要本身无限滚雪球。">记忆摘要最大长度 (Tokens)</label>
                        <input type="number" v-model.number="modelForm.maxSummaryTokens" min="100" />
                      </div>
                      <div class="form-group">
                        <label title="从对话中提取并保存的“用户个人偏好/事实”信息的长度上限。">长期画像提取上限 (Tokens)</label>
                        <input type="number" v-model.number="modelForm.maxExtractionTokens" min="50" />
                      </div>
                    </div>
                  </div>

                  <!-- 分组 B：RAG 检索控制 -->
                  <div class="params-card-group">
                    <div class="group-header">
                      <Icon icon="lucide:database-zap" /> 历史记忆召回参数
                    </div>
                    <div class="grid-2-cols">
                      <div class="form-group">
                        <label title="执行生成标题、提炼总结等后台静默任务时，模型最多可参考的最近对话轮数。">后台压缩参考轮数</label>
                        <input type="number" v-model.number="modelForm.searchLimit" min="1" max="50" />
                      </div>
                      <div class="form-group">
                        <label title="每次提问时，从历史记忆库中初步粗筛出的最相关对话条数（第一轮召回）。">历史检索候选池大小</label>
                        <input type="number" v-model.number="modelForm.vectorSearchLimit" min="1" max="20" />
                      </div>
                      <div class="form-group">
                        <label title="经过智能排序与精简后，最终实际合并到当前提问上下文中的历史记录数量。">最终历史注入条数</label>
                        <input type="number" v-model.number="modelForm.finalContextLimit" min="1" max="10" />
                      </div>
                    </div>
                  </div>

                  <!-- 分组 C：截断保护 -->
                  <div class="params-card-group">
                    <div class="group-header">
                      <Icon icon="lucide:scissors" /> 内容截断与省流策略
                    </div>
                    <div class="grid-2-cols">
                      <div class="form-group">
                        <label title="作为背景知识召回的历史记录中，普通文本内容超过此长度将被截取核心部分。">普通文本单条截断 (字)</label>
                        <input type="number" v-model.number="modelForm.qaSnippetTextLimit" min="50" step="50" />
                      </div>
                      <div class="form-group">
                        <label title="作为背景知识召回的历史记录中，用户发送的代码块最大保留长度。">用户代码单条截断 (字)</label>
                        <input type="number" v-model.number="modelForm.qaSnippetUserCodeLimit" min="100" step="100" />
                      </div>
                      <div class="form-group" style="grid-column: span 2;">
                        <label title="作为背景知识召回的记录中，AI 生成的代码块最大保留长度（代码通常需要完整逻辑，建议高于文本）。">AI 代码单条截断 (字)</label>
                        <input type="number" v-model.number="modelForm.qaSnippetAICodeLimit" min="100" step="100" />
                      </div>
                    </div>
                  </div>

                </div>
                <div v-else class="text-hint">该模型类型无需额外本地控制参数</div>

                <!-- 2. 自定义 API 负载参数 (直接发送给大厂) -->
                <h5 class="section-title" style="margin-top: 24px;">
                  <Icon icon="lucide:blocks" style="margin-right:4px;" />
                  自定义 API 负载参数
                </h5>
                <p class="form-hint" style="margin-bottom: 16px;">在此配置请求体中的专属参数 (如 temperature, max_tokens, steps 等)。</p>
                
                <div class="custom-params-list">
                  <div v-for="(param, index) in modelForm.customParams" :key="index" class="param-row">
                    <!-- 参数名 -->
                    <input type="text" v-model.trim="param.key" class="param-key" placeholder="参数名 (如 top_p)" />
                    
                    <!-- 自定义下拉：参数类型 -->
                    <div class="custom-dropdown param-type-dropdown" @click.stop>
                      <button class="dropdown-trigger" @click="toggleDropdown(`paramType_${index}`)">
                        <span class="trigger-text">{{ formatParamType(param.type) }}</span>
                        <Icon icon="lucide:chevron-down" class="trigger-icon" :class="{ 'rotate-180': activeDropdown === `paramType_${index}` }" />
                      </button>
                      <transition name="dropdown-fade">
                        <ul v-if="activeDropdown === `paramType_${index}`" class="dropdown-menu">
                          <li class="dropdown-item" :class="{ 'is-active': param.type === 'number' }" @click="selectParamType(index, 'number')">
                            <span class="item-name">数字</span>
                            <Icon v-if="param.type === 'number'" icon="lucide:check" class="check-icon" />
                          </li>
                          <li class="dropdown-item" :class="{ 'is-active': param.type === 'string' }" @click="selectParamType(index, 'string')">
                            <span class="item-name">字符</span>
                            <Icon v-if="param.type === 'string'" icon="lucide:check" class="check-icon" />
                          </li>
                          <li class="dropdown-item" :class="{ 'is-active': param.type === 'boolean' }" @click="selectParamType(index, 'boolean')">
                            <span class="item-name">布尔</span>
                            <Icon v-if="param.type === 'boolean'" icon="lucide:check" class="check-icon" />
                          </li>
                        </ul>
                      </transition>
                    </div>
                    
                    <!-- 参数值输入框 -->
                    <input v-if="param.type === 'string'" v-model="param.value" type="text" class="param-value" placeholder="参数值" />
                    <input v-else-if="param.type === 'number'" v-model.number="param.value" type="number" step="any" class="param-value" placeholder="参数值" />
                    
                    <!-- 自定义下拉：布尔值选择 (true/false) -->
                    <!-- 参数值：布尔值专属 Switch 开关 -->
                    <div v-else-if="param.type === 'boolean'" class="param-value boolean-switch-wrapper">
                      <label class="switch-label-wrapper" style="margin: 0; height: 100%;">
                        <div class="switch-container">
                          <input type="checkbox" v-model="param.value" class="switch-input" />
                          <span class="switch-slider"></span>
                        </div>
                        <!-- 固定宽度防止文字抖动 -->
                        <span class="switch-text" style="width: 40px; color: #475569; font-family: monospace;">
                          {{ param.value ? 'true' : 'false' }}
                        </span>
                      </label>
                    </div>

                    <button class="icon-btn delete" @click="removeCustomParam(index)" title="删除参数">
                      <Icon icon="lucide:minus-circle" />
                    </button>
                  </div>
                  
                  <button type="button" class="action-btn text-blue" style="margin-top: 8px;" @click="addCustomParam">
                    <Icon icon="lucide:plus-circle" /> 添加参数
                  </button>
                </div>

              </div> <!-- End of Advanced Panel -->

              <div class="form-footer" style="margin-top: 0;">
                <button type="button" class="cancel-btn" @click="closeForm">取消</button>
                <button type="button" class="submit-btn" @click="handleSaveModel" :disabled="isSaving">
                  <Icon v-if="isSaving" icon="lucide:loader-2" class="spin-icon" />保存模型配置
                </button>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </main>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { Icon } from '@iconify/vue';
import { apiModelDB } from '../Indexdb/db/apiModelDB.js';
import { globalKeyManager } from "../utils/keyManager.js";
import { showConfirm } from "./ui/ui-js/confirm.js";

const router = useRouter();

const currentView = ref('list'); 
const providersList = ref([]);
const isNewRecord = ref(true);
const isSaving = ref(false);
const showKey = ref(false);

const expandedProviders = ref([]);

let originalEncryptedKey = '';
let targetProviderId = null;

const providerForm = reactive({ 
  id: '', name: '', officialUrl: '', apiKey: ''
});

// 1. 扩充 modelForm 响应式对象 (原路请回所有参数)
const modelForm = reactive({ 
  id: '', 
  name: '', 
  baseUrl: '', 
  modelType: 'text', 
  isDefault: false,
  
  // 本地系统控制重写
  enableThinking: false, 
  recentLimit: 10, 
  compressThreshold: 4000,
  maxSummaryTokens: 600,
  maxExtractionTokens: 150,

  searchLimit: 5,
  vectorSearchLimit: 8,
  finalContextLimit: 5,

  qaSnippetTextLimit: 150,
  qaSnippetUserCodeLimit: 600,
  qaSnippetAICodeLimit: 1500,

  // 自定义 API 负载参数
  customParams: []
});

// 2. 修改 openModelForm 方法中的数据回显 (全部请回)
const openModelForm = (providerId, model) => {
  targetProviderId = providerId;
  
  if (model) {
    isNewRecord.value = false;
    modelForm.id = model.id;
    modelForm.name = model.name;
    modelForm.baseUrl = model.baseUrl || ''; 
    modelForm.modelType = model.modelType || 'text';
    modelForm.isDefault = model.isDefault || false;
    
    // 回显本地控制参数
    modelForm.enableThinking = model.enableThinking ?? false;
    modelForm.recentLimit = model.recentLimit ?? 10;
    modelForm.compressThreshold = model.compressThreshold ?? 4000;
    modelForm.maxSummaryTokens = model.maxSummaryTokens ?? (model.compressMaxTokens || 600);
    modelForm.maxExtractionTokens = model.maxExtractionTokens ?? 150;
    
    modelForm.searchLimit = model.searchLimit ?? 5;
    modelForm.vectorSearchLimit = model.vectorSearchLimit ?? 8;
    modelForm.finalContextLimit = model.finalContextLimit ?? 5;
    
    modelForm.qaSnippetTextLimit = model.qaSnippetTextLimit ?? 150;
    modelForm.qaSnippetUserCodeLimit = model.qaSnippetUserCodeLimit ?? 600;
    modelForm.qaSnippetAICodeLimit = model.qaSnippetAICodeLimit ?? 1500;

    let parsedParams = model.customParams ? JSON.parse(JSON.stringify(model.customParams)) : [];
    if (!model.customParams && model.temperature !== undefined) {
      parsedParams.push({ key: 'temperature', value: model.temperature, type: 'number' });
      parsedParams.push({ key: 'max_tokens', value: model.maxTokens || 4096, type: 'number' });
    }
    modelForm.customParams = parsedParams;

  } else {
    isNewRecord.value = true;
    modelForm.id = `mod_${Date.now()}`;
    modelForm.name = '';
    modelForm.baseUrl = '';
    modelForm.modelType = 'text';
    modelForm.isDefault = false;
    
    // 新增时赋予默认值
    modelForm.enableThinking = false;
    modelForm.recentLimit = 10;
    modelForm.compressThreshold = 4000;
    modelForm.maxSummaryTokens = 600;
    modelForm.maxExtractionTokens = 150;
    
    modelForm.searchLimit = 5;
    modelForm.vectorSearchLimit = 8;
    modelForm.finalContextLimit = 5;
    
    modelForm.qaSnippetTextLimit = 150;
    modelForm.qaSnippetUserCodeLimit = 600;
    modelForm.qaSnippetAICodeLimit = 1500;
    
    modelForm.customParams = [
      { key: 'temperature', value: 0.7, type: 'number' },
      { key: 'max_tokens', value: 4096, type: 'number' }
    ];
  }
  currentView.value = 'model-form';
};

// ======= 自定义下拉菜单逻辑与文本模型过滤 =======
const activeDropdown = ref(null);

const toggleDropdown = (id) => {
  activeDropdown.value = activeDropdown.value === id ? null : id;
};

const closeDropdown = () => {
  activeDropdown.value = null;
};

// 全局点击监听，点空白处自动收起下拉框
onMounted(() => {
  window.addEventListener('click', closeDropdown);
  loadProviders(); 
});

onUnmounted(() => {
  window.removeEventListener('click', closeDropdown);
});

// 核心过滤：只提取 text 类型的模型
const getTextModels = (models) => {
  if (!models) return [];
  return models.filter(m => !m.modelType || m.modelType === 'text');
};

// 回显选中的模型名称
const getModelName = (models, modelId, defaultText) => {
  if (!modelId) return defaultText;
  const model = models?.find(m => m.id === modelId);
  return model ? model.name : defaultText;
};

// 选中模型触发保存
const selectModel = (provider, type, modelId) => {
  if (type === 'chat') {
    provider.defaultChatModelId = modelId;
  } else {
    provider.defaultCompressModelId = modelId;
  }
  handleQuickSaveProvider(provider);
  closeDropdown();
};
// ======= 新增：取代 select 的辅助方法 =======

// 模型类型选择
const selectModelType = (type) => {
  modelForm.modelType = type;
  closeDropdown();
};

// 格式化参数类型显示
const formatParamType = (type) => {
  const map = { 'number': '数字', 'string': '字符', 'boolean': '布尔' };
  return map[type] || '数字';
};

// 参数类型选择
const selectParamType = (index, type) => {
  modelForm.customParams[index].type = type;
  // 切换类型时，重置 value 的类型以防止数据错误
  if (type === 'boolean') {
    modelForm.customParams[index].value = true;
  } else if (type === 'number') {
    modelForm.customParams[index].value = 0;
  } else {
    modelForm.customParams[index].value = '';
  }
  closeDropdown();
};

// 布尔值参数选择
const selectParamBool = (index, val) => {
  modelForm.customParams[index].value = val;
  closeDropdown();
};


const loadProviders = async () => {
  providersList.value = await apiModelDB.getAllProviders();
  if (providersList.value.length > 0) {
    providersList.value.forEach(provider => {
      if (provider.models?.some(m => m.isDefault) && !expandedProviders.value.includes(provider.id)) {
        expandedProviders.value.push(provider.id);
      }
    });
  }
};

const toggleProvider = (id) => {
  const index = expandedProviders.value.indexOf(id);
  if (index > -1) {
    expandedProviders.value.splice(index, 1);
  } else {
    expandedProviders.value.push(id);
  }
};

const goBack = () => {
  if (currentView.value !== 'list') {
    closeForm();
  } else {
    router.push('/aiUserChat');
  }
};

const closeForm = () => {
  currentView.value = 'list';
  targetProviderId = null;
  originalEncryptedKey = '';
};

const formatModelType = (type) => {
  const map = { 'text': '对话文本', 'image': '图像生成', 'video': '视频生成', 'embedding': '向量化' };
  return map[type] || '对话文本';
};

const getPanelIcon = (type) => {
  const map = { 'text': 'lucide:message-square', 'image': 'lucide:image', 'video': 'lucide:video', 'embedding': 'lucide:network' };
  return map[type] || 'lucide:cpu';
};

const handleQuickSaveProvider = async (provider) => {
  try {
    const providerToSave = JSON.parse(JSON.stringify(provider));
    await apiModelDB.saveProviderConfig(providerToSave);
  } catch (error) {
    console.error("快速保存厂商默认模型失败:", error);
  }
};

const openProviderForm = (provider) => {
  showKey.value = false;
  if (provider) {
    isNewRecord.value = false;
    providerForm.id = provider.id;
    providerForm.name = provider.name;
    providerForm.officialUrl = provider.officialUrl || '';
    originalEncryptedKey = provider.apiKey; 
    providerForm.apiKey = '********';
  } else {
    isNewRecord.value = true;
    providerForm.id = `prov_${Date.now()}`;
    providerForm.name = '';
    providerForm.officialUrl = '';
    providerForm.apiKey = '';
    originalEncryptedKey = '';
  }
  currentView.value = 'provider-form';
};

const handleSaveProvider = async () => {
  if (!providerForm.name) return  showAlert("warning", `请输入厂商名称`);
  if (!providerForm.apiKey) return  showAlert("warning", `请输入 API Key`);

  try {
    isSaving.value = true;
    let finalApiKey = originalEncryptedKey;

    if (providerForm.apiKey !== '********' && providerForm.apiKey.length > 0) {
      const myPublicKey = await globalKeyManager.getEncryptPublicKey();
      const encoder = new TextEncoder();
      const encodedData = encoder.encode(providerForm.apiKey);
      const publicKey = await window.crypto.subtle.importKey(
        "spki", myPublicKey, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]
      );
      const encryptedBuffer = await window.crypto.subtle.encrypt(
        { name: "RSA-OAEP" }, publicKey, encodedData
      );
      finalApiKey = btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer)));
    }

    const existingProvider = providersList.value.find(p => p.id === providerForm.id);
    const models = existingProvider ? existingProvider.models : [];
    const defaultChat = existingProvider ? existingProvider.defaultChatModelId : '';
    const defaultCompress = existingProvider ? existingProvider.defaultCompressModelId : '';

    const providerToSave = { 
      id: providerForm.id,
      name: providerForm.name,
      officialUrl: providerForm.officialUrl,
      apiKey: finalApiKey,
      defaultChatModelId: defaultChat,
      defaultCompressModelId: defaultCompress,
      models: JSON.parse(JSON.stringify(models))
    };
    
    await apiModelDB.saveProviderConfig(providerToSave);
    
    if (isNewRecord.value && !expandedProviders.value.includes(providerToSave.id)) {
      expandedProviders.value.push(providerToSave.id);
    }

    await loadProviders();
    closeForm();
  } catch (error) {
    console.error("保存厂商失败:", error);
    showAlert("warning", `保存失败，请检查加密环境。`); 
  } finally {
    isSaving.value = false;
  }
};

const handleDeleteProvider = async (id, name) => {
  const isConfirm = await showConfirm({
        title: "删除厂商",
        message: `确定要删除厂商 [${name}] 及其下属的所有模型吗？`,
        type: "info",
      });
   if(!isConfirm)return; 
  try {
    await apiModelDB.deleteProvider(id);
    expandedProviders.value = expandedProviders.value.filter(eId => eId !== id);
    await loadProviders();
  } catch (error) {
    showAlert("warning", `请输入厂商删除厂商失败名称`);
  }
};

// ====== 自定义参数控制 ======
const addCustomParam = () => {
  modelForm.customParams.push({ key: '', value: '', type: 'number' });
};
const removeCustomParam = (index) => {
  modelForm.customParams.splice(index, 1);
};

const handleSaveModel = async () => {
  if (!modelForm.name || !modelForm.baseUrl) return showAlert("warning", `请完整填写模型名称和完整接口地址`); 

  try {
    isSaving.value = true;
    
    const providerIndex = providersList.value.findIndex(p => p.id === targetProviderId);
    if (providerIndex === -1) throw new Error("找不到目标厂商");
    
    const provider = JSON.parse(JSON.stringify(providersList.value[providerIndex]));
    const newModel = JSON.parse(JSON.stringify(modelForm));
    
    // 清理空键值的参数
    newModel.customParams = newModel.customParams.filter(p => p.key.trim() !== '');

    if (!provider.models) provider.models = [];

    if (isNewRecord.value) {
      provider.models.push(newModel);
      if (provider.models.length === 1 && newModel.modelType === 'text') {
        provider.defaultChatModelId = newModel.id;
      }
    } else {
      const modelIndex = provider.models.findIndex(m => m.id === newModel.id);
      if (modelIndex > -1) {
        provider.models[modelIndex] = newModel;
      } else {
        provider.models.push(newModel);
      }
    }

    await apiModelDB.saveProviderConfig(provider);
    
    if (newModel.isDefault && newModel.modelType === 'text') {
      await apiModelDB.setDefaultModel(provider.id, newModel.id);
    }

    await loadProviders();
    closeForm();
  } catch (error) {
    console.error("保存模型失败:", error);
    showAlert("warning", `保存模型失败`); 
  } finally {
    isSaving.value = false;
  }
};

const handleDeleteModel = async (providerId, modelId) => {
  const isConfirm = await showConfirm({
        title: "删除模型",
        message: `确定要删除该模型吗？`,
        type: "info",
      });
   if(!isConfirm)return;  
  try {
    const providerIndex = providersList.value.findIndex(p => p.id === providerId);
    if (providerIndex === -1) return;
    
    const providerCopy = JSON.parse(JSON.stringify(providersList.value[providerIndex]));
    providerCopy.models = providerCopy.models.filter(m => m.id !== modelId);
    
    if (providerCopy.defaultChatModelId === modelId) providerCopy.defaultChatModelId = '';
    if (providerCopy.defaultCompressModelId === modelId) providerCopy.defaultCompressModelId = '';

    await apiModelDB.saveProviderConfig(providerCopy);
    await loadProviders();
  } catch (error) {
    showAlert("warning", `删除模型失败`); 
  }
};

const handleSetDefaultModel = async (providerId, modelId) => {
  try {
    await apiModelDB.setDefaultModel(providerId, modelId);
    await loadProviders();
  } catch (error) {
    showAlert("warning", `设置全局默认模型失败`);
  }
};
</script>

<style scoped>
/* ==========================================
   1. 基础布局与排版 (Layout & Typography)
========================================== */
.settings-page { 
  display: flex; flex-direction: column; height: 100vh; width: 100%; 
  background-color: #f7f9fa; color: #333; 
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
  overflow: hidden; 
}
.settings-content { flex: 1; overflow-y: auto; padding: 24px; }

/* ==========================================
   2. 头部导航 (Header)
========================================== */
.settings-header { 
  display: flex; justify-content: space-between; align-items: center; 
  padding: 16px 24px; background-color: #ffffff; border-bottom: 1px solid #e5e8eb; 
  flex-shrink: 0; 
}
.header-left { display: flex; align-items: center; gap: 12px; }
.header-left h2 { font-size: 18px; font-weight: 600; margin: 0; color: #111827; }

/* ==========================================
   3. 通用按钮 (Buttons)
========================================== */
.back-btn { background: transparent; border: none; font-size: 20px; color: #6b7280; cursor: pointer; padding: 8px; border-radius: 8px; transition: background 0.2s; display: flex; }
.back-btn:hover { background-color: #f3f4f6; color: #111827; }

.primary-btn { display: flex; align-items: center; gap: 6px; background-color: #111827; color: #fff; border: none; padding: 8px 16px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
.primary-btn:hover { background-color: #374151; }
.primary-btn:disabled { opacity: 0.7; cursor: not-allowed; }

.ghost-btn { margin-top: 16px; background: transparent; border: 1px solid #d1d5db; padding: 8px 16px; border-radius: 8px; cursor: pointer; transition: all 0.2s; }
.ghost-btn:hover { background: #f3f4f6; color: #111827; }

.icon-btn { background: transparent; border: none; padding: 6px; border-radius: 6px; cursor: pointer; color: #6b7280; display: flex; align-items: center; justify-content: center; transition: background-color 0.2s;}
.icon-btn.edit:hover { background-color: #e5e7eb; color: #111827; }
.icon-btn.delete:hover { background-color: #fef2f2; color: #ef4444; }

.action-btn { background: transparent; border: none; display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 500; cursor: pointer; transition: color 0.2s; }
.text-blue { color: #3b82f6; }
.text-blue:hover:not(:disabled) { color: #2563eb; }
.text-gray { color: #9ca3af; cursor: not-allowed; }

/* ==========================================
   4. 列表与卡片视图 (List & Cards)
========================================== */
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 60vh; color: #6b7280; }
.empty-icon { font-size: 48px; margin-bottom: 16px; color: #d1d5db; }

.provider-grid { display: flex; flex-direction: column; gap: 16px; max-width: 900px; margin: 0 auto; }
.provider-card { background: #ffffff; border: 1px solid #e5e8eb; border-radius: 12px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02); display: flex; flex-direction: column; overflow: hidden; transition: border-color 0.3s, box-shadow 0.3s; }
.provider-card.is-expanded { border-color: #cbd5e1; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); }

.provider-header { padding: 16px 20px; background-color: #ffffff; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: background-color 0.2s; }
.provider-header:hover { background-color: #f9fafb; }
.is-expanded .provider-header { background-color: #f8fafc; border-bottom: 1px solid #e5e8eb; }

.provider-title-wrapper { display: flex; align-items: center; gap: 12px; }
.chevron-icon { font-size: 18px; color: #9ca3af; transition: transform 0.3s ease; }
.chevron-icon.rotate-90 { transform: rotate(90deg); color: #4b5563; }
.provider-title { display: flex; align-items: center; gap: 12px; }
.title-icon-box { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; background-color: #f3f4f6; border-radius: 8px; color: #4b5563; }
.provider-icon { font-size: 20px; }
.title-text-group h3 { margin: 0 0 2px 0; font-size: 16px; font-weight: 600; color: #111827; line-height: 1.2; }

.key-mask-wrapper { display: flex; align-items: center; gap: 12px; }
.meta-link { font-size: 11px; color: #3b82f6; text-decoration: none; display: flex; align-items: center; gap: 2px; }
.meta-link:hover { text-decoration: underline; }
.key-mask { font-size: 12px; color: #6b7280; font-family: monospace; }
.model-count-badge { font-size: 11px; background-color: #e5e7eb; color: #4b5563; padding: 2px 6px; border-radius: 12px; font-weight: 500; }
.provider-actions { display: flex; gap: 4px; }

/* ==========================================
   5. 模型列表展开区域 (Models Collapse)
========================================== */
.models-collapse-wrapper { display: grid; grid-template-rows: 0fr; opacity: 0; transition: grid-template-rows 0.3s ease, opacity 0.3s ease; }
.models-collapse-wrapper.open { grid-template-rows: 1fr; opacity: 1; }
.models-container { min-height: 0; overflow: hidden; padding: 0 20px; }

.provider-defaults-bar { display: flex; gap: 24px; padding: 16px 16px; margin: 16px 0 0 0; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; }
.default-select-item { display: flex; align-items: center; gap: 12px; }
.select-label { font-size: 13px; font-weight: 600; color: #475569; }

.models-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 0 12px 0; }
.models-header h4 { margin: 0; font-size: 13px; font-weight: 600; color: #4b5563; }
.model-list { display: flex; flex-direction: column; gap: 8px; padding-bottom: 20px; }
.model-item { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; background-color: #ffffff; border: 1px solid #e5e8eb; border-radius: 8px; transition: all 0.2s; }
.model-item:hover { border-color: #cbd5e1; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
.model-item.is-default { border-color: #bfdbfe; background-color: #eff6ff; }

.model-info { display: flex; flex-direction: column; gap: 6px; overflow: hidden; }
.model-name-row { display: flex; align-items: center; gap: 8px; }
.model-name { font-size: 14px; font-weight: 600; color: #1f2937; }
.type-badge { font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 600; text-transform: uppercase; }
.type-badge.text { background-color: #f3f4f6; color: #4b5563; border: 1px solid #e5e7eb; }
.type-badge.image { background-color: #fdf4ff; color: #2563eb; border: 1px solid #bfdbfe; }
.type-badge.video { background-color: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
.type-badge.embedding { background-color: #f0fdf4; color: #059669; border: 1px solid #bbf7d0; }
.default-badge { display: flex; align-items: center; background-color: #3b82f6; color: #ffffff; font-size: 11px; padding: 2px 6px; border-radius: 12px; }
.model-meta { display: flex; align-items: center; gap: 12px; margin-top: 2px; }
.meta-item { font-size: 12px; color: #6b7280; font-family: monospace; display: flex; align-items: center; gap: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.model-actions { display: flex; gap: 4px; align-items: center; }
.empty-models { padding: 24px 0; margin-bottom: 20px; text-align: center; font-size: 13px; color: #9ca3af; background: #f9fafb; border-radius: 8px; border: 1px dashed #e5e8eb; }

/* ==========================================
   6. 表单视图通用 (Form Views)
========================================== */
.form-view { display: flex; justify-content: center; padding-bottom: 40px; margin-top: 20px;}
.form-card { background: #ffffff; border: 1px solid #e5e8eb; border-radius: 16px; padding: 32px; width: 100%; max-width: 550px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
.model-form-card { max-width: 680px; } /* 稍微加宽一点给内嵌卡片留空间 */
.form-title { margin: 0 0 8px 0; font-size: 20px; color: #111827; }
.form-desc { font-size: 13px; color: #6b7280; margin-bottom: 24px; line-height: 1.5; }

.api-form { display: flex; flex-direction: column; gap: 24px; }
.form-group { display: flex; flex-direction: column; gap: 8px; }
.form-group label { font-size: 14px; font-weight: 500; color: #374151; }
.required { color: #ef4444; margin-left: 4px; }
.form-hint { font-size: 12px; color: #9ca3af; margin-top: 2px; line-height: 1.4; }
.text-hint { font-size: 13px; color: #6b7280; margin-bottom: 12px; font-style: italic; }

.grid-2-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }

input[type="text"], input[type="url"], input[type="password"], input[type="number"], select.custom-select {
  padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px; 
  font-size: 14px; font-family: inherit; transition: all 0.2s; 
  background-color: #ffffff; color: #111827; width: 100%; box-sizing: border-box;
}
input:focus, select:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }

.input-with-icon { position: relative; display: flex; align-items: center; }
.input-with-icon input { width: 100%; padding-right: 40px; }
.toggle-eye { position: absolute; right: 8px; background: transparent; border: none; color: #9ca3af; cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center; }

/* 按钮区 */
.form-footer { display: flex; justify-content: flex-end; gap: 12px; margin-top: 16px; padding-top: 20px; border-top: 1px solid #f3f4f6; }
.cancel-btn { background: #ffffff; border: 1px solid #d1d5db; color: #374151; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
.cancel-btn:hover { background: #f9fafb; }
.submit-btn { background: #111827; border: none; color: #ffffff; display: flex; align-items: center; gap: 8px; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
.submit-btn:hover:not(:disabled) { background: #374151; }
.spin-icon { animation: spin 1s linear infinite; }

/* ==========================================
   7. 高级配置面板 (Advanced Panel)
========================================== */
.advanced-panel { 
  display: flex; flex-direction: column; gap: 16px; 
  padding: 24px; background-color: #f8fafc; 
  border: 1px solid #e2e8f0; border-radius: 12px; 
}

.section-title { 
  margin: 0 0 8px 0; font-size: 13px; font-weight: 600; color: #475569; 
  text-transform: uppercase; letter-spacing: 0.5px; 
  border-bottom: 1px solid #cbd5e1; padding-bottom: 10px; 
  display: flex; align-items: center; 
}

/* 内部小卡片 (缓解拥挤感) */
.params-card-group {
  background-color: #ffffff;
  border: 1px solid #e5e8eb;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 8px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.01);
}
.group-header {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.group-header .iconify { color: #64748b; }

/* ==========================================
   8. 自定义参数列表 (Custom Params)
========================================== */
.custom-params-list { display: flex; flex-direction: column; gap: 12px; }
.param-row { display: flex; align-items: center; gap: 8px; animation: fadeIn 0.2s ease; }
.param-key { flex: 2; min-width: 0; }
.param-type { flex: 1; min-width: 0; padding: 8px 12px !important; }
.param-value { flex: 2; min-width: 0; }
/* 在你的 .param-row 相关样式下面加上这个 */
.param-type-dropdown { flex: 1; min-width: 80px; }
.param-value-dropdown { flex: 2; min-width: 100px; }
/* ==========================================
   9. 美化下拉菜单 (Custom Dropdown & Select)
========================================== */
select.custom-select {
  appearance: none; -webkit-appearance: none; -moz-appearance: none;
  padding: 10px 36px 10px 12px;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
  background-repeat: no-repeat; background-position: right 12px center; background-size: 16px;
  cursor: pointer;
}
select.custom-select:hover { border-color: #9ca3af; background-color: #f9fafb; }
select.custom-select:disabled { background-color: #f3f4f6; color: #9ca3af; cursor: not-allowed; opacity: 0.7; }

/* 自定义渲染下拉组件 */
.custom-dropdown { position: relative; min-width: 180px; }
.dropdown-trigger {
  width: 100%; display: flex; justify-content: space-between; align-items: center;
  background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px;
  padding: 6px 10px 6px 12px; font-size: 13px; color: #1f2937;
  cursor: pointer; transition: all 0.2s; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
}
.dropdown-trigger:hover { border-color: #94a3b8; }
.trigger-text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px; }
.trigger-icon { font-size: 14px; color: #64748b; transition: transform 0.3s ease; }
.trigger-icon.rotate-180 { transform: rotate(180deg); }

.dropdown-menu {
  position: absolute; top: calc(100% + 4px); left: 0; width: 100%; min-width: max-content;
  background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  padding: 4px; margin: 0; list-style: none; z-index: 50; max-height: 220px; overflow-y: auto;
}
.dropdown-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 8px 12px; font-size: 13px; color: #334155; border-radius: 4px;
  cursor: pointer; transition: background-color 0.15s;
}
.dropdown-item:hover { background-color: #f1f5f9; }
.dropdown-item.is-active { background-color: #eff6ff; color: #2563eb; font-weight: 500; }
.item-name { white-space: nowrap; }
.check-icon { font-size: 14px; color: #3b82f6; margin-left: 12px; }

.dropdown-fade-enter-active, .dropdown-fade-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.dropdown-fade-enter-from, .dropdown-fade-leave-to { opacity: 0; transform: translateY(-5px); }

/* ==========================================
   10. 拨动开关 (Toggle Switch)
========================================== */
.switch-label-wrapper { display: flex; align-items: center; gap: 12px; cursor: pointer; user-select: none; }
.switch-container { position: relative; width: 40px; height: 22px; flex-shrink: 0; }
.switch-input { opacity: 0; width: 0; height: 0; position: absolute; }
.switch-slider {
  position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  background-color: #cbd5e1; border-radius: 22px; transition: background-color 0.3s ease;
}
.switch-slider:before {
  content: ""; position: absolute; height: 18px; width: 18px; left: 2px; bottom: 2px;
  background-color: white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15); transition: transform 0.3s ease;
}
.switch-input:checked + .switch-slider { background-color: #3b82f6; }
.switch-input:checked + .switch-slider:before { transform: translateX(18px); }
.switch-input:focus-visible + .switch-slider { box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2); }
/* 布尔值开关占位容器，确保与前方的 input 高度完美对齐 */
.boolean-switch-wrapper {
  display: flex;
  align-items: center;
  padding-left: 8px; /* 稍微靠右一点点，避免和中间的下拉框太挤 */
}
.switch-text { font-size: 14px; font-weight: 600; color: #111827; }
.text-gray-400 { color: #9ca3af; }
.font-normal { font-weight: 400; }
.ml-1 { margin-left: 4px; }

/* 动画效果 */
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(10px); }
</style>