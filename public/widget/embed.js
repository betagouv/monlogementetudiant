(function () {
  var script = document.currentScript
  if (!script) return

  var params = new URLSearchParams()
  var attrs = ['city', 'bbox', 'prix', 'crous', 'colocation', 'accessible', 'filters', 'page']
  attrs.forEach(function (key) {
    var value = script.getAttribute('data-' + key)
    if (value) params.set(key, value)
  })

  params.set('referrer', window.location.hostname)

  var baseUrl = script.src.replace('/widget/embed.js', '')
  var src = baseUrl + '/widget/logements' + (params.toString() ? '?' + params.toString() : '')

  var iframe = document.createElement('iframe')
  iframe.src = src
  iframe.title = 'Widget Mon Logement Étudiant'
  iframe.style.cssText = 'display:block;width:100%;border:none;transition:height 0.3s ease;'
  iframe.setAttribute('loading', 'lazy')
  iframe.setAttribute('frameborder', '0')

  // Initial height based on width to avoid blank space before postMessage kicks in
  iframe.onload = function () {
    var w = iframe.offsetWidth
    iframe.style.height = w < 640 ? '2400px' : w < 1024 ? '1400px' : '1100px'
  }

  window.addEventListener('message', function (e) {
    try {
      var d = e.data
      if (d && d.type === 'resize' && d.source === 'mle-widget' && d.height) {
        iframe.style.height = d.height + 'px'
      }
    } catch (err) {
      /* ignore */
    }
  })

  var targetId = script.getAttribute('data-target')
  var target = targetId ? document.getElementById(targetId) : null
  if (target) {
    target.appendChild(iframe)
  } else {
    script.parentNode.insertBefore(iframe, script.nextSibling)
  }
})()
