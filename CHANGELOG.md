# LX Music rev change log

All notable changes to this project will be documented in this file.

Project versioning adheres to [Semantic Versioning](http://semver.org/).
Commit convention is based on [Conventional Commits](http://conventionalcommits.org).
Change log format is based on [Keep a Changelog](http://keepachangelog.com/).

## [Unreleased]

## [1.1.0] - 2026-09-03

LX Music rev 在 1.0.0 基础上的首个功能迭代版本：并行开发的设置页改版、WebDAV 数据同步、收藏/播放列表拆分三条分支合并集成至 master，并修复托盘自实现与设置页重组引入的构建问题。

### 新增

- 设置页改版：16 个分散分页合并重组为「常规 / 播放与歌词 / 下载与备份 / 同步与网络 / 快捷键 / 关于」6 个分组页，新增左侧目录导航与组内小节锚点定位（选中分组后在左侧显示组内 h3 小节并联动滚动）
- 数据同步新增 WebDAV 模式：新增 WebDAV 客户端（连接测试、上传/下载/获取状态），主进程同步模块、渲染端设置 store 与启动编排接入 webdav 模式，设置页「同步与网络」新增 WebDAV 模式选择与配置/操作界面
- 「收藏」与「播放列表」拆分：新增独立收藏页（/favorite，复用 MusicList 并固定 LOVE 列表源），左侧导航新增「我的收藏」入口；「我的列表」移除收藏项、回归歌单管理，收到 LOVE 列表定位时自动跳转收藏页
- 控制栏新增「播放列表」按钮与播放队列弹层面板：展示当前播放队列，支持切歌、移除歌曲、清空已播放与自动定位当前曲目
- 控制栏与播放详情页新增 ♥ 收藏/取消收藏按钮（useLoveButton，复用 collectMusic/uncollectMusic）
- 新增 icon-list、icon-playlist、icon-love-o 图标并补齐 zh-cn/zh-tw/en-us 文案

### 修复

- 修复主进程构建失败：Linux 托盘自实现（StatusNotifierItem + dbusmenu）引入的 dbus-next 会被 webpack 静态解析其函数体内的可选模块 x11（该模块不随 npm ci 安装），导致托盘修复后的 master 推送在 CI 全平台构建失败——将 x11 声明为外部依赖（该代码路径仅在 X11 窗口选择取址时才会执行）
- 修复设置页改版后 renderer 构建失败：「同步与网络」分组页误引用不存在的 SettingSync.vue，改为引用 SettingSync/index.vue（同时使改版后的设置页能进入 WebDAV 同步配置）
- 修复自动下载（边听边下载）重复提交同一歌曲时报 UNIQUE constraint failed：主进程保存下载任务前先过滤已存在的 id 并返回实际新增项，渲染端先加载数据库列表再判重，重复播放同一首歌不再报错
- 修复 Linux 托盘在 KDE Plasma 6 桌面不可用的问题（图标不显示/空白块）：KDE 的 StatusNotifierWatcher 忽略 Electron 注册时携带的“服务名+对象路径”（SNI 对象在 /StatusNotifierItem/1，KDE 固定查询 /StatusNotifierItem 根路径），官方修复（electron#53214）仅进入 44.x，而本 fork 因 Wayland 窗口问题固定 Electron 43.4.1——故 Linux 下弃用 Electron Tray，改用自实现的 StatusNotifierItem + dbusmenu（新增 dbus-next 依赖），在根路径导出图标/提示/菜单并处理点击
- 修复 Linux 托盘图标显示错乱（@2x 图标按高倍率表示加载导致像素截断）
- 恢复系统托盘左键点击显示主窗口（全平台）

## [1.0.0] - 2026-09-02

LX Music rev 首个独立版本发布。本版本基于 lyswhut/lx-music-desktop v2.12.2（Apache-2.0 许可证）fork，除产品化改造外，还包含数据库层重构、Electron 升级与多项稳定性修复。

### 新增

- 新增「自动下载」设置：播放时自动创建下载任务
- 音乐控制栏新增下载按钮
- 新增「下载时自定义音乐文件名」功能
- 同步动作推送失败时上报状态：客户端断开前提示同步失败，服务端设置页显示错误信息

### 优化

- 数据库层改用 Node 内置 node:sqlite 替换 better-sqlite3，移除原生模块依赖，告别 ABI 重建与预编译绑定
- 移除 qrc_decode 私有预编译依赖，Electron 升级至 43.4.1；保留 handle_tx_decode_lyric 接口以兼容不同音源
- 升级 Vue 至 3.5（3.5.42）及 @vue/language-plugin-pug、music-metadata 等依赖
- 替换 image-size 为 probe-image-size，修复解析器无限循环漏洞
- 调整退出流程：先显示主窗口、再注销托盘、最后结束进程
- 重构开发模式 DevTools 安装逻辑；开发模式忽略 --hidden 参数
- 独立产品化：产品名「LX Music rev」，版本号自 1.0.0 起独立演进，应用内更新检查与安装包发布链路指向本仓库（Han-Haocheng/lx-music-rev）
- 新增 lx-music-rev:// 深链协议，同时保留 lxmusic:// 以兼容已有分享链接；使用独立用户数据目录，与原版互不干扰

### 修复

- 修复生产环境产物误走 dev server 地址导致白屏的问题（webpack 5.106 下 DefinePlugin 改用精确键 process.env.NODE_ENV）
- 修复 Wayland 下 ready-to-show 不触发导致窗口永不显示的问题（did-finish-load 兜底显示）；Wayland 会话窗口强制不透明
- Linux 禁用硬件加速避免 GPU 进程 GL 初始化崩溃；修复 Linux 平台 GPU 沙盒问题
- 修复 node:sqlite 迁移后对绑定对象中 SQL 不存在的命名参数报错的问题（如 music_overwrite 的 order 键）
- 修复应用启动并发初始化竞态与失败无提示问题
- 修复 Linux 托盘退出报错；强制退出时先注销托盘（消除 rendererEvent 对 tray 的循环依赖）
- 自动更新模块支持未打包状态运行
- sync 目录创建失败不再导致进程退出；清理生产环境 console.log 与空捕获

### 其他

- 新增 SECURITY.md，说明依赖安全基线与 image-size 漏洞处理记录
- webpack 固定 5.106.2（5.110.1 存在 worker 语法回归，待上游修复后再升级）
- 更新 GitHub Actions 相关依赖与 actions/cache 版本
- 移除上游遗留的版本信息通知 workflow、未使用的发布密钥配置与 Windows 7 构建任务
- 已知限制：QQ 加密歌词暂无法解码（handle_tx_decode_lyric 已降级为原样返回）
