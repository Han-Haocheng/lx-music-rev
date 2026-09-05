<template>
  <div :class="$style.list">
    <div class="thead">
      <table>
        <thead>
          <tr v-if="actionButtonsVisible">
            <th class="num" style="width: 5%;">#</th>
            <th class="nobreak" :class="sortThCls('name')" @click="handleHeaderSortClick('name')">{{ $t('music_name') }}{{ sortThArrow('name') }}</th>
            <th class="nobreak" style="width: 22%;" :class="sortThCls('singer')" @click="handleHeaderSortClick('singer')">{{ $t('music_singer') }}{{ sortThArrow('singer') }}</th>
            <th class="nobreak" style="width: 22%;" :class="sortThCls('albumName')" @click="handleHeaderSortClick('albumName')">{{ $t('music_album') }}{{ sortThArrow('albumName') }}</th>
            <th class="nobreak" style="width: 9%;" :class="sortThCls('interval')" @click="handleHeaderSortClick('interval')">{{ $t('music_time') }}{{ sortThArrow('interval') }}</th>
            <th class="nobreak" style="width: 16%;">{{ $t('action') }}</th>
          </tr>
          <tr v-else>
            <th class="num" style="width: 5%;">#</th>
            <th class="nobreak" :class="sortThCls('name')" @click="handleHeaderSortClick('name')">{{ $t('music_name') }}{{ sortThArrow('name') }}</th>
            <th class="nobreak" style="width: 25%;" :class="sortThCls('singer')" @click="handleHeaderSortClick('singer')">{{ $t('music_singer') }}{{ sortThArrow('singer') }}</th>
            <th class="nobreak" style="width: 28%;" :class="sortThCls('albumName')" @click="handleHeaderSortClick('albumName')">{{ $t('music_album') }}{{ sortThArrow('albumName') }}</th>
            <th class="nobreak" style="width: 10%;" :class="sortThCls('interval')" @click="handleHeaderSortClick('interval')">{{ $t('music_time') }}{{ sortThArrow('interval') }}</th>
          </tr>
        </thead>
      </table>
    </div>
    <div v-show="list.length" ref="dom_listContent" :class="[$style.content, switchFlip ? $style.enterA : $style.enterB]">
      <base-virtualized-list
        v-if="actionButtonsVisible" ref="listRef" v-slot="{ item, index }" :list="list" key-name="id"
        :item-height="listItemHeight" container-class="scroll" content-class="list"
        @scroll="saveListPosition" @contextmenu.capture="handleListRightClick"
      >
        <div
          class="list-item" :class="[{ [$style.active]: playerInfo.isPlayList && playerInfo.playIndex === index }, { selected: selectedIndex == index || rightClickSelectedIndex == index }, { active: selectedSet.has(item) }, { disabled: !assertApiSupport(item.source) }]"
          :data-index="index"
          @click="handleListItemClick($event, index)" @contextmenu="handleListItemRightClick($event, index)"
        >
          <div class="list-item-cell no-select" :class="[$style.num, { 'drag-handle': allowCustomSort }]" style="flex: 0 0 5%;">
            <transition name="play-active">
              <div v-if="playerInfo.isPlayList && playerInfo.playIndex === index" :class="$style.playIcon">
                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="50%" viewBox="0 0 512 512" space="preserve">
                  <use xlink:href="#icon-play-outline" />
                </svg>
              </div>
              <div v-else class="num">{{ index + 1 }}</div>
            </transition>
          </div>
          <div class="list-item-cell auto name" :aria-label="item.name">
            <span class="select name">{{ item.name }}</span>
            <span v-if="isShowSource" class="no-select label-source">{{ item.source }}</span>
          </div>
          <div class="list-item-cell" style="flex: 0 0 22%;"><span class="select" :aria-label="item.singer">{{ item.singer }}</span></div>
          <div class="list-item-cell" style="flex: 0 0 22%;"><span class="select" :aria-label="item.meta.albumName">{{ item.meta.albumName }}</span></div>
          <div class="list-item-cell" style="flex: 0 0 9%;"><span class="no-select">{{ item.interval || '--/--' }}</span></div>
          <div class="list-item-cell" style="flex: 0 0 16%; padding-left: 0; padding-right: 0;">
            <material-list-buttons :index="index" :download-btn="assertApiSupport(item.source) && item.source != 'local'" @btn-click="handleListBtnClick" />
          </div>
        </div>
      </base-virtualized-list>
      <base-virtualized-list
        v-else ref="listRef" v-slot="{ item, index }" :list="list" key-name="id"
        :item-height="listItemHeight" container-class="scroll" content-class="list"
        @scroll="saveListPosition" @contextmenu.capture="handleListRightClick"
      >
        <div
          class="list-item"
          :class="[{ [$style.active]: playerInfo.isPlayList && playerInfo.playIndex === index }, { selected: selectedIndex == index || rightClickSelectedIndex == index }, { active: selectedSet.has(item) }, { disabled: !assertApiSupport(item.source) }]"
          :data-index="index"
          @click="handleListItemClick($event, index)" @contextmenu="handleListItemRightClick($event, index)"
        >
          <div class="list-item-cell no-select" :class="[$style.num, { 'drag-handle': allowCustomSort }]" style="flex: 0 0 5%;">
            <transition name="play-active">
              <div v-if="playerInfo.isPlayList && playerInfo.playIndex === index" :class="$style.playIcon">
                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="50%" viewBox="0 0 512 512" space="preserve">
                  <use xlink:href="#icon-play-outline" />
                </svg>
              </div>
              <div v-else class="num">{{ index + 1 }}</div>
            </transition>
          </div>
          <div class="list-item-cell auto name">
            <span class="select name" :aria-label="item.name">{{ item.name }}</span>
            <span v-if="isShowSource" class="no-select label-source">{{ item.source }}</span>
          </div>
          <div class="list-item-cell" style="flex: 0 0 25%;"><span class="select" :aria-label="item.singer">{{ item.singer }}</span></div>
          <div class="list-item-cell" style="flex: 0 0 28%;"><span class="select" :aria-label="item.meta.albumName">{{ item.meta.albumName }}</span></div>
          <div class="list-item-cell" style="flex: 0 0 10%;"><span class="no-select">{{ item.interval || '--/--' }}</span></div>
        </div>
      </base-virtualized-list>
    </div>
    <div v-show="!list.length" :class="$style.noItem">
      <p v-if="isLocalNoScanFolder" :class="$style.localHint">{{ $t('local_music__scan_hint') }}</p>
      <p v-else v-text="$t('no_item')" />
    </div>
    <common-list-add-modal
      v-model:show="isShowListAdd" :from-list-id="listId"
      :music-info="selectedAddMusicInfo" :exclude-list-id="excludeListIds" teleport="#view"
    />
    <material-favorite-group-select-modal
      v-model:show="isShowFavoriteGroupAdd" :music-info="selectedAddMusicInfo"
      teleport="#view" @add-to-user-list="handleFavoriteGroupModalAddToList"
    />
    <common-list-add-multiple-modal
      v-model:show="isShowListAddMultiple" :from-list-id="listId"
      :music-list="selectedList" :exclude-list-id="excludeListIds" teleport="#view" @confirm="removeAllSelect"
    />
    <common-download-modal v-model:show="isShowDownload" :music-info="selectedDownloadMusicInfo" teleport="#view" :list-id="listId" />
    <common-download-multiple-modal v-model:show="isShowDownloadMultiple" :list="selectedList" teleport="#view" :list-id="listId" @confirm="removeAllSelect" />
    <search-list :list="list" :visible="isShowSearchBar" @action="handleMusicSearchAction" />
    <music-toggle-modal v-model:show="isShowMusicToggleModal" :music-info="selectedToggleMusicInfo" @toggle="toggleSource" />
    <base-menu v-model="isShowItemMenu" :menus="menus" :xy="menuLocation" item-name="name" @menu-click="handleMenuClick" />
  </div>
</template>

<script>
import { clipboardWriteText } from '@common/utils/electron'
import { assertApiSupport } from '@renderer/store/utils'
import SearchList from './components/SearchList.vue'
import MusicToggleModal from './components/MusicToggleModal.vue'
import useListInfo from './useListInfo'
import useList from './useList'
import useMenu from './useMenu'
import usePlay from './usePlay'
import useMusicDownload from './useMusicDownload'
import useMusicAdd from './useMusicAdd'
import useSort, { useRowDragSort } from './useSort'
import useMusicActions from './useMusicActions'
import useSearch from './useSearch'
import useListScroll from './useListScroll'
import useMusicToggle from './useMusicToggle'
import { nextTick, ref, watch, computed } from '@common/utils/vueTools'
import { appSetting } from '@renderer/store/setting'
import { LOCAL_LIST_ID } from '@renderer/store/localList'
import { getSortScheme } from '@renderer/store/list/sortScheme'
export default {
  name: 'MusicList',
  components: {
    SearchList,
    MusicToggleModal,
  },
  props: {
    listId: {
      type: String,
      required: true,
    },
    musicList: {
      type: Array,
      default: null,
    },
    // 滚动位置存储键：不传按 listId 存取；收藏分组视图按视图切换传入，避免各视图滚动位置互相污染
    scrollKey: {
      type: String,
      default: null,
    },
    /**
     * 是否允许自定义排序（表头持久排序/拖拽）：我的列表/收藏等为 true；
     * 收藏分组视图（music-list 模式）为 false，防排序错写 LOVE 整表
     */
    allowCustomSort: {
      type: Boolean,
      default: true,
    },
    groupActionsVisible: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['show-menu', 'group-modal'],
  setup(props, { emit }) {
    const actionButtonsVisible = appSetting['list.actionButtonsVisible']

    let scrollIndex = null
    let isAnimation = false
    const handleRestoreScroll = (_scrollIndex, _isAnimation) => {
      scrollIndex = _scrollIndex
      isAnimation = _isAnimation
      if (isAnimation) void restoreScroll(scrollIndex, isAnimation)
      // console.log('handleRestoreScroll', scrollIndex, isAnimation)
    }
    const onLoadedList = () => {
      // console.log('restoreScroll', scrollIndex, isAnimation)
      void restoreScroll(scrollIndex, isAnimation)
    }

    const {
      rightClickSelectedIndex,
      selectedIndex,
      dom_listContent,
      listRef,
      list,
      playerInfo,
      setSelectedIndex,
      isShowSource,
      excludeListIds,
    } = useListInfo({ props, onLoadedList })

    // 列表切换入场动画：双动画类交替重放（A/B 同款 keyframes，切换类名即重新触发，
    // 无需重挂载虚拟列表；动画起始 opacity 0 恰好遮蔽新旧内容的替换帧，消除硬切感）
    const switchFlip = ref(false)
    watch(() => props.listId, () => {
      switchFlip.value = !switchFlip.value
    })
    watch(() => props.musicList, () => {
      switchFlip.value = !switchFlip.value
    })

    const {
      selectedList,
      selectedSet,
      listItemHeight,
      handleSelectData,
      removeAllSelect,
    } = useList({ listRef, list })

    const {
      handlePlayMusic,
      handlePlayMusicLater,
      doubleClickPlay,
    } = usePlay({ props, selectedList, list, removeAllSelect })

    const {
      isShowListAdd,
      isShowListAddMultiple,
      selectedAddMusicInfo,
      handleShowMusicAddModal,
    } = useMusicAdd({ selectedList, list })

    const isShowFavoriteGroupAdd = ref(false)
    const handleShowMusicFavoriteGroupModal = (index) => {
      selectedAddMusicInfo.value = list.value[index]
      void nextTick(() => {
        isShowFavoriteGroupAdd.value = true
      })
    }
    const handleFavoriteGroupModalAddToList = () => {
      isShowFavoriteGroupAdd.value = false
      void nextTick(() => {
        isShowListAdd.value = true
      })
    }

    const {
      isShowDownload,
      isShowDownloadMultiple,
      selectedDownloadMusicInfo,
      handleShowDownloadModal,
    } = useMusicDownload({ selectedList, list })

    const { handleHeaderSort, commitDragOrder, isSorting } = useSort({ props, list })

    // 行拖拽排序：仅在允许自定义排序且表头排序空闲时启用（与表头排序共用互斥锁）
    const dragEnabled = computed(() => props.allowCustomSort && !isSorting.value)
    useRowDragSort({
      listRef,
      list,
      selectedList,
      selectedSet,
      enabled: dragEnabled,
      onCommit: commitDragOrder,
    })

    // 本地音乐且未配置扫描文件夹：列表空态显示引导提示
    const isLocalNoScanFolder = computed(() => props.listId == LOCAL_LIST_ID && !appSetting['local.scanFolders'].length)

    // 表头排序状态（活动列与方向指示）
    // 注：样式走 :global 类（setup 作用域拿不到 $style，模板同理需 props.xxx 显式取值）
    const sortSchemeInfo = computed(() => getSortScheme(props.listId))
    const sortThCls = (field) => {
      const base = props.allowCustomSort ? 'th-sortable' : null
      return [base, sortSchemeInfo.value.sortType == field ? 'th-sort-active' : null]
    }
    const sortThArrow = (field) => {
      if (sortSchemeInfo.value.sortType != field) return ''
      return sortSchemeInfo.value.sortOrder == 'desc' ? ' ▼' : ' ▲'
    }
    const handleHeaderSortClick = (field) => {
      void handleHeaderSort(field)
    }

    const {
      handleShowMusicToggleModal,
      isShowMusicToggleModal,
      selectedToggleMusicInfo,
      toggleSource,
    } = useMusicToggle(props, list)

    const {
      handleSearch,
      handleOpenMusicDetail,
      handleCopyName,
      handleDislikeMusic,
      handleRemoveMusic,
    } = useMusicActions({ props, list, removeAllSelect, selectedList })

    const {
      menus,
      menuLocation,
      isShowItemMenu,
      showMenu,
      menuClick,
    } = useMenu({
      assertApiSupport,
      emit,
      showGroupAction: props.groupActionsVisible,

      handlePlayMusicLater,
      handleShowMusicToggleModal,
      handleSearch,
      handleOpenMusicDetail,
      handleCopyName,
      handleDislikeMusic,
      handleRemoveMusic,
      handleGroupAction: (index) => {
        const musicList = selectedList.value.length ? [...selectedList.value] : [list.value[index]]
        emit('group-modal', musicList)
      },
    })

    const {
      isShowSearchBar,
      searchList,
      handleMusicSearchAction,
    } = useSearch({
      setSelectedIndex,
      handlePlayMusic,
      listRef,
    })

    const { saveListPosition, restoreScroll } = useListScroll({ props, listRef, list, handleRestoreScroll })


    const handleListItemClick = (event, index) => {
      if (rightClickSelectedIndex.value > -1) return
      handleSelectData(index)
      doubleClickPlay(index)
    }
    const handleListItemRightClick = (event, index) => {
      rightClickSelectedIndex.value = index
      showMenu(event, list.value[index], index)
    }
    const handleMenuClick = (action) => {
      let index = rightClickSelectedIndex.value
      rightClickSelectedIndex.value = -1
      menuClick(action, index)
    }
    const handleListRightClick = (event) => {
      if (!event.target.classList.contains('select')) return
      event.stopImmediatePropagation()
      let classList = dom_listContent.value.classList
      classList.add('copying')
      window.requestAnimationFrame(() => {
        let str = window.getSelection().toString()
        classList.remove('copying')
        str = str.split(/\n\n/).map(s => s.replace(/\n/g, '  ')).join('\n').trim()
        if (!str.length) return
        clipboardWriteText(str)
      })
    }
    const handleListBtnClick = ({ action, index }) => {
      switch (action) {
        case 'download':
          handleShowDownloadModal(index, true)
          break
        case 'play':
          handlePlayMusic(index, true)
          break
        case 'search':
          handleSearch(index)
          break
        case 'listAdd':
          // 「添加到」直接打开目标列表弹窗（我的收藏 / 收藏分组），避免静默收藏无反馈
          handleShowMusicAddModal(index, true)
          break
        case 'listAddSelect':
          handleShowMusicFavoriteGroupModal(index)
          break
      }
    }
    const scrollToTop = () => {
      listRef.value.scrollTo(0, true)
    }

    return {
      listItemHeight,
      handleListItemClick,
      selectedList,
      selectedSet,
      handleListItemRightClick,
      removeAllSelect,
      handleListBtnClick,
      rightClickSelectedIndex,
      selectedIndex,
      dom_listContent,
      listRef,
      excludeListIds,

      menus,
      isShowItemMenu,
      menuLocation,
      handleMenuClick,

      handleListRightClick,
      assertApiSupport,

      isShowListAdd,
      isShowListAddMultiple,
      selectedAddMusicInfo,
      isShowFavoriteGroupAdd,
      handleFavoriteGroupModalAddToList,

      sortThCls,
      sortThArrow,
      handleHeaderSortClick,
      isLocalNoScanFolder,

      isShowDownload,
      isShowDownloadMultiple,
      selectedDownloadMusicInfo,

      scrollToTop,

      isShowSearchBar,
      searchList,
      handleMusicSearchAction,

      list,
      playerInfo,

      saveListPosition,
      isShowSource,
      handleRestoreScroll,

      actionButtonsVisible,
      switchFlip,

      isShowMusicToggleModal,
      selectedToggleMusicInfo,
      toggleSource,
    }
  },
}
</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.list {
  overflow: hidden;
  height: 100%;
  flex: auto;
  display: flex;
  flex-flow: column nowrap;

  :global(.list-item) {
    &.active {
      color: var(--color-button-font);
    }
  }
  :global {
    .label-source {
      color: var(--color-primary);
      padding: 5px;
      font-size: .8em;
      line-height: 1.2;
      opacity: .75;
      display: inline-block;
    }
  }
}
// 表头可排序/激活指示与拖拽预览类由 JS 动态拼到 th/行上，需全局可见
:global {
  .th-sortable {
    cursor: pointer;
    user-select: none;
    &:hover {
      color: var(--color-primary);
    }
  }
  .th-sort-active {
    color: var(--color-primary);
  }
  .list-item .drag-handle {
    cursor: grab;
  }
  // 拖拽中的行：ghostClass 由 SortableJS 加在被拖项 dragEl 自身（native 模式无克隆幽灵）。
  // 本列表结构下 dragEl 为虚拟列表的行包裹层（.list 的直接子元素），行内插槽根才是 .list-item，
  // 因此包裹层与行自身两种落点都要覆盖
  .row-drag-source .list-item,
  .list-item.row-drag-source {
    opacity: .35;
  }
  // 目标插入位高亮（类同样加在目标行自身）：插入到目标行之前（上边缘）/之后（下边缘）
  .list-item.row-drag-target {
    background-color: var(--color-primary-background-hover);
    box-shadow: inset 0 2px 0 var(--color-primary);
  }
  .list-item.row-drag-target-after {
    background-color: var(--color-primary-background-hover);
    box-shadow: inset 0 -2px 0 var(--color-primary);
  }
}
.num {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}
.playIcon {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;

  color: var(--color-button-font);
  opacity: .7;
}
.content {
  min-height: 0;
  font-size: 14px;
  display: flex;
  flex-flow: column nowrap;
  flex: auto;
}
@keyframes listSwitchEnterA {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: none; }
}
@keyframes listSwitchEnterB {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: none; }
}
.enterA { animation: listSwitchEnterA .22s ease-out both; }
.enterB { animation: listSwitchEnterB .22s ease-out both; }
@media (prefers-reduced-motion: reduce) {
  .enterA,
  .enterB { animation: none; }
}

.noItem {
  position: relative;
  height: 100%;
  display: flex;
  flex-flow: column nowrap;
  justify-content: center;
  align-items: center;

  p {
    font-size: 24px;
    color: var(--color-font-label);
  }
}
.localHint {
  font-size: 14px !important;
  line-height: 1.8;
  padding: 0 32px;
  text-align: center;
}

</style>
