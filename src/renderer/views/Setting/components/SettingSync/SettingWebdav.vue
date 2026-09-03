<template lang="pug">
dd
  h3 {{ $t('setting__sync_webdav_mode') }}
  div
    .p.small {{ $t('setting__sync_webdav_status', { status: webdavStatusText }) }}
    .p
      .p.small {{ $t('setting__sync_webdav_url') }}
      div
        base-input.gap-left(:class="$style.urlInput" :model-value="appSetting['sync.webdav.url']" :placeholder="$t('setting__sync_webdav_url_tip')" @update:model-value="setWebdavUrl")
    .p
      .p.small {{ $t('setting__sync_webdav_username') }}
      div
        base-input.gap-left(:class="$style.halfInput" :model-value="appSetting['sync.webdav.username']" @update:model-value="setWebdavUsername")
    .p
      .p.small {{ $t('setting__sync_webdav_password') }}
      div
        base-input.gap-left(:class="$style.halfInput" type="password" :model-value="appSetting['sync.webdav.password']" @update:model-value="setWebdavPassword")
    .p
      .p.small {{ $t('setting__sync_webdav_remote_path') }}
      div
        base-input.gap-left(:class="$style.halfInput" :model-value="appSetting['sync.webdav.remotePath']" :placeholder="$t('setting__sync_webdav_remote_path_tip')" @update:model-value="setWebdavRemotePath")
    .p.gap-top
      base-checkbox(:model-value="appSetting['sync.webdav.autoDownloadOnStart']" :label="$t('setting__sync_webdav_auto_download')" @update:model-value="updateSetting({ 'sync.webdav.autoDownloadOnStart': $event })")
      base-checkbox.gap-left(:model-value="appSetting['sync.webdav.autoUploadOnQuit']" :label="$t('setting__sync_webdav_auto_upload')" @update:model-value="updateSetting({ 'sync.webdav.autoUploadOnQuit': $event })")
    .p.gap-top
      base-btn.btn(min :disabled="busy" @click="runAction('webdav_test')") {{ $t('setting__sync_webdav_test') }}
      base-btn.btn(min :disabled="busy" @click="runAction('webdav_push')") {{ $t('setting__sync_webdav_push') }}
      base-btn.btn(min :disabled="busy" @click="runAction('webdav_pull')") {{ $t('setting__sync_webdav_pull') }}
</template>

<script>
import { computed, ref } from '@common/utils/vueTools'
import { sync } from '@renderer/store'
import { sendSyncAction } from '@renderer/utils/ipc'
import { useI18n } from '@renderer/plugins/i18n'
import { appSetting, updateSetting } from '@renderer/store/setting'
import { debounce } from '@common/utils/common'

export default {
  name: 'SettingWebdav',
  setup() {
    const t = useI18n()
    const busy = ref(false)

    const webdavStatusText = computed(() => {
      const s = sync.webdav.status
      if (s.message) return s.message
      return s.status ? t('setting_sync_status_enabled') : t('sync_status_disabled')
    })

    const runAction = (action) => {
      if (busy.value) return
      busy.value = true
      sendSyncAction({ action }).catch(err => {
        sync.webdav.status = {
          status: false,
          enabled: sync.webdav.status.enabled,
          message: err.message || String(err),
        }
      }).finally(() => {
        busy.value = false
      })
    }

    const setWebdavUrl = debounce(url => {
      updateSetting({ 'sync.webdav.url': url.trim() })
    }, 500)
    const setWebdavUsername = debounce(username => {
      updateSetting({ 'sync.webdav.username': username.trim() })
    }, 500)
    const setWebdavPassword = debounce(password => {
      updateSetting({ 'sync.webdav.password': password })
    }, 500)
    const setWebdavRemotePath = debounce(remotePath => {
      updateSetting({ 'sync.webdav.remotePath': remotePath.trim() })
    }, 500)

    return {
      appSetting,
      sync,
      busy,
      webdavStatusText,
      runAction,
      setWebdavUrl,
      setWebdavUsername,
      setWebdavPassword,
      setWebdavRemotePath,
      updateSetting,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.urlInput {
  min-width: 420px;
}

.halfInput {
  min-width: 300px;
}
</style>
