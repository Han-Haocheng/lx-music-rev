// 已移除 qrc_decode（私有预编译，绑定 Electron ABI）与 better-sqlite3 原生依赖，
// 打包前不再需要替换任何原生模块。保留空实现以兼容外层调用。
module.exports = async() => {}
