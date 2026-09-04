<template lang="pug">
dt#local_music {{ $t('setting__local_music') }}
dd
  h3#local_music_scan_folders {{ $t('setting__local_music_scan_folders') }}
  p.tip {{ $t('setting__local_music_scan_folders_tip') }}
  template(v-if="scanFolders.length")
    .p(v-for="folder in scanFolders" :key="folder")
      span.auto-hidden.hover(:class="$style.folderPath" :aria-label="$t('setting__local_music_open_folder_label')" @click="openDirInExplorer(folder)") {{ folder }}
      base-btn.btn.gap-left(min @click="handleRemoveFolder(folder)") {{ $t('setting__local_music_remove_btn') }}
  p(v-else) {{ $t('setting__local_music_scan_folders_empty') }}
  .p
    base-btn.btn(min @click="handleAddFolder") {{ $t('setting__local_music_add_folder_btn') }}
  .p
    base-btn.btn(min :disabled="scanning" @click="handleScanAll") {{ $t('setting__local_music_scan_now_btn') }}
</template>

<script>
import { computed, ref } from '@common/utils/vueTools'
import { showSelectDialog, openDirInExplorer } from '@renderer/utils/ipc'
import { appSetting, updateSetting } from '@renderer/store/setting'
import { addScanFolderToSettings, removeScanFolderFromSettings, scanAllFolders } from '@renderer/store/localList'
import { dialog } from '@renderer/plugins/Dialog'

export default {
  name: 'SettingLocal',
  setup() {
    const scanning = ref(false)

    const scanFolders = computed(() => appSetting['local.scanFolders'] ?? [])

    const handleAddFolder = () => {
      void showSelectDialog({
        title: window.i18n.t('setting__local_music_add_folder_btn'),
        properties: ['openDirectory'],
      }).then(result => {
        if (result.canceled || !result.filePaths.length) return
        const res = addScanFolderToSettings(result.filePaths[0])
        if (res.reason == 'conflict') {
          void dialog({ message: window.i18n.t('setting__local_music_folder_conflict') })
        }
      })
    }

    const handleRemoveFolder = (folder) => {
      removeScanFolderFromSettings(folder)
    }

    const handleScanAll = async() => {
      if (scanning.value) return
      scanning.value = true
      try {
        const result = await scanAllFolders()
        void dialog({ message: window.i18n.t('setting__local_music_scan_done', { folders: result.folderCount, files: result.fileCount }) })
      } catch (err) {
        console.warn(err)
        void dialog({ message: window.i18n.t('local_music__scan_failed') })
      } finally {
        scanning.value = false
      }
    }

    return {
      scanFolders,
      scanning,
      handleAddFolder,
      handleRemoveFolder,
      handleScanAll,
      openDirInExplorer,
      updateSetting,
    }
  },
}
</script>

<style lang="less" module>
.folderPath {
  color: var(--color-primary);
  cursor: pointer;
  word-break: break-all;
}
</style>
