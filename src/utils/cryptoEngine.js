export class CryptoEngine {
/**
   * 🚀 【核心架构】：生成 RSA 密钥对、备份并锁定
   * 专门用于加密和解密本地/网络数据
   * @param {string} secondPassword 用户的二级验证密码
   */
static async generateAndBackupAllKeys(secondPassword) {
  try {
    // 1. 生成临时可导出的 RSA 加密密钥对 (2048位)
    const rsaPair = await window.crypto.subtle.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true, // 暂时允许导出
      ["encrypt", "decrypt"]
    );

    // 2. 导出私钥用于备份和重新锁定 (拿到的是 ArrayBuffer)
    const rawRsaPriv = await window.crypto.subtle.exportKey(
      "pkcs8",
      rsaPair.privateKey
    );

    // 3. 【转为 Base64 后再打包】打包私钥并用二级密码加密备份
    const privateKeysPayload = JSON.stringify({
      rsa: this._arrayBufferToBase64(rawRsaPriv), // 转换！
    });
    // _encryptPayloadForBackup 内部应该是用 AES-GCM 加密，并返回 Base64 或 Uint8Array
    const backupData = await this._encryptPayloadForBackup(
      privateKeysPayload,
      secondPassword
    );

    // 4. 【关键：锁定私钥】以 extractable: false 重新导入，彻底封死 XSS 窃取可能！
    const permanentRsaPriv = await window.crypto.subtle.importKey(
      "pkcs8",
      rawRsaPriv,
      { name: "RSA-OAEP", hash: "SHA-256" },
      false,
      ["decrypt"]
    );

    // 5. 处理公钥导出 (拿到的是 ArrayBuffer)
    const rawRsaPub = await window.crypto.subtle.exportKey(
      "spki",
      rsaPair.publicKey
    );

    // 6. 返回结果
    return {
      // 这个对象立刻存入浏览器的 Dexie (IndexedDB)
      localPrivateKeys: {
        decryptKey: permanentRsaPriv,
      },
      // 发给后端（或存本地公用区）的公钥和备份数据
      publicKeysToUpload: {
        encryptPubKey: rawRsaPub,
        backupData: backupData,
      },
    };
  } catch (error) {
    console.error("[Crypto] RSA 密钥生成及备份失败:", error);
    throw error;
  }  
}

  /**
   * 内部方法：使用二级密码加密任意字符串 (PBKDF2 + AES-GCM)
   */
  static async _encryptPayloadForBackup(payloadString, password) {
    const encoder = new TextEncoder();
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    // PBKDF2 派生出极强的 AES 密钥 (十万次迭代拖延暴力破解)
    const baseKey = await window.crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      "PBKDF2",
      false,
      ["deriveKey"]
    );
    const aesKey = await window.crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
      baseKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt"]
    );

    // 加密真实数据
    const dataToEncrypt = encoder.encode(payloadString);
    const encrypted = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      aesKey,
      dataToEncrypt
    );

    // 格式拼装：Salt(16) + IV(12) + 密文Data
    const result = new Uint8Array(
      salt.byteLength + iv.byteLength + encrypted.byteLength
    );
    result.set(salt, 0);
    result.set(iv, salt.byteLength);
    result.set(new Uint8Array(encrypted), salt.byteLength + iv.byteLength);

    return result.buffer;
  }

  /**
   * 内部方法：压缩 ECDSA 公钥至 33 字节
   */
  static _compressPublicKey(rawPubBuffer) {
    const u8 = new Uint8Array(rawPubBuffer);
    const x = u8.slice(1, 33);
    const y = u8.slice(33);
    const prefix = (y[31] & 1) === 0 ? 0x02 : 0x03;
    const compressed = new Uint8Array(33);
    compressed[0] = prefix;
    compressed.set(x, 1);
    return compressed.buffer;
  }

  /**
   * 🚀 【修复】：彻底解决堆栈溢出漏洞的 Base64 转换法
   */
  static _arrayBufferToBase64(buffer) {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    // 放弃展开语法(...)，使用传统循环，内存占用小且绝不崩溃
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  /**
   * 现代高性能版：Base64 字符串转回 ArrayBuffer
   */
  static _base64ToArrayBuffer(base64) {
    const binaryString = window.atob(base64);
    const bytes = Uint8Array.from(binaryString, (c) => c.charCodeAt(0));
    return bytes.buffer;
  }
  /**
 * 将 Base64 字符串转换为 Uint8Array
 * @param {string} base64String 
 * @returns {Uint8Array}
 */
static base64ToUint8Array(base64String) {
  // 1. 使用原生 atob 函数将 Base64 解码为二进制字符串
  const binaryString = window.atob(base64String);
  
  // 2. 获取长度并创建一个等长的 Uint8Array
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  
  // 3. 逐个字节填充
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  return bytes;
}
  /**
   * 🚀 【新功能 1】：通过二级密码和备份数据，恢复出双私钥
   * @param {string} backupBase64 从服务器拉取的 encrypted_private_keys
   * @param {string} password 用户的二级密码
   */
  static async restoreKeysFromBackup(backupData, password) {
    try {
      // 1. 【核心修正】：判断输入类型。如果是 Protobuf 来的 Uint8Array 则直接用，
      // 如果是普通 JSON 来的字符串，则走 Base64 转换。
      const data =
        typeof backupData === "string"
          ? new Uint8Array(this._base64ToArrayBuffer(backupData))
          : new Uint8Array(backupData);

      // 2. 提取 Salt(16), IV(12), 密文 (与注册时的拼接顺序必须严格一致)
      const salt = data.slice(0, 16);
      const iv = data.slice(16, 28);
      const encrypted = data.slice(28);

      // 3. 派生 AES 解密密钥
      const encoder = new TextEncoder();
      const baseKey = await window.crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        "PBKDF2",
        false,
        ["deriveKey"]
      );
      const aesKey = await window.crypto.subtle.deriveKey(
        { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
        baseKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"]
      );

      // 4. 解密出 JSON 字符串
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        aesKey,
        encrypted
      );
      const payloadString = new TextDecoder().decode(decryptedBuffer);
      const keysObj = JSON.parse(payloadString);

      // 5. 【数据转换】：将 JSON 里的 Base64 字符串转回 ArrayBuffer
      // 对应之前打包时的 bufferToBase64(rawEcdsaPriv)
      const rawEcdsaPriv = this._base64ToArrayBuffer(keysObj.ecdsa);
      const rawRsaPriv = this._base64ToArrayBuffer(keysObj.rsa);

      // 6. 最终导入为“不可导出”的 CryptoKey 实例
      const signKey = await window.crypto.subtle.importKey(
        "pkcs8",
        rawEcdsaPriv,
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["sign"]
      );
      const decryptKey = await window.crypto.subtle.importKey(
        "pkcs8",
        rawRsaPriv,
        { name: "RSA-OAEP", hash: "SHA-256" },
        false,
        ["decrypt"]
      );

      return { signKey, decryptKey };
    } catch (error) {
      // 如果这里报错，绝大概率是密码错误导致解密失败（OperationError）
      console.error("[Crypto] 恢复密钥失败:", error);
      throw new Error("密码错误或备份数据损坏");
    }
  }
  /**
   * 🚀 【新功能 2】：验证收到消息的 ECDSA 签名防篡改
   * @param {Uint8Array} senderPubKeyBase64 发送者的 sign_public_key
   * @param {Uint8Array} signatureBuffer 提取出的签名 (result.signature)
   * @param {Uint8Array} dataBuffer 提取出的纯净载荷 (result.bytesToVerify)
   * @returns {boolean} 验签是否通过
   */
  static async verifyMessageSignature(
    senderPubKeyBase64,
    signatureBuffer,
    dataBuffer
  ) {
    try {
      const pubKeyBuffer = senderPubKeyBase64;

      // 导入发件人的公钥
      const publicKey = await window.crypto.subtle.importKey(
        "spki",
        pubKeyBuffer,
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["verify"]
      );

      // 执行验签！
      return await window.crypto.subtle.verify(
        { name: "ECDSA", hash: { name: "SHA-256" } },
        publicKey,
        signatureBuffer,
        dataBuffer
      );
    } catch (e) {
      console.error("[Crypto] 验签过程发生异常:", e);
      return false;
    }
  }
  /**
   * 🚀 【新功能 3】：提取 IV 并解密收到消息的 content
   * @param {Uint8Array} encryptedContentBytes 协议包里的 msg.content
   * @param {CryptoKey} aesRoomKey 业务层根据 roomId 从本地拿到的 AES 密钥
   * @returns {string} 解密后的明文文本
   */
  static async decryptMessageContent(encryptedContentBytes, aesRoomKey) {
    try {
      // 1. 拆分 IV (前12字节) 和 密文本体
      const iv = encryptedContentBytes.slice(0, 12);
      const ciphertext = encryptedContentBytes.slice(12);

      // 2. AES-GCM 解密
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        aesRoomKey,
        ciphertext
      );

      // 3. 转回明文文本 (如果是图片等二进制文件，可以直接返回 new Uint8Array(decryptedBuffer))
      return new TextDecoder().decode(decryptedBuffer);
    } catch (e) {
      console.error("[Crypto] 内容解密失败 (可能是密钥错误或非加密消息):", e);
      return "【系统提示：消息解密失败】";
    }
  }

  /**
   * 🌟 核心：使用房间密钥加密聊天消息 (AES-GCM)
   * @param {string} plaintext - 用户输入的明文文本，比如 "你好！"
   * @param {Uint8Array} rawRoomKey - 你从 Dexie 数据库拿出来的房间密钥二进制流 (通常是 16 或 32 字节)
   * @returns {Promise<{iv: Uint8Array, ciphertext: Uint8Array}>} 返回随机 IV 和加密后的密文
   */
  static async encryptMessageContentStr(plaintext, rawRoomKey) {
    try {
      // 1. 转为字节流
      const encoder = new TextEncoder();
      const encodedMessage = encoder.encode(plaintext);

      // 2. 导入 AES 密钥
      const aesKey = await window.crypto.subtle.importKey(
        "raw", rawRoomKey, { name: "AES-GCM" }, false, ["encrypt"]
      );

      // 3. 生成 12 字节随机 IV
      const iv = window.crypto.getRandomValues(new Uint8Array(12));

      // 4. 执行加密
      const encryptedBuffer = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv }, aesKey, encodedMessage
      );
      const ciphertext = new Uint8Array(encryptedBuffer);

      // 🌟 5. 【核心修改】拼接 IV 和密文
      // 创建一个新的 Uint8Array，长度是 IV长度 + 密文长度
      const combinedData = new Uint8Array(iv.length + ciphertext.length);
      combinedData.set(iv, 0);          // 把 IV 放在最前面的 0~11 字节处
      combinedData.set(ciphertext, 12); // 把密文紧接着放在第 12 字节开始的位置

      // 现在，你只需要返回这一个数组，后端用一个 byte[] 就能存下！
      return combinedData;
      
    } catch (error) {
      console.error("[Crypto] 消息加密失败:", error);
      throw new Error("加密消息失败");
    }
  }
  /**
   * 🌟 解密收到的聊天消息
   * @param {Uint8Array} combinedData - 包含 IV 和密文的合并字节流
   * @param {Uint8Array} rawRoomKey - 房间密钥
   * @returns {Promise<string>} 解密后的明文字符串
   */
  static async decryptMessageContentUnit(combinedData, rawRoomKey) {
    try {
      // 1. 🌟 【核心修改】把数据切开
      // 确保输入是纯净的 Uint8Array，防止 Protobuf 共享内存池问题
      const data = new Uint8Array(combinedData);
      
      // 前 12 个字节是 IV
      const iv = data.slice(0, 12);
      // 第 12 个字节往后全是密文
      const ciphertext = data.slice(12);

      // 2. 导入 AES 密钥
      const aesKey = await window.crypto.subtle.importKey(
        "raw", rawRoomKey, { name: "AES-GCM" }, false, ["decrypt"]
      );

      // 3. 执行解密
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv }, aesKey, ciphertext
      );

      // 4. 将解密出来的 ArrayBuffer 转回字符串
      const decoder = new TextDecoder();
      return decoder.decode(decryptedBuffer);

    } catch (error) {
      console.error("[Crypto] 消息解密失败:", error);
      return "[消息解密失败或密钥不匹配]"; // 优雅降级，防止整个聊天列表崩溃
    }
  }
  
}
