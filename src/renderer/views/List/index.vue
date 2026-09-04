<template>
  <div id="my-list" :class="$style.container" @click="handleContainerClick">
    <MyList ref="myList" :list-id="listId" @show-menu="$refs.musicList.handleMenuClick()" />
    <MusicList ref="musicList" :list-id="listId" @show-menu="$refs.myList.handleMenuClick()" />
  </div>
</template>

<script>
import { getListPrevSelectId } from '@renderer/utils/data'
import { LIST_IDS } from '@common/constants'

import MyList from './MyList/index.vue'
import MusicList from './MusicList/index.vue'

export default {
  name: 'List',
  components: {
    MyList,
    MusicList,
  },
  async beforeRouteEnter(to, from, next) {
    let id = to.query.id
    if (!id) {
      id = await getListPrevSelectId()
      if (id == LIST_IDS.LOVE) {
        next({ path: '/favorite' })
        return
      }
      next({
        path: to.path,
        query: { id },
      })
    } else if (id == LIST_IDS.LOVE) {
      next({ path: '/favorite' })
    } else next()
  },
  beforeRouteUpdate(to, from) {
    // console.log(to, from)
    if (to.query.updated) return
    let id = to.query.id
    if (id == null) return
    if (id == LIST_IDS.LOVE) {
      this.$router.replace({ path: '/favorite' }).catch(_ => _)
      return
    }
    // if (!getList(id)) {
    //   id = defaultList.id
    // }
    this.listId = id
    const scrollIndex = to.query.scrollIndex
    const isAnimation = from.query.id == to.query.id
    this.$refs.musicList?.handleRestoreScroll(scrollIndex, isAnimation)

    return {
      path: '/list',
      query: { id, updated: true },
    }
  },
  beforeRouteLeave(to, from) {
    this.$refs.musicList?.saveListPosition()
  },
  data() {
    return {
      listId: null,
    }
  },
  created() {
    this.listId = this.$route.query.id
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.container {
  overflow: hidden;
  height: 100%;
  display: flex;
  position: relative;
}

</style>
