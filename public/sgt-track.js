/* SGT — script de captura de atribuição multi-toque.
 * Cole antes de </head> em todas as Landing Pages:
 *   <script src="https://sgt.grupoblue.com.br/sgt-track.js" async></script>
 *
 * Captura UTMs do query-string, armazena first-touch (TTL 30 dias) e histórico
 * de toques (até 20) em localStorage. Forms enviam esses dados como hidden inputs.
 */
(function () {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;

  var KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
  var TTL_MS = 30 * 24 * 60 * 60 * 1000;
  var params = new URLSearchParams(window.location.search);
  var hasUtm = KEYS.some(function (k) { return params.get(k); });

  // TTL check: limpa first-touch expirado
  var exp = parseInt(localStorage.getItem("sgt_first_touch_expira") || "0", 10);
  if (exp && Date.now() > exp) {
    localStorage.removeItem("sgt_first_touch");
    localStorage.removeItem("sgt_first_touch_expira");
  }

  if (hasUtm) {
    var current = {
      ts: Date.now(),
      referrer: document.referrer || null,
      url: window.location.href,
    };
    KEYS.forEach(function (k) { current[k] = params.get(k); });

    // First-touch: só grava se ainda não existe
    if (!localStorage.getItem("sgt_first_touch")) {
      localStorage.setItem("sgt_first_touch", JSON.stringify(current));
      localStorage.setItem("sgt_first_touch_expira", String(Date.now() + TTL_MS));
    }
    // Last-touch
    localStorage.setItem("sgt_last_touch", JSON.stringify(current));
    // Histórico (até 20)
    var hist;
    try { hist = JSON.parse(localStorage.getItem("sgt_touchpoints") || "[]"); } catch (e) { hist = []; }
    if (!Array.isArray(hist)) hist = [];
    hist.push(current);
    if (hist.length > 20) hist = hist.slice(-20);
    localStorage.setItem("sgt_touchpoints", JSON.stringify(hist));
  }

  // Helper público: window.sgtTracker.injectInto(form)
  function readJson(key) {
    try { return JSON.parse(localStorage.getItem(key) || "null"); } catch (e) { return null; }
  }

  function buildHidden(name, value) {
    var input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value == null ? "" : String(value);
    return input;
  }

  function injectInto(form) {
    if (!form || form.dataset.sgtTrackInjected === "1") return;
    var firstTouch = readJson("sgt_first_touch");
    var lastTouch = readJson("sgt_last_touch");
    var touchpoints = readJson("sgt_touchpoints") || [];

    if (firstTouch) {
      form.appendChild(buildHidden("first_touch_utm_source", firstTouch.utm_source));
      form.appendChild(buildHidden("first_touch_utm_medium", firstTouch.utm_medium));
      form.appendChild(buildHidden("first_touch_utm_campaign", firstTouch.utm_campaign));
      form.appendChild(buildHidden("first_touch_utm_content", firstTouch.utm_content));
      form.appendChild(buildHidden("first_touch_utm_term", firstTouch.utm_term));
      form.appendChild(buildHidden("first_touch_em", new Date(firstTouch.ts || Date.now()).toISOString()));
    }
    if (lastTouch) {
      KEYS.forEach(function (k) {
        // Só preenche se o form NÃO já tem esse campo
        if (!form.querySelector('[name="' + k + '"]')) {
          form.appendChild(buildHidden(k, lastTouch[k]));
        }
      });
    }
    form.appendChild(buildHidden("touchpoints", JSON.stringify(touchpoints)));
    form.appendChild(buildHidden("page_url", window.location.href));
    form.appendChild(buildHidden("referrer", document.referrer));
    form.dataset.sgtTrackInjected = "1";
  }

  function injectAll() {
    var forms = document.querySelectorAll("form");
    for (var i = 0; i < forms.length; i++) injectInto(forms[i]);
  }

  // Roda imediatamente e ao submit (caso o form seja criado dinamicamente)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectAll);
  } else {
    injectAll();
  }
  document.addEventListener("submit", function (ev) {
    var form = ev.target && ev.target.closest ? ev.target.closest("form") : null;
    if (form) injectInto(form);
  }, true);

  window.sgtTracker = {
    injectInto: injectInto,
    injectAll: injectAll,
    getFirstTouch: function () { return readJson("sgt_first_touch"); },
    getLastTouch: function () { return readJson("sgt_last_touch"); },
    getTouchpoints: function () { return readJson("sgt_touchpoints") || []; },
  };
})();
