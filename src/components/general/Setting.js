// 全部可选主题（类名约定为 `${值}-theme`，定义在 src/styles/theme.css）
const THEME_VALUES = ['pink', 'blue', 'green', 'purple', 'gray', 'dark']

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
        app_theme:THEME_VALUES
    }

    #options={
        using_imgserver_index:"0",
        app_theme:"pink"
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
}
export const setting=new Setting()
