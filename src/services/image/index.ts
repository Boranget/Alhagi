export { PathTemplate } from './strategies/PathTemplate'
export type { PathTemplateContext } from './strategies/PathTemplate'

export { escapeImageUrl } from './strategies/escapeImageUrl'

export { KeepOriginalStrategy } from './strategies/KeepOriginalStrategy'
export { CopyStrategy } from './strategies/CopyStrategy'
export { PathResolver } from './strategies/PathResolver'
export { ImageFetcher } from './strategies/ImageFetcher'

export { ImageInsertService } from './ImageInsertService'

export { extractFileNameFromUrl, uint8ArrayToBase64, fileToImageSource, blobToImageSource, urlToImageSource } from './ImagePasteHandler'
