// src/service/aiUserService.js
import { chatDB } from "../Indexdb/db/chatDB.js";
// 在原有的 import 下面加上这行
import { systemSetDB } from "../Indexdb/db/systemSetDB.js";
import {
  buildGlobalSearchIndex,
  loadChatHistoryIntoSearch,
  runBackgroundMemoryCompress,
  runBackgroundMemoryHistory,
  getRelevantContextHybrid,
  buildShortTermContext,
} from "../embedding/searchContext.js";
import { chatUserAIApi } from "../api/ai.js";
import {
  shouldTriggerRAG,
  sanitizePrivacyInfo,
} from "../embedding/routerRules.js";

let currentModelId = null;
const compressingChats = new Set();

// 辅助函数：将图片转换为 Base64 (Data URL)
const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
};

// 辅助函数：提取纯文本文件的内容 (txt, md, csv 等)
const readTextFile = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsText(file, "UTF-8");
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
};

export const AIUserService = {
  async activateChatSearch(chatId, modelId, targetRole) {
    if (currentModelId !== modelId) {
      await buildGlobalSearchIndex(modelId, targetRole);
      currentModelId = modelId;
    }
    await loadChatHistoryIntoSearch(chatId);
  },

  /**
   * 核心发送消息逻辑
   */
  async sendAIMessage({
    systemRole = "system",
    text: rawText,
    files = [], // 🌟 新增：接收从前端传来的 file 数组
    chatId,
    model, // 包含高级参数、baseUrl, path, modelType 等 
    signal,
    isTemporary = false,
    tempMessages = [],
    onChatCreated,
    onContextAssembled,
    onStreamContent,
    onStreamReasoning,
    onStreamFinish,
    onError,
  }) {
    let fullContent = "";
    let fullReasoning = "";
    let inputTokens = 0;
    let outputTokens = 0; 
    let apiMessages = [];
   // ==========================================
    // 🌟 阶段 0：处理附件 (图片转 Base64，文档提纯文本)
    // ==========================================
    let finalRawText = rawText || "";
    const visionImages = []; // 用于存放图片的 Base64 数据

    if (files && files.length > 0) {
      for (const file of files) {
        if (file.type.startsWith("image/")) {
          // 1. 如果是图片：加入多模态处理队列
          const b64 = await fileToBase64(file);
          visionImages.push(b64);
        } else {
          // 2. 如果是文档：提取文本并追加到 prompt
          // 注意：此处仅支持前端能直接 readAsText 的纯文本/CSV/MD 文件。
          // 如果是 PDF/Word，你需要在这里调用你的 RAG/PDF.js 解析逻辑
          try {
            const fileContent = await readTextFile(file);
            finalRawText += `\n\n--- 附件 [${file.name}] 内容 ---\n${fileContent}\n--- 附件结束 ---`;
          } catch (e) {
            console.warn(`无法读取文件 ${file.name}:`, e);
          }
        }
      }
    }

    // 此时的 text 包含了用户输入的文字 + 提出来的文档内容
    const text = sanitizePrivacyInfo(finalRawText); 

    let currentChatId = chatId;
    let userMsgId = null;
    const isNewChat = !chatId;

    const estimateTokens = (textStr) =>
      textStr ? Math.ceil(textStr.length * 1) : 0; 
    try {
      // ==========================================
      // 🌟 1. 获取全局系统配置 (提供基础兜底)
      // ==========================================
      const globalSettings =
        (await systemSetDB.getSystemSettings("default").catch(() => ({}))) ||
        {};

      // 🌟 2. 终极融合：全局配置垫底，用户传入的模型专属配置覆盖！
      const mergedModelConfig = {
        ...globalSettings,
        ...model,
      }; 
      // 🌟 3. 核心判断使用合并后的配置
      const isStream =
        mergedModelConfig.modelType === "text" || !mergedModelConfig.modelType; 
      // --- 阶段 1：初始化会话 ---
      if (!currentChatId) {
        const titleLen = mergedModelConfig?.chatTitleMaxLength || 15;
        // 🌟 给纯图片输入一个默认标题
        const safeTitle = text.trim() ? text.slice(0, titleLen) : "[多模态图片对话]";

        currentChatId = isTemporary
          ? `temp_${Date.now()}`
          : await chatDB.addChatList({
              title: safeTitle,
              modelId: mergedModelConfig.modelId,
            });
        if (onChatCreated) onChatCreated(currentChatId);
      } 
      // ==========================================
      // 🌟 修复：构造要存入数据库的附件数组 (使用 Base64)
      // ==========================================
      const dbAttachments = visionImages.map((b64, index) => ({
        isImage: true,
        url: b64, // 存入 Base64 字符串，永久有效
        file: { name: `image_${index}.png` } // 兜底属性，防止前端模板报错
      })); 

      if (!isTemporary) {
        userMsgId = await chatDB.addChatMessages({
          chatId: currentChatId,
          role: "user",
          content: text || "[发送了图片]", 
          timestamp: Date.now(),
          attachments: dbAttachments // 🌟 核心修复：把附件存进本地数据库！
        });
      }

      // --- 阶段 2：组装上下文 ---
      apiMessages = await this._assembleContext({
        text: text || "请分析我发送的图片",
        currentChatId,
        userMsgId,
        isTemporary,
        tempMessages,
        modelConfig: mergedModelConfig, // 👈 必须把融合后的超级配置传下去！
      });
      console.log(apiMessages);
      if (visionImages.length > 0) {
        // 找到倒数第一条 role 为 user 的消息
        let lastUserMsgIndex = -1;
        for (let i = apiMessages.length - 1; i >= 0; i--) {
          if (apiMessages[i].role === "user") {
            lastUserMsgIndex = i;
            break;
          }
        }

        if (lastUserMsgIndex !== -1) {
          const originalText = apiMessages[lastUserMsgIndex].content;
          const multiModalContent = [];
          
          // 推入文字部分
          if (originalText) {
            multiModalContent.push({ type: "text", text: originalText });
          }
          
          // 推入所有图片 Base64
          visionImages.forEach(b64Data => {
            multiModalContent.push({ 
              type: "image_url", 
              image_url: { url: b64Data } 
            });
          });

          // 将原本字符串的 content 替换为 OpenAI 标准的数组对象
          apiMessages[lastUserMsgIndex].content = multiModalContent;
        }
      }

      if (onContextAssembled && isStream) {
        // 如果是多模态数组，这里强转字符串打印或回调可能会显示 [object Object]，忽略即可
        onContextAssembled(typeof apiMessages[apiMessages.length - 1].content === 'string' 
          ? apiMessages.map((m) => m.content).join("\n") 
          : "[多模态内容]");
      }

      // --- 阶段 3：根据多模态类型动态组装 Payload ---
      const payload = {
        model: model.name,
      };
      if (isStream) {
        payload.stream = true;
        payload.messages = apiMessages;

        if (
          mergedModelConfig.customParams &&
          mergedModelConfig.customParams.length > 0
        ) {
          mergedModelConfig.customParams.forEach((param) => {
            if (param.key) payload[param.key] = param.value;
          });
        }
        if (mergedModelConfig.enableThinking) {
          payload.reasoning_effort =
            mergedModelConfig.reasoningEffort || "medium";
        }
      } else if (mergedModelConfig.modelType === "image") {
        payload.prompt = text;

        if (
          mergedModelConfig.customParams &&
          mergedModelConfig.customParams.length > 0
        ) {
          mergedModelConfig.customParams.forEach((param) => {
            if (param.key) payload[param.key] = param.value;
          });
        }
      }

      // --- 阶段 4：API 直连 ---
      const response = await chatUserAIApi(
        model.baseUrl,
        payload,
        signal,
        model.apiKey
      );

      if (!response.ok) {
        const errorText = await response.text();
        let errorJson;
        try {
          errorJson = JSON.parse(errorText);
        } catch (e) {}
        throw new Error(
          errorJson?.error?.message || `API 错误 (${response.status})`
        );
      }
      // --- 阶段 5：解析响应 (分流处理) ---
      if (isStream) {
        // 文本流式处理
        const streamResult = await this._processStream(response.body, {
          onStreamReasoning,
          onStreamContent,
        });

        fullContent = streamResult.fullContent;
        fullReasoning = streamResult.fullReasoning;
        inputTokens =
          streamResult.inputTokens ||
          estimateTokens(JSON.stringify(apiMessages));
        outputTokens =
          streamResult.outputTokens ||
          estimateTokens(fullContent + fullReasoning);
      } else if (model.modelType === "image") {
        // 🌟 图像非流式处理：直接解析 JSON
        const jsonResult = await response.json();

        // 适配标准 OpenAI 格式，提取 url 或 base64
        const imageUrl =
          jsonResult.data?.[0]?.url || jsonResult.data?.[0]?.b64_json;
        if (!imageUrl) throw new Error("API 未返回有效的图片内容");

        // 转换为 Markdown 格式，这样你的聊天框直接就能渲染出图片，不需要改 UI 组件
        fullContent = `![Generated Image](${imageUrl})`;

        // 主动触发一次 onStreamContent，把完整图片交出去
        if (onStreamContent) onStreamContent(fullContent);

        inputTokens = estimateTokens(text);
        outputTokens = 1; // 图像的 Token 计算通常很特殊，这里记为 1
      }

      const finalTokenStr = `[ 输入: ${inputTokens} | 输出: ${outputTokens} | 总计: ${
        inputTokens + outputTokens
      } ]`;

      // --- 阶段 6：收尾与后台压缩 ---
      if (!isTemporary) {
        await chatDB.addChatMessages({
          chatId: currentChatId,
          role: "assistant",
          content: fullContent.trim(),
          reasoning: fullReasoning,
          token: finalTokenStr,
          timestamp: Date.now(),
        });

        // 只有文本模型需要去做记忆和摘要压缩，图像直接跳过
        if (isStream) {
          this._triggerBackgroundCompression(
            currentChatId,
            mergedModelConfig
          ).catch((e) => console.error(e));
        }
      }

      onStreamFinish?.(finalTokenStr, { inputTokens, outputTokens });
    } catch (error) {
      this._handleError(error, {
        isTemporary,
        userMsgId,
        isNewChat,
        currentChatId,
        onError,
        onStreamFinish,
        apiMessages,
        fullContent,
        fullReasoning,
        inputTokens,
        outputTokens,
        estimateTokens,
      });
    }
  },

  // ============================================================================
  // 👇 内部解析逻辑优化
  // ============================================================================

  async _processStream(body, { onStreamReasoning, onStreamContent }) {
    const reader = body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let isProperlyFinished = false;
    let inputTokens = 0;
    let outputTokens = 0;
    let fullContent = "";
    let fullReasoning = "";
    const ZERO_WIDTH_REGEX = /[\u200B-\u200D\uFEFF\u200E\u200F]/g;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          isProperlyFinished = true; // 正常读取结束（应对部分不发 [DONE] 的厂商）
          break;
        }

        buffer += decoder
          .decode(value, { stream: true })
          .replace(ZERO_WIDTH_REGEX, "");

        let eventEnd;
        while ((eventEnd = buffer.indexOf("\n\n")) !== -1) {
          const rawEvent = buffer.slice(0, eventEnd);
          buffer = buffer.slice(eventEnd + 2);

          for (let line of rawEvent.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const dataStr = line.slice(6).trim();

            if (dataStr === "[DONE]") {
              isProperlyFinished = true;
              continue;
            }

            try {
              const dataObj = JSON.parse(dataStr);
              if (dataObj.usage) {
                inputTokens = dataObj.usage.prompt_tokens || inputTokens;
                outputTokens = dataObj.usage.completion_tokens || outputTokens;
              }

              const delta = dataObj.choices?.[0]?.delta;
              if (delta) {
                if (delta.reasoning_content) {
                  fullReasoning += delta.reasoning_content;
                  onStreamReasoning?.(delta.reasoning_content);
                }
                if (delta.content) {
                  fullContent += delta.content;
                  onStreamContent?.(delta.content);
                }
              }
            } catch (e) {
              // 忽略解析错误，继续处理下一个 chunk
            }
          }
        }
      }

      // 如果完全没有任何内容且未正常结束，才抛出截断异常
      if (!isProperlyFinished && !fullContent && !fullReasoning) {
        throw new Error("Stream closed unexpectedly");
      }
      return { inputTokens, outputTokens, fullContent, fullReasoning };
    } catch (error) {
      throw error; // 向上抛出让 _handleError 捕获
    } finally {
      // 核心修改：确保底层流物理中断，避免幽灵流量
      reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  },

  // 错误处理提取
  async _handleError(error, ctx) {
    const isAbort =
      error.name === "AbortError" ||
      error.message === "abort" ||
      error.message.includes("Unexpected");

    if (isAbort) {
      // 核心修改：中断时不要删除 userMsgId，保留用户的提问！
      // 如果已经有部分回答，将其作为完整的消息保存下来
      if (!ctx.isTemporary && (ctx.fullContent || ctx.fullReasoning)) {
        const partialTokenStr = `[ 中断 | 输入: ${ctx.inputTokens} | 输出: ${ctx.outputTokens} ]`;
        await chatDB.addChatMessages({
          chatId: ctx.currentChatId,
          role: "assistant",
          content: ctx.fullContent.trim() || "[内容生成被中断]",
          reasoning: ctx.fullReasoning,
          token: partialTokenStr,
          timestamp: Date.now(),
        });
        ctx.onStreamFinish?.(partialTokenStr, {
          inputTokens: ctx.inputTokens,
          outputTokens: ctx.outputTokens,
        });
      } else {
        // 如果一点内容都没生成就被中断，仅触发完成回调，UI 层处理 loading 状态
        ctx.onStreamFinish?.("[ 已取消 ]", { inputTokens: 0, outputTokens: 0 });
      }
    } else {
      // 真实报错逻辑保持不变
      const finalTokenStr = `[ 出错: ${error.message} ]`;
      ctx.onStreamFinish?.(finalTokenStr, {
        inputTokens: ctx.inputTokens,
        outputTokens: ctx.outputTokens,
      });
    }

    ctx.onError?.(error);
  },
 
/**
   * 辅助方法：触发后台记忆压缩
   */ 
  async _triggerBackgroundCompression(currentChatId, modelConfig) {
    if (compressingChats.has(currentChatId)) return;
    try {
      compressingChats.add(currentChatId);

      // 错峰延迟，防止抢占首屏渲染性能
      const delayMs = modelConfig?.backgroundTaskDelay || 2000;
      await new Promise((resolve) => setTimeout(resolve, delayMs));

      const currentChatInfo = await chatDB.queryChatListById(currentChatId);
      if (!currentChatInfo) return;

      // 🌟 轨道一永远执行：向量提纯游标 (RAG)
      const vectorizedCount = currentChatInfo.vectorizedCount || 0; 
      
      const tasks = [];

      // 任务 1：向量记忆提纯存库 (无视模式，永远在后台默默构建向量库)
      tasks.push(
        runBackgroundMemoryCompress(currentChatId, vectorizedCount, modelConfig)
      );

      // 🌟 任务 2：文本摘要降维 (根据双擎模式分流)
      if (modelConfig?.enablePrefixCaching) {
        // ==========================================
        // 引擎 B：全量缓存模式 -> 触发【低频大纪元压缩】
        // ==========================================
        const epochStartIndex = currentChatInfo.epochStartIndex || 0;
        const totalCount = await chatDB.countMessagesByChatId(currentChatId);
        
        // 计算当前“游离”在摘要外的新消息数量 (-1 是排除当前正在生成的这条)
        const uncompressedCount = Math.max(0, totalCount - 1 - epochStartIndex);
        const cacheLimit = modelConfig.cacheMessageLimit || 50; // 读取我们刚加的新字段

        console.log(`[Compression] 缓存模式检查: 已堆叠 ${uncompressedCount} 轮 / 阈值 ${cacheLimit} 轮`);

        // 只有当积累的消息超过了设定的最大缓存轮数时，才触发大压缩
        if (uncompressedCount >= cacheLimit) {
          console.log("🔥 [Compression] 达到缓存上限，触发纪元大压缩！");
          
          // ⚠️ 这里需要你在 searchContext.js 中新增一个专门处理大摘要的方法
          // 并在完成后将数据库的 epochStartIndex 更新为最新的 totalCount
          tasks.push(
            runEpochMemoryCompression(currentChatId, epochStartIndex, modelConfig)
          );
        }
      } else {
        // ==========================================
        // 引擎 A：滑动节约模式 -> 触发【高频小步长压缩】
        // ==========================================
        const summarizedCount = currentChatInfo.summarizedCount || 0;
        
        console.log(`[Compression] 节约模式触发: 摘要游标[${summarizedCount}]`);
        tasks.push(
          runBackgroundMemoryHistory(currentChatId, summarizedCount, modelConfig)
        );
      }

      // 并发执行所分配的任务，互不干扰
      const results = await Promise.allSettled(tasks);

      results.forEach((res, index) => {
        if (res.status === "rejected") {
          console.error(`[Compression] 后台任务 ${index} 失败:`, res.reason);
        }
      });

    } catch (err) {
      console.error("[Compression] 后台调度器整体异常:", err);
    } finally {
      compressingChats.delete(currentChatId); // 释放锁
    }
  },
   /**
   * 辅助方法：组装上下文大礼包
   */
  // ============================================================================
  // 👇 核心上下文路由分发器 (双擎架构)
  // ============================================================================
  async _assembleContext(params) {
    // 假设你在 modelConfig 里配置了一个字段标识该模型是否支持前缀缓存
    // 例如：enablePrefixCaching: true
    if (params.modelConfig?.enablePrefixCaching) {
      console.log("🚀 [Context] 启用【全量缓存模式】(Cache Optimized)");
      return await this._assembleContextCacheOptimized(params);
    } else {
      console.log("🛡️ [Context] 启用【滑动节约模式】(Token Saver)");
      return await this._assembleContextTokenSaver(params);
    }
  },

  // ============================================================================
  // 👇 引擎 A：原版滑动窗口模式 (适用于本地模型 / 昂贵且无缓存的 API)
  // ============================================================================
  async _assembleContextTokenSaver({
    text,
    currentChatId,
    userMsgId,
    isTemporary,
    tempMessages,
    modelConfig,
  }) {

    const baseSystemPrompt = {
      role: "system",
      content:
        "You are a professional assistant. Answer directly and factually. Match the user language.",
    };

    let backgroundContext = [];
    let chatMessages = [];

    const recentLimit = modelConfig?.recentLimit ?? 6;
    const searchLimit = modelConfig?.searchLimit ?? 5;

    if (isTemporary) {
      const rawTempHistory = tempMessages
        .filter((m) => m.content && !m.isGenerating)
        .map((m) => ({ role: m.role, content: m.content }));
      chatMessages = buildShortTermContext(rawTempHistory, recentLimit);
    } else {
      const pivot = Math.max(0, tempMessages.length - 2);
      const excludeMsg = tempMessages.slice(-(recentLimit + searchLimit));

      if (shouldTriggerRAG(text)) {
        try {
          const historyContext = await getRelevantContextHybrid(
            text,
            currentChatId,
            excludeMsg.map((m) => m.id),
            modelConfig
          );
          if (historyContext?.length > 0) {
            backgroundContext.push(historyContext.join("\n\n"));
          }
        } catch (e) {}
      }

      const currentChatInfo = await chatDB.queryChatListById(currentChatId);
      if (currentChatInfo?.summary) {
        let cleanSummary = currentChatInfo.summary
          .replace(/[\uFFFD\u0000-\u0008\u000B-\u000C\u000E-\u001F]/g, "")
          .replace(/^-{2,}\s*$/gm, "")
          .replace(/^-\s*$/gm, "")
          .replace(/\n{3,}/g, "\n\n")
          .trim();

        if (cleanSummary.length > 0) {
          const limitThreshold = modelConfig?.summaryInjectThreshold || 10;
          const strictLen = modelConfig?.summaryInjectStrictLen || 500;
          const looseLen = modelConfig?.summaryInjectLooseLen || 1000;
          const maxLen =
            tempMessages.length > limitThreshold ? strictLen : looseLen;

          if (cleanSummary.length > maxLen) {
            let truncated = cleanSummary.substring(0, maxLen);
            const lastPunctuation =
              truncated.search(/[。！？.!?][^。！？.!?]*$/);
            if (lastPunctuation !== -1)
              truncated = truncated.substring(0, lastPunctuation + 1);
            cleanSummary = truncated + "\n...[早期摘要已折叠]";
          }
          backgroundContext.push(
            `[Previous Recap - 仅供参考]\n${cleanSummary}`
          );
        }
      }

      const totalCount = await chatDB.countMessagesByChatId(currentChatId);
      const unsummarizedCount = Math.max(
        0,
        totalCount - 1 - (currentChatInfo?.summarizedCount || 0)
      );
      const n = Math.min(unsummarizedCount, recentLimit);
      const startIdx = Math.max(0, pivot - n);
      const recentSlice = tempMessages.slice(startIdx, pivot);

      chatMessages = recentSlice
        .filter((m) => m.id !== userMsgId)
        .map((m) => ({ role: m.role, content: m.content }));
    }

    const finalPayload = [baseSystemPrompt];
    if (backgroundContext.length > 0)
      finalPayload.push({
        role: "system",
        content: backgroundContext.join("\n\n"),
      });
    finalPayload.push(...chatMessages);
    finalPayload.push({ role: "user", content: text });

    return finalPayload;
  },
  // ============================================================================
  // 👇 引擎 B：全新全量缓存模式 (适用于 DeepSeek/Claude 等支持 Prefix Caching 的大模型)
  // ============================================================================
  async _assembleContextCacheOptimized({
    text,
    currentChatId,
    userMsgId,
    isTemporary,
    tempMessages,
    modelConfig,
  }) {
    const baseSystemPrompt = {
      role: "system",
      content:
        "You are a professional assistant. Answer directly and factually. Match the user language.",
    };

    // 🌟 核心修复：计算 pivot，剔除前端刚塞入的最后一条 User 消息和正在生成的 AI 消息
    // 因为这最后一条消息，我们在方法最末尾会经过多模态组装后手动 push 进去
    const pivot = Math.max(0, tempMessages.length - 2);

    if (isTemporary) {
      // 临时会话不读数据库摘要，直接全量追加即可
      const rawTempHistory = tempMessages
        .slice(0, pivot) // 🌟 修复点：只截取到 pivot
        .filter((m) => m.content && !m.isGenerating)
        .map((m) => ({ role: m.role, content: m.content }));
      return [
        baseSystemPrompt,
        ...rawTempHistory,
        { role: "user", content: text },
      ];
    }

    let backgroundContext = [];
    const currentChatInfo = await chatDB.queryChatListById(currentChatId);

    // 1. 静态纪元大摘要 
    if (currentChatInfo?.epochSummary) {
      backgroundContext.push(
        `[Previous Core Context]\n${currentChatInfo.epochSummary}`
      );
    }

    // 2. 追加模式获取近期历史 
    const startIndex = currentChatInfo?.epochStartIndex || 0;
    
    let chatMessages = tempMessages
      .slice(startIndex, pivot) // 🌟 修复点：限制结束位置为 pivot，完美过滤掉本次新发的信息
      .filter((m) => !m.isGenerating && m.content)
      .map((m) => ({ role: m.role, content: m.content }));

    // 3. 极度动态的 RAG 插入
    if (shouldTriggerRAG(text)) {
      try {
        const excludeMsgIds = tempMessages.slice(-20).map((m) => m.id);
        const historyContext = await getRelevantContextHybrid(
          text,
          currentChatId,
          excludeMsgIds,
          modelConfig
        );
        if (historyContext?.length > 0) {
          chatMessages.push({
            role: "system",
            content: `[Retrieved Context]\n${historyContext.join("\n\n")}`,
          });
        }
      } catch (e) {
        console.error("[Context] RAG Error:", e);
      }
    }

    // 4. 拼装 payload：顺序严格遵循 [静态 -> 动态]
    const finalPayload = [baseSystemPrompt];

    if (backgroundContext.length > 0) {
      finalPayload.push({
        role: "system",
        content: backgroundContext.join("\n\n"),
      });
    }

    // 第二层：原汁原味的追加历史记录
    finalPayload.push(...chatMessages);

    // 第三层：最新的提问 (在阶段 2.5 会被替换为图片数组)
    finalPayload.push({ role: "user", content: text });

    return finalPayload;
  },

};
