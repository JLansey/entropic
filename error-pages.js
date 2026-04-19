(function() {
  var messages = [
    '🔥 CLOD 4 OOPUS NOW AVAILABLE 🔥',
    'SAFETY-LAST AI FOR THE REST OF US',
    'NOW WITH 47% MORE HALLUCINATIONS',
    'TRUSTED BY ABSOLUTELY NOBODY',
    'AS SEEN ON... ACTUALLY, NOWHERE'
  ];

  function buildMarquee() {
    var wrapper = document.createElement('div');
    wrapper.className = 'marquee-wrapper';

    var marquee = document.createElement('div');
    marquee.className = 'marquee';

    for (var repeat = 0; repeat < 2; repeat++) {
      for (var i = 0; i < messages.length; i++) {
        var span = document.createElement('span');
        span.textContent = messages[i];
        marquee.appendChild(span);
      }
    }

    wrapper.appendChild(marquee);
    return wrapper;
  }

  function initErrorPage() {
    var body = document.body;
    if (!body || !body.classList.contains('error-page')) return;

    var slot = body.querySelector('[data-error-marquee]');
    if (!slot || slot.getAttribute('data-error-marquee-ready') === 'true') return;

    slot.setAttribute('data-error-marquee-ready', 'true');
    slot.replaceWith(buildMarquee());
  }

  window.initErrorPage = initErrorPage;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initErrorPage);
  } else {
    initErrorPage();
  }
})();
