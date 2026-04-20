(function () {
  var script = document.currentScript
  if (!script) return

  var params = new URLSearchParams()
  params.set('referrer', window.location.hostname)

  var baseUrl = script.src.replace('/widget/embed-calculatrice.js', '')
  var src = baseUrl + '/widget/calculatrice?' + params.toString()

  var iframe = document.createElement('iframe')
  iframe.src = src
  iframe.title = 'Widget calculatrice de budget Mon Logement Étudiant'
  iframe.style.cssText = 'display:block;width:100%;border:none;transition:height 0.3s ease;'
  iframe.setAttribute('loading', 'lazy')
  iframe.setAttribute('frameborder', '0')

  iframe.onload = function () {
    var w = iframe.offsetWidth
    iframe.style.height = w < 640 ? '2000px' : '1400px'
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
