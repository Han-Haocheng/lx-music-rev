<template>
  <Teleport to="#root">
    <transition name="play-queue-fade">
      <div v-if="show" :class="$style.wrap" @click.self="handleClose">
        <div :class="$style.panel">
          <div :class="$style.header">
            <span :class="$style.title">{{ $t('playlist') }}</span>
            <button :class="$style.headerBtn" :aria-label="$t('playlist_clear')" @click="handleClearPlaylist">
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="14" viewBox="0 0 1024 1024" space="preserve">
                <use xlink:href="#icon-delete" />
              </svg>
            </button>
            <button :class="$style.headerBtn" :aria-label="$t('close')" @click="handleClose">
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="16" viewBox="0 0 24 24" space="preserve">
                <use xlink:href="#icon-close" />
              </svg>
            </button>
          </div>
          <div :class="$style.content">
            <p v-if="!list.length" :class="$style.empty">{{ $t('playlist_empty_tip') }}</p>
            <base-virtualized-list
              v-if="list.length" ref="listRef" v-slot="{ item, index }" :list="displayList"
              key-name="id" :item-height="44" container-class="scroll" content-class="list"
            >
              <div
                :class="[$style.row, { [$style.active]: isActiveIndex(index) }]"
                @click="handlePlay(index)"
              >
                <div :class="$style.index">
                  <svg v-if="isActiveIndex(index)" version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="14" viewBox="0 0 512 512" space="preserve">
                    <use xlink:href="#icon-play-outline" />
                  </svg>
                  <span v-else>{{ index + 1 }}</span>
                </div>
                <div :class="$style.info">
                  <p :class="$style.name" :aria-label="item.name">{{ item.name }}</p>
                  <p :class="$style.singer" :aria-label="item.singer">{{ item.singer }}</p>
                </div>
                <button :class="$style.removeBtn" :aria-label="$t('list__remove')" @click.stop="handleRemove(index)">
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="14" viewBox="0 0 212.982 212.982" space="preserve">
                    <use xlink:href="#icon-delete" />
                  </svg>
                </button>
              </div>
            </base-virtualized-list>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script>
import { computed, ref, watch, nextTick } from '@common/utils/vueTools'
import { playInfo, playMusicInfo } from '@renderer/store/player/state'
import { getPlayList, setPlayListSnapshot, persistPlayQueue } from '@renderer/store/player/action'
import { playList, playNext } from '@renderer/core/player'
import { dialog } from '@renderer/plugins/Dialog'

export default {
  name: 'PlayQueue',
  props: {
    show: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['close'],
  setup(props, { emit }) {
    const listRef = ref(null)
    // 播放队列：快照优先（收藏分组等子集视图播放时显示分组内歌曲），否则按列表实时取整表
    const list = computed(() => (playInfo.playerListId ? getPlayList(playInfo.playerListId) : []))

    // 虚拟列表的数据源：将原始列表扁平化为 [{ id, name, singer, raw }]，id 供 key 使用，raw 供操作回查
    const displayList = computed(() => list.value.map(item => {
      const musicInfo = getRealMusicInfo(item)
      return {
        id: musicInfo.id,
        name: musicInfo.name,
        singer: musicInfo.singer,
        raw: item,
      }
    }))

    const isActiveIndex = (index) => !playMusicInfo.isTempPlay && playInfo.playIndex === index

    const getRealMusicInfo = (item) => ('progress' in item ? item.metadata.musicInfo : item)

    const handleClose = () => {
      emit('close')
    }

    const handlePlay = (index) => {
      const listId = playInfo.playerListId
      if (!listId) return
      // 在队列内点播：以当前队列恢复播放（避免重新固化导致队列内容丢失）
      playList(listId, index, list.value)
      handleClose()
    }

    // 播放列表是独立会话队列：移除（或清空）只影响队列本身，不读写收藏/试听等任何持久列表
    const handleRemove = (index) => {
      const listId = playInfo.playerListId
      if (!listId || !list.value.length) return
      const isCurrent = !playMusicInfo.isTempPlay && index === playInfo.playIndex
      const newList = list.value.filter((_, i) => i != index)
      setPlayListSnapshot(newList)
      persistPlayQueue()
      if (isCurrent) void playNext(true)
    }

    // 清空当前会话队列（区别于仅清空已播记录）：纯队列操作，不影响收藏/试听等任何持久列表；
    // 清空不可逆且曾误触全量删除，故二次确认；清空后保持面板打开，直接显示空态以便确认结果
    const handleClearPlaylist = async() => {
      if (!playInfo.playerListId) return
      const isConfirm = await dialog.confirm({
        message: window.i18n.t('playlist_clear_confirm'),
        cancelButtonText: window.i18n.t('cancel_button_text'),
        confirmButtonText: window.i18n.t('confirm_button_text'),
      })
      if (!isConfirm) return
      setPlayListSnapshot([])
      persistPlayQueue()
    }

    const handleLocate = () => {
      if (!props.show || playMusicInfo.isTempPlay || playInfo.playIndex < 0) return
      if (!list.value.length) return
      // 弹层面板整体处于 v-if="show" 下，watch(pre) 触发时 DOM 尚未挂载，需等一次 nextTick 拿到 listRef
      // 之后直接设置 scrollTop 即可（content 高度由 list.length * 44 决定），无需等待虚拟列表首屏渲染
      void nextTick(() => {
        listRef.value?.scrollToIndex(playInfo.playIndex, 0, false)
      })
    }

    watch(() => props.show, (val) => {
      if (val) handleLocate()
    })

    return {
      listRef,
      list,
      displayList,
      isActiveIndex,
      getRealMusicInfo,
      handleClose,
      handlePlay,
      handleRemove,
      handleClearPlaylist,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.wrap {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
  background-color: rgba(0, 0, 0, .24);
}
.panel {
  position: fixed;
  right: 16px;
  bottom: 84px;
  width: 360px;
  height: 60vh;
  display: flex;
  flex-flow: column nowrap;
  overflow: hidden;
  background-color: var(--color-content-background);
  border-radius: @radius-border;
  box-shadow: 0 8px 24px rgba(0, 0, 0, .3);
}
.header {
  flex: none;
  display: flex;
  align-items: center;
  height: 40px;
  padding: 0 12px;
  border-bottom: var(--color-list-header-border-bottom);
}
.title {
  flex: auto;
  font-size: 13px;
  color: var(--color-font);
}
.headerBtn {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin-left: 6px;
  padding: 0;
  background: none;
  border: none;
  outline: none;
  border-radius: 50%;
  cursor: pointer;
  color: var(--color-font-label);
  opacity: .6;
  transition: opacity @transition-normal;
  &:hover {
    opacity: 1;
  }
}
.content {
  flex: auto;
  min-height: 0;
  display: flex;
  flex-flow: column nowrap;
  // 滚动由 base-virtualized-list 容器承担（其自带 height:100%; overflow-y:auto）
}
.empty {
  padding: 24px 0;
  text-align: center;
  font-size: 13px;
  color: var(--color-font-label);
}
.row {
  display: flex;
  align-items: center;
  height: 44px;
  padding: 0 12px;
  cursor: pointer;
  transition: background-color @transition-fast;
  &:hover {
    background-color: var(--color-button-background-hover);
    .removeBtn {
      opacity: .8;
    }
  }
  &.active {
    color: var(--color-primary);
  }
}
.index {
  flex: none;
  width: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--color-font-label);
}
.info {
  flex: auto;
  min-width: 0;
  margin-left: 10px;
}
.name {
  .mixin-ellipsis-1();
  font-size: 13px;
  line-height: 1.4;
  color: inherit;
}
.singer {
  .mixin-ellipsis-1();
  font-size: 11px;
  line-height: 1.4;
  color: var(--color-font-label);
}
.removeBtn {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin-left: 6px;
  padding: 0;
  background: none;
  border: none;
  outline: none;
  cursor: pointer;
  color: var(--color-font-label);
  opacity: 0;
  transition: opacity @transition-fast;
  &:hover {
    color: var(--color-primary);
  }
}
</style>

<style lang="less">
.play-queue-fade-enter-active,
.play-queue-fade-leave-active {
  transition: opacity .2s ease;
}
.play-queue-fade-enter-from,
.play-queue-fade-leave-to {
  opacity: 0;
}
</style>
