import { db } from "../index";

export const keyDB = {
  /**
   * 1. 保存/更新密钥
   * @param {number|string} userId 用户ID
   * @param {string} keyName 密钥名称 (如: 'sign_public_key', 'encrypted_private_keys')
   * @param {any} keyData 密钥数据 (可以是 ArrayBuffer, 字符串，或 CryptoKey 对象)
   */
  async saveKey(userId, keyName, keyData) {
    if (!userId || !keyName || !keyData) {
      console.error("保存密钥失败：参数不完整");
      return;
    }
    try {
      // put 方法：有则更新，无则插入
      await db.keyStore.put({
        userId: userId,
        keyName: keyName,
        keyData: keyData,
        timestamp: Date.now() // 顺手记个时间，以后做密钥过期轮换时用得上
      });
      // console.log(`🔑 密钥 [${keyName}] 已安全写入本地缓存`);
    } catch (error) {
      console.error(`保存密钥 [${keyName}] 失败:`, error);
    }
  },

  /**
   * 2. 获取指定密钥
   * @param {number|string} userId 用户ID
   * @param {string} keyName 密钥名称
   * @returns {Promise<any>} 返回密钥数据，如果没有则返回 null
   */
  async getKey(userId, keyName) {
    try {
      // 使用复合主键数组进行精确查询
      const record = await db.keyStore.get([userId, keyName]);
      return record ? record.keyData : null;
    } catch (error) {
      console.error(`读取密钥 [${keyName}] 失败:`, error);
      return null;
    }
  },

  /**
   * 3. 检查密钥是否存在 (支持动态检查1个或多个密钥)
   * @param {number|string} userId 用户ID
   * @param {...string} keyNames 密钥名称列表
   * @returns {Promise<boolean>} true 表示全都在，false 表示有缺失
   */
  async hasKey(userId, ...keyNames) {
    if (!keyNames || keyNames.length === 0) return false;
    
    // 遍历检查传入的所有密钥名，只要有一个查不到，就返回 false
    for (const keyName of keyNames) {
      const keyData = await this.getKey(userId, keyName);
      if (!keyData) return false;
    }
    return true; 
  },

  /**
   * 4. 退出登录时的“核弹级”清理（极度重要！）
   * @param {number|string} userId 用户ID
   */
  async clearAllKeysForUser(userId) {
    try {
      // 利用我们刚才在 Schema 里加的 userId 普通索引，批量揪出这个人的所有密钥并销毁
      const deleteCount = await db.keyStore.where('userId').equals(userId).delete();
      console.log(`💥 已彻底销毁用户 ${userId} 的 ${deleteCount} 条本地密钥记录，确保物理安全。`);
    } catch (error) {
      console.error(`销毁用户 ${userId} 的密钥失败:`, error);
    }
  }
};