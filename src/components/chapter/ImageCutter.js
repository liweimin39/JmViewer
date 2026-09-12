import { crypto } from "@/api/Crypto.js";

export class ImageCutter {
    constructor() {}
    
    cutImage(image, id, path) {
        try {
            const width = image.naturalWidth || image.width;
            const height = image.naturalHeight || image.height;
            
            if (width <= 0 || height <= 0) {
                throw new Error('无效的图片尺寸');
            }
            
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            
            const context = canvas.getContext('2d', {
                alpha: false,
                willReadFrequently: false
            });
            
            if (!context) {
                throw new Error('无法获取Canvas上下文');
            }
            
            // 白色背景，避免透明图变黑
            context.fillStyle = '#FFFFFF';
            context.fillRect(0, 0, width, height);
            
            const sliceCount = this.#getCuttingCount(id, path.substring(0, 5));
            const sliceHeight = Math.floor(height / sliceCount);
            const remainingHeight = height % sliceCount;
            
            context.imageSmoothingEnabled = true;
            context.imageSmoothingQuality = 'high';
            
            // 最后一片（底部）移到顶部
            context.drawImage(
                image,
                0,
                height - sliceHeight - remainingHeight,
                width,
                sliceHeight + remainingHeight,
                0,
                0,
                width,
                sliceHeight + remainingHeight
            );
            
            // 从下往上依次拼接
            for (let i = 0; i < sliceCount - 1; i++) {
                context.drawImage(
                    image,
                    0,
                    sliceHeight * (sliceCount - i - 2),
                    width,
                    sliceHeight,
                    0,
                    (i + 1) * sliceHeight + remainingHeight,
                    width,
                    sliceHeight
                );
            }
            
            return canvas;
        } catch (error) {
            console.error('图片解密失败:', error);
            throw new Error(`解密失败: ${error.message}`);
        }
    }
    
    #getCuttingCount(id, path) {
        try {
            if (id >= 220980 && id < 268850) {
                return 10;
            }
            
            const hashData = crypto.calculateMD5(id + path);
            let key = hashData.charCodeAt(hashData.length - 1);
            
            if (id >= 268850 && id <= 421925) {
                key = key % 10;
            } else {
                key = key % 8;
            }
            
            if (key >= 0 && key <= 9) {
                const layers = key * 2 + 2;
                return Math.min(Math.max(layers, 2), 50);
            }
            return 10;
        } catch (error) {
            console.warn('计算切片数失败，使用默认值10:', error);
            return 10;
        }
    }
}