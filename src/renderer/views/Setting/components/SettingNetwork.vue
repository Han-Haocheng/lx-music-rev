<template lang="pug">
dt#network {{ $t('setting__network') }}
dd
  h3#network_proxy_title {{ $t('setting__network_proxy_title') }}
  div
    .p
      base-checkbox(id="setting_network_proxy_enable" :model-value="appSetting['network.proxy.enable']" :label="$t('setting__is_enable')" @update:model-value="updateSetting({'network.proxy.enable': $event})")
    .p
      base-input(:model-value="appSetting['network.proxy.host']" :placeholder="proxy.envProxy ? proxy.envProxy.host : $t('setting__network_proxy_host')" @update:model-value="setHost")
    .p
      base-input(:model-value="appSetting['network.proxy.port']" :placeholder="proxy.envProxy ? proxy.envProxy.port : $t('setting__network_proxy_port')" @update:model-value="setPort")

dd
  h3#open_api {{ $t('setting__open_api') }}
  div
    .p
      base-checkbox(id="setting_open_api_enable" :model-value="appSetting['openAPI.enable']" :label="$t('setting__open_api_enable')" @update:model-value="updateSetting({ 'openAPI.enable': $event })")
    .p.gap-top
      base-checkbox(id="setting_open_api_bind_lan" :model-value="appSetting['openAPI.bindLan']" :label="$t('setting__open_api_bind_lan')" @update:model-value="updateSetting({ 'openAPI.bindLan': $event })")
    .p.gap-top.small
      | {{ $t('setting__open_api_address') }}
      span.select {{ openAPI.address }}
    .p.small(v-if="openAPI.message") {{ openAPI.message }}
    .p
      .p.small {{ $t('setting__open_api_port') }}
      div
        base-input.gap-left(:class="$style.portInput" :model-value="appSetting['openAPI.port']" type="number" :placeholder="$t('setting__open_api_port_tip')" @update:model-value="setOpenAPIPort")

dd.gap-top
  div
    .p
      | {{ $t('setting__open_api_tip') }}
      strong.hover.underline(aria-label="https://lyswhut.github.io/lx-music-doc/desktop/faq/open-api" @click="openUrl('https://lyswhut.github.io/lx-music-doc/desktop/open-api')") {{ $t('setting__open_api_tip_link') }}

</template>

<script>
import { onBeforeUnmount } from '@common/utils/vueTools'
import { proxy, openAPI } from '@renderer/store'
import { debounce } from '@common/utils'
import { openUrl } from '@common/utils/electron'

import { appSetting, updateSetting } from '@renderer/store/setting'

export default {
  name: 'SettingNetwork',
  setup() {
    const setHost = debounce(host => {
      // 写入前剥离误填的 http(s):// 前缀（主进程组装 proxyRules 时会再拼 http://，避免 http://http://…）
      updateSetting({ 'network.proxy.host': host.trim().replace(/^https?:\/\//i, '') })
    }, 500)
    const setPort = debounce(port => {
      updateSetting({ 'network.proxy.port': port.trim() })
    }, 500)
    const setOpenAPIPort = debounce(port => {
      updateSetting({ 'openAPI.port': port.trim() })
    }, 500)

    onBeforeUnmount(() => {
      // 离开页面时若开启代理但未填 host（请求实际不会走固定代理），回写设置并同步 store，
      // 避免 appSetting(UI 显开) 与 proxy store 不一致，导致之后填好 host 也要重启才能生效
      if (appSetting['network.proxy.enable'] && !appSetting['network.proxy.host']) {
        proxy.enable = false
        updateSetting({ 'network.proxy.enable': false })
      }
    })

    return {
      appSetting,
      updateSetting,
      setHost,
      setPort,
      setOpenAPIPort,
      proxy,
      openAPI,
      openUrl,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';
.portInput[disabled], .hostInput[disabled] {
  opacity: .8 !important;
}
</style>
