/* Outils communs : création d'éléments sans innerHTML, formats de date et d'heure. */
(function () {
  var TZ = 'Africa/Porto-Novo';
  var JOURS = ['', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    for (var k in (attrs || {})) {
      if (k === 'class') { e.className = attrs[k]; }
      else if (k === 'text') { e.textContent = attrs[k]; }
      else if (k.slice(0, 2) === 'on') { e.addEventListener(k.slice(2), attrs[k]); }
      else if (attrs[k] !== false && attrs[k] != null) { e.setAttribute(k, attrs[k] === true ? '' : attrs[k]); }
    }
    (kids || []).forEach(function (c) { if (c != null) { e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); } });
    return e;
  }
  function clear(n) { while (n.firstChild) { n.removeChild(n.firstChild); } }
  function todayLocal() { return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date()); } /* AAAA-MM-JJ */
  function addDays(iso, n) { var d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function isoDow(iso) { var d = new Date(iso + 'T12:00:00Z').getUTCDay(); return d === 0 ? 7 : d; }
  function fmtDate(iso, long) { return new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', weekday: long ? 'long' : 'short', day: 'numeric', month: long ? 'long' : 'short' }).format(new Date(iso + 'T12:00:00Z')); }
  function fmtTime(ts) { return new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(ts)).replace(':', 'h'); }
  function fmtDay(ts) { return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(ts)); }
  function hhmm(t) { var p = String(t || '').split(':'); return parseInt(p[0], 10) + 'h' + (p[1] || '00'); }
  function fcfa(n) { return new Intl.NumberFormat('fr-FR').format(n) + ' FCFA'; }
  function digits(s) { return String(s || '').replace(/\D/g, ''); }
  window.U = { h: h, clear: clear, TZ: TZ, JOURS: JOURS, todayLocal: todayLocal, addDays: addDays, isoDow: isoDow, fmtDate: fmtDate, fmtTime: fmtTime, fmtDay: fmtDay, hhmm: hhmm, fcfa: fcfa, digits: digits };
})();
