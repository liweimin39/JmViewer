export class InfinityScrollContainer {
    isLoading = false;
    pageIndex = 0;
    maxPageIndex = 10000;
    container;
    threshold;
    loadContent;
    coolingTime;
    prevLoadedTime = 0;

    // ★ 新增：保存 scroll handler 引用，便于 destroy 时移除
    _scrollHandler = null;

    constructor({
        container = null,
        threshold = 100,
        loadContent = () => {},
        coolingTime = 1000,
    }) {
        this.container = container;
        this.threshold = threshold;
        this.loadContent = loadContent;
        this.coolingTime = coolingTime;
    }

    init() {
        this.addEvent();
        this.#onScroll();
    }

    addEvent() {
        // ★ 改动：用保存引用的方式绑定，destroy 时才能精确移除
        this._scrollHandler = () => this.#onScroll();
        window.addEventListener("scroll", this._scrollHandler);
    }

    // ★ 新增：组件卸载时调用，避免路由切换后监听叠加
    destroy() {
        if (this._scrollHandler) {
            window.removeEventListener("scroll", this._scrollHandler);
            this._scrollHandler = null;
        }
    }

    #onScroll() {
        if (
            this.isLoading ||
            this.pageIndex >= this.maxPageIndex ||
            Date.now() - this.prevLoadedTime < this.coolingTime
        )
            return;

        let bottom = Math.floor(
            document.documentElement.offsetHeight -
                document.documentElement.scrollTop -
                window.screen.height,
        );
        if (bottom < this.threshold) {
            // ★ 改动：兼容 loadContent 返回非 Promise 的情况
            const result = this.loadContent(++this.pageIndex);
            this.isLoading = true;
            this.prevLoadedTime = Date.now();

            if (result && typeof result.then === "function") {
                result.then(() => (this.isLoading = false));
            } else {
                // 同步返回（或者不返回）时立刻解锁，防止永久锁死
                this.isLoading = false;
            }
        }
    }
}