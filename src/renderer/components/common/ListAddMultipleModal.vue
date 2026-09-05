<template>
  <material-modal :show="show" :bg-close="bgClose" max-width="70%" :teleport="teleport" @close="handleClose">
    <main :class="$style.main">
      <h2>{{ $t('list_add__multiple_' + (moveMode ? 'title_move' : 'title_add'), { num: musicList.length }) }}</h2>
      <div v-if="fromListId" :class="$style.moveBar">
        <base-checkbox id="list_add_multiple_move_mode" :model-value="moveMode" :label="$t('list_add__move_mode')" @update:model-value="setMoveMode" />
      </div>
      <div class="scroll" :class="$style.btnContent">
        <base-btn v-for="(item, index) in lists" :key="item.id" :class="$style.btn" :aria-label="$t('list_add__multiple_btn_title', { name: item.name })" @click="handleClick(index)">{{ item.name }}</base-btn>
        <base-btn :class="[$style.btn, $style.newList, isEditing ? $style.editing : null]" :aria-label="$t('favorite_group_new')" @click="handleEditing($event)">
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" viewBox="0 0 42 42" space="preserve">
            <use xlink:href="#icon-addTo" />
          </svg>
          <base-input :class="$style.newListInput" :value="newListName" :placeholder="$t('favorite_group_new_input')" @keyup.enter="handleSaveList($event)" @blur="handleSaveList($event)" />
        </base-btn>
        <span v-for="i in spaceNum" :key="i" :class="$style.btn" />
      </div>
    </main>
  </material-modal>
</template>

<script>
import { computed, ref, watch } from '@common/utils/vueTools'
import { loveList } from '@renderer/store/list/state'
import { addListMusics, moveListMusics, getMusicExistListIds } from '@renderer/store/list/action'
import useKeyDown from '@renderer/utils/compositions/useKeyDown'
import { useI18n } from '@root/lang'
import { dialog } from '@renderer/plugins/Dialog'
import { favoriteGroups, addFavoriteGroup, setMusicGroupIds } from '@renderer/store/list/favoriteGroup'

export default {
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
    bgClose: {
      type: Boolean,
      default: true,
    },
    excludeListId: {
      type: Array,
      default() {
        return []
      },
    },
    // listName: {
    //   type: String,
    //   default: '',
    // },
    fromListId: {
      type: String,
      default: null,
    },
    isMove: {
      type: Boolean,
      default: false,
    },
    teleport: {
      type: String,
      default: '#root',
    },
  },
  emits: ['update:show', 'confirm'],
  setup(props) {
    const keyModDown = useKeyDown('mod')
    const t = useI18n()

    const lists = computed(() => {
      // 目标仅「我的收藏」与收藏分组（试听列表已由独立会话播放列表取代，不再作为添加目标）
      return [
        { ...loveList, name: t(loveList.name) },
        ...favoriteGroups.map(g => ({ id: g.id, name: g.name, isGroup: true })),
      ].filter(l => !props.excludeListId.includes(l.isGroup ? loveList.id : l.id))
    })

    // 多选弹窗补齐"已存在禁用"：任一选中歌曲已在该列表则禁用该列表按钮（与单选弹窗一致）
    const existListIds = ref(new Set())
    watch(() => props.show, (val) => {
      if (!val || !props.musicList.length) {
        existListIds.value = new Set()
        return
      }
      const musics = 'progress' in props.musicList[0] ? props.musicList.map(t => t.metadata.musicInfo) : props.musicList
      const ids = [...new Set(musics.map(m => m?.id).filter(Boolean))]
      void Promise.all(ids.map(async id => getMusicExistListIds(id))).then(idSets => {
        const all = new Set()
        for (const set of idSets) for (const id of set) all.add(id)
        existListIds.value = all
      })
    })

    return {
      keyModDown,
      lists,
      existListIds,
    }
  },
  data() {
    return {
      isEditing: false,
      newListName: '',
      rowNum: 3,
      moveMode: false,
    }
  },
  computed: {
    spaceNum() {
      return this.lists.length < 2 ? 0 : (this.rowNum - this.lists.length % this.rowNum - 1)
    },
  },
  watch: {
    show(val) {
      if (val) this.moveMode = this.isMove
    },
  },
  mounted() {
    window.addEventListener('resize', this.handleResize)
    this.handleResize()
  },
  beforeUnmount() {
    window.removeEventListener('resize', this.handleResize)
  },
  methods: {
    handleResize() {
      const width = window.innerWidth
      this.rowNum = width < 1920
        ? 3
        : width < 2560
          ? 4
          : width < 3840 ? 5 : 6
    },
    async handleClick(index) {
      const target = this.lists[index]
      const list = 'progress' in this.musicList[0] ? this.musicList.map(t => t.metadata.musicInfo) : this.musicList
      if (target.isExist) {
        void dialog({ message: window.i18n.t('list_add__already', { name: target.name }) })
        return
      }
      // 收藏分组目标：歌曲进入「我的收藏」并按分组归属
      const targetListId = target.isGroup ? loveList.id : target.id
      try {
        if (this.moveMode) await moveListMusics(this.fromListId, targetListId, list)
        else await addListMusics(targetListId, list)
        if (target.isGroup) {
          for (const musicInfo of list) await setMusicGroupIds(musicInfo.id, [target.id])
        }
      } catch (err) {
        console.warn(err)
        void dialog({ message: window.i18n.t('list_add__failed') })
        return
      }

      if (this.keyModDown && !this.moveMode) return
      this.$nextTick(() => {
        this.handleClose()
        this.$emit('confirm')
      })
    },
    setMoveMode(val) {
      this.moveMode = val
    },
    handleClose() {
      this.$emit('update:show', false)
    },
    handleEditing(event) {
      if (this.isEditing) return
      // if (!this.newListName) this.newListName = this.listName
      this.isEditing = true
      this.$nextTick(() => event.currentTarget.querySelector('.' + this.$style.newListInput).focus())
    },
    async handleSaveList(event) {
      let name = event.target.value
      this.newListName = event.target.value = ''
      this.isEditing = false
      if (!name) return
      if (favoriteGroups.some(g => g.name == name) && !(await dialog.confirm(window.i18n.t('list_duplicate_tip')))) return
      // 新建收藏分组并直接执行「添加到该分组」
      const groupId = await addFavoriteGroup(name)
      this.lists.push({ id: groupId, name, isGroup: true, isExist: false })
      await this.handleClick(this.lists.length - 1)
    },
  },
}
</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.main {
  // padding: 15px 0;
  // max-width: 620px;
  min-width: 200px;
  display: flex;
  flex-flow: column nowrap;
  justify-content: center;
  min-height: 0;
  // max-height: 100%;
  // overflow: hidden;
  h2 {
    font-size: 13px;
    color: var(--color-font);
    line-height: 1.3;
    text-align: center;
    padding: 15px;
  }
}

.moveBar {
  display: flex;
  justify-content: center;
  padding: 0 15px 8px;
  font-size: 12px;
}

.btnContent {
  flex: auto;
  max-height: 100%;
  padding-right: 15px;
  display: flex;
  flex-flow: row wrap;
  justify-content: space-evenly;
}

@item-width: (100% / 3);
.btn {
  position: relative;
  box-sizing: border-box;
  margin-left: 15px;
  margin-bottom: 15px;
  height: 36px;
  line-height: 36px;
  padding: 0 10px !important;
  width: calc(@item-width - 15px);
  min-width: 160px;
  .mixin-ellipsis-1();
}

.newList {
  border: 1px dashed var(--color-primary-font-hover);
  // background-color: var(--color-main-background);
  color: var(--color-primary-font-hover);
  opacity: .7;

  svg {
    height: 18px;
    margin-top: 9px;
  }

  &.editing {
    opacity: 1;

    svg {
      display: none;
    }
    .newListInput {
      display: block;
    }
  }
}
.newListInput {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 34px;
  line-height: 34px;
  background: none !important;
  font-size: 14px;
  text-align: center;
  box-sizing: border-box;
  padding: 0 10px;
  border-radius: 0;
  display: none;
}

@item-width2: (100% / 4);
@media (min-width: 1920px){
  .btn {
    width: calc(@item-width2 - 15px);
  }
}
@item-width3: (100% / 5);
@media (min-width: 2560px){
  .btn {
    width: calc(@item-width3 - 15px);
  }
}
@item-width4: (100% / 6);
@media (min-width: 3840px){
  .btn {
    width: calc(@item-width4 - 15px);
  }
}

</style>
