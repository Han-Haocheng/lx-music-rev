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
          <div :class="$style.advancedLabel">{{ $t("player__volume_output_device") }}</div>
          <base-selection
            :class="$style.deviceSelection"
            :list="outputDevices"
            item-key="deviceId"
            item-name="label"
            :value="appSetting['player.mediaDeviceId']"
            @change="handleOutputDeviceChange"
          />
        </div>

      </div>
    </template>
  </material-popup-btn>
</template>

<script setup>
import { computed, ref, onMounted } from '@common/utils/vueTools'
import { saveVolumeIsMute, appSetting, saveMediaDeviceId } from '@renderer/store/setting'
import { setMediaDeviceId } from '@renderer/plugins/player'
import { volume, isMute } from '@renderer/store/player/volume'

const handleWheel = (event) => {
  window.app_event.setVolume(Math.round(volume.value * 100 + (-event.deltaY / 100 * 2)) / 100)
}

const handleUpdateVolume = (val) => {
  window.app_event.setVolume(val)
}

// ===== 高级音量设置：音频输出设备切换 =====
const outputDevices = ref<Array<{ deviceId: string, label: string }>>([])
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

const handleOutputDeviceChange = (deviceId: string) => {
  if (!deviceId) return
  void saveMediaDeviceId(deviceId)
  void setMediaDeviceId(deviceId)
}

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

.advancedLabel {
  font-size: 12px;
  color: var(--color-font-label);
  margin-bottom: 6px;
}

.deviceSelection {
  width: 100%;
}

.advanced {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--color-primary-alpha-500);
}

.advancedLabel {
  font-size: 12px;
  color: var(--color-font-label);
  margin-bottom: 6px;
}

.deviceSelection {
  width: 100%;
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
  width: 140px;
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
