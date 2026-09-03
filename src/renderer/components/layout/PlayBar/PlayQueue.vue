<template>
  <Teleport to="#root">
    <transition name="play-queue-fade">
      <div v-if="show" :class="$style.wrap" @click.self="handleClose">
        <div :class="$style.panel">
          <div :class="$style.header">
            <span :class="$style.title">{{ $t('playlist') }}</span>
            <button :class="$style.headerBtn" :aria-label="$t('playlist_clear_played')" @click="handleClearPlayed">
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="16" viewBox="0 0 512 512" space="preserve">
                <use xlink:href="#icon-eraser" />
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
import { useI18n } from '@renderer/plugins/i18n'
import { playInfo, playMusicInfo } from '@renderer/store/player/state'
import { getList, clearPlayedList } from '@renderer/store/player/action'
import { playList, playNext } from '@renderer/core/player'
import { removeListMusics } from '@renderer/store/list/action'
import { LIST_IDS } from '@common/constants'
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
    const t = useI18n()
    const listRef = ref(null)
    const list = computed(() => (playInfo.playerListId ? getList(playInfo.playerListId) : []))

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
    const displayName = (item) => getRealMusicInfo(item).name

    const handleClose = () => {
      emit('close')
    }

    const handlePlay = (index) => {
      const listId = playInfo.playerListId
      if (!listId) return
      playList(listId, index)
      handleClose()
    }

    const handleRemove = async(index) => {
      const listId = playInfo.playerListId
      const item = list.value[index]
      if (!listId || !item) return
      // 对持久列表（我的收藏/用户列表/试听）删除前二次确认，避免误删源列表歌曲
      const isPersistent = listId != LIST_IDS.TEMP && listId != LIST_IDS.DOWNLOAD
      if (isPersistent) {
        const isConfirm = await dialog.confirm({
          message: t('playlist_remove_confirm', { name: displayName(item) }),
          cancelButtonText: t('cancel_button_text'),
          confirmButtonText: t('confirm_button_text'),
        })
        if (!isConfirm) return
      }
      void removeListMusics({ listId, ids: [getRealMusicInfo(item).id] })
      if (!playMusicInfo.isTempPlay && index === playInfo.playIndex) void playNext(true)
    }

    const handleClearPlayed = () => {
      clearPlayedList()
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
      displayName,
      handleClose,
      handlePlay,
      handleRemove,
      handleClearPlayed,
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
  max-height: 60vh;
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
