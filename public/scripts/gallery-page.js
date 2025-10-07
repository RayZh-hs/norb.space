// Client logic for Gallery page: fetch from our API, render tiny placeholders,
// then wire up normal images for the lazy loader to swap in.
(function () {
  async function boot() {
    console.log("booted")
    try {

      var root = document.getElementById('gallery')
      if (!root) return

      // Kick off list fetch and render placeholders immediately to avoid blank page
      var listPromise = fetch('/api/gallery')
      var renderPlaceholders = function (count) {
        var f = document.createDocumentFragment()
        for (var i = 0; i < count; i++) {
          var w = document.createElement('div')
          w.className = 'break-inside-avoid animate'
          w.style.animationDelay = (i * 10) + 'ms'
          var a = document.createElement('a')
          a.href = '#'
          a.className = 'gallery-card'
          // Use a gentle default ratio to reserve height
          a.style.aspectRatio = '4 / 3'
          var img = document.createElement('img')
          img.className = 'lazy-img w-full bg-gray-200 object-cover shadow-md transition-transform duration-300 dark:bg-gray-700'
          img.alt = ''
          img.style.height = '100%'
          a.appendChild(img)
          var ov = document.createElement('div')
          ov.className = 'overlay'
          a.appendChild(ov)
          var cap = document.createElement('div')
          cap.className = 'caption'
          cap.textContent = ''
          a.appendChild(cap)
          w.appendChild(a)
          f.appendChild(w)
        }
        root.appendChild(f)
      }
      renderPlaceholders(12)

      var listRes = await listPromise
      if (!listRes.ok) throw new Error('Failed to fetch gallery list')
      var list = await listRes.json()
      var uuid = list.uuid
      var metaById = new Map()
      if (list.items && Array.isArray(list.items)) {
        list.items.forEach(function (it) {
          metaById.set(String(it.id), { alt: it.alt || '', photographer: it.photographer || '', width: it.width, height: it.height })
        })
      }

      // Replace placeholders with actual items
      root.innerHTML = ''
      var frag = document.createDocumentFragment()
        // Render skeleton/placeholders immediately based on list metadata
        ; (list.items || []).forEach(function (it, idx) {
          var wrap = document.createElement('div')
          wrap.className = 'break-inside-avoid animate'
          wrap.style.animationDelay = (idx * 10) + 'ms'
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

      // Prepare URL caches for lightbox
      var tinyUrlById = new Map()
      var normalUrlById = new Map()

      // Fetch tiny and normal in parallel and progressively hydrate the DOM
      var tinyPromise = fetch('/api/gallery/' + uuid + '?size=tiny')
        .then(function (r) { if (!r.ok) throw new Error('tiny'); return r.json() })
        .then(function (r) { console.log("Tiny loaded"); return r; })
        .then(function (tiny) {
          tiny.images.forEach(function (img) {
            tinyUrlById.set(String(img.id), img.url)
            var el = root.querySelector('img[data-id="' + String(img.id) + '"]')
            if (el && !el.getAttribute('src')) el.setAttribute('src', img.url)
          })
        })
        .catch(function () { /* ignore tiny errors */ })

      var normalPromise = fetch('/api/gallery/' + uuid + '?size=normal')
        .then(function (r) { if (!r.ok) throw new Error('normal'); return r.json() })
        .then(function (r) { console.log("Normal loaded"); return r; })
        .then(function (normal) {
          var urlById = new Map(normal.images.map(function (im) { return [String(im.id), im.url] }))
          urlById.forEach(function (u, k) { normalUrlById.set(k, u) })
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
      var currentLightboxId = null
      function openLightbox(opts) {
        if (!lbOverlay || !overlayImg) return
        // Start blurred; swap to final image on load elsewhere
        overlayImg.classList.remove('is-loaded')
        if (!overlayImg.classList.contains('lazy-img')) overlayImg.classList.add('lazy-img')
        overlayImg.src = opts.src
        overlayImg.alt = opts.alt || ''
        // Reserve final size using aspect ratio when available
        if (opts.width && opts.height) {
          console.log(opts)
          overlayImg.style.aspectRatio = opts.width + ' / ' + opts.height
          overlayImg.style.width = opts.width + 'px'
          overlayImg.style.height = opts.height + 'px'
        } else {
          overlayImg.style.removeProperty('aspect-ratio')
          overlayImg.style.removeProperty('width')
          overlayImg.style.removeProperty('height')
        }
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
        setTimeout(function () {
          overlayImg.src = ''
          overlayImg.classList.remove('is-loaded')
          overlayImg.style.removeProperty('aspect-ratio')
          overlayImg.style.removeProperty('width')
          overlayImg.style.removeProperty('height')
        }, 200)
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
          var meta = (id && metaById.get(String(id))) || { alt: img.getAttribute('alt') || '', photographer: '', width: undefined, height: undefined }
          // Open immediately with tiny (blurred) or fallback
          var tinySrc = (id && tinyUrlById.get(String(id))) || fallback
          openLightbox({ src: tinySrc, alt: meta.alt, title: meta.photographer || meta.alt, desc: meta.alt, width: meta.width, height: meta.height })
          if (!id) return
          currentLightboxId = String(id)
          // Then fetch hires and swap on load
          fetch('/api/gallery/' + uuid + '?size=hires')
            .then(function (r) { return r.json() })
            .then(function (data) {
              if (!data || !data.images) throw new Error('bad')
              var item = data.images.find(function (x) { return String(x.id) === String(id) }) || data.images[0]
              var targetUrl = item && item.url ? item.url : (normalUrlById.get(String(id)) || fallback)
              if (!targetUrl) return
              var pre = new Image()
              pre.onload = function () {
                if (currentLightboxId !== String(id)) return
                overlayImg.src = targetUrl
                overlayImg.classList.add('is-loaded')
              }
              pre.onerror = function () {
                if (currentLightboxId !== String(id)) return
                var nf = normalUrlById.get(String(id)) || fallback
                if (!nf) return
                var pre2 = new Image()
                pre2.onload = function () { if (currentLightboxId === String(id)) { overlayImg.src = nf; overlayImg.classList.add('is-loaded') } }
                pre2.src = nf
              }
              pre.src = targetUrl
            })
            .catch(function () {
              // Try normal or fallback
              var nf = normalUrlById.get(String(id)) || fallback
              if (!nf) return
              var pre = new Image()
              pre.onload = function () { if (currentLightboxId === String(id)) { overlayImg.src = nf; overlayImg.classList.add('is-loaded') } }
              pre.src = nf
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
