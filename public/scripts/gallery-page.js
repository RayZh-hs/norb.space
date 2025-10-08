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
    var currentSlug = null

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

    function openLightbox(item) {
      if (!lbOverlay || !overlayImg) return
      currentSlug = item.slug
      overlayImg.classList.remove('is-loaded')
      if (!overlayImg.classList.contains('lazy-img')) overlayImg.classList.add('lazy-img')
      overlayImg.src = item.images.small.src
      overlayImg.alt = item.title || ''
      overlayImg.style.aspectRatio = item.images.raw.width + ' / ' + item.images.raw.height

      if (lbTitle) lbTitle.textContent = item.title
      if (lbDesc) lbDesc.textContent = item.description || ''
      applyTags(item.tags)

      if (lbLink) {
        if (item.externalLink) {
          lbLink.href = item.externalLink
          lbLink.style.display = 'inline-block'
        } else {
          lbLink.removeAttribute('href')
          lbLink.style.display = 'none'
        }
      }

      lbOverlay.classList.add('open')
      document.body.classList.add('no-scroll')

      var loader = new Image()
      loader.onload = function () {
        if (currentSlug !== item.slug) return
        overlayImg.src = item.images.raw.src
        overlayImg.classList.add('is-loaded')
      }
      loader.onerror = function () {
        overlayImg.classList.add('is-loaded')
      }
      loader.src = item.images.raw.src
    }

    function closeLightbox() {
      if (!lbOverlay || !overlayImg) return
      lbOverlay.classList.remove('open')
      document.body.classList.remove('no-scroll')
      currentSlug = null
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
      if (e.key === 'Escape') closeLightbox()
    })

    document.querySelectorAll('#gallery a.gallery-card').forEach(function (card) {
      card.addEventListener('click', function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
        e.preventDefault()
        var slug = card.getAttribute('data-slug')
        if (!slug) return
        var item = metaBySlug.get(slug)
        if (!item) return
        openLightbox(item)
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
      metaBySlug.set(item.slug, item)

      var wrap = document.createElement('div')
      wrap.className = 'break-inside-avoid animate'
      wrap.style.animationDelay = (idx * STAGGER_MS) + 'ms'

      var anchor = document.createElement('a')
      anchor.href = item.images.raw.src
      anchor.className = 'gallery-card'
      anchor.target = '_blank'
      anchor.rel = 'noopener noreferrer'
      anchor.dataset.slug = item.slug
      anchor.style.aspectRatio = item.images.raw.width + ' / ' + item.images.raw.height
      anchor.setAttribute('aria-label', item.title)

      var img = document.createElement('img')
      img.className = 'lazy-img w-full bg-gray-200 object-cover shadow-md transition-transform duration-300 dark:bg-gray-700'
  img.alt = item.title || ''
      img.loading = 'lazy'
      img.decoding = 'async'
      img.src = item.images.preview.src
      img.setAttribute('data-src', item.images.small.src)
      img.setAttribute('data-raw', item.images.raw.src)
      img.setAttribute('data-slug', item.slug)

      anchor.appendChild(img)
      anchor.appendChild(createOverlay())
      anchor.appendChild(createCaption(item.title))

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
