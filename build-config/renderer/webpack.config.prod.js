const path = require('path')
const { execSync } = require('child_process')
const webpack = require('webpack')
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin')
const TerserPlugin = require('terser-webpack-plugin')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const { merge } = require('webpack-merge')

const baseConfig = require('./webpack.config.base')
const buildConfig = require('../webpack-build-config')

// const { dependencies } = require('../../package.json')

// let whiteListedModules = ['vue', 'vue-router', 'vuex', 'vue-i18n']

const gitInfo = {
  commit_id: '',
  commit_date: '',
}

// 记录构建所对应的提交信息（页面 COMMIT_ID/COMMIT_DATE 展示用）。
// 本地开发构建允许脏树（跳过提交信息嵌入即可）；CI（IS_CI=true）必须工作区干净，
// 脏树说明产物与提交不一致，应 fail-fast——throw 置于 try/catch 之外，避免被空 catch 吞掉。
let isClean = false
try {
  isClean = !execSync('git status --porcelain').toString().trim()
} catch {
  // git 不可用（例如非 git 目录构建）时按非干净处理
}

if (isClean) {
  try {
    gitInfo.commit_id = execSync('git log -1 --pretty=format:"%H"').toString().trim()
    gitInfo.commit_date = execSync('git log -1 --pretty=format:"%ad" --date=iso-strict').toString().trim()
  } catch {
    // 提交信息读取失败时保留空值，不阻断构建
  }
}

if (!isClean && process.env.IS_CI) {
  throw new Error('Working directory is not clean')
}

module.exports = merge(baseConfig, {
  mode: 'production',
  devtool: 'source-map',
  externals: [
    // ...Object.keys(dependencies || {}).filter(d => !whiteListedModules.includes(d)),
  ],
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.join(__dirname, '../../src/static'),
          to: path.join(__dirname, '../../dist/static'),
        },
      ],
    }),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': '"production"',
      // ENVIRONMENT: 'process.env',
      __VUE_OPTIONS_API__: 'true',
      __VUE_PROD_DEVTOOLS__: 'false',
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
      COMMIT_ID: `"${gitInfo.commit_id}"`,
      COMMIT_DATE: `"${gitInfo.commit_date}"`,
    }),
  ],
  optimization: {
    minimize: buildConfig.minimize,
    minimizer: [
      new TerserPlugin(),
      new CssMinimizerPlugin(),
    ],
    splitChunks: {
      chunks: 'initial',
      minChunks: 2,
    },
  },
  performance: {
    maxEntrypointSize: 1024 * 1024 * 10,
    maxAssetSize: 1024 * 1024 * 20,
    hints: 'warning',
  },
  node: {
    __dirname: false,
    __filename: false,
  },
})


