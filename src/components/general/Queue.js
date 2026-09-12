export class Queue {
    arr = [];
    maxLength;
    
    constructor(maxLength) {
        this.maxLength = maxLength;
    }
    
    hasEmptySeat() {
        return this.arr.length < this.maxLength;
    }
    
    add(item) {
        if (this.arr.length >= this.maxLength) {
            const oldItem = this.arr.shift();
            if (oldItem && oldItem.cleanup) {
                oldItem.cleanup();
            }
        }
        this.arr.push(item);
        return this.arr.length;
    }
    
    getItem(index) {
        return this.arr[index];
    }
    
    removeItem(item) {
        const index = this.arr.indexOf(item);
        if (index === -1) return false;
        this.arr.splice(index, 1);
        return true;
    }
    
    getAndRemoveItem(index) {
        const item = this.getItem(index);
        if (item) {
            this.removeItem(item);
        }
        return item;
    }
    
    clear() {
        this.arr = [];
    }
    
    get length() {
        return this.arr.length;
    }
}