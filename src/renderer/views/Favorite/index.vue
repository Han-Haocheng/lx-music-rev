<template>
  <div id="favorite" :class="$style.container">
    <header :class="$style.header">
      <h2 :class="$style.title">{{ $t('favorite') }}</h2>
    </header>
    <div :class="$style.main">
      <div :class="$style.groupsWrap">
        <ul :class="['scroll', $style.groups]">
          <li
            :class="[$style.groupItem, { [$style.active]: showLocalMusic }]"
            :aria-label="$t('local_music')"
            @click="showLocalMusic = true"
          >
            <span :class="$style.groupLabel">
              <svg-icon name="audio-wave" :class="$style.localMusicIcon" />
              {{ $t('local_music') }}
            </span>
          </li>
          <!-- 全部收藏（LOVE 聚合视图）已移除：收藏以收藏夹为唯一容器，见 CHANGELOG -->
          <li
            v-for="group in favoriteGroups" :key="group.id"
            :class="[$style.groupItem, { [$style.active]: !showLocalMusic && currentGroupId == group.id, [$style.editing]: editingGroupId == group.id }]"
            :aria-label="group.name"
            @click="handleGroupClick(group)" @contextmenu.prevent="handleGroupRightClick(group, $event)"
          >
            <span v-if="group.source" :class="$style.groupSourceBadge" :title="$t('favorite_group_from_source', { name: getSourceName(group.source) })">{{ $t('favorite_group_from_source_badge') }}</span>
            <span :class="$style.groupLabel">{{ group.name }}</span>
            <span :class="$style.count">{{ groupCounts[group.id] ?? '' }}</span>
            <base-input :ref="el => setEditInputRef(group, el)" v-model="editingGroupName" :class="$style.groupEditInput" @keyup.enter="handleRenameGroup(group)" @blur="handleRenameGroup(group)" />
          </li>
        </ul>
        <p v-if="!favoriteGroups.length" :class="$style.emptyTip">{{ $t('favorite_group_empty') }}</p>
        <template v-if="!isShowNewGroup">
          <button :class="$style.newGroupBtn" :aria-label="$t('favorite_group_new')" @click="handleNewGroup">
            <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="14" viewBox="0 0 24 24" space="preserve">
              <use xlink:href="#icon-list-add" />
            </svg>
            <span>{{ $t('favorite_group_new') }}</span>
          </button>
        </template>
        <base-input v-else ref="newGroupInput" v-model="newGroupName" :class="$style.newGroupInput" :placeholder="$t('favorite_group_new_input')" @keyup.enter="handleSaveNewGroup" @blur="handleSaveNewGroup" />
      </div>
      <div :class="$style.listWrap">
        <!-- 无收藏夹时的空态列表：独立字面量滚动键，不复用历史 'favorite' 残留键（由 initData 清理） -->
        <MusicList
          :list-id="showLocalMusic ? LOCAL_LIST_ID : LOVE_ID"
          :music-list="showLocalMusic ? null : (currentGroupId == null ? emptyMusicList : groupMusicList)"
          :scroll-key="showLocalMusic ? LOCAL_LIST_ID : (currentGroupId ?? 'favgroup_empty')"
          :allow-custom-sort="showLocalMusic"
          :group-actions-visible="!showLocalMusic"
          @group-modal="handleGroupModal"
        />
      </div>
    </div>
    <music-group-modal v-model:show="isShowGroupModal" :music-list="groupModalMusicList" @close="isShowGroupModal = false" @changed="handleGroupModalChanged" />
    <base-menu v-model="isShowGroupMenu" :menus="groupMenus" :xy="groupMenuLocation" item-name="name" @menu-click="handleGroupMenuClick" />
  </div>
</template>

<script>
import { nextTick } from '@common/utils/vueTools'
import { LIST_IDS } from '@common/constants'
import { LOCAL_LIST_ID } from '@renderer/store/localList'
import { getListPositionInfo } from '@renderer/utils/ipc'
import { removeListPosition } from '@renderer/utils/data'
import MusicList from '../List/MusicList/index.vue'
import MusicGroupModal from './components/MusicGroupModal.vue'
import { favoriteGroups, initFavoriteGroups, getGroupMusics, removeFavoriteGroup, updateFavoriteGroup, addFavoriteGroup, clearGroupMusicsCache, syncFavoriteGroup, getMusicGroupIds, migrateOrphanMusics, FAVORITE_GROUP_DEFAULT_ID } from '@renderer/store/list/favoriteGroup'
import { playMusicInfo } from '@renderer/store/player/state'
import { appSetting } from '@renderer/store/setting'
import { getListMusics, getListMusicsFromCache } from '@renderer/store/list/action'
import { dialog } from '@renderer/plugins/Dialog'

export default {
  name: 'Favorite',
  components: {
    MusicList,
    MusicGroupModal,
  },
  data() {
    return {
      LOVE_ID: LIST_IDS.LOVE,
      LOCAL_LIST_ID,
      favoriteGroups,
      currentGroupId: null,
      showLocalMusic: false,
      loveListMusics: [],
      emptyMusicList: [],
      groupMusics: [],
      groupCounts: {},
      isShowNewGroup: false,
      newGroupName: '',
      editingGroupId: null,
      editingGroupName: '',
      isShowGroupModal: false,
      groupModalMusicList: [],
      isShowGroupMenu: false,
      groupMenuLocation: { x: 0, y: 0 },
      targetGroup: null,
    }
  },
  computed: {
    isLocalMusic() {
      return this.showLocalMusic
    },
    groupMusicList() {
      const set = new Set(this.groupMusics)
      return this.loveListMusics.filter(m => set.has(m.id))
    },
    groupMenus() {
      const menus = [
        { name: this.$t('favorite_group_rename'), action: 'rename' },
      ]
      if (this.targetGroup?.source) menus.push({ name: this.$t('favorite_group_sync'), action: 'sync' })
      menus.push({ name: this.$t('favorite_group_remove'), action: 'remove' })
      return menus
    },
  },
  watch: {
    currentGroupId() {
      void this.refreshGroupMusics()
    },
  },
  created() {
    void this.initData()
    window.app_event.on('myListUpdate', this.handleMyListUpdate)
  },
  beforeUnmount() {
    window.app_event.off('myListUpdate', this.handleMyListUpdate)
  },
  methods: {
    getSourceName(source) {
      const prefix = appSetting['common.sourceNameType'] == 'real' ? 'source_' : 'source_alias_'
      return window.i18n.t(prefix + source)
    },
    handleOpenLocalMusic() {
      // 本地音乐与收藏同页切换（不再打开新页面）
      this.showLocalMusic = true
      this.currentGroupId = null
    },
    handleGroupClick(group) {
      this.showLocalMusic = false
      this.currentGroupId = group.id
    },
    async handleSyncGroup(group) {
      const isConfirm = await dialog.confirm({
        message: this.$t('favorite_group_sync_confirm'),
        cancelButtonText: this.$t('cancel_button_text'),
        confirmButtonText: this.$t('confirm_button_text'),
      })
      if (!isConfirm) return
      try {
        const count = await syncFavoriteGroup(group.id)
        clearGroupMusicsCache(group.id)
        await this.initData()
        void dialog({ message: this.$t('favorite_group_sync_success', { num: count }) })
      } catch (err) {
        console.warn(err)
        void dialog({ message: this.$t('favorite_group_sync_failed') + (err?.message ? '\n' + err.message : '') })
      }
    },
    async initData() {
      clearGroupMusicsCache()
      await this.cleanListScrollResidues()
      await initFavoriteGroups()
      // 无容器孤儿歌曲（历史存量/整库恢复残留）自动归入默认兜底收藏夹「我的收藏」
      try {
        const migrated = await migrateOrphanMusics(this.$t('favorite_group_default'))
        if (migrated) await initFavoriteGroups()
      } catch (err) {
        console.warn('[favorite] 孤儿迁移失败，跳过:', err)
      }
      await this.refreshLoveList()
      await this.refreshGroupMusics()
      await this.selectInitialGroup()
    },
    // 清理列表滚动位置历史残留：'love'（旧「全部收藏」视图）、'favorite'（旧空态兜底键）、
    // 'userlist_*'（退役自建列表）与空态兜底键（仅空列表写入、值恒为 0，无恢复价值）
    async cleanListScrollResidues() {
      const map = await getListPositionInfo() ?? {}
      const legacyKeys = Object.keys(map).filter(key => key == LIST_IDS.LOVE || key == 'favorite' || key == 'favgroup_empty' || key.startsWith('userlist_'))
      if (!legacyKeys.length) return
      for (const key of legacyKeys) await removeListPosition(key)
    },
    // 首次进入/无选中时：播放中的收藏歌曲所属收藏夹优先，其次默认兜底收藏夹，最后第一个收藏夹
    async selectInitialGroup() {
      if (this.showLocalMusic || this.currentGroupId != null) return
      const playing = playMusicInfo
      if (playing.listId == LIST_IDS.LOVE && playing.musicInfo) {
        try {
          const groupIds = await getMusicGroupIds(playing.musicInfo.id)
          if (groupIds.length) {
            this.currentGroupId = groupIds[0]
            return
          }
        } catch (err) {
          console.warn('[favorite] 播放歌曲归属查询失败，跳过:', err)
        }
      }
      const defaultGroup = favoriteGroups.find(g => g.id == FAVORITE_GROUP_DEFAULT_ID)
      this.currentGroupId = (defaultGroup ?? favoriteGroups[0])?.id ?? null
    },
    async refreshLoveList() {
      await getListMusics(LIST_IDS.LOVE)
      this.loveListMusics = [...getListMusicsFromCache(LIST_IDS.LOVE)]
    },
    async refreshGroupMusics() {
      const counts = {}
      for (const group of this.favoriteGroups) {
        const ids = await getGroupMusics(group.id)
        counts[group.id] = ids.length
      }
      this.groupCounts = counts
      await this.loadCurrentGroupMusics()
    },
    async loadCurrentGroupMusics() {
      const groupId = this.currentGroupId
      if (groupId == null) {
        this.groupMusics = []
        return
      }
      const ids = await getGroupMusics(groupId)
      // 快速切换分组时丢弃过期结果
      if (this.currentGroupId == groupId) this.groupMusics = ids
    },
    handleMyListUpdate(ids) {
      if (!ids.includes(LIST_IDS.LOVE)) return
      // LOVE 列表变更后映射可能残留旧 id（配合主进程孤儿映射清理），先失效缓存再重查
      clearGroupMusicsCache()
      void this.refreshLoveList()
      void this.refreshGroupMusics()
    },
    handleNewGroup() {
      this.isShowNewGroup = true
      this.newGroupName = ''
      void nextTick(() => {
        this.$refs.newGroupInput?.focus?.()
      })
    },
    async handleSaveNewGroup() {
      if (!this.isShowNewGroup) return
      this.isShowNewGroup = false
      const name = this.newGroupName.trim()
      this.newGroupName = ''
      if (!name) return
      const id = await addFavoriteGroup(name)
      // 自动选中新分组，watcher 随即刷新计数与组内内容
      this.currentGroupId = id
    },
    handleGroupRightClick(group, event) {
      this.targetGroup = group
      this.groupMenuLocation.x = event.pageX
      this.groupMenuLocation.y = event.pageY
      this.isShowGroupMenu = true
    },
    handleGroupMenuClick(action) {
      if (!action || !this.targetGroup) return
      const group = this.targetGroup
      this.targetGroup = null
      if (action.action == 'sync') {
        // 与远程源同步：拉取源歌单并覆盖组内歌曲（同步前确认覆盖语义）
        void this.handleSyncGroup(group)
        return
      }
      if (action.action == 'rename') {
        // 进入编辑前预填当前组名（输入框为 v-model 绑定，不会自动带出）
        this.editingGroupName = group.name
        this.editingGroupId = group.id
      } else if (action.action == 'remove') {
        void dialog.confirm({
          message: this.$t('favorite_group_remove_tip', { name: group.name }),
          cancelButtonText: this.$t('cancel_button_text'),
          confirmButtonText: this.$t('confirm_button_text'),
        }).then(async isConfirm => {
          if (!isConfirm) return
          const groupIndex = this.favoriteGroups.findIndex(g => g.id == group.id)
          await removeFavoriteGroup(group.id)
          clearGroupMusicsCache()
          // 删除收藏夹会把不再属于任何收藏夹的歌曲一并移出收藏，LOVE 快照同步刷新
          await this.refreshLoveList()
          await this.refreshGroupMusics()
          if (!this.favoriteGroups.some(g => g.id == this.currentGroupId)) {
            this.currentGroupId = this.favoriteGroups[Math.min(groupIndex, this.favoriteGroups.length - 1)]?.id ?? null
          }
        })
      }
    },
    async handleRenameGroup(group) {
      if (this.editingGroupId != group.id) return
      this.editingGroupId = null
      const name = this.editingGroupName.trim()
      this.editingGroupName = ''
      if (!name || name == group.name) return
      await updateFavoriteGroup(group.id, name)
    },
    // 进入重命名编辑态时自动聚焦该组输入框（此前输入框可见但不聚焦，无法直接键入，
    // 且未聚焦时点击空白处不触发 blur 提交，行会停留在编辑态）
    setEditInputRef(group, el) {
      if (!el || this.editingGroupId != group.id) return
      void nextTick(() => {
        if (this.editingGroupId != group.id) return
        el.focus?.()
      })
    },
    handleGroupModal(musicList) {
      this.groupModalMusicList = musicList
      this.isShowGroupModal = true
    },
    handleGroupModalChanged() {
      clearGroupMusicsCache()
      // 归组若全不勾选会把歌曲移出收藏（LOVE 同步删除），刷新 LOVE 快照与分组内容
      void this.refreshLoveList()
      void this.refreshGroupMusics()
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
  flex: auto;
  font-size: 16px;
  color: var(--color-font);
}
.headerBtn {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  background: none;
  border: none;
  outline: none;
  border-radius: 50%;
  cursor: pointer;
  color: var(--color-button-font);
  opacity: .6;
  transition: opacity @transition-normal;
  &:hover {
    opacity: 1;
    background-color: var(--color-primary-background-hover);
    color: var(--color-primary);
  }
}
.newGroupInput {
  width: 160px;
}
.main {
  flex: auto;
  min-height: 0;
  display: flex;
}
.groupsWrap {
  flex: none;
  width: 15%;
  min-width: 120px;
  min-height: 0;
  display: flex;
  flex-flow: column nowrap;
  border-right: var(--color-list-header-border-bottom);
}
.groups {
  flex: auto;
  min-height: 0;
  overflow-y: scroll !important;
}
.groupItem {
  display: flex;
  align-items: center;
  height: 36px;
  padding: 0 10px;
  cursor: pointer;
  transition: background-color @transition-fast;
  &:not(.active) {
    &:hover {
      background-color: var(--color-primary-background-hover);
    }
  }
  &.active {
    color: var(--color-primary);
  }
  &.editing {
    .groupLabel {
      display: none;
    }
    .groupEditInput {
      display: block;
    }
  }
}
.groupLabel {
  flex: auto;
  min-width: 0;
  font-size: 13px;
  .mixin-ellipsis-1();
}
.localMusicIcon {
  flex: none;
  height: 12px;
  margin-right: 6px;
  color: var(--color-font-label);
}
.groupSourceBadge {
  flex: none;
  font-size: 10px;
  line-height: 1;
  padding: 2px 4px;
  border-radius: 3px;
  margin-right: 4px;
  color: var(--color-primary);
  background: var(--color-primary-alpha-100);
  white-space: nowrap;
}
.count {
  flex: none;
  margin-left: 6px;
  font-size: 11px;
  color: var(--color-font-label);
}
.groupEditInput {
  flex: auto;
  display: none;
}
.emptyTip {
  flex: none;
  padding: 6px 10px 8px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--color-font-label);
}
.newGroupBtn {
  flex: none;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 10px;
  border: none;
  border-top: var(--color-list-header-border-bottom);
  background: none;
  outline: none;
  cursor: pointer;
  font-size: 13px;
  color: var(--color-button-font);
  transition: background-color @transition-fast, color @transition-fast;
  &:hover {
    background-color: var(--color-primary-background-hover);
    color: var(--color-primary);
  }
}
.listWrap {
  flex: auto;
  min-width: 0;
  display: flex;
}
</style>
