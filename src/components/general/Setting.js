// 全部可选主题（类名约定为 `${值}-theme`，定义在 src/styles/theme.css）
const THEME_VALUES = ['pink', 'blue', 'green', 'purple', 'gray', 'dark', 'orange']

// 漫画图片加载方式：
// - direct：原实现，Image 直链 + crossOrigin + canvas.toDataURL
// - blob：fetch 取字节 → Blob → objectURL 渲染，再解密
const IMG_LOAD_MODES = ['direct', 'blob']

// 阅读相关设置（取值与默认值照搬原项目 Jmcomic-webUI）
const ROOT_MARGINS = ['0px', '50px', '100px', '200px', '500px', '1000px', '2000px']
const IMAGE_WIDTHS = ['50', '55', '60', '65', '70', '75', '80', '85', '90', '95', '100']
const SWITCH_VALUES = ['off', 'on']

/**
 * 把主题类应用到 <html>：先摘掉所有已知主题类，再挂上新的那个。
 * 同时同步 <meta name="theme-color">，让移动端地址栏 / 状态栏颜色跟随主题。
 * @param {string} theme 主题标识
 */
function applyTheme(theme) {
    const el = document.documentElement
    el.classList.remove(...THEME_VALUES.map((value) => `${value}-theme`))
    el.classList.add(`${theme}-theme`)
    const meta = document.getElementById('theme-color-meta')
    if (meta) {
        const bg = getComputedStyle(el).getPropertyValue('--theme-primary-light').trim()
        if (bg) meta.setAttribute('content', bg)
    }
}

class Setting{
    #settingValues={
        using_imgserver_index:["0","1","2","3","4","5"],
        app_theme:THEME_VALUES,
        img_load_mode:IMG_LOAD_MODES,
        root_margin:ROOT_MARGINS,
        reader_image_width:IMAGE_WIDTHS,
        reader_is_horizontal:SWITCH_VALUES,
        auto_fullscreen_reader:SWITCH_VALUES
    }

    #options={
        using_imgserver_index:"0",
        app_theme:"pink",
        img_load_mode:"direct",
        root_margin:"200px",
        reader_image_width:"100",
        reader_is_horizontal:"off",
        auto_fullscreen_reader:"off"
    }
    constructor(){

    }
    init(){
        for(let key in this.#settingValues){
            let value=localStorage.getItem(key)
            if(value===null)continue
            if(this.#settingValues[key].includes(value)){
                this.#options[key]=value
            }else{
                localStorage.setItem(key,this.#options[key])
            }
        }
        applyTheme(this.#options.app_theme)
    }
    setOption(key,value){
        let values=this.#settingValues[key]
        if(typeof value==='number')value=value.toString()
        if(values && values.includes(value)){
            localStorage.setItem(key,value)
            this.#options[key]=value
        }
    }
    setTheme(theme){
        if(!THEME_VALUES.includes(theme))return
        localStorage.setItem('app_theme',theme)
        this.#options.app_theme=theme
        applyTheme(theme)
    }
    get using_imgserver_index(){
        return this.#options.using_imgserver_index
    }
    get app_theme(){
        return this.#options.app_theme
    }
    get img_load_mode(){
        return this.#options.img_load_mode
    }
    get root_margin(){
        return this.#options.root_margin
    }
    get reader_image_width(){
        return this.#options.reader_image_width
    }
    get reader_is_horizontal(){
        return this.#options.reader_is_horizontal
    }
    get auto_fullscreen_reader(){
        return this.#options.auto_fullscreen_reader
    }
}
export const setting=new Setting()
