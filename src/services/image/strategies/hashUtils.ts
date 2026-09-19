export async function computeSHA1(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', data.buffer as ArrayBuffer)
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}
