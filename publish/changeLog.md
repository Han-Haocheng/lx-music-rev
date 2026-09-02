LX Music rev 首个独立版本发布。本版本基于 lyswhut/lx-music-desktop v2.12.2（Apache-2.0 许可证）fork。

### 变更

- 独立产品化：产品名「LX Music rev」，版本号自 1.0.0 起独立演进
- 应用内更新检查与安装包发布链路指向本仓库（Han-Haocheng/lx-music-rev）
- 新增 lx-music-rev:// 深链协议，同时保留 lxmusic:// 以兼容已有分享链接
- 使用独立的用户数据目录，与原版 LX Music 互不干扰

### 其他

- 移除上游遗留的版本信息通知 workflow 与未使用的发布密钥配置
- 移除 Windows 7 构建任务（Electron 43 不支持 Win7，node:sqlite 亦不兼容旧运行时）
