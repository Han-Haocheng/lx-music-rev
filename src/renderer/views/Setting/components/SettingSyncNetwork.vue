<template lang="pug">
SettingSync
SettingNetwork
</template>

<script>
import SettingSync from './SettingSync/index.vue'
import SettingNetwork from './SettingNetwork.vue'

export default {
  name: 'SettingSyncNetwork',
  components: {
    SettingSync,
    SettingNetwork,
  },
}
</script>
