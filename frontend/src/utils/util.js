export const getFilenameWithoutExtension = (filename) => {
  if (!filename) return ''
  const lastDotIndex = filename.lastIndexOf('.')
  const lastSlashIndex = Math.max(filename.lastIndexOf('/'), filename.lastIndexOf('\\'))
  
  const nameStart = lastSlashIndex + 1
  const nameEnd = lastDotIndex > lastSlashIndex ? lastDotIndex : filename.length
  
  return filename.substring(nameStart, nameEnd)
}