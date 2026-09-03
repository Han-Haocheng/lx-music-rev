<template lang="pug">
div(v-if="currentOnlineInfo && !isLocalSource" :class="$style.wrap")
  div(ref="sourceBtnEl" role="button" tabindex="0" :class="[$style.btn, { [$style.active]: isShowSourcePanel }]" @click.stop="toggleSourcePanel" @keyup.enter="toggleSourcePanel")
    span(:class="$style.btnLabel") {{ $t('play_source') }}
    span(:class="$style.btnValue") {{ currentSourceName }}
  div(ref="qualityBtnEl" role="button" tabindex="0" :class="[$style.btn, { [$style.active]: isShowQualityPanel }]" @click.stop="toggleQualityPanel" @keyup.enter="toggleQualityPanel")
    span(:class="$style.btnLabel") {{ $t('play_quality') }}
    span(:class="$style.btnValue") {{ currentQualityName }}
    span(v-if="isSwitching" :class="$style.loading") ...
  Teleport(to="#root")
    div(v-if="isShowSourcePanel" ref="sourcePanelEl" :class="$style.panel" :style="sourcePanelStyle" @click.stop)
      div(:class="$style.panelTitle") {{ $t('play_source') }}
      div.scroll(:class="$style.panelList")
        button(v-for="source in MUSIC_SOURCE_LIST" :key="source" type="button" :class="[$style.item, { [$style.itemCurrent]: source == effectiveSource, [$style.itemDisabled]: source != effectiveSource && sourceStatusMap[source] != 'available' }]" :disabled="source != effectiveSource && sourceStatusMap[source] != 'available'" @click="handleSwitchSource(source)")
          span(:class="$style.itemName") {{ getSourceName(source) }}
          span(v-if="source == effectiveSource" :class="[$style.itemStatus, $style.statusCurrent]")
          span(v-else-if="sourceStatusMap[source] == 'checking'" :class="[$style.itemStatus, $style.statusChecking]") {{ $t('play_source_checking') }}
          span(v-else-if="sourceStatusMap[source] == 'unavailable'" :class="[$style.itemStatus, $style.statusUnavailable]") {{ $t('play_source_unavailable') }}
          span(v-else :class="[$style.itemStatus, $style.statusAvailable]") ✓
  Teleport(to="#root")
    div(v-if="isShowQualityPanel" ref="qualityPanelEl" :class="$style.panel" :style="qualityPanelStyle" @click.stop)
      div(:class="$style.panelTitle") {{ $t('play_quality') }}
      div.scroll(:class="$style.panelList")
        button(v-for="item in qualityOptions" :key="item.quality" type="button" :class="[$style.item, { [$style.itemCurrent]: item.current, [$style.itemDisabled]: !item.available }]" :disabled="item.current || !item.available" @click="handleSwitchQuality(item.quality)")
          span(:class="$style.itemName") {{ getQualityName(item.quality) }}
          span(v-if="item.size" :class="$style.itemSize") {{ item.size }}
        div(v-if="!qualityOptions.length" :class="$style.panelEmpty") {{ $t('play_source_checking') }}
  div(v-if="toast.show" :class="$style.toast") {{ toast.msg }}
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from '@common/utils/vueTools'
import type { Message } from '@root/lang'
import { useI18n } from '@renderer/plugins/i18n'
import { setResource } from '@renderer/plugins/player'
import { appSetting } from '@renderer/store/setting'
import { playMusicInfo } from '@renderer/store/player/state'
import {
  MUSIC_SOURCE_LIST,
  checkSourceUrlAvailable,
  getMusicUrlForPlay,
  getOtherSourceMap,
  getPlayQuality,
} from '@renderer/core/music/utils'

const t = useI18n()

const currentOnlineInfo = computed<LX.Music.MusicInfo | null>(() => {
  const mi = playMusicInfo.musicInfo
  if (!mi) return null
  return 'progress' in mi ? mi.metadata.musicInfo : mi
})
const isLocalSource = computed(() => {
  const info = currentOnlineInfo.value
  return info == null || info.source == 'local'
})

const effectiveSource = ref('')
const effectiveQuality = ref<LX.Quality>('128k')
const otherSourceMap = ref<Record<string, LX.Music.MusicInfoOnline>>({})

type SourceStatus = '' | 'checking' | 'available' | 'unavailable' | 'current'
const sourceStatusMap = reactive<Record<string, SourceStatus>>({})
const probedSources = new Set<string>()
const isSwitching = ref(false)
let probeToken = 0

const getCurrentKey = () => {
  const mi = playMusicInfo.musicInfo
  if (!mi) return ''
  const info = 'progress' in mi ? mi.metadata.musicInfo : mi
  return info.source + '_' + info.id
}

const resetMusicState = () => {
  probeToken++
  const info = currentOnlineInfo.value
  otherSourceMap.value = {}
  probedSources.clear()
  for (const key of Object.keys(sourceStatusMap)) {
    Reflect.deleteProperty(sourceStatusMap, key)
  }
  if (!info || info.source == 'local') {
    effectiveSource.value = ''
    return
  }
  effectiveSource.value = info.source
  effectiveQuality.value = getPlayQuality(appSetting['player.playQuality'], info)
}

watch(getCurrentKey, resetMusicState, { immediate: true })

const getSourceName = (source: string) => {
  if (!source) return ''
  const prefix = appSetting['common.sourceNameType'] == 'real' ? 'source_' : 'source_alias_'
  return window.i18n.t((prefix + source) as keyof Message)
}
const currentSourceName = computed(() => getSourceName(effectiveSource.value))

const getQualityName = (quality: LX.Quality) => {
  return window.i18n.t((`play_quality_${quality}`) as keyof Message)
}
const currentQualityName = computed(() => effectiveSource.value ? getQualityName(effectiveQuality.value) : '')

// ==================== 探测 ====================

const probeSources = async() => {
  const mi = playMusicInfo.musicInfo
  if (!mi) return
  let info: LX.Music.MusicInfoOnline | null = null
  if ('progress' in mi) {
    info = mi.metadata.musicInfo
  } else if (mi.source != 'local') {
    info = mi
  }
  if (!info) return
  const token = ++probeToken
  // 未出结果的源先标记为“探测中”，避免面板打开时状态空白
  for (const source of MUSIC_SOURCE_LIST) {
    if (source == effectiveSource.value) continue
    if (sourceStatusMap[source] != 'available' && sourceStatusMap[source] != 'unavailable') sourceStatusMap[source] = 'checking'
  }
  try {
    const map = await getOtherSourceMap(info)
    if (token != probeToken) return
    otherSourceMap.value = map
    for (const source of MUSIC_SOURCE_LIST) {
      if (source == effectiveSource.value) continue
      if (sourceStatusMap[source] == 'available' || sourceStatusMap[source] == 'unavailable') continue
      if (probedSources.has(source)) continue
      const targetInfo = map[source]
      if (!targetInfo) {
        sourceStatusMap[source] = 'unavailable'
        continue
      }
      probedSources.add(source)
      void checkSourceUrlAvailable(targetInfo).then(available => {
        if (token != probeToken) return
        sourceStatusMap[source] = available ? 'available' : 'unavailable'
      })
    }
  } catch (err) {
    console.log(err)
  }
}

// ==================== 换源 ====================

const handleSwitchSource = async(source: string) => {
  if (isSwitching.value || source == effectiveSource.value) return
  if (sourceStatusMap[source] != 'available') return
  const mi = playMusicInfo.musicInfo
  if (!mi) return
  const info = currentOnlineInfo.value
  if (!info || info.source == 'local') return
  const targetInfo = source == info.source ? info : (otherSourceMap.value[source] ?? null)
  if (!targetInfo) return
  isSwitching.value = true
  try {
    const { url, quality } = await getMusicUrlForPlay(targetInfo, targetInfo.meta._qualitys[effectiveQuality.value] != null ? effectiveQuality.value : undefined)
    setResource(url)
    effectiveSource.value = source
    effectiveQuality.value = quality
    sourceStatusMap[source] = 'current'
    if (source != info.source && sourceStatusMap[info.source] != 'unavailable') sourceStatusMap[info.source] = 'available'
    isShowSourcePanel.value = false
  } catch (err) {
    console.log(err)
    showToast(t('play_source_switch_failed'))
  } finally {
    isSwitching.value = false
  }
}

// ==================== 音质 ====================

const effectiveInfo = computed<LX.Music.MusicInfoOnline | null>(() => {
  const info = currentOnlineInfo.value
  if (!info || info.source == 'local') return null
  if (effectiveSource.value == info.source) return info
  return otherSourceMap.value[effectiveSource.value] ?? null
})

const qualityOptions = computed(() => {
  const info = effectiveInfo.value
  if (!info) return []
  return (info.meta.qualitys ?? []).map(q => ({
    quality: q.type,
    size: q.size,
    available: info.meta._qualitys[q.type] != null,
    current: q.type == effectiveQuality.value,
  }))
})

const handleSwitchQuality = async(quality: LX.Quality) => {
  if (isSwitching.value || quality == effectiveQuality.value) return
  const info = effectiveInfo.value
  if (!info) return
  isSwitching.value = true
  try {
    const { url, quality: realQuality } = await getMusicUrlForPlay(info, quality)
    setResource(url)
    effectiveQuality.value = realQuality
    isShowQualityPanel.value = false
  } catch (err) {
    console.log(err)
    showToast(t('play_quality_switch_failed'))
  } finally {
    isSwitching.value = false
  }
}

// ==================== 面板 ====================

const isShowSourcePanel = ref(false)
const isShowQualityPanel = ref(false)
const sourceBtnEl = ref<HTMLElement | null>(null)
const qualityBtnEl = ref<HTMLElement | null>(null)
const sourcePanelEl = ref<HTMLElement | null>(null)
const qualityPanelEl = ref<HTMLElement | null>(null)
const sourcePanelStyle = reactive({ top: '0px', left: '0px' })
const qualityPanelStyle = reactive({ top: '0px', left: '0px' })

const toggleSourcePanel = () => {
  if (isShowSourcePanel.value) {
    isShowSourcePanel.value = false
    return
  }
  isShowQualityPanel.value = false
  isShowSourcePanel.value = true
}
const toggleQualityPanel = () => {
  if (isShowQualityPanel.value) {
    isShowQualityPanel.value = false
    return
  }
  isShowSourcePanel.value = false
  isShowQualityPanel.value = true
}

const positionPanel = (name: 'source' | 'quality') => {
  const panelEl = name == 'source' ? sourcePanelEl.value : qualityPanelEl.value
  const btnEl = name == 'source' ? sourceBtnEl.value : qualityBtnEl.value
  const style = name == 'source' ? sourcePanelStyle : qualityPanelStyle
  if (!panelEl || !btnEl) return
  const rect = btnEl.getBoundingClientRect()
  const panelW = panelEl.offsetWidth
  const panelH = panelEl.offsetHeight
  const viewW = document.body.clientWidth
  const viewH = document.body.clientHeight
  const gap = 8
  let top = rect.bottom + gap
  if (top + panelH > viewH - gap) top = Math.max(gap, rect.top - panelH - gap)
  style.top = `${top}px`
  const left = Math.min(Math.max(gap, rect.left - window.lx.rootOffset + (rect.width - panelW) / 2), viewW - panelW - gap)
  style.left = `${left}px`
}

watch(isShowSourcePanel, (show) => {
  if (!show) return
  void nextTick(() => {
    void probeSources()
    positionPanel('source')
  })
})
watch(isShowQualityPanel, (show) => {
  if (!show) return
  void nextTick(() => {
    positionPanel('quality')
  })
})

const handleResize = () => {
  if (isShowSourcePanel.value) positionPanel('source')
  if (isShowQualityPanel.value) positionPanel('quality')
}
const handleDocClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  if (isShowSourcePanel.value && !sourceBtnEl.value?.contains(target) && !sourcePanelEl.value?.contains(target)) {
    isShowSourcePanel.value = false
  }
  if (isShowQualityPanel.value && !qualityBtnEl.value?.contains(target) && !qualityPanelEl.value?.contains(target)) {
    isShowQualityPanel.value = false
  }
}
onMounted(() => {
  document.addEventListener('click', handleDocClick)
  window.addEventListener('resize', handleResize)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocClick)
  window.removeEventListener('resize', handleResize)
})

// ==================== toast ====================

const toast = reactive({ show: false, msg: '' })
let toastTimer: ReturnType<typeof setTimeout> | null = null
const showToast = (msg: string) => {
  toast.msg = msg
  toast.show = true
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toast.show = false
  }, 3000)
}

</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.wrap {
  display: flex;
  flex-flow: row nowrap;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}

.btn {
  display: inline-flex;
  flex-flow: row nowrap;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid var(--color-primary-alpha-300);
  background-color: transparent;
  color: var(--color-font);
  font-size: 12px;
  line-height: 1.4;
  cursor: pointer;
  opacity: .75;
  transition: opacity @transition-fast;
  user-select: none;

  &:hover,
  &.active {
    opacity: 1;
    border-color: var(--color-primary);
  }
  &.active {
    color: var(--color-primary);
  }
}
.btnLabel {
  color: var(--color-font-label);
}
.btnValue {
  font-weight: bold;
}

.loading {
  color: var(--color-primary);
}

.panel {
  position: absolute;
  z-index: 100;
  min-width: 140px;
  max-width: 240px;
  background-color: var(--color-content-background);
  border-radius: 6px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, .25);
  padding: 6px 0;
  color: var(--color-font);
}
.panelTitle {
  padding: 6px 12px;
  font-size: 12px;
  color: var(--color-font-label);
  border-bottom: 1px solid var(--color-primary-alpha-100);
  margin-bottom: 4px;
}
.panelList {
  max-height: 260px;
  overflow-y: auto;
  padding: 0 4px;
}
.item {
  display: flex;
  flex-flow: row nowrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 6px 10px;
  border: none;
  background-color: transparent;
  color: var(--color-font);
  font-size: 13px;
  line-height: 1.4;
  border-radius: 4px;
  cursor: pointer;
  text-align: left;

  &:hover:not(:disabled) {
    background-color: var(--color-primary-background-hover);
  }
}
.itemCurrent {
  color: var(--color-primary);
  font-weight: bold;
}
.itemDisabled {
  opacity: .4;
  cursor: not-allowed;
}
.itemName {
  flex: auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.itemSize {
  flex: none;
  font-size: 11px;
  color: var(--color-font-label);
}
.itemStatus {
  flex: none;
  font-size: 11px;
}
.statusCurrent {
  color: var(--color-primary);
}
.statusChecking {
  color: var(--color-font-label);
}
.statusUnavailable {
  color: var(--color-font-label);
}
.statusAvailable {
  color: var(--color-primary);
}
.panelEmpty {
  padding: 10px 12px;
  font-size: 12px;
  color: var(--color-font-label);
}

.toast {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 101;
  max-width: 80%;
  padding: 8px 14px;
  border-radius: 6px;
  background-color: var(--color-content-background);
  border: 1px solid var(--color-primary-alpha-300);
  color: var(--color-font);
  font-size: 13px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, .2);
}
</style>
