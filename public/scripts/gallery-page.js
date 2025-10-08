// Client logic for Gallery page: fetch local gallery metadata and progressively
// enhance images from preview -> small -> raw while wiring up the lightbox.
(function () {
  var PLACEHOLDER_COUNT = 9
  var STAGGER_MS = 60

  function renderPlaceholders(root, count) {
    if (!root) return
    var frag = document.createDocumentFragment()
    for (var i = 0; i < count; i++) {
      var wrap = document.createElement('div')
      wrap.className = 'break-inside-avoid animate'
      wrap.style.animationDelay = (i * STAGGER_MS) + 'ms'

      var anchor = document.createElement('a')
      anchor.href = '#'
      anchor.className = 'gallery-card'
      anchor.style.aspectRatio = '4 / 3'

      var img = document.createElement('img')
      img.className = 'lazy-img w-full bg-gray-200 object-cover shadow-md transition-transform duration-300 dark:bg-gray-700'
      img.alt = ''
      img.loading = 'lazy'
      img.decoding = 'async'

      anchor.appendChild(img)
      anchor.appendChild(createOverlay())
      anchor.appendChild(createCaption(''))

      wrap.appendChild(anchor)
      frag.appendChild(wrap)
    }
    root.appendChild(frag)
  }

  function createOverlay() {
    var overlay = document.createElement('div')
    overlay.className = 'overlay'
    return overlay
  }

  function createCaption(text) {
    var cap = document.createElement('div')
    cap.className = 'caption'
    cap.textContent = text
    return cap
  }

  function setupLightbox(metaBySlug) {
    var lbOverlay = document.getElementById('lightbox')
    var overlayImg = document.getElementById('lightbox-img')
    var lbTitle = document.getElementById('lightbox-title')
    var lbDesc = document.getElementById('lightbox-desc')
    var lbLink = document.getElementById('lightbox-link')
    var lbTags = document.getElementById('lightbox-tags')
    var lbPrev = document.getElementById('lightbox-prev')
    var lbNext = document.getElementById('lightbox-next')
    var currentSlug = null
    var currentItem = null
    var currentFrameIndex = 0

    function applyTags(tags) {
      if (!lbTags) return
      lbTags.innerHTML = ''
      if (!tags || !tags.length) {
        lbTags.style.display = 'none'
        return
      }
      tags.forEach(function (tag) {
        var chip = document.createElement('span')
        chip.className = 'lb-tag'
        chip.textContent = tag
        lbTags.appendChild(chip)
      })
      lbTags.style.display = 'flex'
    }

    function updateNavButtons(item) {
      if (!lbPrev || !lbNext) return
      var total = item.frames.length
      if (total <= 1) {
        lbPrev.hidden = true
        lbNext.hidden = true
        lbPrev.style.display = 'none'
        lbNext.style.display = 'none'
        console.log("Removed property for: ", lbPrev, lbNext)
        return
      } else {
        lbPrev.style.removeProperty('display')
        lbNext.style.removeProperty('display')
        lbPrev.hidden = false
        lbNext.hidden = false
      }
      lbPrev.disabled = currentFrameIndex <= 0
      lbNext.disabled = currentFrameIndex >= total - 1
    }

    function showFrame(item, frameIndex) {
      if (!lbOverlay || !overlayImg) return
      var frame = item.frames[frameIndex]
      if (!frame) return
      currentFrameIndex = frameIndex
      overlayImg.classList.remove('is-loaded')
      if (!overlayImg.classList.contains('lazy-img')) overlayImg.classList.add('lazy-img')
      overlayImg.src = frame.images.small.src
      overlayImg.alt = frame.title || item.title || ''
      overlayImg.style.aspectRatio = frame.images.raw.width + ' / ' + frame.images.raw.height

      if (lbTitle) lbTitle.textContent = frame.title || item.title
      if (lbDesc) lbDesc.textContent = frame.description || item.description || ''
      applyTags(frame.tags.length ? frame.tags : item.tags)

      if (lbLink) {
        if (item.externalLink) {
          lbLink.href = item.externalLink
          lbLink.style.display = 'inline-block'
        } else {
          lbLink.removeAttribute('href')
          lbLink.style.display = 'none'
        }
      }

      updateNavButtons(item)

      var loader = new Image()
      loader.onload = function () {
        if (!currentItem || currentItem.slug !== item.slug || currentFrameIndex !== frameIndex) return
        overlayImg.src = frame.images.raw.src
        overlayImg.classList.add('is-loaded')
      }
      loader.onerror = function () {
        overlayImg.classList.add('is-loaded')
      }
      loader.src = frame.images.raw.src
    }

    function openLightbox(item, frameIndex) {
      if (!lbOverlay || !overlayImg) return
      currentSlug = item.slug
      currentItem = item
      showFrame(item, Math.max(0, Math.min(frameIndex || 0, item.frames.length - 1)))

      lbOverlay.classList.add('open')
      document.body.classList.add('no-scroll')
    }

    function closeLightbox() {
      if (!lbOverlay || !overlayImg) return
      lbOverlay.classList.remove('open')
      document.body.classList.remove('no-scroll')
      currentSlug = null
      currentItem = null
      currentFrameIndex = 0
      if (lbPrev) { lbPrev.hidden = true; lbPrev.disabled = false }
      if (lbNext) { lbNext.hidden = true; lbNext.disabled = false }
      setTimeout(function () {
        overlayImg.src = ''
        overlayImg.classList.remove('is-loaded')
        overlayImg.style.removeProperty('aspect-ratio')
      }, 200)
    }

    if (lbOverlay) {
      lbOverlay.addEventListener('click', function (e) {
        if (e.target === lbOverlay) closeLightbox()
      })
    }

    document.addEventListener('keydown', function (e) {
      if (lbOverlay && lbOverlay.classList.contains('open')) {
        if (e.key === 'Escape') closeLightbox()
        if (e.key === 'ArrowRight') navigate(1)
        if (e.key === 'ArrowLeft') navigate(-1)
      }
    })

    function navigate(delta) {
      if (!currentItem) return
      var nextIndex = currentFrameIndex + delta
      if (nextIndex < 0 || nextIndex >= currentItem.frames.length) return
      showFrame(currentItem, nextIndex)
      if (delta > 0 && lbNext) lbNext.focus()
      else if (delta < 0 && lbPrev) lbPrev.focus()
    }

    if (lbPrev) {
      lbPrev.addEventListener('click', function () { navigate(-1) })
    }
    if (lbNext) {
      lbNext.addEventListener('click', function () { navigate(1) })
    }

    document.querySelectorAll('#gallery a.gallery-card').forEach(function (card) {
      card.addEventListener('click', function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
        e.preventDefault()
        var slug = card.getAttribute('data-slug')
        if (!slug) return
        var item = metaBySlug.get(slug)
        if (!item) return
        openLightbox(item, 0)
      })
    })
  }

  async function boot() {
    var root = document.getElementById('gallery')
    if (!root) return

    renderPlaceholders(root, PLACEHOLDER_COUNT)

    var res = await fetch('/api/gallery')
    if (!res.ok) throw new Error('Failed to fetch gallery data')
    var payload = await res.json()
    var items = Array.isArray(payload.items) ? payload.items : []

    var metaBySlug = new Map()
    root.innerHTML = ''

    var frag = document.createDocumentFragment()
    items.forEach(function (item, idx) {
      if (!item || !item.cover || !Array.isArray(item.frames) || !item.frames.length) return
      metaBySlug.set(item.slug, item)
      var cover = item.cover

      var wrap = document.createElement('div')
      wrap.className = 'break-inside-avoid animate'
      wrap.style.animationDelay = (idx * STAGGER_MS) + 'ms'

      var anchor = document.createElement('a')
      anchor.href = cover.images.raw.src
      anchor.className = 'gallery-card'
      anchor.target = '_blank'
      anchor.rel = 'noopener noreferrer'
      anchor.dataset.slug = item.slug
      anchor.style.aspectRatio = cover.images.raw.width + ' / ' + cover.images.raw.height
      anchor.setAttribute('aria-label', cover.title || item.title)

      var img = document.createElement('img')
      img.className = 'lazy-img w-full bg-gray-200 object-cover shadow-md transition-transform duration-300 dark:bg-gray-700'
      img.alt = cover.title || item.title || ''
      img.loading = 'lazy'
      img.decoding = 'async'
      img.src = cover.images.preview.src
      img.setAttribute('data-src', cover.images.small.src)
      img.setAttribute('data-raw', cover.images.raw.src)
      img.setAttribute('data-slug', item.slug)

      anchor.appendChild(img)
      anchor.appendChild(createOverlay())
      anchor.appendChild(createCaption(cover.title || item.title))

      wrap.appendChild(anchor)
      frag.appendChild(wrap)
    })

    root.appendChild(frag)

    if (typeof window.__initGalleryLazy === 'function') window.__initGalleryLazy()

    setupLightbox(metaBySlug)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      boot().catch(function (err) { console.error(err) })
    })
  } else {
    boot().catch(function (err) { console.error(err) })
  }
})()
