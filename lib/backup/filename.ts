export const BACKUP_FILENAME_RE =
  /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}(-\d+)?\.sql$/

const pad = (value: number, length = 2) =>
  String(value).padStart(length, "0")

export function backupBaseName(date: Date): string {
  const year = pad(date.getFullYear(), 4)
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hours = pad(date.getHours())
  const minutes = pad(date.getMinutes())
  const seconds = pad(date.getSeconds())
  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`
}

export function isBackupFilename(name: string): boolean {
  return BACKUP_FILENAME_RE.test(name)
}
