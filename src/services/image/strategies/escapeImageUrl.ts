export function escapeImageUrl(url: string): string {
  return url
    .replace(/%/g, '%25')
    .replace(/\?/g, '%3F')
    .replace(/#/g, '%23')
    .replace(/\[/g, '%5B')
    .replace(/\]/g, '%5D')
    .replace(/@/g, '%40')
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/ /g, '%20')
}
