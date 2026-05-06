import { db } from "../index";

export const systemSetDB = {
  /**
   * 获取系统全局配置
   * @param {string} id - 配置的唯一标识，默认使用 'default'
   * @returns {Promise<Object|undefined>} 返回配置对象，如果没有则返回 undefined
   */
  async getSystemSettings(id = 'default') {
    try {
      return await db.systemSettings.get(id);
    } catch (error) {
      console.error("[DB Error] 获取系统配置失败:", error);
      throw error;
    }
  },

  /**
   * 保存或更新系统全局配置
   * @param {Object} data - 要保存的配置对象
   * @returns {Promise<string>} 返回保存的主键
   */
  async saveSystemSettings(data) {
    try {
      // 强制确保有 id 字段（兜底保护）
      if (!data.id) {
        data.id = 'default';
      }
      
      // 使用 put 方法：如果存在就更新，如果不存在就插入
      return await db.systemSettings.put(data);
    } catch (error) {
      console.error("[DB Error] 保存系统配置失败:", error);
      throw error;
    }
  },
  /**
   * 局部更新系统配置（只修改指定字段，不影响其他配置）
   * @param {Object} changes - 包含要更新的键值对的对象，例如 { cacheMessageLimit: 100 }
   * @param {string} id - 配置的唯一标识，默认使用 'default'
   * @returns {Promise<number>} 返回更新成功的记录数（1 表示成功，0 表示未找到记录）
   */
  async updateSystemSettingField(changes, id = 'default') {
    try {
      // Dexie 的 update 方法会进行深层合并/覆盖，非常安全
      const updatedCount = await db.systemSettings.update(id, changes);
      
      // 如果 update 返回 0，说明数据库里连 'default' 这条基础记录都没有
      // 此时我们需要兜底，把它连同 changes 一起初始化进去
      if (updatedCount === 0) {
        console.warn(`[DB Warn] 未找到 id 为 ${id} 的系统配置，正在自动初始化...`);
        await this.saveSystemSettings({ id, ...changes });
        return 1;
      }
      return updatedCount;
    } catch (error) {
      console.error("[DB Error] 局部更新系统配置失败:", error);
      throw error;
    }
  }
};