let activeUploads = 0
const listeners = new Set()

function emit() {
  listeners.forEach((l) => {
    try {
      l(activeUploads)
    } catch (_) {}
  })
}

export function beginUpload() {
  activeUploads += 1
  emit()
  let ended = false
  return () => {
    if (ended) return
    ended = true
    activeUploads = Math.max(0, activeUploads - 1)
    emit()
  }
}

export function isUploadInProgress() {
  return activeUploads > 0
}

export function getActiveUploadCount() {
  return activeUploads
}

export function subscribeUploadGuard(listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

