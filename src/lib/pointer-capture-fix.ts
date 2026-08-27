// Pointer capture release safety fix for browsers
if (typeof Element !== 'undefined' && Element.prototype.releasePointerCapture) {
  const origRelease = Element.prototype.releasePointerCapture
  Element.prototype.releasePointerCapture = function (id: number) {
    try {
      if (this.hasPointerCapture && this.hasPointerCapture(id)) {
        origRelease.call(this, id)
      }
    } catch {
      // ignore
    }
  }
}
