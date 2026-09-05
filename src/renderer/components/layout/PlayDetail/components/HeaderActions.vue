<template>
  <div :class="$style.actions">
    <button type="button" :class="$style.btn" :aria-label="$t('player__add_music_to')" :title="$t('player__add_music_to')" @click="addMusicTo">
      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="60%" viewBox="0 0 512 512" space="preserve">
        <use xlink:href="#icon-add-2" />
      </svg>
    </button>
    <button v-show="appSetting['download.enable']" type="button" :class="$style.btn" :aria-label="$t('list__download')" :title="$t('list__download')" @click="download">
      <svg v-once version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="60%" viewBox="0 0 475.078 475.077" space="preserve">
        <use xlink:href="#icon-download" />
      </svg>
    </button>
    <button type="button" :class="$style.btn" :aria-label="$t('playlist')" :title="$t('playlist')" @click="isShowPlayQueue = true">
      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="60%" viewBox="0 0 24 24" space="preserve">
        <use xlink:href="#icon-playlist" />
      </svg>
    </button>
    <common-list-add-modal v-model:show="isShowAddMusicTo" :music-info="playMusicInfo.musicInfo" />
    <common-download-modal v-model:show="isShowDownload" :music-info="playMusicInfo.musicInfo" />
    <play-queue :show="isShowPlayQueue" @close="isShowPlayQueue = false" />
  </div>
</template>

<script>
import { ref } from '@common/utils/vueTools'
import { musicInfo, playMusicInfo } from '@renderer/store/player/state'
import { appSetting } from '@renderer/store/setting'
import PlayQueue from '../../PlayBar/PlayQueue.vue'

export default {
  name: 'PlayDetailHeaderActions',
  components: {
    PlayQueue,
  },
  setup() {
    const isShowAddMusicTo = ref(false)
    const isShowDownload = ref(false)
    const isShowPlayQueue = ref(false)
    const addMusicTo = () => {
      if (!musicInfo.id) return
      isShowAddMusicTo.value = true
    }
    const download = () => {
      if (!musicInfo.id || musicInfo.source === 'local') return
      isShowDownload.value = true
    }
    return {
      appSetting,
      isShowAddMusicTo,
      isShowDownload,
      isShowPlayQueue,
      addMusicTo,
      download,
      playMusicInfo,
    }
  },
}
</script>

<style lang="less" module>
.actions {
  display: flex;
  flex-flow: row nowrap;
  align-items: center;
  gap: 8px;
}
.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  background: transparent;
  border: none;
  color: var(--color-button-font);
  cursor: pointer;
  opacity: 0.8;
  &:hover {
    opacity: 1;
    color: var(--color-primary);
  }
}
</style>
