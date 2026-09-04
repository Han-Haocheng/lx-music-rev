<script>
import { h, nextTick } from 'vue'
import { perfMark, perfMeasure } from '@common/utils/common'

/**
 * 生成防抖函数
 * @param {*} fn
 * @param {*} delay
 */
export const debounce = (fn, delay = 100) => {
  let timer = null
  let _args = null
  return function(...args) {
    _args = args
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      fn.apply(this, _args)
    }, delay)
  }
}

const easeInOutQuad = (t, b, c, d) => {
  t /= d / 2
  if (t < 1) return (c / 2) * t * t + b
  t--
  return (-c / 2) * (t * (t - 2) - 1) + b
}
const handleScroll = (element, to, duration = 300, callback = () => {}, onCancel = () => {}) => {
  if (!element) { callback(); return }
  const start = element.scrollTop || element.scrollY || 0
  let cancel = false
  if (to > start) {
    let maxScrollTop = element.scrollHeight - element.clientHeight
    if (to > maxScrollTop) to = maxScrollTop
  } else if (to < start) {
    if (to < 0) to = 0
  } else { callback(); return }
  const change = to - start
  const increment = 10
  if (!change) { callback(); return }

  let currentTime = 0
  let val
  let cancelCallback

  const animateScroll = () => {
    currentTime += increment
    val = parseInt(easeInOutQuad(currentTime, start, change, duration))
    if (element.scrollTo) {
      element.scrollTo(0, val)
    } else {
      element.scrollTop = val
    }
    if (currentTime < duration) {
      if (cancel) {
        cancelCallback()
        onCancel()
        return
      }
      window.setTimeout(animateScroll, increment)
    } else {
      callback()
    }
  }
  animateScroll()
  return (callback) => {
    cancelCallback = callback
    cancel = true
  }
}

const CONTAINER_STYLE = 'outline: none; height: 100%; overflow-y: auto; position: relative; display: block; contain: strict;'

/**
 * 行渲染子组件。
 * 让每一行拥有独立的 render effect：只有该行读取到的响应式数据发生变化（item 内容、
 * 父级行内比较的状态等）或收到新的 row/slotFn 时才重新求值插槽，滚动引起的 views
 * 边缘增删不会让其余可见行重新执行插槽闭包。
 */
const VirtualizedListRow = {
  name: 'VirtualizedListRow',
  props: {
    row: {
      type: Object,
      required: true,
    },
    slotFn: {
      type: Function,
      default: null,
    },
  },
  render() {
    const { row, slotFn } = this
    const children = slotFn ? slotFn({ item: row.item, index: row.index }) : null
    return h('div', { style: row.style }, children)
  },
}

export default {
  name: 'VirtualizedList',
  inheritAttrs: false,
  props: {
    containerEl: {
      type: String,
      default: 'div',
    },
    containerClass: {
      type: String,
      default: 'virtualized-list',
    },
    contentEl: {
      type: String,
      default: 'div',
    },
    contentClass: {
      type: String,
      default: 'virtualized-list-content',
    },
    itemHeight: {
      type: Number,
      required: true,
    },
    keyName: {
      type: String,
      required: true,
    },
    list: {
      type: Array,
      required: true,
    },
  },
  emits: ['scroll'],
  data() {
    return {
      // 稳定响应式数组：始终是 [startIndex, endIndex) 的升序连续窗口（行对象按绝对索引缓存复用）
      views: [],
      isListScrolling: false,
    }
  },
  computed: {
    contentStyle() {
      const style = {
        display: 'block',
        height: this.list.length * this.itemHeight + 'px',
      }
      if (this.isListScrolling) style['pointer-events'] = 'none'
      return style
    },
  },
  created() {
    // 列表/行高变化（等价于原 watch itemHeight/list，见 methods.handleReset）
    this.$watch(() => this.itemHeight, () => {
      this.handleReset(this.list)
    })
    this.$watch(() => this.list, (list) => {
      this.handleReset(list)
    })
    // 非响应式内部状态（避免触发额外渲染）
    this.rowCache = [] // 绝对索引 -> 行对象（修复旧版 cachedList 相对切片索引映射的隐患）
    this.startIndex = -1 // 当前渲染窗口第一个绝对索引（含）
    this.endIndex = -1 // 当前渲染窗口最后一个绝对索引（不含）
    this.lastScrollTop = -1 // 上次触发更新时的滚动位置（用于 0.6*行高 阈值）
    this.cancelScroll = null
    this.isAutoScrolling = false
    this.scrollToValue = 0
    this.rafId = null
    this.setStopScrollStatus = debounce(() => {
      this.isListScrolling = false
    }, 200)
    this.handleScrollEvent = event => {
      if (!this.isListScrolling) this.isListScrolling = true
      this.setStopScrollStatus()
      const dom = this.$refs.dom_scrollContainer
      if (!dom) return
      const currentScrollTop = dom.scrollTop
      // 只有位移超过 ~0.6*行高才进入虚拟窗口更新（与旧实现一致）
      if (Math.abs(currentScrollTop - this.lastScrollTop) > this.itemHeight * 0.6) {
        this.lastScrollTop = currentScrollTop
        this.requestUpdate()
      }
      this.$emit('scroll', event)
    }
  },
  mounted() {
    const dom = this.$refs.dom_scrollContainer
    if (!dom) return
    dom.addEventListener('scroll', this.handleScrollEvent, {
      capture: false,
      passive: true,
    })
    this.rowCache = []
    this.startIndex = -1
    this.endIndex = -1

    if (this.list.length) {
      void nextTick(() => {
        this.requestUpdate()
      })
    }
    window.addEventListener('resize', this.handleResize)
  },
  beforeUnmount() {
    const dom = this.$refs.dom_scrollContainer
    if (dom) dom.removeEventListener('scroll', this.handleScrollEvent)
    window.removeEventListener('resize', this.handleResize)
    if (this.rafId != null) {
      window.cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    // 取消平滑滚动动画（传空回调避免残留计时器内调用 undefined 报错）
    if (this.cancelScroll) this.cancelScroll(() => {})
  },
  methods: {
    // 获取（或缓存创建）绝对索引对应的行对象。行对象按绝对索引存取，滚动回退时直接复用。
    getRowData(index) {
      const cache = this.rowCache
      let row = cache[index]
      if (!row) {
        const itemHeight = this.itemHeight
        const item = this.list[index]
        const top = index * itemHeight
        row = cache[index] = {
          item,
          index,
          key: item[this.keyName],
          style: { position: 'absolute', left: 0, right: 0, top: top + 'px', height: itemHeight + 'px' },
        }
      }
      return row
    },
    // 构建 [start, end) 的整窗行数组（force 路径用）
    buildRows(start, end) {
      const rows = []
      for (let i = start; i < end; i++) rows.push(this.getRowData(i))
      return rows
    },
    /**
     * 增量边缘补丁：只增删窗口边缘行。
     * - 向下滚动/窗口向下扩大：splice 头部移除 + 尾部 push 补新行
     * - 向上滚动/窗口向上扩大：头部 unshift 补新行 + 尾部 splice 移除
     * 保留的可见行对象与数组顺序完全不变，Vue 按 key 只 patch 变化行。
     */
    applyWindow(start, end) {
      const arr = this.views
      const prevStart = this.startIndex
      const prevEnd = this.endIndex
      let dropHead = start - prevStart
      if (dropHead > 0) {
        if (dropHead > arr.length) dropHead = arr.length
        arr.splice(0, dropHead)
      }
      let dropTail = prevEnd - end
      if (dropTail > 0) {
        if (dropTail > arr.length) dropTail = arr.length
        arr.splice(arr.length - dropTail, dropTail)
      }
      // 尾部追加新增边缘行
      let tail = arr.length ? arr[arr.length - 1].index : start - 1
      while (tail + 1 < end) {
        tail++
        arr.push(this.getRowData(tail))
      }
      // 头部前插新增边缘行（倒序 unshift 以保持索引升序）
      let head = arr.length ? arr[0].index : end
      while (head - 1 >= start) {
        head--
        arr.unshift(this.getRowData(head))
      }
    },
    // 计算当前滚动位置应渲染的窗口并（增量/整窗）提交；单帧内多次滚动只执行一次
    updateView() {
      const dom = this.$refs.dom_scrollContainer
      if (!dom) return
      const list = this.list
      const len = list.length
      const currentScrollTop = dom.scrollTop || 0
      if (!len) {
        if (this.views.length) this.views = []
        this.rowCache = []
        this.startIndex = -1
        this.endIndex = -1
        this.lastScrollTop = currentScrollTop
        return
      }
      const itemHeight = this.itemHeight
      const containerHeight = dom.clientHeight
      // 与旧实现一致的可视窗口：顶部行 + 可视行数 + 底部 1 行余量，按列表长度收口
      const viewStart = Math.floor(currentScrollTop / itemHeight)
      const start = Math.max(viewStart, 0)
      const end = Math.min(Math.max(viewStart + Math.ceil(containerHeight / itemHeight) + 1, 0), len)
      if (start >= end) {
        // 视口已越过数据底部（列表缩短后的瞬态等）：整窗为空
        if (this.views.length) this.views = []
        this.startIndex = -1
        this.endIndex = -1
        this.lastScrollTop = currentScrollTop
        return
      }
      const prevStart = this.startIndex
      const prevEnd = this.endIndex
      if (start === prevStart && end === prevEnd) {
        this.lastScrollTop = currentScrollTop
        return
      }
      // 窗口与当前渲染内容重叠 → 增量边缘补丁；不连续跳变（首屏/重置/大跳）→ 整窗重建
      const overlap = prevStart >= 0 && start < prevEnd && end > prevStart
      if (overlap) {
        this.applyWindow(start, end)
      } else {
        this.views = this.buildRows(start, end)
        perfMeasure('4. vl reset→整窗行构建', 'vl:reset')
        perfMeasure('5. 列表赋值→整窗行构建', 'switch:assigned')
        window.requestAnimationFrame(() => {
          perfMeasure('6. 列表赋值→DOM提交帧', 'switch:assigned')
          perfMeasure('7. 路由→DOM提交 总耗时', 'switch:route')
        })
      }
      this.startIndex = start
      this.endIndex = end
      this.lastScrollTop = currentScrollTop
    },
    // 合并同帧多次更新：requestAnimationFrame 单飞
    requestUpdate() {
      if (this.rafId != null) return
      this.rafId = window.requestAnimationFrame(() => {
        this.rafId = null
        this.updateView()
      })
    },
    handleResize() {
      window.setTimeout(() => {
        this.requestUpdate()
      })
    },
    // 列表/行高变化：清缓存与窗口状态，重新整窗渲染（不依赖下一次滚动事件）
    handleReset(list) {
      perfMark('vl:reset')
      this.rowCache = []
      this.startIndex = -1
      this.endIndex = -1
      if (list.length) {
        this.requestUpdate()
      } else {
        this.views = []
      }
    },
    scrollTo(scrollTop, animate = false, onScrollEnd) {
      const dom = this.$refs.dom_scrollContainer
      if (onScrollEnd) {
        void new Promise(resolve => {
          if (this.cancelScroll) {
            this.cancelScroll(resolve)
          } else {
            resolve()
          }
        }).then(() => {
          if (animate) {
            this.isAutoScrolling = true
            this.scrollToValue = scrollTop
            this.cancelScroll = handleScroll(dom, scrollTop, 300, () => {
              this.cancelScroll = null
              this.isAutoScrolling = false
              onScrollEnd(true)
            }, () => {
              this.cancelScroll = null
              this.isAutoScrolling = false
              onScrollEnd('canceled')
            })
          } else {
            dom.scrollTop = scrollTop
          }
        })
      } else {
        dom.scrollTo({
          top: scrollTop,
          behavior: animate ? 'smooth' : 'instant',
        })
      }
    },
    scrollToIndex(index, offset = 0, animate = false, onScrollEnd) {
      this.scrollTo(Math.max(index * this.itemHeight + offset, 0), animate, onScrollEnd)
    },
    getScrollTop() {
      const dom = this.$refs.dom_scrollContainer
      return this.isAutoScrolling ? this.scrollToValue : dom.scrollTop
    },
  },
  render() {
    const attrs = this.$attrs
    const classList = [this.containerClass]
    const styleList = [CONTAINER_STYLE]
    const rootProps = { ref: 'dom_scrollContainer', tabindex: 0 }
    for (const key in attrs) {
      if (key === 'class') {
        classList.push(attrs[key])
      } else if (key === 'style') {
        styleList.push(attrs[key])
      } else {
        rootProps[key] = attrs[key]
      }
    }
    rootProps.class = classList
    rootProps.style = styleList

    const rowList = this.views
    const rows = new Array(rowList.length)
    const slotFn = this.$slots.default
    for (let i = 0; i < rowList.length; i++) {
      const row = rowList[i]
      rows[i] = h(VirtualizedListRow, { key: row.key, row, slotFn })
    }

    const children = [
      h(this.contentEl, { class: this.contentClass, style: this.contentStyle }, rows),
    ]
    const footer = this.$slots.footer
    if (footer) children.push(footer())
    return h(this.containerEl, rootProps, children)
  },
}
</script>
