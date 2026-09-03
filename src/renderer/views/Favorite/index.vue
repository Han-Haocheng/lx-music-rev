<template>
  <div id="favorite" :class="$style.container">
    <header :class="$style.header">
      <h2 :class="$style.title">{{ $t('favorite') }}</h2>
    </header>
    <MusicList :list-id="LOVE_ID" />
  </div>
</template>

<script>
import MusicList from '../List/MusicList/index.vue'
import { LIST_IDS } from '@common/constants'

export default {
  name: 'Favorite',
  components: {
    MusicList,
  },
  data() {
    return {
      LOVE_ID: LIST_IDS.LOVE,
    }
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
}
.header {
  flex: none;
  display: flex;
  align-items: center;
  height: 56px;
  padding: 0 20px;
  border-bottom: var(--color-list-header-border-bottom);
}
.title {
  font-size: 16px;
  color: var(--color-font);
}
</style>
