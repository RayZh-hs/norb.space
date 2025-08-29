// Client logic for Gallery page: fetch from our API, render tiny placeholders,
// then wire up normal images for the lazy loader to swap in.
(function () {
  async function boot() {
    try {
      var listRes = await fetch('/api/gallery')
      if (!listRes.ok) throw new Error('Failed to fetch gallery list')
      var list = await listRes.json()
      var uuid = list.uuid
      var metaById = new Map()
      if (list.items && Array.isArray(list.items)) {
        list.items.forEach(function (it) {
          metaById.set(String(it.id), { alt: it.alt || '', photographer: it.photographer || '' })
        })
      }

      var root = document.getElementById('gallery')
      if (!root) return
      var frag = document.createDocumentFragment()
      // Render skeleton/placeholders immediately based on list metadata
      ;(list.items || []).forEach(function (it) {
        var wrap = document.createElement('div')
        wrap.className = 'break-inside-avoid'
        var a = document.createElement('a')
        a.href = '#'
        a.target = '_blank'
        a.rel = 'noopener noreferrer'
        a.className = 'gallery-card'
        // Reserve space to avoid layout shift; use original aspect ratio
        if (it.width && it.height) {
          a.style.aspectRatio = it.width + ' / ' + it.height
        }

        var el = document.createElement('img')
        el.className = 'lazy-img w-full bg-gray-200 object-cover shadow-md transition-transform duration-300 dark:bg-gray-700'
        el.setAttribute('data-id', String(it.id))
        el.alt = (metaById.get(String(it.id)) || {}).alt || ''
        // Do not set src yet; tiny will fill it in when available
  el.style.height = '100%'
        el.setAttribute('loading', 'lazy')
        el.setAttribute('decoding', 'async')
        a.appendChild(el)
  var cardOverlay = document.createElement('div')
  cardOverlay.className = 'overlay'
  a.appendChild(cardOverlay)

        var cap = document.createElement('div')
        cap.className = 'caption'
        cap.textContent = (metaById.get(String(it.id)) || {}).alt || ''
        a.appendChild(cap)

        wrap.appendChild(a)
        frag.appendChild(wrap)
      })
      root.appendChild(frag)

      // Fetch tiny and normal in parallel and progressively hydrate the DOM
      var tinyPromise = fetch('/api/gallery/' + uuid + '?size=tiny')
        .then(function (r) { if (!r.ok) throw new Error('tiny'); return r.json() })
        .then(function (tiny) {
          tiny.images.forEach(function (img) {
            var el = root.querySelector('img[data-id="' + String(img.id) + '"]')
            if (el && !el.getAttribute('src')) el.setAttribute('src', img.url)
          })
        })
        .catch(function () { /* ignore tiny errors */ })

      var normalPromise = fetch('/api/gallery/' + uuid + '?size=normal')
        .then(function (r) { if (!r.ok) throw new Error('normal'); return r.json() })
        .then(function (normal) {
          var urlById = new Map(normal.images.map(function (im) { return [String(im.id), im.url] }))
          root.querySelectorAll('img.lazy-img').forEach(function (img) {
            var id = img.getAttribute('data-id')
            var full = id ? urlById.get(id) : undefined
            if (typeof full === 'string') img.setAttribute('data-src', full)
          })
          if (typeof window.__initGalleryLazy === 'function') window.__initGalleryLazy()
        })
        .catch(function () { /* ignore normal errors */ })

      // Lightbox: click to open zoomed image centered with dark overlay
      var lbOverlay = document.getElementById('lightbox')
      var overlayImg = document.getElementById('lightbox-img')
      var lbTitle = document.getElementById('lightbox-title')
      var lbDesc = document.getElementById('lightbox-desc')
      var lbLink = document.getElementById('lightbox-link')
      function openLightbox(opts) {
        if (!lbOverlay || !overlayImg) return
        overlayImg.src = opts.src
        overlayImg.alt = opts.alt || ''
        if (lbTitle) lbTitle.textContent = opts.title || ''
        if (lbDesc) lbDesc.textContent = opts.desc || ''
        if (lbLink) {
          if (opts.link) { lbLink.href = opts.link; lbLink.style.display = 'inline-block' }
          else { lbLink.removeAttribute('href'); lbLink.style.display = 'none' }
        }
        lbOverlay.classList.add('open')
        document.body.classList.add('no-scroll')
      }
      function closeLightbox() {
        if (!lbOverlay || !overlayImg) return
        lbOverlay.classList.remove('open')
        document.body.classList.remove('no-scroll')
        // Delay clearing src to avoid flash
        setTimeout(function(){ overlayImg.src = '' }, 200)
      }
      // Close on click outside image
      if (lbOverlay) {
        lbOverlay.addEventListener('click', function (e) {
          if (e.target === lbOverlay) closeLightbox()
        })
      }
      // Close on ESC
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeLightbox()
      })

      // Bind click to images
    document.querySelectorAll('#gallery a.gallery-card').forEach(function (a) {
        a.addEventListener('click', function (e) {
      // Always handle via lightbox
      e.preventDefault()
          var img = a.querySelector('img')
          if (!img) return
          // try hires API for ~2k image and richer metadata
          var id = img.getAttribute('data-id')
      var fallback = img.getAttribute('data-src') || img.getAttribute('src') || ''
          var meta = (id && metaById.get(String(id))) || { alt: img.getAttribute('alt') || '', photographer: '' }
          if (!id) return openLightbox({ src: fallback, alt: meta.alt, title: meta.photographer || meta.alt, desc: meta.alt })
          fetch('/api/gallery/' + uuid + '?size=hires')
            .then(function (r) { return r.json() })
            .then(function (data) {
              if (!data || !data.images) throw new Error('bad')
              var item = data.images.find(function (x) { return String(x.id) === String(id) }) || data.images[0]
              openLightbox({ src: item.url || fallback, alt: meta.alt, title: meta.photographer || meta.alt, desc: meta.alt })
            })
            .catch(function () {
              openLightbox({ src: fallback, alt: meta.alt, title: meta.photographer || meta.alt, desc: meta.alt })
            })
        })
      })
    } catch (e) {
      console.error(e)
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot)
  } else {
    boot()
  }
})()
