declare module 'unzip-crx-3' {
  /**
   * 解压 CRX（CRX2/CRX3）或 ZIP 格式的 Chrome 扩展文件到目标目录
   * @param crxFilePath 扩展文件路径
   * @param destination 解压目标目录，默认为文件同名目录
   */
  const unzip: (crxFilePath: string, destination?: string) => Promise<void>
  export default unzip
}
