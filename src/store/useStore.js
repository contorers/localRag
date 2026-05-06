import { defineStore } from "pinia";
import { initDB } from "../Indexdb/index.js";
import { keyDB } from "../Indexdb/db/keyDB.js";
import { CryptoEngine } from "../utils/cryptoEngine.js";
import { globalKeyManager } from "../utils/keyManager.js";
import { ElMessageBox } from "element-plus";

export const useUserStore = defineStore("loginUser", {
  state: () => ({
    userInfo: null,
    isLoading: false,
  }),

  getters: {
    isLoggedIn: (state) => !!state.userInfo,
  },

  actions: {
    async getUserInfo() {
     return this.userInfo;
    },
    // 彻底移除 userId 参数
    // 彻底移除 userId 参数
    async getUserKeys() {
      try {
        // 🚀 一进来先开启全局 loading
        this.isLoading = true;

        // 1. 纯本地环境，固定给 IndexedDB 分配一个本地专用的 ID 即可
        const LOCAL_USER = "local_device_user";
        initDB(LOCAL_USER);

        // 2. 只检查核心解密私钥是否存在
        const hasPrivateKey = await keyDB.hasKey(
          LOCAL_USER,
          "rsa_private_key_active"
        );

        if (!hasPrivateKey) {
          console.log("☁️ 本地无密钥记录，准备引导创建...");

          // ⚠️ 弹窗前先关掉 loading，防止遮罩层挡住 Element Plus 的输入框
          this.isLoading = false;
          const newPassword = await this.promptUserForPassword(
            "设置本地安全密码",
            "首次使用"
          );
          this.isLoading = true; // 用户输完密码，恢复 loading 开始干活

          const keys = await CryptoEngine.generateAndBackupAllKeys(newPassword);
          console.log("CryptoEngine 生成的密钥对象:", keys);
          
          // 🚨 核心修改：加上嵌套路径，并且确保字段名拼写一致
          await keyDB.saveKey(
            LOCAL_USER,
            "encrypt_public_key",
            keys.publicKeysToUpload.encryptPubKey 
          );
          await keyDB.saveKey(
            LOCAL_USER,
            "rsa_private_key_active",
            keys.localPrivateKeys.decryptKey
          );

          // 🚨 核心修改：同理，注入全局管理器也要加路径
          globalKeyManager.setEncryptPublicKey(keys.publicKeysToUpload.encryptPubKey);
          globalKeyManager.setEncryptPrivateKey(keys.localPrivateKeys.decryptKey);

          // 🔥 核心：创建完成后，给 userInfo 赋值，代表已登录
          this.userInfo = {
            id: LOCAL_USER,
            username: "本地用户",
            isLocal: true,
          };

          console.log("🎉 本地系统密钥生成并装载完毕！");
        } else {
          console.log("🔒 检测到本地已有密钥，请求密码解锁...");

          // ⚠️ 弹窗前先关掉 loading
          this.isLoading = false;
          const inputPassword = await this.promptUserForPassword(
            "请输入安全密码",
            "解锁本地数据"
          );
          this.isLoading = true; // 用户输完密码，恢复 loading 准备解密

          const decryptPubKey = await keyDB.getKey(
            LOCAL_USER,
            "encrypt_public_key"
          );
          const decryptKey = await keyDB.getKey(
            LOCAL_USER,
            "rsa_private_key_active"
          );

          globalKeyManager.setEncryptPublicKey(decryptPubKey);
          globalKeyManager.setEncryptPrivateKey(decryptKey);

          // 🔥 核心：解锁成功后，给 userInfo 赋值，代表已登录
          this.userInfo = {
            id: LOCAL_USER,
            username: "本地用户",
            isLocal: true,
          };

          console.log("✅ 密码验证通过，本地密钥读取放行");
        }
      } catch (error) {
        console.error("密钥验证中断：", error);
        throw error;
      } finally {
        // 🚀 无论成功还是失败（比如用户点取消），最后一定要把 loading 关掉
        this.isLoading = false;
      }
    },

    // 改造后的弹窗方法，支持动态文案，复用于“设置密码”和“验证密码”
    async promptUserForPassword(title = "请输入密码", message = "安全验证") {
      try {
        const { value } = await ElMessageBox.prompt(message, title, {
          confirmButtonText: "确定",
          cancelButtonText: "取消",
          inputType: "password",
          inputPlaceholder: "密码长度不少于6位",
          inputPattern: /^.{6,}$/,
          inputErrorMessage: "密码格式不正确",
          closeOnClickModal: false, // 强化安全：点击空白处不能关掉弹窗
        });
        return value;
      } catch (error) {
        throw new Error("用户取消了密码操作");
      }
    },

    resetState() {
      this.userInfo = null;
      this.isLoading = false;
    },

    startLoading() {
      this.isLoading = true;
    },
    stopLoading() {
      this.isLoading = false;
    },
  },
});
