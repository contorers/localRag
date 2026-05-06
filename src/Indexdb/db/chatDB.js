import { db } from "../index";
import Dexie from "dexie";

export const chatDB = {
  // ==========================================
  // 表: chatList (会话列表) 操作
  // ==========================================

  /**
   * 1. 新增一个聊天会话
   */
  async addChatList(data) {
    return await db.chatList.add({
      title: data.title || "新聊天",
      timestamp: Date.now(), // 既是创建时间，也是初始排序时间
      ...data,
    });
  },

  /**
   * 2. 查询所有会话列表 (按最后活跃时间倒序)
   * 逻辑：直接利用 timestamp 索引进行全表反向查询
   */
  async queryChatList() {
    return await db.chatList.orderBy("timestamp").reverse().toArray();
  },

  /**
   * 3. 查询所有会话列表 (按model)
   * 逻辑：直接利用 timestamp 索引进行全表反向查询
   */
  async queryChatListByModelId(modelId) {
    return await db.chatList.where("modelId").equals(modelId).toArray();
  },

  /**
   * 4. 删除单个会话 (级联删除)
   */
  async deleteChatListById(chatId) {
    // 🌟 修复：去掉数组中括号，直接平铺
    return db.transaction("rw", db.chatList, db.chatMessages, async () => {
      await db.chatMessages.where("chatId").equals(chatId).delete();
      await db.chatList.delete(chatId);
    });
  },
  /**
   * 5. 查询单个会话的详细信息 (获取 summary, title 等)
   */
  async queryChatListById(chatId) {
    return await db.chatList.get(chatId);
  },

  /**
   * 6. 更新单个会话的属性 (专门用于动态追加/更新摘要、游标等)
   */
  async updateChatList(chatId, changes) {
    // changes 是一个对象，例如 { summary: "...", summarizedCount: 10 }
    return await db.chatList.update(chatId, changes);
  },
  // ==========================================
  // 表: chatMessages (具体聊天内容) 操作
  // ==========================================

  /**
   * 1. 新增一条聊天记录
   * 关键：保存消息的同时，必须更新 chatList 的 timestamp，
   * 这样侧边栏的这个会话才会跳到最上方。
   */
  async addChatMessages(data) {
    return db.transaction("rw", db.chatList, db.chatMessages, async () => {
      const now = Date.now();

      // 1. 插入消息记录
      const msgId = await db.chatMessages.add({
        ...data,
        timestamp: now, // 消息自带的时间戳
      });

      // 2. 更新对应会话的 timestamp 索引
      // 这样 queryChatList() 里的 .orderBy("timestamp") 就能让它置顶
      if (data.chatId) {
        await db.chatList.update(data.chatId, { timestamp: now });
      }

      return msgId;
    });
  },

  /**
   * 2. 查询某个会话的历史消息
   * 利用复合索引 [chatId+timestamp] 实现高性能排序查询
   */
  async queryChatMessages(chatId) {
    return await db.chatMessages
      .where("[chatId+timestamp]")
      .between([chatId, Dexie.minKey], [chatId, Dexie.maxKey])
      .toArray();
  },
  async queryChatIdMessages(chatId) {
    return db.chatMessages.where("chatId").equals(chatId).sortBy("timestamp");
  },
  /**
   * 🌟 核心修改 1：支持分页查询历史消息 (防止内存爆炸)
   * @param {string|number} chatId 会话ID
   * @param {number} offset 偏移量(已经加载了多少条)
   * @param {number} limit 每次加载的条数(默认 50 条)
   */
  async queryChatMessagesByPage(chatId, offset = 0, limit = 50) {
    // 1. 利用复合索引定位到该 chatId 的所有消息
    // 2. reverse(): 倒序排列（时间戳最大的，也就是最新的消息在最前面）
    // 3. offset & limit: 跳过已加载的，取下一批
    const messages = await db.chatMessages
      .where("[chatId+timestamp]")
      .between([chatId, Dexie.minKey], [chatId, Dexie.maxKey])
      .reverse()
      .offset(offset)
      .limit(limit)
      .toArray();

    // 4. 因为 UI 渲染要求最旧的消息在上面，最新的在下面，所以返回前需要反转回正序
    return messages.reverse();
  },
  /**
   * 3. 按ids查询会话的历史消息
   */
  async queryChatIdsMessages(chatIds) {
    return await db.chatMessages.where("chatId").anyOf(chatIds).toArray();
  },
  /**
   * 4.获取会话最近的 N 条记录 (短期记忆)
   */
  async queryRecentMessages(chatId, limit = 15) {
    const messages = await db.chatMessages
      .where("[chatId+timestamp]") // 🌟 优化：这里也建议改成复合索引，比单查 chatId 性能更好
      .between([chatId, Dexie.minKey], [chatId, Dexie.maxKey])
      .reverse()
      .limit(limit)
      .toArray();

    return messages.reverse();
  },
  /**
   * 5. 删除单条聊天记录 (用于中止生成时的事务回滚)
   */
  async deleteChatMessageById(msgId) {
    return await db.chatMessages.delete(msgId);
  },
  /**
   *6. 清空所有聊天记录 (重置功能)
   */
  async clearAllChatData() {
    // 🌟 修复：去掉数组中括号，并弃用 Promise.all 防止事务提前关闭
    return db.transaction("rw", db.chatList, db.chatMessages, async () => {
      await db.chatList.clear();
      await db.chatMessages.clear();
    });
  },
  // ==========================================
  // 高级性能优化方法 (用于 RAG 和 记忆压缩)
  // ==========================================

  /**
   * 🌟 优化 1：极速获取会话的消息总数 (不加载具体数据，耗时接近 0)
   */
  async countMessagesByChatId(chatId) {
    return await db.chatMessages.where("chatId").equals(chatId).count();
  },

  /**
   * 🌟 优化 2：精确截取指定范围的历史记录 (专供后台记忆压缩使用)
   * @param {string|number} chatId
   * @param {number} offset 开始索引 (summarizedCount)
   * @param {number} limit 截取条数 (forgottenCount - summarizedCount)
   */
  async queryMessagesSlice(chatId, offset, limit) {
    return await db.chatMessages
      .where("[chatId+timestamp]")
      .between([chatId, Dexie.minKey], [chatId, Dexie.maxKey])
      .offset(offset)
      .limit(limit)
      .toArray();
  },

  /**
   * 🌟 优化 3：增量加载全局搜索所需的消息 (防止全局搜索 OOM 崩溃)
   * 只加载指定会话列表最近 N 天，或最近 M 条记录
   */
  async queryRecentMessagesByChatIds(chatIds, limitPerChat = 100) {
    // 因为 anyOf().limit() 会限制全局总数，而不是每个 chatId 的总数
    // 所以我们需要对每个 chatId 并发获取最近的 N 条，再拍平
    const promises = chatIds.map((id) =>
      this.queryRecentMessages(id, limitPerChat)
    );
    const results = await Promise.all(promises);
    return results.flat();
  },
  // 当用户发完消息，后台静默计算并 Patch 更新到数据库
  async saveMessageVector(msgId, vectorArray) {
    await db.chatMessages.update(msgId, { vector: vectorArray });
  },
  /**
   * 获取当前会话中，所有已经包含 vector 字段的消息
   */
  // ==========================================
  // 向量 RAG 专用查询方法
  // ==========================================

  /**
   * 🌟 优化 4：获取会话中【最近的 N 条】已向量化的消息 (防 OOM 核心)
   * 利用 Dexie 的游标特性，从新到老扫描，凑满 limit 即刻停止，绝不全表遍历
   * @param {string|number} chatId
   * @param {number} limit 提取上限，默认 500 条
   */
  async queryRecentMessagesWithVectors(chatId, limit = 500) {
    try {
      return await db.chatMessages
        .where("[chatId+timestamp]")
        .between([chatId, Dexie.minKey], [chatId, Dexie.maxKey])
        .reverse() // 1. 从最新的消息开始往回找
        .filter(msg => msg.vector && msg.vector.length > 0) // 2. 必须包含向量数据
        .limit(limit) // 3. 凑够 limit 条立刻停止底层游标扫描！
        .toArray();
    } catch (error) {
      console.error('[ChatDB] 获取近期向量消息失败:', error);
      return [];
    }
  },

  /**
   * (高危) 获取当前会话中，所有已经包含 vector 字段的消息
   * ⚠️ 警告：当单会话极长时（如上万条聊天），会导致 JS 内存溢出。
   * 建议在混合检索(getRelevantContextHybrid)中改用 queryRecentMessagesWithVectors
   */
  async queryAllMessagesWithVectors(chatId) {
    console.warn('[ChatDB] ⚠️ 警告：正在调用全量向量提取，长会话存在内存溢出风险！');
    return await db.chatMessages
      .where("[chatId+timestamp]")
      .between([chatId, Dexie.minKey], [chatId, Dexie.maxKey])
      .filter(msg => msg.vector && msg.vector.length > 0)
      .toArray();
  },
};
