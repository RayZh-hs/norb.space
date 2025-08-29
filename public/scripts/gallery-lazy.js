// Lazy-load with blur-up: swap to high-res when in view, then un-blur on load
(function () {
  if (typeof window === 'undefined') return

  function init() {
    var images = document.querySelectorAll('img.lazy-img[data-src]')
    if (!images.length) return

    var onIntersect = function (entries, observer) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return
        var img = entry.target
        var highSrc = img.getAttribute('data-src')
        if (!highSrc) {
          observer.unobserve(img)
          return
        }

        var handleLoad = function () {
          img.classList.add('is-loaded')
          img.removeEventListener('load', handleLoad)
        }
        img.addEventListener('load', handleLoad, { once: true })

        // Switch to high res
        img.src = highSrc
        img.removeAttribute('data-src')
        observer.unobserve(img)
      })
    }

    var io = new IntersectionObserver(onIntersect, { rootMargin: '200px 0px', threshold: 0.01 })
    images.forEach(function (img) { io.observe(img) })
  }

  // Expose a way to re-initialize after DOM changes
  try { window.__initGalleryLazy = init } catch (_) {}

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
