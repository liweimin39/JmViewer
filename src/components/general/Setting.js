import { ref } from 'vue'

class Setting{
    #settingValues={
        using_imgserver_index:["0","1","2","3","4","5"],
        app_theme:["pink","blue","green","purple","gray","dark"],
        app_icon:["pink","blue","green","purple","gray","dark"]
    }

    #options={
        using_imgserver_index:"0",
        app_theme:"pink",
        app_icon:"pink"
    }
    // 响应式版本号：getter 读取它，setOption 递增它，使 watchEffect/computed 能感知变化
    version=ref(0)
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
    }
    setOption(key,value){
        if(this.#settingValues[key] && this.#settingValues[key].includes(value)){
            this.#options[key]=value
            localStorage.setItem(key,value)
            this.version.value++
        }
    }
    get using_imgserver_index(){
        this.version.value
        return this.#options.using_imgserver_index
    }
    get app_theme(){
        this.version.value
        return this.#options.app_theme
    }
    get app_icon(){
        this.version.value
        return this.#options.app_icon
    }
}
export const setting=new Setting()