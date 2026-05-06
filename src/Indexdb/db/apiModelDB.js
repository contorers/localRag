import { db } from "../index";

export const apiModelDB = {
  // ==========================================
  // 1. 宏观/聚合操作 (配合前端 UI 的主要接口)
  // ==========================================

  /**
   * 🌟 新增核心方法：保存厂商及其下属的所有模型配置
   * 这是一个原子化事务，确保前端传入的嵌套对象(厂商 + models数组)与数据库保持严格同步
   * @param {Object} providerData - { id, name, ..., defaultChatModelId, models: [...] }
   */
  async saveProviderConfig(providerData) {
    try {
      await db.transaction('rw', db.apiProviders, db.apiModels, async () => {
        // 1. 拆分数据：分离厂商基础信息和模型数组
        const models = providerData.models || [];
        const providerToSave = { ...providerData };
        delete providerToSave.models; // 移除嵌套的模型数组，保持 apiProviders 表的纯净度

        // 2. 保存或更新厂商基础信息 (包含 defaultChatModelId 等)
        await db.apiProviders.put(providerToSave);

        // 3. 处理模型列表的“增、删、改”同步
        // 获取当前数据库中该厂商下的所有旧模型
        const existingModels = await db.apiModels.where('providerId').equals(providerToSave.id).toArray();
        const existingModelIds = existingModels.map(m => m.id);
        const newModelIds = models.map(m => m.id);

        // 找出被前端删除的模型 (在旧列表中，但不在新列表中)，执行批量删除
        const idsToDelete = existingModelIds.filter(id => !newModelIds.includes(id));
        if (idsToDelete.length > 0) {
          await db.apiModels.bulkDelete(idsToDelete);
        }

        // 4. 将传入的模型强制关联 providerId，并执行批量保存/更新
        const modelsToSave = models.map(m => ({
          ...m,
          providerId: providerToSave.id 
        }));
        
        if (modelsToSave.length > 0) {
          await db.apiModels.bulkPut(modelsToSave);
        }
      });
    } catch (error) {
      console.error("保存厂商及模型配置失败:", error);
      throw error;
    }
  },

  /**
   * 获取所有厂商，并自动关联其下的所有模型
   * (逻辑正确，保持不变)
   */
  async getAllProviders() {
    try {
      const providers = await db.apiProviders.toArray();
      // 为每个厂商拉取属于它的模型列表
      for (let p of providers) {
        p.models = await db.apiModels.where('providerId').equals(p.id).toArray();
      }
      return providers;
    } catch (error) {
      console.error("获取厂商列表失败:", error);
      return [];
    }
  },

  /**
   * 删除厂商及其关联的所有模型
   * (逻辑正确，保持不变)
   */
  async deleteProvider(providerId) {
    try {
      await db.transaction('rw', db.apiProviders, db.apiModels, async () => {
        await db.apiProviders.delete(providerId);
        await db.apiModels.where('providerId').equals(providerId).delete();
      });
    } catch (error) {
      console.error("级联删除厂商失败:", error);
      throw error;
    }
  },

  // ==========================================
  // 2. 独立模型与默认值操作
  // ==========================================

  /**
   * 设置全局默认文本对话模型 (跨厂商排他性)
   */
  async setDefaultModel(targetProviderId, targetModelId) {
    try {
      await db.transaction('rw', db.apiModels, async () => {
        // 1. 先把所有文本模型的默认状态清空
        await db.apiModels
          .where('modelType')
          .equals('text')
          .modify({ isDefault: false });
          
        // 2. 将指定模型设为默认
        await db.apiModels.update(targetModelId, { isDefault: true });
      });
    } catch (error) {
      console.error("设置默认模型失败:", error);
      throw error;
    }
  },

  /**
   * 供聊天引擎直接获取当前可用的默认对话模型
   */
  async getDefaultModel() {
    try {
      // 查询 isDefault 并且必须是 text 类型的模型，防边缘 Bug
      const model = await db.apiModels
        .where('isDefault').equals(true)
        .and(m => m.modelType === 'text')
        .first();
        
      if (!model) return null;

      const provider = await db.apiProviders.get(model.providerId);
      return {
        ...model,
        apiKey: provider?.apiKey || ""
      };
    } catch (error) {
      console.error("获取默认模型失败:", error);
      return null;
    }
  },

  /**
   * 快速获取单个模型的完整配置（含厂商 Key）
   */
  async getModelConfig(modelId) {
    try {
      const model = await db.apiModels.get(modelId);
      if (!model) return null;
      
      const provider = await db.apiProviders.get(model.providerId);
      return {
        ...model,
        apiKey: provider?.apiKey || ""
      };
    } catch (error) {
      return null;
    }
  },
  /**
   * 局部更新单个模型配置（只修改指定字段，不影响其他配置）
   * @param {string|number} id - 模型的唯一标识 (modelId)
   * @param {Object} changes - 包含要更新的键值对的对象，例如 { cacheMessageLimit: 100 }
   * @returns {Promise<number>} 返回更新成功的记录数（1 表示成功，0 表示未找到记录）
   */
  async updateModel(id, changes) {
    try {
      // Dexie 的 update 方法会进行局部字段覆盖，非常安全 
      const updatedCount = await db.apiModels.update(id, changes);
      
      if (updatedCount === 0) {
        console.warn(`[DB Warn] 未找到 id 为 ${id} 的模型，无法更新。`);
      }
      return updatedCount;
    } catch (error) {
      console.error("[DB Error] 局部更新模型配置失败:", error);
      throw error;
    }
  }
};