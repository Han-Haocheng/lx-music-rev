const path = require('path')
const { merge } = require('webpack-merge')
const webpack = require('webpack')
const CopyWebpackPlugin = require('copy-webpack-plugin')

const baseConfig = require('./webpack.config.base')

module.exports = merge(baseConfig, {
  mode: 'production',
  devtool: false,
  entry: {
    main: path.join(__dirname, '../../src/main/index.ts'),
    // dbService worker 通过 main 入口内的 new Worker(new URL(...)) 以 chunk 方式打包（见 src/main/worker/utils/index.ts），无需独立入口
  },
  node: {
    __dirname: false,
    __filename: false,
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.join(__dirname, '../../src/main/modules/userApi/renderer/user-api.html'),
          to: path.join(__dirname, '../../dist/userApi/renderer/user-api.html'),
        },
        {
          from: path.join(__dirname, '../../src/common/theme/images/*').replace(/\\/g, '/'),
          to: path.join(__dirname, '../../dist/theme_images/[name][ext]'),
        },
      ],
    }),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': '"production"',
    }),
  ],
  performance: {
    maxEntrypointSize: 1024 * 1024 * 10,
    maxAssetSize: 1024 * 1024 * 20,
  },
  optimization: {
    // 主进程产物刻意不做压缩（minimize:false）：node_modules 依赖均外部化并按原始模块路径 require，
    // 压缩对调试与产物正确性风险高且收益低；渲染进程的压缩由 webpack-build-config.js 统一控制。
    minimize: false,
  },
})
