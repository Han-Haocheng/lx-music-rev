<template>
  <div id="local-music" :class="$style.container">
    <header :class="$style.header">
      <button :class="$style.backBtn" :aria-label="$t('back_to_favorite')" @click="handleBack">
        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="14" viewBox="0 0 451.847 451.847" space="preserve">
          <use xlink:href="#icon-left" />
        </svg>
      </button>
      <h2 :class="$style.title">
        <svg-icon name="audio-wave" :class="$style.titleIcon" />
        {{ $t('local_music') }}
      </h2>
    </header>
    <div :class="$style.listWrap">
      <MusicList
        :list-id="LOCAL_LIST_ID"
        :scroll-key="LOCAL_LIST_ID"
        :allow-custom-sort="true"
      />
    </div>
  </div>
</template>

<script>
import { LOCAL_LIST_ID } from '@renderer/store/localList'
import MusicList from '../List/MusicList/index.vue'

export default {
  name: 'LocalMusic',
  components: {
    MusicList,
  },
  data() {
    return {
      LOCAL_LIST_ID,
    }
  },
  methods: {
    handleBack() {
      this.$router.back()
    },
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.container {
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-flow: column nowrap;
  position: relative;
}
.header {
  height: 40px;
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
}
.backBtn {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  background: transparent;
  border: none;
  color: var(--color-font);
  cursor: pointer;
  &:hover {
    color: var(--color-primary);
  }
}
.title {
  margin: 0;
  font-size: 15px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
}
.titleIcon {
  height: 14px;
}
.listWrap {
  flex: auto;
  overflow: hidden;
  min-height: 0;
}
</style>
