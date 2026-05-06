import Dexie from "dexie";

// 缓存池：防止同一个用户在 Vue 各个组件里反复调用导致内存溢出
const dbInstances = new Map();

// 🌟 1. 【修复点】声明当前激活的数据库实例变量
let currentActiveDb = null;

// ==========================================
// 1. 初始化 / 切换数据库 (登录时调用)
// ==========================================
export const initDB = function (userId) {
  if (!userId) {
    throw new Error("初始化 Dexie 失败：缺少 userId");
  }

  const dbName = `myChatAppDB_${userId}`;

  // 🌟 2. 【修复点】如果缓存里有，必须在返回前同步给 currentActiveDb
  if (dbInstances.has(dbName)) {
    currentActiveDb = dbInstances.get(dbName);
    return currentActiveDb;
  }

  // 如果没有，真正的实例化在这里发生
  const db = new Dexie(dbName);

  // 定义表结构
  db.version(1).stores({
    chatList: "++id, modelId, timestamp, [modelId+timestamp]",
    chatMessages: "++id, chatId, timestamp, [chatId+timestamp]",
    vectors: "id, chatId, timestamp",

    // 1. 厂商表：只存基础信息和鉴权
    apiProviders: "id",
    // 2. 模型表：独立出来！
    apiModels: "id, providerId, modelType, isDefault",
    // 3. 全局系统设置表：只写主键 id 即可，其他字段作为对象的普通属性存入
    systemSettings: "id", 
    keyStore: "[userId+keyName], userId",
  });

  // 存入缓存池
  dbInstances.set(dbName, db);

  currentActiveDb = dbInstances.get(dbName);
  return currentActiveDb;
};

// ==========================================
// 2. 日常调用 (组件内无脑调用此方法即可)
// ==========================================
export const db = new Proxy(
  {},
  {
    get(target, prop) {
      // 1. 每次你输入 myDb.xxx 时，这里都会被触发
      if (!currentActiveDb) {
        throw new Error("数据库尚未初始化，请确保已登录并调用过 initDB!");
      }

      // 2. 拿到真实的 Dexie 属性或方法 (比如 sessions 表)
      const value = currentActiveDb[prop];

      // 3. 安全处理：如果是函数，绑定一下 this 防止原生报错；如果是普通属性(表)，直接返回
      return typeof value === "function" ? value.bind(currentActiveDb) : value;
    },
  }
);

// ==========================================
// 3. 安全退出 (退出登录时调用)
// ==========================================
export const closeDexieDb = function (userId) {
  const dbName = `myChatAppDB_${userId}`;

  if (dbInstances.has(dbName)) {
    const dbInstance = dbInstances.get(dbName);
    dbInstance.close(); // 1. 切断物理连接
    dbInstances.delete(dbName); // 2. 从 Map 释放内存
    console.log(`已安全关闭并清理数据库实例: ${dbName}`);
  }

  // 🌟 3. 【修复点】彻底清空当前激活状态，防止下个账号串车或调用僵尸连接
  currentActiveDb = null;
};
