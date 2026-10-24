import CryptoJS from 'crypto-js'
class Crypto {
    predefinedKeyTemplates = ["185Hcomic3PAPP7R", "18comicAPPContent"];
    constructor() {}
    calculateMD5(inputStr) {
        return CryptoJS.MD5(inputStr).toString();
    }
    decryptData(key, cipherText) {
        // 接口可能直接返回原文：对象原样返回，JSON 字符串直接解析
        if (cipherText && typeof cipherText === 'object') {
            return cipherText;
        }
        if (typeof cipherText === 'string') {
            const text = cipherText.trim();
            if (text.startsWith("{") || text.startsWith("[")) {
                try {
                    return JSON.parse(text);
                } catch (error) {
                    // 不是合法 JSON，继续按加密文本处理
                }
            }
        }

        for (const template of this.predefinedKeyTemplates) {
            try {
                const dynamicKey = this.calculateMD5(key + template);
                const decryptedData = CryptoJS.AES.decrypt(
                    cipherText,
                    CryptoJS.enc.Utf8.parse(dynamicKey),
                    { mode: CryptoJS.mode.ECB },
                );
                return JSON.parse(decryptedData.toString(CryptoJS.enc.Utf8));
            } catch (error) {
                continue;
            }
        }
        // 非密文（如 "通知已讀" 这类提示文本）→ 原样返回
        if (typeof cipherText === "string" && !this._looksEncrypted(cipherText)) {
            return cipherText.trim();
        }
        throw new Error("Decryption failed");
    }
    /** 是否像 AES-ECB 密文：合法 base64 且解码后按 16 字节分组 */
    _looksEncrypted(text) {
        if (!/^[A-Za-z0-9+/=\s]+$/.test(text)) return false;
        try {
            const raw = atob(text.replace(/\s/g, ""));
            return raw.length > 0 && raw.length % 16 === 0;
        } catch (error) {
            return false;
        }
    }
    decryptCurrentApi(text) {
        const dynamicKey = this.calculateMD5("diosfjckwpqpdfjkvnqQjsik");
        const decryptedData = CryptoJS.AES.decrypt(
            text,
            CryptoJS.enc.Utf8.parse(dynamicKey),
            { mode: CryptoJS.mode.ECB },
        );
        return JSON.parse(decryptedData.toString(CryptoJS.enc.Utf8));
    }
}
export const crypto = new Crypto();
