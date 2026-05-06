import { db } from "../index";

/**
 * 向量记忆存储层封装
 * 负责端侧 RAG 的本地数据持久化与检索源提供
 */
export const vectorDB = {
  /**
   * 1. 存入/更新单条状态向量 (已移除 importance)
   * @param {Object} record - 必须包含: { id: String/BigInt, chatId: String, timestamp: Number, textContent: String, vector: Array<Number> }
   */
  async saveVector(record) {
    try {
      if (typeof record.id === 'number' && record.id.toString().length > 15) {
        console.warn('[VectorDB] 警告：传入的 ID 为 Number 类型，存在精度丢失风险，请使用 String 或 BigInt！');
      }

      await db.vectors.put({
        id: record.id,
        chatId: record.chatId, 
        timestamp: record.timestamp || Date.now(),
        textContent: record.textContent,
        vector: record.vector
      });
      
      console.log(`[VectorDB] 记忆落库成功 ID: ${record.id}, ChatID: ${record.chatId}`);
    } catch (error) {
      console.error('[VectorDB] 落库失败:', error);
      throw error;
    }
  },

  /**
   * 2. 获取最近的 N 条记忆向量
   */
  async getRecentVectors(limit = 1000) {
    try {
      const records = await db.vectors
        .orderBy('timestamp') // 按时间戳排序
        .reverse()            // 最新在最前面
        .limit(limit)         
        .toArray();
        
      return records || [];
    } catch (error) {
      console.warn('[VectorDB] 提取近期向量失败:', error);
      const allRecords = await db.vectors.toArray();
      return allRecords.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
    }
  },

  /**
   * 3. (高危) 获取全量记忆向量 
   */
  async getAllVectors() {
    try {
      console.warn('[VectorDB] ⚠️ 警告：正在调用 getAllVectors() 全量提取，注意内存风险！');
      const records = await db.vectors.toArray();
      return records || [];
    } catch (error) {
      console.error('[VectorDB] 提取全量向量失败:', error);
      return [];
    }
  },

  /**
   * 🌟 4. 重构后的记忆淘汰机制：纯时间淘汰 (FIFO)
   * 去除了花里胡哨的分数淘汰，直接砍掉最老的数据
   */
  async pruneOldestVectors(keepLimit = 2000) {
    try {
      const totalCount = await db.vectors.count();
      if (totalCount <= keepLimit) return;
    
      const toDeleteCount = totalCount - keepLimit;
    
      // 找出最旧的 N 条记录的主键
      const keysToDelete = await db.vectors
        .orderBy('timestamp') // 默认升序，最老的数据在最前面
        .limit(toDeleteCount)
        .primaryKeys();
    
      if (keysToDelete.length > 0) {
        await db.vectors.bulkDelete(keysToDelete);
        console.log(`[VectorDB] 容量保底：已清理最旧的 ${keysToDelete.length} 条记忆。`);
      }
    } catch (error) {
      console.error('[VectorDB] 记忆淘汰失败:', error);
    }
  },

  /**
   * 5. 彻底清空所有向量记忆
   */
  async clearAllVectors() {
    try {
      const count = await db.vectors.count();
      if (count === 0) return;
      
      await db.vectors.clear();
      console.log(`[VectorDB] 💥 记忆库已彻底清空，共删除 ${count} 条记录。`);
    } catch (error) {
      console.error('[VectorDB] 清空记忆库失败:', error);
      throw error;
    }
  },

  /**
   * 6. 根据会话 ID 物理清空所属记忆
   */
  async deleteVectorsByChatId(chatId) {
    try {
      const deleteCount = await db.vectors.where('chatId').equals(chatId).delete();
      console.log(`[VectorDB] 级联清理完成：已销毁会话 ${chatId} 的 ${deleteCount} 条记忆。`);
    } catch (error) {
      console.error(`[VectorDB] 级联清理失败 ChatID: ${chatId}`, error);
      throw error;
    }
  },

  /**
   * 7. 获取特定会话的向量记忆
   */
  async getRecentVectorsByChatId(chatId, limit = 1000) {
    try {
      const records = await db.vectors
        .where('chatId')
        .equals(chatId)
        .reverse() 
        .limit(limit)
        .toArray();
        
      return records || [];
    } catch (error) {
      console.error(`[VectorDB] 提取会话 ${chatId} 的向量失败:`, error);
      return [];
    }
  },
};