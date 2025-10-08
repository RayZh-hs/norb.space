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
        var nextSrc = img.getAttribute('data-src')
        var rawSrc = img.getAttribute('data-raw')

        if (!nextSrc) {
          observer.unobserve(img)
          return
        }

        var onSmallLoad = function () {
          img.removeEventListener('load', onSmallLoad)
          img.setAttribute('data-loaded-small', 'true')

          if (!rawSrc) {
            img.classList.add('is-loaded')
            return
          }

          var loader = new Image()
          loader.onload = function () {
            img.src = rawSrc
            img.classList.add('is-loaded')
          }
          loader.onerror = function () {
            img.classList.add('is-loaded')
          }
          loader.src = rawSrc
          img.removeAttribute('data-raw')
        }

        img.addEventListener('load', onSmallLoad, { once: true })

        img.src = nextSrc
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
