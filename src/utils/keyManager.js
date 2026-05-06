// keyManager.js
class KeyManager {
  constructor() {
    // 存储 4 把实体密钥
    this.keys = {
      signPrivate: null,
      encryptPrivate: null,
      signPublic: null,
      encryptPublic: null
    };
    
    // 保存 resolve 函数的引用
    this._resolvers = {
      signPrivate: null,
      encryptPrivate: null,
      signPublic: null,
      encryptPublic: null
    };

    // 为 4 把密钥分别创建独立的等待锁
    this.promises = this._initPromises();
  }

  // 内部辅助方法：初始化或重置 Promises
  _initPromises() {
    return {
      signPrivate: new Promise((resolve) => { this._resolvers.signPrivate = resolve; }),
      encryptPrivate: new Promise((resolve) => { this._resolvers.encryptPrivate = resolve; }),
      signPublic: new Promise((resolve) => { this._resolvers.signPublic = resolve; }),
      encryptPublic: new Promise((resolve) => { this._resolvers.encryptPublic = resolve; })
    };
  }

  // ==========================================
  // 1. 注入区 (Setters) - 通常在登录或初始化数据库后调用
  // ==========================================

  setSignPrivateKey(key) {
    if (!this.keys.signPrivate) {
      this.keys.signPrivate = key;
      this._resolvers.signPrivate(key);
      console.log("[KeyManager] ✍️ 签名【私钥】已就绪");
    }
  }

  setEncryptPrivateKey(key) {
    if (!this.keys.encryptPrivate) {
      this.keys.encryptPrivate = key;
      this._resolvers.encryptPrivate(key);
      console.log("[KeyManager] 🔓 加密【私钥】已就绪");
    }
  }

  setSignPublicKey(key) {
    if (!this.keys.signPublic) {
      this.keys.signPublic = key;
      this._resolvers.signPublic(key);
      console.log("[KeyManager] 📝 签名【公钥】已就绪");
    }
  }

  setEncryptPublicKey(key) {
    if (!this.keys.encryptPublic) {
      this.keys.encryptPublic = key;
      this._resolvers.encryptPublic(key);
      console.log("[KeyManager] 🔒 加密【公钥】已就绪");
    }
  }

  // ==========================================
  // 2. 获取区 (Getters) - 业务组件调用，自动等待
  // ==========================================

  // 业务获取签名私钥 (给自己发出的消息签名)
  async getSignPrivateKey() {
    if (this.keys.signPrivate) return this.keys.signPrivate;
    console.warn("[KeyManager] 等待签名私钥...");
    return await this.promises.signPrivate;
  }

  // 业务获取加密私钥 (解密别人发给我的密钥信封)
  async getEncryptPrivateKey() {
    if (this.keys.encryptPrivate) return this.keys.encryptPrivate;
    console.warn("[KeyManager] 等待加密私钥...");
    return await this.promises.encryptPrivate;
  }

  // 业务获取签名公钥 (可能用于验证自己的签名，或导出给服务器)
  async getSignPublicKey() {
    if (this.keys.signPublic) return this.keys.signPublic;
    console.warn("[KeyManager] 等待签名公钥...");
    return await this.promises.signPublic;
  }

  // 业务获取加密公钥 (用于给【自己】备份房间根密钥)
  async getEncryptPublicKey() {
    if (this.keys.encryptPublic) return this.keys.encryptPublic;
    console.warn("[KeyManager] 等待加密公钥...");
    return await this.promises.encryptPublic;
  }

  // ==========================================
  // 3. 生命周期管理
  // ==========================================

  // 登出时调用：清空所有密钥，重置等待锁，防止账号串号
  reset() {
    this.keys = { 
      signPrivate: null, 
      encryptPrivate: null, 
      signPublic: null, 
      encryptPublic: null 
    };
    // 重新生成一套全新的挂起 Promise
    this.promises = this._initPromises();
    console.log("[KeyManager] 🧹 所有密钥状态已重置");
  }
}

export const globalKeyManager = new KeyManager();