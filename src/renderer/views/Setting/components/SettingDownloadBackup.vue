<template lang="pug">
SettingDownload
SettingBackup
SettingLocal
</template>

<script>
import SettingDownload from './SettingDownload.vue'
import SettingBackup from './SettingBackup.vue'
import SettingLocal from './SettingLocal.vue'

export default {
  name: 'SettingDownloadBackup',
  components: {
    SettingDownload,
    SettingBackup,
    SettingLocal,
  },
}
</script>
