// 原来：import { setting } from "../components/general/Setting.js";
import { setting } from '@/components/general/Setting.js'   // ← 加 @
import { crypto } from './Crypto.js'                        // 不变

// 代理请求超时（毫秒）
const PROXY_TIMEOUT = 20000

/** 代理地址去掉首尾空白与结尾斜杠 */
function normalizeProxyBase(url) {
    return String(url ?? "").trim().replace(/\/+$/, "")
}

/**
 * 禁漫天堂API类
 * 提供对禁漫天堂API的各种操作接口
 *
 * 两种模式：
 * - 直连（默认）：本地取时间戳生成 token，拿到密文后本地 AES 解密
 * - 代理：设置里开启 API 代理后，请求发到自建反向代理，服务端做完令牌与解密，
 *   客户端只带一个 KEY，直接拿到明文 JSON
 */
class JmcomicApi {
    accessToken; // 访问令牌对象，包含token和tokenParam
    currentKey; // 当前时间戳作为密钥
    servers; // API服务器列表
    // 图片服务器列表，用于获取漫画图片
    imgServers = [
        "cdn-msp-jmimg2.072139.dpdns.org",
        "cdn-msp.jmapiproxy2.cc",
        "cdn-msp2.jmapiproxy2.cc",
        "cdn-msp3.jmapiproxy2.cc",
        "cdn-msp.jmapinodeudzn.net",
        "cdn-msp3.jmapinodeudzn.net",
    ];
    usingImgServerIndex = 0; // 使用中的图片服务器索引

    /**
     * 构造函数，初始化API实例
     */
    constructor() {
        this.init();
    }

    /**
     * 初始化方法，获取当前密钥、访问令牌和服务器列表
     * 服务器列表失败不影响使用：代理模式不需要它，账号接口会提示无可用服务器
     */
    async init() {
        this.currentKey = this.#getCurrentKey(); // 获取当前时间戳作为密钥
        this.accessToken = this.#getAccessToken(this.currentKey); // 根据密钥生成访问令牌
        try {
            this.servers = await this.#getCurrentApi(); // 获取当前可用的API服务器列表
        } catch (error) {
            this.servers = [];
            console.warn("[JmcomicApi] 获取服务器列表失败：", error?.message || error);
        }
    }

    /** 是否走代理（开关打开且地址、密钥都已填写） */
    get proxyEnabled() {
        return setting.api_proxy_ready;
    }

    /** 当前配置的代理地址（已去掉结尾斜杠） */
    get proxyBaseURL() {
        return normalizeProxyBase(setting.api_proxy_url);
    }

    /**
     * 获取当前时间戳作为密钥
     * @returns {number} 当前时间戳（秒级）
     */
    #getCurrentKey() {
        return Math.floor(Date.now() / 1000);
    }

    /**
     * 根据密钥生成访问令牌
     * @param {number} key - 时间戳密钥
     * @returns {Object} 包含token和tokenParam的对象
     */
    #getAccessToken(key) {
        return {
            token: crypto.calculateMD5(key + "185Hcomic3PAPP7R"), // 计算MD5哈希值作为token
            tokenParam: `${key},3.2.0`, // 包含时间戳和版本号的参数
        };
    }

    /**
     * 获取当前可用的API服务器列表
     * @returns {Promise<Array>} 服务器列表
     */
    async #getCurrentApi() {
        const resp = await this.retryFetch(
            "https://rup4a04-c02.tos-cn-hongkong.bytepluses.com/newsvr-2025.txt",
            1,
        );
        const text = await resp.text();
        return crypto.decryptCurrentApi(text).Server;
    }

    /**
     * 直连：带时间戳令牌请求上游，再用本地密钥解密
     * @param {Function} pathBuilder - 返回路径 + 查询串的函数
     * @returns {Promise<any>} 解密后的 data
     */
    async #directData(pathBuilder) {
        if (!this.servers || this.servers.length === 0) {
            throw new Error("没有可用的服务器，请检查网络后重试");
        }
        const resp = await this.retryFetch(
            (i) => `https://${this.servers[4 - i]}${pathBuilder()}`,
            {
                headers: {
                    token: this.accessToken.token,
                    tokenParam: this.accessToken.tokenParam,
                },
                redirect: "follow",
            },
            5,
        );
        const json = await resp.json();
        return crypto.decryptData(this.currentKey, json.data);
    }

    /**
     * 走代理请求：服务端已解密，这里只取 body.data
     * 网络类失败自动重试一次（业务错误直接抛出）
     * @param {string} path - 代理路径，如 "/album"
     * @param {Object} [params] - 查询参数
     * @returns {Promise<any>} 明文 data
     */
    async #proxyRequest(path, params = {}) {
        let lastError = null;
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                return await this.#proxyRequestOnce(path, params);
            } catch (error) {
                lastError = error;
                if (!error.__networkError) throw error;
                if (attempt === 0) {
                    await new Promise((resolve) => setTimeout(resolve, 300));
                }
            }
        }
        throw lastError;
    }

    /** 代理请求单次执行 */
    async #proxyRequestOnce(path, params = {}) {
        const base = this.proxyBaseURL;
        if (!base) throw new Error("未配置 API 代理地址");

        let url;
        try {
            url = new URL(base + path);
        } catch {
            throw new Error("代理地址格式不正确，需要以 http(s):// 开头");
        }
        for (const name in params) {
            const value = params[name];
            if (value === undefined || value === null || value === "") continue;
            url.searchParams.set(name, String(value));
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), PROXY_TIMEOUT);

        let resp;
        try {
            resp = await fetch(url.toString(), {
                method: "GET",
                headers: {
                    "X-Api-Key": setting.api_proxy_key,
                    accept: "application/json",
                },
                redirect: "follow",
                signal: controller.signal,
            });
        } catch (error) {
            const err = new Error(
                error?.name === "AbortError"
                    ? "代理请求超时"
                    : `代理网络错误：${error?.message || "未知原因"}`,
            );
            err.__networkError = true;
            throw err;
        } finally {
            clearTimeout(timer);
        }

        let body = null;
        try {
            body = await resp.json();
        } catch {
            throw new Error(`代理响应解析失败 (HTTP ${resp.status})`);
        }
        if (!body || body.ok !== true) {
            throw new Error((body && body.error) || `代理请求失败 (HTTP ${resp.status})`);
        }
        return body.data;
    }

    /**
     * 代理图片地址（<img> 无法携带请求头，密钥走查询参数）
     * @param {string} path - 图片路径，如 "/media/albums/123_3x4.jpg"
     * @param {number|string} serverIndex - 图片服务器索引
     */
    #proxyMediaURL(path, serverIndex) {
        const index = Math.max(0, Number(serverIndex) || 0);
        const key = encodeURIComponent(setting.api_proxy_key);
        return `${this.proxyBaseURL}${path}?s=${index}&key=${key}`;
    }

    /**
     * 带重试机制的请求方法
     * @param {string|Function} getUrl - 请求URL或返回URL的函数
     * @param {Object} init - 请求配置对象
     * @param {number} count - 重试次数
     * @returns {Promise<Response>} 请求响应对象
     */
    async retryFetch(getUrl, init, count) {
        // 如果getUrl是字符串，则将其转换为返回该字符串的函数
        if (typeof getUrl === "string") {
            let url = getUrl;
            getUrl = () => url;
        }
        // 如果init是数字，则表示重试次数，将init设为空对象
        if (typeof init === "number") {
            count = init;
            init = {};
        }
        try {
            const resp = await fetch(getUrl(count - 1), init);
            return resp;
        } catch (error) {
            // 如果重试次数已用完，抛出错误
            if (count <= 0) throw new Error(error);
            // 否则递归调用retryFetch，减少重试次数
            return this.retryFetch(getUrl, init, count - 1);
        }
    }

    /**
     * 搜索漫画结果
     * @param {string} searchQuery - 搜索关键词
     * @param {number} page - 页码
     * @param {string} mode - 排序模式
     * @returns {Promise<Object>} 搜索结果数据
     */
    async getSearchResults(searchQuery, page, mode) {
        if (this.proxyEnabled) {
            return this.#proxyRequest("/search", { search_query: searchQuery, o: mode, page });
        }
        return this.#directData(
            () => `/search?search_query=${searchQuery}&o=${mode}&page=${page}`,
        );
    }

    /**
     * 获取最新内容
     * @param {number} page - 页码
     * @returns {Promise<Object>} 最新内容数据
     */
    async getLatestContent(page) {
        if (this.proxyEnabled) {
            return this.#proxyRequest("/latest", { page });
        }
        return this.#directData(() => `/latest?page=${page}`);
    }

    /**
     * 获取推广内容（带缓存机制）
     * @returns {Promise<Object>} 推广内容数据
     */
    async getPromotionContent() {
        // 尝试从本地存储中获取缓存的推广数据
        let cache = localStorage.getItem("promoteCache");
        if (cache) {
            cache = JSON.parse(cache);
            // 如果缓存日期是今天，则直接返回缓存数据
            if (cache.date === new Date().toDateString()) {
                return cache.data;
            }
        }
        const data = this.proxyEnabled
            ? await this.#proxyRequest("/promote", { page: 1 })
            : await this.#directData(() => `/promote?page=1`);
        // 将数据保存到本地存储中，以日期为标识进行缓存
        localStorage.setItem(
            "promoteCache",
            JSON.stringify({
                date: new Date().toDateString(),
                data,
            }),
        );
        console.log(data);

        return data;
    }

    /**
     * 获取漫画专辑信息
     * @param {string|number} comicId - 漫画ID
     * @returns {Promise<Object>} 漫画专辑数据
     */
    async getComicAlbum(comicId) {
        if (this.proxyEnabled) {
            return this.#proxyRequest("/album", { id: comicId });
        }
        return this.#directData(() => `/album?id=${comicId}`);
    }

    /**
     * 获取漫画章节信息
     * @param {string|number} comicId - 漫画ID
     * @returns {Promise<Object>} 漫画章节数据
     */
    async getComicChapter(comicId) {
        if (this.proxyEnabled) {
            return this.#proxyRequest("/chapter", { id: comicId });
        }
        return this.#directData(() => `/chapter?id=${comicId}`);
    }

    /**
     * 获取漫画评论
     * @param {string|number} comicId - 漫画ID
     * @param {number} index - 评论页码
     * @returns {Promise<Array>} 漫画评论列表
     */
    async getComicComments(comicId, index) {
        if (this.proxyEnabled) {
            const data = await this.#proxyRequest("/forum", {
                page: index,
                mode: "manhua",
                aid: comicId,
            });
            return data.list;
        }
        const data = await this.#directData(
            () => `/forum?page=${index}&mode=manhua&aid=${comicId}`,
        );
        return data.list;
    }

    /**
     * 获取分类列表
     * @returns {Promise<Object>} 分类数据
     */
    async getCategories() {
        if (this.proxyEnabled) {
            return this.#proxyRequest("/categories");
        }
        return this.#directData(() => `/categories`);
    }

    /**
     * 获取分类筛选结果
     * @param {string} category - 分类ID
     * @param {number} page - 页码
     * @param {string} order - 排序方式
     * @returns {Promise<Object>} 分类筛选结果
     */
    async getCategoriesFilter(category, page, order) {
        if (this.proxyEnabled) {
            return this.#proxyRequest("/categories/filter", { page, c: category, o: order });
        }
        return this.#directData(
            () => `/categories/filter?page=${page}&c=${category}&o=${order}`,
        );
    }

    /**
     * 获取用户头像URL
     * @param {string} path - 用户头像路径
     * @returns {string} 完整的用户头像URL
     */
    getUserPhotoURL(path) {
        if (this.proxyEnabled) {
            return this.#proxyMediaURL(
                `/media/users/${path}`,
                setting.using_imgserver_index,
            );
        }
        return `https://${this.imgServers[setting.using_imgserver_index]}/media/users/${path}`
    }

    /**
     * 获取漫画封面图片URL
     * @param {string|number} id - 漫画ID
     * @returns {string} 完整的封面图片URL
     */
    getCoverImageURL(id) {
        if (this.proxyEnabled) {
            return this.#proxyMediaURL(`/media/albums/${id}_3x4.jpg`, Number(id) % 5);
        }
        return `https://${this.imgServers[id % 5]}/media/albums/${id}_3x4.jpg`;
    }

    /**
     * 获取漫画章节图片URL
     * @param {string|number} id - 章节ID
     * @param {string} pathName - 图片路径名
     * @returns {string} 完整的章节图片URL
     */
    getChapterImageURL(id, pathName) {
        if (this.proxyEnabled) {
            return this.#proxyMediaURL(
                `/media/photos/${id}/${pathName}`,
                setting.using_imgserver_index,
            );
        }
        return `https://${this.imgServers[setting.using_imgserver_index]}/media/photos/${id}/${pathName}`;
    }
}

// 创建并导出jmApi实例
export const jmApi = new JmcomicApi();
export { normalizeProxyBase };
