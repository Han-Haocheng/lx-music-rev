/* eslint-disable no-console */
// dev runner CLI：按设计向 stdout 输出编译状态/进程日志（no-console 例外）

process.env.NODE_ENV = 'development'

const chalk = require('chalk')
const electron = require('electron')
const path = require('path')
// const { say } = require('cfonts')
const { spawn } = require('child_process')
const net = require('net')
const webpack = require('webpack')
const WebpackDevServer = require('webpack-dev-server')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const webpackHotMiddleware = require('webpack-hot-middleware')

const mainConfig = require('./main/webpack.config.dev')
const rendererConfig = require('./renderer/webpack.config.dev')
const rendererLyricConfig = require('./renderer-lyric/webpack.config.dev')
const rendererScriptConfig = require('./renderer-scripts/webpack.config.dev')
const { Arch } = require('electron-builder')
const replaceLib = require('./build-before-pack')
const treeKill = require('tree-kill')
const { debounce } = require('./utils')

let electronProcess = null
let hotMiddlewareRenderer
let hotMiddlewareRendererLyric

// 开发服务器端口：默认 19080（渲染窗口）/ 19081（桌面歌词）——高位段与日常服务/正常版常见端口（80xx/90xx）区分开，
// 端口被占用时自动向上递增寻找可用端口（上限起始 +100）；可用环境变量 LX_DEV_PORT 覆盖默认起始端口
const DEV_PORT_START = Number(process.env.LX_DEV_PORT ?? 19080)
const DEV_PORT_END = DEV_PORT_START + 100
// 探测后实际使用的端口（init 阶段确定，dev server 与 Electron 加载地址统一使用该值）
let rendererDevPort = DEV_PORT_START
let lyricDevPort = DEV_PORT_START + 1

// 用 net 探测指定端口是否可用（能成功监听即为可用）
function isPortAvailable(port) {
  return new Promise(resolve => {
    const server = net.createServer()
    server.once('error', () => resolve(false))
    server.once('listening', () => server.close(() => resolve(true)))
    server.listen(port, '127.0.0.1')
  })
}

// 在 [startPort, endPort] 范围内向上递增寻找第一个可用端口，excludedPorts 中的端口会跳过
async function findAvailablePort(startPort, endPort, excludedPorts = []) {
  for (let port = startPort; port <= endPort; port++) {
    if (excludedPorts.includes(port)) continue
    if (await isPortAvailable(port)) return port
  }
  return null
}

// 启动前探测 renderer / lyric 两个 dev server 的可用端口；
// 端口全部被占用时给出清晰中文错误提示并退出
async function resolveDevPorts() {
  rendererDevPort = await findAvailablePort(DEV_PORT_START, DEV_PORT_END)
  if (rendererDevPort == null) {
    console.error(chalk.red(`[错误] 渲染窗口 dev server 端口 ${DEV_PORT_START} ~ ${DEV_PORT_END} 全部被占用，无法启动，请先释放部分端口后重试。`))
    process.exit(1)
  }
  lyricDevPort = await findAvailablePort(DEV_PORT_START + 1, DEV_PORT_END, [rendererDevPort])
  if (lyricDevPort == null) {
    console.error(chalk.red(`[错误] 桌面歌词 dev server 端口 ${DEV_PORT_START} ~ ${DEV_PORT_END} 全部被占用，无法启动，请先释放部分端口后重试。`))
    process.exit(1)
  }
}


function startRenderer() {
  return new Promise((resolve, reject) => {
    // rendererConfig.entry.renderer = [path.join(__dirname, 'dev-client')].concat(rendererConfig.entry.renderer)
    // rendererConfig.mode = 'development'
    const compiler = webpack(rendererConfig)
    hotMiddlewareRenderer = webpackHotMiddleware(compiler, {
      log: false,
      heartbeat: 2500,
    })

    compiler.hooks.compilation.tap('compilation', compilation => {
      // console.log(Object.keys(compilation.hooks))
      HtmlWebpackPlugin.getHooks(compilation).beforeEmit.tapAsync('html-webpack-plugin-after-emit', (data, cb) => {
        hotMiddlewareRenderer.publish({ action: 'reload' })
        cb()
      })
    })

    // compiler.hooks.done.tap('done', stats => {
    //   // logStats('Renderer', 'Compile done')
    //   // logStats('Renderer', stats)
    // })

    const server = new WebpackDevServer({
      port: rendererDevPort,
      hot: true,
      historyApiFallback: true,
      static: {
        directory: path.join(__dirname, '../src/common/theme/images'),
        publicPath: '/theme_images',
      },
      client: {
        logging: 'warn',
        // 关闭错误浮层：ResizeObserver 等良性浏览器警告会被 overlay 全屏显示
        overlay: false,
      },
      setupMiddlewares(middlewares, devServer) {
        devServer.app.use(hotMiddlewareRenderer)
        setImmediate(() => {
          devServer.middleware.waitUntilValid(resolve)
        })

        return middlewares
      },
    }, compiler)

    server.start()
  })
}

function startRendererLyric() {
  return new Promise((resolve, reject) => {
    // rendererConfig.entry.renderer = [path.join(__dirname, 'dev-client')].concat(rendererConfig.entry.renderer)
    // rendererConfig.mode = 'development'
    const compiler = webpack(rendererLyricConfig)
    hotMiddlewareRendererLyric = webpackHotMiddleware(compiler, {
      log: false,
      heartbeat: 2500,
    })

    compiler.hooks.compilation.tap('compilation', compilation => {
      // console.log(Object.keys(compilation.hooks))
      HtmlWebpackPlugin.getHooks(compilation).beforeEmit.tapAsync('html-webpack-plugin-after-emit', (data, cb) => {
        hotMiddlewareRendererLyric.publish({ action: 'reload' })
        cb()
      })
    })

    // compiler.hooks.done.tap('done', stats => {
    //   // logStats('Renderer', 'Compile done')
    //   // logStats('Renderer', stats)
    // })

    const server = new WebpackDevServer({
      port: lyricDevPort,
      hot: true,
      historyApiFallback: true,
      // static: {
      //   directory: path.join(__dirname, '../'),
      // },
      client: {
        logging: 'warn',
        // 关闭错误浮层：ResizeObserver 等良性浏览器警告会被 overlay 全屏显示
        overlay: false,
      },
      setupMiddlewares(middlewares, devServer) {
        devServer.app.use(hotMiddlewareRendererLyric)
        setImmediate(() => {
          devServer.middleware.waitUntilValid(resolve)
        })
        return middlewares
      },
    }, compiler)

    server.start()
  })
}

function startRendererScripts() {
  return new Promise((resolve, reject) => {
    // mainConfig.entry.main = [path.join(__dirname, '../src/main/index.dev.js')].concat(mainConfig.entry.main)
    // mainConfig.mode = 'development'
    const compiler = webpack(rendererScriptConfig)

    compiler.watch({}, (err, stats) => {
      if (err) {
        console.log(err)
        return
      }
      resolve()
    })
  })
}

function startMain() {
  let firstRun = true
  return new Promise((resolve, reject) => {
    // mainConfig.entry.main = [path.join(__dirname, '../src/main/index.dev.js')].concat(mainConfig.entry.main)
    // mainConfig.mode = 'development'
    const runElectronDelay = debounce(startElectron, 200)
    const compiler = webpack(mainConfig)

    // 将主进程产物中硬编码的 dev server 地址端口替换为实际探测所得的端口，
    // 保证 Electron 窗口加载的 URL 与真正启动的 dev server 端口一致（端口被占用自动递增时生效）
    compiler.hooks.thisCompilation.tap('runner-dev-port-sync', compilation => {
      compilation.hooks.processAssets.tap({
        name: 'runner-dev-port-sync',
        stage: webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_TRANSFER,
      }, assets => {
        const asset = assets['main.js']
        if (!asset) return
        let source = asset.source().toString()
        if (lyricDevPort !== DEV_PORT_START + 1) {
          source = source.replace(/http:\/\/localhost:9081\/lyric\.html/g, `http://localhost:${lyricDevPort}/lyric.html`)
        }
        if (rendererDevPort !== DEV_PORT_START) {
          source = source.replace(/http:\/\/localhost:9080/g, `http://localhost:${rendererDevPort}`)
        }
        if (source !== asset.source().toString()) {
          assets['main.js'] = new webpack.sources.RawSource(source)
        }
      })
    })

    compiler.hooks.watchRun.tapAsync('watch-run', (compilation, done) => {
      hotMiddlewareRenderer.publish({ action: 'compiling' })
      hotMiddlewareRendererLyric.publish({ action: 'compiling' })
      done()
    })

    compiler.watch({}, (err, stats) => {
      if (err) {
        console.log(err)
        reject(err)
        return
      }

      // logStats('Main', stats)
      if (electronProcess) {
        electronProcess.removeAllListeners()
        treeKill(electronProcess.pid)
      }
      if (firstRun) {
        firstRun = false
        resolve()
      } else runElectronDelay()
    })
  })
}

function startElectron() {
  let args = [
    '--inspect=5858',
    // 'NODE_ENV=development',
    path.join(__dirname, '../dist/main.js'),
  ]

  // detect yarn or npm and process commandline args accordingly
  if (process.env.npm_execpath.endsWith('yarn.js')) {
    args = args.concat(process.argv.slice(3))
  } else if (process.env.npm_execpath.endsWith('npm-cli.js')) {
    args = args.concat(process.argv.slice(2))
  }

  electronProcess = spawn(electron, args)

  electronProcess.stdout.on('data', data => {
    electronLog(data, 'blue')
  })
  electronProcess.stderr.on('data', data => {
    electronLog(data, 'red')
  })

  electronProcess.on('close', () => {
    process.exit()
  })
}

const logs = [
  'Manifest version 2 is deprecated, and support will be removed in 2023',
  '"Extension server error: Operation failed: Permission denied", source: devtools://devtools/bundled',

  // https://github.com/electron/electron/issues/32133
  '"Electron sandbox_bundle.js script failed to run"',
  '"TypeError: object null is not iterable (cannot read property Symbol(Symbol.iterator))",',
]
function electronLog(data, color) {
  let log = data.toString()
  if (/[0-9A-z]+/.test(log)) {
    // 抑制某些无关的报错日志
    if (color == 'red' && typeof log === 'string' && logs.some(l => log.includes(l))) return

    console.log(chalk[color](log))
  }
}

function init() {
  resolveDevPorts().then(() => {
    const Spinnies = require('spinnies')
    const spinners = new Spinnies({ color: 'blue' })
    spinners.add('main', { text: 'main compiling' })
    spinners.add('renderer', { text: `renderer compiling (http://localhost:${rendererDevPort})` })
    spinners.add('renderer-lyric', { text: `renderer-lyric compiling (http://localhost:${lyricDevPort})` })
    spinners.add('renderer-scripts', { text: 'renderer-scripts compiling' })
    function handleSuccess(name) {
      spinners.succeed(name, { text: name + ' compile success!' })
    }
    function handleFail(name) {
      spinners.fail(name, { text: name + ' compile fail!' })
    }
    replaceLib({ electronPlatformName: process.platform, arch: Arch[process.arch] })

    if (rendererDevPort !== 9080 || lyricDevPort !== 9081) {
      console.log(chalk.yellow('[dev] 检测到默认端口被占用，已自动递增切换端口：'))
    }
    console.log(chalk.green(`[dev] 渲染窗口 dev server: http://localhost:${rendererDevPort}`))
    console.log(chalk.green(`[dev] 桌面歌词 dev server: http://localhost:${lyricDevPort}`))

    Promise.all([
      startRenderer().then(() => handleSuccess('renderer')).catch((err) => {
        console.error(err.message)
        return handleFail('renderer')
      }),
      startRendererLyric().then(() => handleSuccess('renderer-lyric')).catch((err) => {
        console.error(err.message)
        return handleFail('renderer-lyric')
      }),
      startRendererScripts().then(() => handleSuccess('renderer-scripts')).catch((err) => {
        console.error(err.message)
        return handleFail('renderer-scripts')
      }),
      startMain().then(() => handleSuccess('main')).catch(() => handleFail('main')),
    ]).then(startElectron).catch(err => {
      console.error(err)
    })
  }).catch(err => {
    console.error(chalk.red(`[错误] dev 服务启动失败：${err.message}`))
    process.exit(1)
  })
}

init()
