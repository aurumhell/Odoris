(() => {
  const METRIKA_COUNTER_ID = 114672905;

  if (!Number.isSafeInteger(METRIKA_COUNTER_ID) || METRIKA_COUNTER_ID <= 0) return;

  (function (m, e, t, r, i, k, a) {
    m[i] = m[i] || function () {
      (m[i].a = m[i].a || []).push(arguments);
    };
    m[i].l = 1 * new Date();
    for (let j = 0; j < e.scripts.length; j += 1) {
      if (e.scripts[j].src === r) return;
    }
    k = e.createElement(t);
    a = e.getElementsByTagName(t)[0];
    k.async = true;
    k.src = r;
    a.parentNode.insertBefore(k, a);
  })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js', 'ym');

  window.ym(METRIKA_COUNTER_ID, 'init', {
    clickmap: true,
    trackLinks: true,
    accurateTrackBounce: true
  });
})();
