<template>
  <div id="favorite" :class="$style.container">
    <header :class="$style.header">
      <h2 :class="$style.title">{{ $t('favorite') }}</h2>
      <template v-if="!isShowNewGroup">
        <button :class="$style.headerBtn" :aria-label="$t('favorite_group_new')" @click="handleNewGroup">
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="14" viewBox="0 0 24 24" space="preserve">
            <use xlink:href="#icon-list-add" />
          </svg>
        </button>
      </template>
      <base-input v-else ref="newGroupInput" :class="$style.newGroupInput" :value="newGroupName" :placeholder="$t('favorite_group_new_input')" @keyup.enter="handleSaveNewGroup" @blur="handleSaveNewGroup" />
    </header>
    <div :class="$style.main">
      <div :class="$style.groupsWrap">
        <ul :class="['scroll', $style.groups]">
          <li
            :class="[$style.groupItem, { [$style.active]: currentGroupId == null }]"
            :aria-label="$t('favorite_group_all')"
            @click="currentGroupId = null"
          >
            <span :class="$style.groupLabel">{{ $t('favorite_group_all') }}</span>
            <span :class="$style.count">{{ loveListMusics.length }}</span>
          </li>
          <li
            v-for="group in favoriteGroups" :key="group.id"
            :class="[$style.groupItem, { [$style.active]: currentGroupId == group.id, [$style.editing]: editingGroupId == group.id }]"
            :aria-label="group.name"
            @click="currentGroupId = group.id" @contextmenu.prevent="handleGroupRightClick(group, $event)"
          >
            <span :class="$style.groupLabel">{{ group.name }}</span>
            <span :class="$style.count">{{ groupCounts[group.id] ?? '' }}</span>
            <base-input :class="$style.groupEditInput" :value="group.name" @keyup.enter="handleRenameGroup(group, $event)" @blur="handleRenameGroup(group, $event)" />
          </li>
        </ul>
        <p v-if="!favoriteGroups.length" :class="$style.emptyTip">{{ $t('favorite_group_empty') }}</p>
        <button :class="$style.newGroupBtn" :aria-label="$t('favorite_group_new')" @click="handleNewGroup">
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="14" viewBox="0 0 24 24" space="preserve">
            <use xlink:href="#icon-list-add" />
          </svg>
          <span>{{ $t('favorite_group_new') }}</span>
        </button>
      </div>
      <div :class="$style.listWrap">
        <MusicList v-if="currentGroupId == null" :list-id="LOVE_ID" :group-actions-visible="true" @group-modal="handleGroupModal" />
        <MusicList v-else :list-id="LOVE_ID" :music-list="groupMusicList" :group-actions-visible="true" @group-modal="handleGroupModal" />
      </div>
    </div>
    <music-group-modal v-model:show="isShowGroupModal" :music-list="groupModalMusicList" @close="isShowGroupModal = false" />
    <base-menu v-model="isShowGroupMenu" :menus="groupMenus" :xy="groupMenuLocation" item-name="name" @menu-click="handleGroupMenuClick" />
  </div>
</template>

<script>
import { nextTick } from '@common/utils/vueTools'
import { LIST_IDS } from '@common/constants'
import MusicList from '../List/MusicList/index.vue'
import MusicGroupModal from './components/MusicGroupModal.vue'
import { favoriteGroups, initFavoriteGroups, getGroupMusics, removeFavoriteGroup, updateFavoriteGroup, addFavoriteGroup } from '@renderer/store/list/favoriteGroup'
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
      favoriteGroups,
      currentGroupId: null,
      loveListMusics: [],
      groupMusics: [],
      groupCounts: {},
      isShowNewGroup: false,
      newGroupName: '',
      editingGroupId: null,
      isShowGroupModal: false,
      groupModalMusicList: [],
      isShowGroupMenu: false,
      groupMenuLocation: { x: 0, y: 0 },
      targetGroup: null,
    }
  },
  computed: {
    groupMusicList() {
      const set = new Set(this.groupMusics)
      return this.loveListMusics.filter(m => set.has(m.id))
    },
    groupMenus() {
      return [
        { name: this.$t('favorite_group_rename'), action: 'rename' },
        { name: this.$t('favorite_group_remove'), action: 'remove' },
      ]
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
    async initData() {
      await initFavoriteGroups()
      await this.refreshLoveList()
      await this.refreshGroupMusics()
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
      this.groupMusics = this.currentGroupId ? await getGroupMusics(this.currentGroupId) : []
    },
    handleMyListUpdate(ids) {
      if (!ids.includes(LIST_IDS.LOVE)) return
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
      await addFavoriteGroup(name)
      await this.refreshGroupMusics()
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
      if (action.action == 'rename') {
        this.editingGroupId = group.id
      } else if (action.action == 'remove') {
        void dialog.confirm({
          message: this.$t('favorite_group_remove_tip', { name: group.name }),
          cancelButtonText: this.$t('cancel_button_text'),
          confirmButtonText: this.$t('confirm_button_text'),
        }).then(async isConfirm => {
          if (!isConfirm) return
          await removeFavoriteGroup(group.id)
          if (this.currentGroupId == group.id) this.currentGroupId = null
          await this.refreshGroupMusics()
        })
      }
    },
    async handleRenameGroup(group, event) {
      if (this.editingGroupId != group.id) return
      this.editingGroupId = null
      const name = event.target.value.trim()
      if (!name || name == group.name) return
      await updateFavoriteGroup(group.id, name)
    },
    handleGroupModal(musicList) {
      this.groupModalMusicList = musicList
      this.isShowGroupModal = true
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
