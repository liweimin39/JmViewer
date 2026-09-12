export class ComicReadingProgress {
    constructor({ progressEl, progressInnerEl, jmnianHotEl, imageContainerEl }) {
        this.progressDom = progressEl;
        this.progressInnerDom = progressInnerEl;
        this.jmnianHotImage = jmnianHotEl;
        this.comicImageCr = imageContainerEl;
        this.maxIndex = 0;

        this._isDragging = false;
        this._dragIndex = 0;
        this._lastProgressIndex = -1;
    }

    init(maxIndex) {
        this.maxIndex = maxIndex;
        this._attachEvents();
        this.setProgress(0);
    }

    _getIndexFromClientY(clientY) {
        if (!this.progressDom || this.maxIndex <= 0) return 0;
        const rect = this.progressDom.getBoundingClientRect();
        if (rect.height === 0) return 0;
        let idx = Math.floor(((clientY - rect.top) / rect.height) * this.maxIndex);
        if (idx < 0) idx = 0;
        if (idx > this.maxIndex) idx = this.maxIndex;
        return idx;
    }

    _attachEvents() {
        this._onMouseDown = (e) => {
            this._isDragging = true;
            this._dragIndex = this._getIndexFromClientY(e.clientY);
            this.setProgress(this._dragIndex);
            e.preventDefault();
        };
        this._onMouseMove = (e) => {
            if (!this._isDragging) return;
            this._dragIndex = this._getIndexFromClientY(e.clientY);
            this.setProgress(this._dragIndex);
        };
        this._onMouseUp = () => {
            if (!this._isDragging) return;
            this.jumpTo(this._dragIndex);
            this._isDragging = false;
        };

        this._onTouchStart = (e) => {
            const touch = e.touches[0];
            if (!touch) return;
            this._isDragging = true;
            this._dragIndex = this._getIndexFromClientY(touch.clientY);
            this.setProgress(this._dragIndex);
            e.preventDefault();
            window.addEventListener("touchmove", this._onTouchMove, { passive: false });
            window.addEventListener("touchend", this._onTouchEnd, { passive: true });
            window.addEventListener("touchcancel", this._onTouchEnd, { passive: true });
        };
        this._onTouchMove = (e) => {
            if (!this._isDragging) return;
            const touch = e.touches[0];
            if (!touch) return;
            this._dragIndex = this._getIndexFromClientY(touch.clientY);
            this.setProgress(this._dragIndex);
            e.preventDefault();
        };
        this._onTouchEnd = () => {
            if (!this._isDragging) return;
            this.jumpTo(this._dragIndex);
            this._isDragging = false;
            window.removeEventListener("touchmove", this._onTouchMove);
            window.removeEventListener("touchend", this._onTouchEnd);
            window.removeEventListener("touchcancel", this._onTouchEnd);
        };

        this.progressDom.addEventListener("mousedown", this._onMouseDown);
        window.addEventListener("mousemove", this._onMouseMove);
        window.addEventListener("mouseup", this._onMouseUp);
        this.progressDom.addEventListener("touchstart", this._onTouchStart, { passive: false });
    }

    destroy() {
        if (this.progressDom) {
            this.progressDom.removeEventListener("mousedown", this._onMouseDown);
            this.progressDom.removeEventListener("touchstart", this._onTouchStart);
        }
        window.removeEventListener("mousemove", this._onMouseMove);
        window.removeEventListener("mouseup", this._onMouseUp);
        window.removeEventListener("touchmove", this._onTouchMove);
        window.removeEventListener("touchend", this._onTouchEnd);
        window.removeEventListener("touchcancel", this._onTouchEnd);
    }

    setProgress(index) {
        if (this.maxIndex <= 0) return;
        if (this._lastProgressIndex === index) return;
        this._lastProgressIndex = index;

        this.progressInnerDom.style.height =
            index * (this.progressDom.offsetHeight / this.maxIndex) + "px";
        if (this.progressInnerDom.children[0]) {
            this.progressInnerDom.children[0].textContent = `←${index + 1}`;
        }
        const opacity = index / this.maxIndex;
        if (this.jmnianHotImage) {
            this.jmnianHotImage.style.opacity = opacity;
        }
    }

    jumpTo(index) {
        const target = this.comicImageCr.children[index];
        if (target) target.scrollIntoView();
    }
}