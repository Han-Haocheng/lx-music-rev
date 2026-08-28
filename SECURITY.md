# 安全说明

## 依赖安全基线

- 生产依赖运行 `npm audit --omit=dev` 应为 **0 漏洞**（2026-08 验证通过）。
- 如 CI/开发环境执行完整 `npm audit`，构建期依赖链中可能存在与本项目运行时无关的告警（见下）。

## image-size 解析器漏洞处理记录

image-size 曾被用作运行时依赖（`src/common/utils/musicMeta/flacMeta.js` 解析 FLAC 封面尺寸），
存在两个高危 DoS 公告（解析器无限循环）：

- [GHSA-w3rx-r6r6-pgpr](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr)（ICNS 解析器）
- [GHSA-5p2g-fcmc-qvqq](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq)（JXL/HEIF 解析器）

已处理：运行时依赖替换为 `probe-image-size`（仅解析常见位图格式头部，不含 ICNS/JXL/HEIF 解析器），
解析失败回退尺寸为 0，不影响 FLAC 写入。涉及提交见 `git log --oneline -S probe-image-size`。

## 构建期残留：svg-baker → image-size@0.5.5

`svg-sprite-loader`（构建期，devDependencies 链）依赖 `svg-baker`，后者传递依赖 `image-size@0.5.5`。
该残留**不可达，无需处理**，理由：

1. image-size@0.5.5 仅包含 bmp/gif/jpg/png/psd/svg/tiff/webp/dds 解析器，**没有 ICNS/JXL/HEIF 解析器**，
   两个 GHSA 的触发路径在该版本上不存在（公告受影响范围为库的整体发布线，粒度较粗）；
2. svg-baker 仅在 `raster-to-svg` 变换（把栅格图片转为内联 SVG 符号）中调用 image-size，
   本项目 18 个 svg 资产均无栅格引用，也没有经 sprite loader 引入的栅格图，该路径不会执行；
3. 即使执行，输入也仅为仓库内受信的构建资产。

复查点：

- `svg-sprite-loader` / `svg-baker` 升级时，复查其依赖树（`npm ls image-size`）；
- GHSA 发布修复版本后，评估是否将 `svg-baker` 的 image-size 通过 overrides 指到修复版；
- 常规检查：`npm audit --omit=dev` + `npm ls image-size`。

## 报告安全问题

请通过 GitHub Issues（`https://github.com/lyswhut/lx-music-desktop/issues`）反馈。
