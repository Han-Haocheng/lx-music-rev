import { mainHandle } from '@common/mainIpc'
import { WIN_MAIN_RENDERER_EVENT_NAME } from '@common/ipcNames'

// 腾讯(Qq)歌词解密：原为私有 qrc_decode 预编译算法（源码未公开，且仅绑定 Electron 40 的 ABI），
// 无法以纯 JS 实现。此处保留 handle_tx_decode_lyric 接口以兼容渲染端与不同音源，
// 实现改为原样返回（不再解密）：
//  - 若音源传入的是未加密的 lrc/tlrc/rlrc，仍可正常解析；
//  - QQ 音源的 qrc 加密歌词将无法解码显示（涉及私有算法，属预期降级）。
const handleDecode = (lrc: string, tlrc: string, rlrc: string) => ({ lyric: lrc, tlyric: tlrc, rlyric: rlrc })


export default () => {
  mainHandle<{ lrc: string, tlrc: string, rlrc: string }, { lyric: string, tlyric: string, rlyric: string }>(WIN_MAIN_RENDERER_EVENT_NAME.handle_tx_decode_lyric, async({ params: { lrc, tlrc, rlrc } }) => {
    return handleDecode(lrc, tlrc, rlrc)
  })
}
