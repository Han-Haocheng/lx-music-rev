<template lang="pug">
dt#about {{ $t('setting__about') }}
dd
  h3#update {{ $t('setting__update') }}
  .gap-top
    base-checkbox(id="setting__update_tryAutoUpdate" :model-value="appSetting['common.tryAutoUpdate']" :label="$t('setting__update_try_auto_update')" @update:model-value="updateSetting({'common.tryAutoUpdate': $event})")
  .gap-top
    base-checkbox(id="setting__update_showChangeLog" :model-value="appSetting['common.showChangeLog']" :label="$t('setting__update_show_change_log')" @update:model-value="updateSetting({'common.showChangeLog': $event})")
  .gap-top
    .p.small(@click="handleOpenDevTools") {{ $t('setting__update_current_label') }}{{ versionInfo.version }}
    .p.small(v-if="commit_id")
      | {{ $t('setting__update_commit_id') }}
      span.select {{ commit_id }}
    .p.small(v-if="commit_date") {{ $t('setting__update_commit_date') }}{{ commit_date }}
    .p.small.gap-top
      | {{ $t('setting__update_latest_label') }}{{ versionInfo.newVersion && versionInfo.newVersion.version != '0.0.0' ? versionInfo.newVersion.version : $t('setting__update_unknown') }}
    .p.small(v-if="downloadProgress" style="line-height: 1.5;")
      | {{ $t('setting__update_downloading') }}
      br
      | {{ $t('setting__update_progress') }}{{ downloadProgress }}
    template(v-if="versionInfo.newVersion")
      .p(v-if="versionInfo.isLatest")
        span {{ $t('setting__update_latest') }}
      .p(v-else-if="versionInfo.isUnknown")
        span {{ $t('setting__update_unknown_tip') }}
      .p(v-else-if="versionInfo.status != 'downloading'")
        span {{ $t('setting__update_new_version') }}
      .p
        base-btn.btn.gap-left(min @click="showUpdateModal") {{ $t('setting__update_open_version_modal_btn') }}
    .p.small(v-else-if="versionInfo.status =='checking'") {{ $t('setting__update_checking') }}
  br
  .p.small
    | 本软件完全免费，代码已开源。本项目为 lx-music-desktop 的开源 fork，开源地址：
    span.hover.underline(:aria-label="$t('setting__click_open')" @click="openUrl('https://github.com/Han-Haocheng/lx-music-rev#readme')") https://github.com/Han-Haocheng/lx-music-rev
  .p.small
    | 最新版下载地址：
    span.hover.underline(:aria-label="$t('setting__click_open')" @click="openUrl('https://github.com/Han-Haocheng/lx-music-rev/releases')") GitHub Releases
  .p.small
    | 软件的常见问题可转至：
    span.hover.underline(:aria-label="$t('setting__click_open')" @click="openUrl('https://lyswhut.github.io/lx-music-doc/desktop/faq')") 桌面版常见问题
  .p.small
    strong 本软件没有客服
    | ，但我们整理了一些常见的使用问题。
    strong 仔细、仔细、仔细
    | 地阅读常见问题后，
  .p.small
    | 仍有问题可到&nbsp;GitHub&nbsp;
    span.hover.underline(:aria-label="$t('setting__click_open')" @click="openUrl('https://github.com/Han-Haocheng/lx-music-rev/issues?q=is%3Aissue+')") 提交&nbsp;Issue
    | 。
  br
  .p.small 由于软件开发的初衷仅是为了对新技术的学习与研究，因此软件直至停止维护都将会一直保持纯净。
  .p.small
    | 目前本项目的原始发布地址
    strong 只有&nbsp;GitHub
    | ，其他渠道均为第三方转载发布，可信度请自行鉴别。
  .p.small
    strong 本项目没有微信公众号之类的所谓「官方账号」，谨防被骗！

  .p.small
    | 你已签署本软件的
    base-btn(min @click="handleShowPact") 许可协议
    | ，协议的在线版本在
    strong.hover.underline(:aria-label="$t('setting__click_open')" @click="openUrl('https://github.com/Han-Haocheng/lx-music-rev#%E9%A1%B9%E7%9B%AE%E5%8D%8F%E8%AE%AE')") 这里
    | 。
  br

  .p.small
    | By:&nbsp;
    strong 落雪无痕
    | &nbsp;(原作者) · 本 fork 由&nbsp;
    strong Han-Haocheng
    | &nbsp;维护
</template>

<script>
import { computed } from '@common/utils/vueTools'
import { isShowPact, versionInfo } from '@renderer/store'
import { openUrl, clipboardWriteText } from '@common/utils/electron'
import { dateFormat, sizeFormate } from '@common/utils/common'
import { openDevTools } from '@renderer/utils/ipc'
import { useI18n } from '@renderer/plugins/i18n'
import { appSetting, updateSetting } from '@renderer/store/setting'

export default {
  name: 'SettingAbout',
  setup() {
    const t = useI18n()

    let lastClickTime = 0
    let clickNum = 0
    const commit_id = COMMIT_ID
    const commit_date = dateFormat(COMMIT_DATE)

    const handleOpenDevTools = () => {
      if (window.performance.now() - lastClickTime > 1000) {
        if (clickNum > 0) clickNum = 0
      } else {
        if (clickNum > 4) {
          openDevTools()
          clickNum = 0
          return
        }
      }
      clickNum++
      lastClickTime = window.performance.now()
    }

    const downloadProgress = computed(() => {
      return versionInfo.status == 'downloading'
        ? versionInfo.downloadProgress
          ? `${versionInfo.downloadProgress.percent.toFixed(2)}% - ${sizeFormate(versionInfo.downloadProgress.transferred)}/${sizeFormate(versionInfo.downloadProgress.total)} - ${sizeFormate(versionInfo.downloadProgress.bytesPerSecond)}/s`
          : t('setting__update_init')
        : ''
    })

    const showUpdateModal = () => {
      versionInfo.showModal = true
    }

    const handleShowPact = () => {
      isShowPact.value = true
    }

    return {
      appSetting,
      updateSetting,
      openUrl,
      clipboardWriteText,
      handleShowPact,
      versionInfo,
      commit_id,
      commit_date,
      downloadProgress,
      handleOpenDevTools,
      showUpdateModal,
    }
  },
}
</script>
