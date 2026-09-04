<template>
  <material-modal :show="show" :bg-close="true" teleport="#root" max-width="70%" min-width="240px" @close="handleClose">
    <main :class="$style.main">
      <h2 :class="$style.title">{{ $t('favorite_group_modal_title') }}</h2>
      <div v-if="musicList.length" :class="$style.subTitle">{{ $t('favorite_group_modal_count', { num: musicList.length }) }}</div>
      <div class="scroll" :class="$style.groupContent">
        <label v-for="group in favoriteGroups" :key="group.id" :class="$style.groupItem">
          <base-checkbox v-model="selectedGroupIds" :value="group.id" />
          <span :class="$style.groupName" :aria-label="group.name">{{ group.name }}</span>
        </label>
        <p v-if="!favoriteGroups.length" :class="$style.empty">{{ $t('favorite_group_empty') }}</p>
        <div :class="$style.newGroup">
          <button :class="$style.newGroupBtn" :aria-label="$t('favorite_group_new')" @click="handleStartNewGroup">
            <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="14" viewBox="0 0 42 42" space="preserve">
              <use xlink:href="#icon-addTo" />
            </svg>
          </button>
          <base-input v-if="isEditing" ref="newGroupInput" v-model="newGroupName" :class="$style.newGroupInput" :placeholder="$t('favorite_group_new_input')" @keyup.enter="handleSaveNewGroup" @blur="handleSaveNewGroup" />
        </div>
      </div>
      <div :class="$style.btns">
        <base-btn :class="$style.btn" :aria-label="$t('confirm_button_text')" @click="handleConfirm">{{ $t('confirm_button_text') }}</base-btn>
        <base-btn :class="$style.btn" :aria-label="$t('cancel_button_text')" @click="handleClose">{{ $t('cancel_button_text') }}</base-btn>
      </div>
    </main>
  </material-modal>
</template>

<script>
import { ref, watch, nextTick } from '@common/utils/vueTools'
import { favoriteGroups, addFavoriteGroup, getMusicGroupIds, setMusicGroupIds } from '@renderer/store/list/favoriteGroup'
import baseCheckbox from '@renderer/components/base/Checkbox.vue'
import baseInput from '@renderer/components/base/Input.vue'
import baseBtn from '@renderer/components/base/Btn.vue'

export default {
  name: 'MusicGroupModal',
  components: {
    baseCheckbox,
    baseInput,
    baseBtn,
  },
  props: {
    show: {
      type: Boolean,
      default: false,
    },
    musicList: {
      type: Array,
      default() {
        return []
      },
    },
  },
  emits: ['close'],
  setup(props, { emit }) {
    const selectedGroupIds = ref([])
    const isEditing = ref(false)
    const newGroupName = ref('')
    const newGroupInput = ref(null)

    const loadSelected = async() => {
      selectedGroupIds.value = []
      if (!props.show || !props.musicList.length) return
      // 取所有歌曲归属分组的交集作为初始勾选
      let intersection
      for (const musicInfo of props.musicList) {
        const ids = await getMusicGroupIds(musicInfo.id)
        if (!intersection) {
          intersection = new Set(ids)
        } else {
          for (const id of Array.from(intersection)) {
            if (!ids.includes(id)) intersection.delete(id)
          }
        }
      }
      selectedGroupIds.value = Array.from(intersection ?? [])
    }

    watch(() => props.show, (val) => {
      if (val) {
        isEditing.value = false
        newGroupName.value = ''
        void loadSelected()
      }
    })

    const handleStartNewGroup = () => {
      if (isEditing.value) return
      isEditing.value = true
      void nextTick(() => {
        newGroupInput.value?.focus?.()
      })
    }

    const handleSaveNewGroup = async() => {
      if (!isEditing.value) return
      isEditing.value = false
      const name = newGroupName.value.trim()
      newGroupName.value = ''
      if (!name) return
      const id = await addFavoriteGroup(name)
      selectedGroupIds.value.push(id)
    }

    const handleConfirm = async() => {
      const groupIds = [...selectedGroupIds.value]
      for (const musicInfo of props.musicList) {
        await setMusicGroupIds(musicInfo.id, groupIds)
      }
      emit('close')
    }

    const handleClose = () => {
      emit('close')
    }

    return {
      favoriteGroups,
      selectedGroupIds,
      isEditing,
      newGroupName,
      newGroupInput,
      handleStartNewGroup,
      handleSaveNewGroup,
      handleConfirm,
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
}
.title {
  font-size: 15px;
  margin-bottom: 6px;
}
.subTitle {
  font-size: 12px;
  color: var(--color-font-label);
  margin-bottom: 10px;
}
.groupContent {
  max-height: 300px;
  overflow-y: scroll !important;
}
.groupItem {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  cursor: pointer;
}
.groupName {
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
.btns {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 14px;
}
.btn {
  min-width: 72px;
}
</style>
