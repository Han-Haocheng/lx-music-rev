<template>
  <div :class="$style.main">
    <div :class="$style.header">
      <base-tab v-model="avtiveComponentName" :class="$style.tab" :list="tocList" item-key="id" item-label="title" @change="toggleTab" />
    </div>
    <div :class="$style.body">
      <div v-if="subList.length" class="scroll" :class="$style.toc">
        <ul :class="$style.tocList">
          <li v-for="item in subList" :key="item.id" :class="$style.tocListItem">
            <h2
              :class="[$style.tocDt, {[$style.active]: activeSubId == item.id }]"
              :aria-label="item.title" @click="scrollToSub(item.id)"
            >{{ item.title }}</h2>
            <ul v-if="item.children && item.children.length" :class="$style.tocSubList">
              <li v-for="(child, childIndex) in item.children" :key="item.id + '_' + child.id + '_' + childIndex" :class="$style.tocSubListItem">
                <h3
                  :class="[$style.tocH3, {[$style.active]: activeSubId == child.id }]"
                  :aria-label="child.title" @click="scrollToSub(child.id)"
                >{{ child.title }}</h3>
              </li>
            </ul>
          </li>
        </ul>
      </div>
      <div ref="dom_content_ref" class="scroll" :class="$style.setting">
        <dl>
          <component :is="avtiveComponentName" />
          <!-- <SettingGeneral />
          <SettingPlayLyric />
          <SettingDownloadBackup />
          <SettingSyncNetwork />
          <SettingHotKey />
          <SettingAbout /> -->
        </dl>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, nextTick, watch, onMounted } from '@common/utils/vueTools'
import { useI18n } from '@renderer/plugins/i18n'
import { useRoute } from '@common/utils/vueRouter'

import SettingGeneral from './components/SettingGeneral.vue'
import SettingPlayLyric from './components/SettingPlayLyric.vue'
import SettingDownloadBackup from './components/SettingDownloadBackup.vue'
import SettingSyncNetwork from './components/SettingSyncNetwork.vue'
import SettingHotKey from './components/SettingHotKey.vue'
import SettingAbout from './components/SettingAbout.vue'

export default {
  name: 'Setting',
  components: {
    SettingGeneral,
    SettingPlayLyric,
    SettingDownloadBackup,
    SettingSyncNetwork,
    SettingHotKey,
    SettingAbout,
  },
  setup() {
    const t = useI18n()
    const route = useRoute()

    const dom_content_ref = ref(null)

    const tocList = computed(() => {
      return [
        { id: 'SettingGeneral', title: t('setting__general') },
        { id: 'SettingPlayLyric', title: t('setting__play_lyric') },
        { id: 'SettingDownloadBackup', title: t('setting__download_backup') },
        { id: 'SettingSyncNetwork', title: t('setting__sync_network') },
        { id: 'SettingHotKey', title: t('setting__hot_key') },
        { id: 'SettingAbout', title: t('setting__about') },
      ]
    })

    const avtiveComponentName = ref(route.query.name && tocList.value.some(t => t.id == route.query.name)
      ? route.query.name
      : tocList.value[0].id)

    const subList = ref([])
    const activeSubId = ref('')

    const updateSubList = () => {
      activeSubId.value = ''
      const container = dom_content_ref.value
      if (!container) {
        subList.value = []
        return
      }
      const list = []
      let currentDt = null
      container.querySelectorAll('dt[id], h3[id]').forEach(el => {
        const title = (el.textContent ?? '').trim()
        if (!el.id || !title) return
        if (el.tagName === 'DT') {
          currentDt = { id: el.id, title, children: [] }
          list.push(currentDt)
        } else if (el.tagName === 'H3' && currentDt) {
          currentDt.children.push({ id: el.id, title })
        }
      })
      subList.value = list
    }

    const scrollToSub = id => {
      activeSubId.value = id
      const container = dom_content_ref.value
      if (!container) return
      const el = container.querySelector('#' + CSS.escape(id))
      if (!el) return
      const top = el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop
      container.scrollTo({ top: Math.max(top - 8, 0), behavior: 'smooth' })
    }

    const toggleTab = id => {
      avtiveComponentName.value = id
      void nextTick(() => {
        dom_content_ref.value?.scrollTo({
          top: 0,
          behavior: 'smooth',
        })
        updateSubList()
      })
    }

    watch(avtiveComponentName, () => {
      void nextTick(updateSubList)
    })
    onMounted(() => {
      void nextTick(updateSubList)
    })

    return {
      tocList,
      avtiveComponentName,
      dom_content_ref,
      toggleTab,
      subList,
      activeSubId,
      scrollToSub,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.main {
  display: flex;
  flex-flow: column nowrap;
  height: 100%;
}
.header {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  border-bottom: var(--color-list-header-border-bottom);
}
.tab {
  font-size: 13px;
}
.body {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-flow: row nowrap;
}

.toc {
  flex: 0 0 15%;
  overflow-y: scroll;
}
.tocList {
  padding: 8px 0;
}
.tocListItem {
  padding-top: 1px;
}
.tocDt {
  line-height: 1.5;
  .mixin-ellipsis-1();
  font-size: 13px;
  color: var(--color-font);
  padding: 5px 12px;
  cursor: pointer;
  transition: @transition-fast;
  transition-property: background-color, color;

  &:not(.active) {
    &:hover {
      background-color: var(--color-button-background-hover);
    }
  }
  &.active {
    color: var(--color-primary);
  }
}
.tocSubList {
  padding: 0 0 2px;
}
.tocSubListItem {
  padding-top: 1px;
}
.tocH3 {
  line-height: 1.5;
  .mixin-ellipsis-1();
  font-size: 12px;
  color: var(--color-font);
  padding: 3px 12px 3px 24px;
  cursor: pointer;
  transition: @transition-fast;
  transition-property: background-color, color;

  &:not(.active) {
    &:hover {
      background-color: var(--color-button-background-hover);
    }
  }
  &.active {
    color: var(--color-primary);
  }
}

.setting {
  padding: 0 15px 15px;
  font-size: 14px;
  box-sizing: border-box;
  overflow-y: auto;
  height: 100%;
  position: relative;
  width: 100%;

  :global {
    dt {
      border-left: 5px solid var(--color-primary-alpha-700);
      padding: 3px 7px;
      margin: 15px 0;

      + dd h3 {
        margin-top: 0;
      }
    }

    dd {
      > div {
        padding: 0 15px;
      }
    }
    h3 {
      font-size: 12px;
      margin: 25px 0 15px;
    }
    .p {
      padding: 3px 0;
      line-height: 1.3;
      .btn {
        + .btn {
          margin-left: 10px;
        }
      }
    }

    .help-btn {
      padding: 0;
      margin: 0 0.4em;
      border: none;
      background: none;
      color: var(--color-button-font);
      cursor: pointer;
      transition: opacity 0.2s ease;
      &:hover {
        opacity: 0.7;
      }
    }
    .help-icon {
      margin: 0 0.4em;
    }
  }
}
</style>
