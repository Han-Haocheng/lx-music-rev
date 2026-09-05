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
          <base-tab v-model="seTab" :list="seTabs" />
          <div :class="$style.sePanel">
            <audio-convolution v-show="seTab == 'convolution'" />
            <biquad-filter v-show="seTab == 'eq'" />
            <audio-panner v-show="seTab == 'panner'" />
            <pitch-shifter v-show="seTab == 'pitch'" />
          </div>
        </div>

      </div>
    </template>
  </material-popup-btn>
</template>

<script setup>
import { computed, ref } from '@common/utils/vueTools'
import { saveVolumeIsMute } from '@renderer/store/setting'
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

.sePanel {
  margin-top: 8px;
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
