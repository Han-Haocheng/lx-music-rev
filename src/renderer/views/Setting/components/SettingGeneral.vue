<template lang="pug">
SettingBasic
SettingSearch
SettingList
SettingOther
</template>

<script>
import SettingBasic from './SettingBasic.vue'
import SettingSearch from './SettingSearch.vue'
import SettingList from './SettingList.vue'
import SettingOther from './SettingOther.vue'

export default {
  name: 'SettingGeneral',
  components: {
    SettingBasic,
    SettingSearch,
    SettingList,
    SettingOther,
  },
}
</script>
