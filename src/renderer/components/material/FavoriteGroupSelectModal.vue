<!--
  添加到收藏夹弹窗：
  供歌曲行"添加到"长按（listAddSelect）与控制栏"添加到"使用。
  包含：全部收藏（LOVE）入口、收藏夹分组入口、内联新建分组，
  以及"添加到用户列表"次级入口（通过 add-to-user-list 事件交由父组件打开用户列表弹窗）。
-->
<template>
  <material-modal :show="show" :bg-close="bgClose" :teleport="teleport" max-width="70%" min-width="240px" @close="handleClose">
    <main :class="$style.main">
      <h2 :class="$style.title">{{ $t('favorite_group_select_title') }}</h2>
      <div v-if="currentMusicInfo && currentMusicInfo.name" :class="$style.subTitle">{{ currentMusicInfo.name }}</div>
      <div class="scroll" :class="$style.groupContent">
        <button
          type="button"
          :class="[$style.groupItem, { [$style.checked]: loveChecked }]"
          :aria-label="$t('list_add__btn_title', { name: $t('favorite_group_all') })"
          @click="handleAddToLove"
        >
          <span :class="$style.checkIcon">
            <svg v-if="loveChecked" version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" viewBox="0 32 448 448" space="preserve">
              <use xlink:href="#icon-check-true" />
            </svg>
          </span>
          <span :class="$style.groupName">{{ $t('favorite_group_all') }}</span>
        </button>
        <button
          v-for="group in favoriteGroups"
          :key="group.id"
          type="button"
          :class="[$style.groupItem, { [$style.checked]: groupCheckedIds.includes(group.id) }]"
          :aria-label="$t('list_add__btn_title', { name: group.name })"
          @click="handleAddToGroup(group)"
        >
          <span :class="$style.checkIcon">
            <svg v-if="groupCheckedIds.includes(group.id)" version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" viewBox="0 32 448 448" space="preserve">
              <use xlink:href="#icon-check-true" />
            </svg>
          </span>
          <span :class="$style.groupName">{{ group.name }}</span>
        </button>
        <p v-if="!favoriteGroups.length" :class="$style.empty">{{ $t('favorite_group_empty') }}</p>
        <div :class="$style.newGroup">
          <button type="button" :class="$style.newGroupBtn" :aria-label="$t('favorite_group_new')" @click="handleStartNewGroup">
            <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="14" viewBox="0 0 42 42" space="preserve">
              <use xlink:href="#icon-addTo" />
            </svg>
          </button>
          <base-input :class="$style.newGroupInput" :value="newGroupName" :placeholder="$t('favorite_group_new_input')" @keyup.enter="handleSaveNewGroup" @blur="handleSaveNewGroup" />
        </div>
      </div>
      <div :class="$style.footer">
        <button type="button" :class="$style.secondaryBtn" :aria-label="$t('favorite_group_select_add_to_list')" @click="handleAddToUserList">
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="14" viewBox="0 0 24 24" space="preserve">
            <use xlink:href="#icon-list-add" />
          </svg>
          {{ $t('favorite_group_select_add_to_list') }}
        </button>
      </div>
    </main>
  </material-modal>
</template>

<script>
import { ref, watch } from '@common/utils/vueTools'
import { favoriteGroups, addFavoriteGroup, getMusicGroupIds, setMusicGroupIds, clearGroupMusicsCache } from '@renderer/store/list/favoriteGroup'
import { loveList } from '@renderer/store/list/state'
import { addListMusics, getMusicExistListIds } from '@renderer/store/list/action'

export default {
  name: 'FavoriteGroupSelectModal',
  props: {
    show: {
      type: Boolean,
      default: false,
    },
    musicInfo: {
      type: [Object, null],
      required: true,
    },
    bgClose: {
      type: Boolean,
      default: true,
    },
    teleport: {
      type: String,
      default: '#root',
    },
  },
  emits: ['update:show', 'add-to-user-list'],
  setup(props, { emit }) {
    const currentMusicInfo = ref(null)
    const loveChecked = ref(false)
    const groupCheckedIds = ref([])
    const isEditing = ref(false)
    const newGroupName = ref('')

    const handleClose = () => {
      emit('update:show', false)
    }

    const loadInfo = async() => {
      const raw = props.musicInfo
      currentMusicInfo.value = raw && 'progress' in raw ? raw.metadata.musicInfo : raw
      loveChecked.value = false
      groupCheckedIds.value = []
      const musicInfo = currentMusicInfo.value
      if (!musicInfo?.id) return
      const [listIds, groupIds] = await Promise.all([
        getMusicExistListIds(musicInfo.id),
        getMusicGroupIds(musicInfo.id),
      ])
      if (currentMusicInfo.value?.id != musicInfo.id) return
      loveChecked.value = listIds.includes(loveList.id)
      groupCheckedIds.value = groupIds
    }

    watch(() => props.show, (val) => {
      if (!val) return
      isEditing.value = false
      newGroupName.value = ''
      void loadInfo()
    })

    const addToLoveIfNeeded = async(musicInfo) => {
      if (loveChecked.value) return
      await addListMusics(loveList.id, [musicInfo])
      loveChecked.value = true
    }

    const addMusicToGroup = async(musicInfo, groupId) => {
      await addToLoveIfNeeded(musicInfo)
      const ids = await getMusicGroupIds(musicInfo.id)
      if (!ids.includes(groupId)) ids.push(groupId)
      await setMusicGroupIds(musicInfo.id, ids)
      clearGroupMusicsCache(groupId)
      groupCheckedIds.value.push(groupId)
      window.app_event.myListUpdate([loveList.id])
    }

    const handleAddToLove = async() => {
      const musicInfo = currentMusicInfo.value
      if (!musicInfo?.id) return
      if (!loveChecked.value) await addToLoveIfNeeded(musicInfo)
      handleClose()
    }

    const handleAddToGroup = async(group) => {
      const musicInfo = currentMusicInfo.value
      if (!musicInfo?.id) return
      await addMusicToGroup(musicInfo, group.id)
      handleClose()
    }

    const handleStartNewGroup = () => {
      if (isEditing.value) return
      isEditing.value = true
    }

    const handleSaveNewGroup = async(event) => {
      if (!isEditing.value) return
      isEditing.value = false
      let name = event.target.value.trim()
      event.target.value = ''
      newGroupName.value = ''
      const musicInfo = currentMusicInfo.value
      if (!name || !musicInfo?.id) return
      const id = await addFavoriteGroup(name)
      await addMusicToGroup(musicInfo, id)
      handleClose()
    }

    const handleAddToUserList = () => {
      emit('update:show', false)
      emit('add-to-user-list')
    }

    return {
      favoriteGroups,
      currentMusicInfo,
      loveChecked,
      groupCheckedIds,
      isEditing,
      newGroupName,
      handleAddToLove,
      handleAddToGroup,
      handleStartNewGroup,
      handleSaveNewGroup,
      handleAddToUserList,
      handleClose,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.main {
  display: flex;
  flex-flow: column nowrap;
  padding: 16px 20px;
  min-width: 260px;
  max-width: 340px;
}
.title {
  font-size: 15px;
  margin-bottom: 6px;
}
.subTitle {
  font-size: 12px;
  color: var(--color-font-label);
  margin-bottom: 10px;
  .mixin-ellipsis-1();
}
.groupContent {
  max-height: 280px;
  overflow-y: scroll !important;
}
.groupItem {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 8px;
  padding: 6px 0;
  border: none;
  background: none;
  outline: none;
  cursor: pointer;
  color: var(--color-font);
  text-align: left;

  &:hover {
    color: var(--color-primary);
  }
  &.checked {
    color: var(--color-primary);
  }
}
.checkIcon {
  flex: none;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-font-label);
  border-radius: 2px;

  svg {
    width: 12px;
    height: 12px;
    color: var(--color-primary);
    display: none;
  }
}
.groupItem.checked {
  .checkIcon {
    border-color: var(--color-primary);
    svg {
      display: block;
    }
  }
}
.groupName {
  flex: auto;
  min-width: 0;
  font-size: 13px;
  .mixin-ellipsis-1();
}
.empty {
  padding: 12px 0;
  font-size: 12px;
  color: var(--color-font-label);
}
.newGroup {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}
.newGroupBtn {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  background: none;
  border: none;
  outline: none;
  cursor: pointer;
  color: var(--color-button-font);
  opacity: .6;

  &:hover {
    opacity: 1;
  }
}
.newGroupInput {
  flex: auto;
}
.footer {
  display: flex;
  justify-content: flex-start;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--color-list-header-border-bottom);
}
.secondaryBtn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 4px;
  border: none;
  background: none;
  outline: none;
  cursor: pointer;
  font-size: 12px;
  color: var(--color-font-label);

  svg {
    width: 14px;
    height: 14px;
  }

  &:hover {
    color: var(--color-primary);
  }
}
</style>
