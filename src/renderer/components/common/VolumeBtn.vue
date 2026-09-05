<template>
  <material-popup-btn :class="$style.btnContent">
    <button :class="$style.btn" :aria-label="isMute ? $t('player__volume_muted') : `${$t('player__volume')}${parseInt(volume * 100)}%`" @wheel.passive="handleWheel">
      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" width="100%" viewBox="0 0 24 24" space="preserve">
        <use :xlink:href="icon" />
      </svg>
    </button>
    <template #content>
      <div :class="$style.setting">
        <div :class="$style.info">
          <span>{{ Math.trunc(volume * 100) }}%</span>
          <base-checkbox
            id="player__volume_mute"
            :model-value="isMute"
            :label="$t('player__volume_mute_label')"
            @update:model-value="saveVolumeIsMute($event)"
          />
        </div>
        <base-slider-bar :class="$style.slider" :value="volume" :min="0" :max="1" :step="0.01" @change="handleUpdateVolume" />
        <div :class="$style.advanced">
          <button :class="$style.advancedHeader" :aria-label="$t('player__volume_advanced')" @click="advancedExpanded = !advancedExpanded">
            <span>{{ $t('player__volume_advanced') }}</span>
            <svg :class="[$style.advancedArrow, { [$style.expanded]: advancedExpanded }]" version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" width="10" viewBox="0 0 451.847 451.847" space="preserve">
              <use xlink:href="#icon-right" />
            </svg>
          </button>
          <div v-show="advancedExpanded" :class="$style.advancedContent">
            <div :class="$style.advancedSection">
              <div :class="$style.advancedLabel">{{ $t('player__volume_playback_rate') }}<span :class="$style.rateValue">{{ playbackRate }}x</span></div>
              <base-slider-bar :class="$style.slider" :value="playbackRate" :min="0.5" :max="2" :step="0.05" @change="handlePlaybackRateChange" />
            </div>
            <div :class="$style.advancedSection">
              <div :class="$style.advancedLabel">{{ $t('player__volume_output_device') }}</div>
              <base-selection
                :class="$style.deviceSelection"
                :list="outputDevices"
                item-key="deviceId"
                item-name="label"
                :model-value="appSetting['player.mediaDeviceId']"
                @change="handleOutputDeviceChange"
              />
            </div>
            <base-tab v-model="seTab" :list="seTabs" />
            <div :class="$style.sePanel">
              <audio-convolution v-show="seTab == 'convolution'" />
              <biquad-filter v-show="seTab == 'eq'" />
              <audio-panner v-show="seTab == 'panner'" />
              <pitch-shifter v-show="seTab == 'pitch'" />
            </div>
          </div>
        </div>

      </div>
    </template>
  </material-popup-btn>
</template>

<script setup>
import { computed, ref, onMounted } from '@common/utils/vueTools'
import { saveVolumeIsMute, appSetting, saveMediaDeviceId, savePlaybackRate } from '@renderer/store/setting'
import { setMediaDeviceId } from '@renderer/plugins/player'
import { playbackRate, setPlaybackRate } from '@renderer/store/player/playbackRate'
import AudioConvolution from './SoundEffectBtn/AudioConvolution.vue'
import BiquadFilter from './SoundEffectBtn/BiquadFilter.vue'
import AudioPanner from './SoundEffectBtn/AudioPanner.vue'
import PitchShifter from './SoundEffectBtn/PitchShifter.vue'
import { volume, isMute } from '@renderer/store/player/volume'

const handleWheel = (event) => {
  window.app_event.setVolume(Math.round(volume.value * 100 + (-event.deltaY / 100 * 2)) / 100)
}

const handleUpdateVolume = (val) => {
  window.app_event.setVolume(val)
}

// ===== 高级设置：可折叠区（倍速 / 输出设备 / 音效） =====
const advancedExpanded = ref(false)
const outputDevices = ref([])
const refreshOutputDevices = async() => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    outputDevices.value = devices
      .filter(({ kind }) => kind == 'audiooutput')
      .map(({ deviceId, label }, i) => ({ deviceId, label: label || `${window.i18n.t('player__volume_output_device')} ${i + 1}` }))
  } catch {}
}
onMounted(() => {
  void refreshOutputDevices()
  navigator.mediaDevices?.addEventListener?.('devicechange', () => { void refreshOutputDevices() })
})

const handleOutputDeviceChange = (deviceId) => {
  if (!deviceId) return
  saveMediaDeviceId(deviceId)
  void setMediaDeviceId(deviceId)
}

const handlePlaybackRateChange = (rate) => {
  setPlaybackRate(rate)
  savePlaybackRate(rate)
}

// ===== 高级音效（音质/环绕声等，原详情页功能入口迁移至此） =====
const seTab = ref('eq')
const seTabs = [
  { id: 'eq', label: window.i18n.t('player__sound_effect_biquad_filter') },
  { id: 'convolution', label: window.i18n.t('player__sound_effect_convolution') },
  { id: 'panner', label: window.i18n.t('player__sound_effect_panner') },
  { id: 'pitch', label: window.i18n.t('player__sound_effect_pitch_shifter') },
]

const icon = computed(() => {
  return isMute.value
    ? '#icon-volume-mute-outline'
    : volume.value == 0
      ? '#icon-volume-off-outline'
      : volume.value < 0.3
        ? '#icon-volume-low-outline'
        : volume.value < 0.7
          ? '#icon-volume-medium-outline'
          : '#icon-volume-high-outline'
})

</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';
.btnContent {
  flex: none;
  height: 100%;
}


.advanced {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--color-primary-alpha-500);
}

.advancedHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0;
  background: transparent;
  border: none;
  font-size: 12px;
  color: var(--color-font-label);
  cursor: pointer;
  &:hover {
    color: var(--color-primary);
  }
}

.advancedArrow {
  transition: transform @transition-fast;
  transform: rotate(90deg);
  &.expanded {
    transform: rotate(270deg);
  }
}

.advancedContent {
  margin-top: 8px;
  display: flex;
  flex-flow: column nowrap;
  gap: 10px;
}

.advancedSection {
  display: flex;
  flex-flow: column nowrap;
  gap: 6px;
}

.rateValue {
  margin-left: 6px;
  color: var(--color-primary);
}

.sePanel {
  margin-top: 4px;
  width: 320px;
}

.btn {
  position: relative;
  // color: var(--color-button-font);
  justify-content: center;
  align-items: center;
  transition: color @transition-normal;
  cursor: pointer;
  background-color: transparent;
  border: none;
  width: 24px;
  display: flex;
  flex-flow: column nowrap;
  padding: 0;

  svg {
    width: 18px;
    height: 18px;
    transition: opacity @transition-fast;
    opacity: .6;
    filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.2));
  }
  &:hover {
    svg {
      opacity: .9;
    }
  }
  &:active {
    svg {
      opacity: 1;
    }
  }
}

.setting {
  display: flex;
  flex-flow: column nowrap;
  padding: 2px 3px;
  gap: 8px;
  width: 340px;
}

.info {
  display: flex;
  flex-flow: row nowrap;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  span {
    line-height: 1.2;
  }
}

.slider {
  width: 100%;
}

</style>
