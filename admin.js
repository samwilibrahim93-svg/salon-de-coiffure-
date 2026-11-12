/* Espace de la gérante : réservations, prestations, réglages, créneaux bloqués.
   La sécurité repose sur la base de données (règles RLS) : cette page ne protège rien toute seule. */
(function () {
  var h = U.h, API = SalonAPI;
  var app = document.getElementById('app');
  var logout = document.getElementById('logout');
  var tab = 'reservations';
  var STATUT = { pending: 'En attente', confirmed: 'Confirmé', cancelled: 'Annulé' };

  function msgBox() { return h('p', { class: 'msg', role: 'alert' }); }
  function show(el, text, ok) { el.className = 'msg ' + (ok ? 'ok' : 'bad'); el.textContent = text; }
  function fail(e) {
    if (e && e.status === 401) { API.signOut(); start(); return 'Ta session a expiré. Reconnecte-toi.'; }
    if (e && e.status === 0) { return 'Pas de connexion internet.'; }
    var m = String((e && e.message) || '');
    if (m.indexOf('violates foreign key') >= 0) { return 'Impossible de supprimer : des réservations utilisent cette prestation. Désactive-la plutôt.'; }
    if (m.indexOf('bookings_no_overlap') >= 0) { return 'Ce créneau est déjà pris par une réservation.'; }
    return 'Une erreur est survenue : ' + m;
  }

  /* ---------- Connexion ---------- */
  function renderLogin(note) {
    U.clear(app); logout.hidden = true;
    var m = msgBox(); if (note) { show(m, note, false); }
    var email = h('input', { type: 'email', id: 'em', autocomplete: 'username', required: true });
    var pw = h('input', { type: 'password', id: 'pw', autocomplete: 'current-password', required: true });
    var btn = h('button', { class: 'btn', type: 'submit' }, ['Se connecter']);
    var f = h('form', { class: 'step', style: 'max-width:420px' }, [
      h('h2', { text: 'Connexion' }),
      h('div', { class: 'field' }, [h('label', { for: 'em', text: 'Email' }), email]),
      h('div', { class: 'field' }, [h('label', { for: 'pw', text: 'Mot de passe' }), pw]),
      m, btn]);
    f.addEventListener('submit', function (e) {
      e.preventDefault(); btn.disabled = true;
      API.signIn(email.value.trim(), pw.value).then(function () { return API.rpc('is_admin'); }).then(function (ok) {
        if (ok !== true) { API.signOut(); btn.disabled = false; show(m, "Ce compte n'a pas accès à cet espace.", false); return; }
        start();
      }, function (er) { btn.disabled = false; show(m, er.status === 400 ? 'Email ou mot de passe incorrect.' : fail(er), false); });
    });
    app.appendChild(f);
  }

  /* ---------- Cadre commun ---------- */
  function renderShell() {
    U.clear(app); logout.hidden = false;
    var tabs = h('div', { class: 'tabs' });
    [['reservations', 'Réservations'], ['services', 'Prestations'], ['bloques', 'Créneaux bloqués'], ['reglages', 'Réglages']].forEach(function (t) {
      tabs.appendChild(h('button', { type: 'button', class: 'chip', 'aria-pressed': tab === t[0] ? 'true' : 'false', onclick: function () { tab = t[0]; renderShell(); } }, [t[1]]));
    });
    var body = h('div');
    app.appendChild(tabs); app.appendChild(body);
    ({ reservations: tabReservations, services: tabServices, bloques: tabBloques, reglages: tabReglages })[tab](body);
  }

  /* ---------- Réservations ---------- */
  var resFilter = 'upcoming';
  function tabReservations(body) {
    var m = msgBox();
    var sel = h('select', { 'aria-label': 'Filtre' }, [
      h('option', { value: 'upcoming', text: 'À venir' }), h('option', { value: 'past', text: 'Passées (30 derniers jours)' })]);
    sel.value = resFilter;
    sel.addEventListener('change', function () { resFilter = sel.value; renderShell(); });
    var list = h('div', { class: 'list' });
    body.appendChild(h('div', { class: 'field', style: 'max-width:320px;margin-bottom:14px' }, [sel]));
    body.appendChild(m); body.appendChild(list);
    var nowIso = new Date().toISOString();
    var q = 'bookings?select=*,services(name)&order=starts_at.' + (resFilter === 'upcoming' ? 'asc&starts_at=gte.' + encodeURIComponent(nowIso)
      : 'desc&starts_at=lt.' + encodeURIComponent(nowIso) + '&starts_at=gte.' + encodeURIComponent(new Date(Date.now() - 30 * 864e5).toISOString()));
    API.get(q).then(function (rows) {
      if (!rows.length) { list.appendChild(h('div', { class: 'empty', text: resFilter === 'upcoming' ? 'Aucune réservation à venir.' : 'Aucune réservation passée.' })); return; }
      rows.forEach(function (b) {
        var acts = h('div', { class: 'row' });
        function setStatus(s) { return function () { API.patch('bookings?id=eq.' + b.id, { status: s }).then(renderShell, function (e) { show(m, fail(e), false); }); }; }
        if (b.status === 'pending') { acts.appendChild(h('button', { class: 'btn small', type: 'button', onclick: setStatus('confirmed') }, ['Confirmer'])); }
        if (b.status !== 'cancelled') { acts.appendChild(h('button', { class: 'btn small danger', type: 'button', onclick: setStatus('cancelled') }, ['Annuler'])); }
        acts.appendChild(h('a', { class: 'btn small ghost', target: '_blank', rel: 'noopener', href: 'https://wa.me/' + b.client_phone }, ['WhatsApp']));
        list.appendChild(h('article', { class: 'item' }, [
          h('div', { class: 'row' }, [h('b', { text: U.fmtDate(U.fmtDay(b.starts_at), true) + ' à ' + U.fmtTime(b.starts_at) }), h('span', { class: 'badge ' + b.status, text: STATUT[b.status] })]),
          h('div', { text: (b.services && b.services.name) || 'Prestation supprimée' }),
          h('div', { class: 'muted', text: b.client_name + ' · +' + b.client_phone + ' · réf. ' + b.reference }),
          acts]));
      });
    }, function (e) { show(m, fail(e), false); });
  }

  /* ---------- Prestations ---------- */
  function tabServices(body) {
    var m = msgBox(); var list = h('div', { class: 'list' });
    var name = h('input', { id: 's-name', maxlength: '80' }), dur = h('input', { id: 's-dur', type: 'number', min: '10', max: '480', step: '5', inputmode: 'numeric' });
    var price = h('input', { id: 's-price', type: 'number', min: '0', step: '500', inputmode: 'numeric' }), desc = h('input', { id: 's-desc', maxlength: '300' });
    var add = h('form', { class: 'step', novalidate: true }, [
      h('h3', { text: 'Ajouter une prestation' }),
      h('div', { class: 'inline' }, [
        h('div', { class: 'field' }, [h('label', { for: 's-name', text: 'Nom' }), name]),
        h('div', { class: 'field' }, [h('label', { for: 's-dur', text: 'Durée (minutes)' }), dur]),
        h('div', { class: 'field' }, [h('label', { for: 's-price', text: 'Prix « à partir de » (FCFA)' }), price])]),
      h('div', { class: 'field' }, [h('label', { for: 's-desc', text: 'Description (facultatif)' }), desc]),
      h('button', { class: 'btn', type: 'submit' }, ['Ajouter'])]);
    add.addEventListener('submit', function (e) {
      e.preventDefault();
      var d = parseInt(dur.value, 10), p = price.value === '' ? null : parseInt(price.value, 10);
      if (name.value.trim().length < 2) { show(m, 'Écris le nom de la prestation.', false); return; }
      if (!(d >= 10 && d <= 480)) { show(m, 'La durée doit être entre 10 et 480 minutes.', false); return; }
      if (p !== null && !(p >= 0)) { show(m, 'Le prix doit être un nombre positif.', false); return; }
      API.insert('services', { name: name.value.trim(), duration_min: d, price_from_fcfa: p, description: desc.value.trim() || null }).then(renderShell, function (er) { show(m, fail(er), false); });
    });
    body.appendChild(add); body.appendChild(m); body.appendChild(h('div', { style: 'height:14px' })); body.appendChild(list);
    API.get('services?select=*&order=sort.asc,name.asc').then(function (rows) {
      if (!rows.length) { list.appendChild(h('div', { class: 'empty', text: 'Aucune prestation. Ajoute la première ci-dessus.' })); return; }
      rows.forEach(function (s) {
        list.appendChild(h('article', { class: 'item' }, [
          h('div', { class: 'row' }, [h('b', { text: s.name }), h('span', { class: 'badge ' + (s.active ? 'confirmed' : 'cancelled'), text: s.active ? 'Visible' : 'Masquée' })]),
          h('div', { class: 'muted', text: s.duration_min + ' min' + (s.price_from_fcfa != null ? ' · dès ' + U.fcfa(s.price_from_fcfa) : '') }),
          h('div', { class: 'row' }, [
            h('button', { class: 'btn small ghost', type: 'button', onclick: function () { API.patch('services?id=eq.' + s.id, { active: !s.active }).then(renderShell, function (e) { show(m, fail(e), false); }); } }, [s.active ? 'Masquer' : 'Afficher']),
            h('button', { class: 'btn small danger', type: 'button', onclick: function (ev) {
              var b = ev.currentTarget;
              if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Confirmer la suppression'; return; }
              API.remove('services?id=eq.' + s.id).then(renderShell, function (e) { show(m, fail(e), false); });
            } }, ['Supprimer'])])]));
      });
    }, function (e) { show(m, fail(e), false); });
  }

  /* ---------- Créneaux bloqués ---------- */
  function tabBloques(body) {
    var m = msgBox(); var list = h('div', { class: 'list' });
    var date = h('input', { id: 'b-date', type: 'date', min: U.todayLocal() });
    var from = h('input', { id: 'b-from', type: 'time', value: '08:00' }), to = h('input', { id: 'b-to', type: 'time', value: '18:30' });
    var reason = h('input', { id: 'b-reason', maxlength: '120', placeholder: 'Ex : congé, formation' });
    var f = h('form', { class: 'step', novalidate: true }, [
      h('h3', { text: 'Bloquer un moment (le salon ne prend pas de rendez-vous)' }),
      h('div', { class: 'inline' }, [
        h('div', { class: 'field' }, [h('label', { for: 'b-date', text: 'Jour' }), date]),
        h('div', { class: 'field' }, [h('label', { for: 'b-from', text: 'De' }), from]),
        h('div', { class: 'field' }, [h('label', { for: 'b-to', text: 'À' }), to])]),
      h('div', { class: 'field' }, [h('label', { for: 'b-reason', text: 'Raison (facultatif)' }), reason]),
      h('button', { class: 'btn', type: 'submit' }, ['Bloquer'])]);
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!date.value) { show(m, 'Choisis un jour.', false); return; }
      if (!(from.value < to.value)) { show(m, "L'heure de fin doit être après l'heure de début.", false); return; }
      /* Le Bénin n'a pas d'heure d'été : toujours UTC+01:00 */
      API.insert('blocked_slots', { starts_at: date.value + 'T' + from.value + ':00+01:00', ends_at: date.value + 'T' + to.value + ':00+01:00', reason: reason.value.trim() || null }).then(renderShell, function (er) { show(m, fail(er), false); });
    });
    body.appendChild(f); body.appendChild(m); body.appendChild(h('div', { style: 'height:14px' })); body.appendChild(list);
    API.get('blocked_slots?select=*&ends_at=gte.' + encodeURIComponent(new Date().toISOString()) + '&order=starts_at.asc').then(function (rows) {
      if (!rows.length) { list.appendChild(h('div', { class: 'empty', text: 'Aucun créneau bloqué.' })); return; }
      rows.forEach(function (b) {
        list.appendChild(h('article', { class: 'item' }, [
          h('b', { text: U.fmtDate(U.fmtDay(b.starts_at), true) + ' · ' + U.fmtTime(b.starts_at) + ' – ' + U.fmtTime(b.ends_at) }),
          b.reason ? h('div', { class: 'muted', text: b.reason }) : null,
          h('div', { class: 'row' }, [h('button', { class: 'btn small danger', type: 'button', onclick: function () { API.remove('blocked_slots?id=eq.' + b.id).then(renderShell, function (e) { show(m, fail(e), false); }); } }, ['Débloquer'])])]));
      });
    }, function (e) { show(m, fail(e), false); });
  }

  /* ---------- Réglages ---------- */
  function tabReglages(body) {
    var m = msgBox();
    API.get('salon_settings?select=*&id=eq.1').then(function (rows) {
      var s = rows[0];
      var f = {
        name: h('input', { id: 'r-name', maxlength: '80', value: s.name || '' }),
        city: h('input', { id: 'r-city', maxlength: '60', value: s.city || '' }),
        district: h('input', { id: 'r-district', maxlength: '60', value: s.district || '' }),
        address: h('input', { id: 'r-address', maxlength: '200', value: s.address || '' }),
        phone: h('input', { id: 'r-phone', type: 'tel', inputmode: 'tel', placeholder: '229XXXXXXXXXX', value: s.phone || '' }),
        policy: h('textarea', { id: 'r-policy', maxlength: '500', placeholder: 'Ex : merci de prévenir au moins 24 h à l\'avance en cas d\'annulation.' }),
        open: h('input', { id: 'r-open', type: 'time', value: String(s.open_time).slice(0, 5) }),
        close: h('input', { id: 'r-close', type: 'time', value: String(s.close_time).slice(0, 5) }),
        slot: h('select', { id: 'r-slot' }, [15, 30, 45, 60].map(function (n) { return h('option', { value: String(n), text: n + ' min' }); })),
        notice: h('input', { id: 'r-notice', type: 'number', min: '0', value: String(s.min_notice_minutes) }),
        ahead: h('input', { id: 'r-ahead', type: 'number', min: '1', max: '365', value: String(s.max_days_ahead) })
      };
      f.policy.value = s.cancellation_policy || ''; f.slot.value = String(s.slot_minutes);
      var days = h('div', { class: 'chips' }); var chosen = {};
      (s.open_days || []).forEach(function (d) { chosen[d] = true; });
      [1, 2, 3, 4, 5, 6, 7].forEach(function (d) {
        days.appendChild(h('button', { type: 'button', class: 'chip', 'aria-pressed': chosen[d] ? 'true' : 'false', onclick: function (ev) { chosen[d] = !chosen[d]; ev.currentTarget.setAttribute('aria-pressed', chosen[d] ? 'true' : 'false'); } }, [U.JOURS[d]]));
      });
      function fld(id, label, el) { return h('div', { class: 'field' }, [h('label', { for: id, text: label }), el]); }
      var form = h('form', { class: 'step', novalidate: true }, [
        h('h3', { text: 'Informations du salon' }),
        fld('r-name', 'Nom du salon', f.name),
        h('div', { class: 'inline' }, [fld('r-city', 'Ville', f.city), fld('r-district', 'Quartier', f.district)]),
        fld('r-address', 'Adresse ou repère', f.address),
        fld('r-phone', 'Numéro WhatsApp (indicatif 229, chiffres seulement)', f.phone),
        fld('r-policy', "Règle d'annulation et de retard", f.policy),
        h('h3', { text: 'Horaires' }),
        h('div', { class: 'field' }, [h('label', { text: 'Jours ouverts' }), days]),
        h('div', { class: 'inline' }, [fld('r-open', 'Ouverture', f.open), fld('r-close', 'Fermeture', f.close), fld('r-slot', 'Pas entre deux créneaux', f.slot)]),
        h('div', { class: 'inline' }, [fld('r-notice', 'Préavis minimum (minutes)', f.notice), fld('r-ahead', 'Réservation possible jusqu\'à (jours)', f.ahead)]),
        m, h('button', { class: 'btn', type: 'submit' }, ['Enregistrer'])]);
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var ph = U.digits(f.phone.value);
        if (f.phone.value.trim() && (ph.length < 8 || ph.length > 15)) { show(m, 'Numéro invalide : chiffres seulement, avec l\'indicatif.', false); return; }
        var od = [1, 2, 3, 4, 5, 6, 7].filter(function (d) { return chosen[d]; });
        if (!od.length) { show(m, 'Choisis au moins un jour ouvert.', false); return; }
        if (!(f.open.value < f.close.value)) { show(m, "L'heure de fermeture doit être après l'ouverture.", false); return; }
        API.patch('salon_settings?id=eq.1', {
          name: f.name.value.trim() || null, city: f.city.value.trim() || null, district: f.district.value.trim() || null,
          address: f.address.value.trim() || null, phone: ph || null, cancellation_policy: f.policy.value.trim() || null,
          open_days: od, open_time: f.open.value, close_time: f.close.value, slot_minutes: parseInt(f.slot.value, 10),
          min_notice_minutes: Math.max(0, parseInt(f.notice.value, 10) || 0), max_days_ahead: Math.min(365, Math.max(1, parseInt(f.ahead.value, 10) || 30))
        }).then(function () { show(m, 'Réglages enregistrés.', true); }, function (er) { show(m, fail(er), false); });
      });
      body.appendChild(form);
    }, function (e) { body.appendChild(msgBox()); show(body.lastChild, fail(e), false); });
  }

  logout.addEventListener('click', function () { API.signOut(); renderLogin(); });

  function start() {
    if (!API.hasToken()) { renderLogin(); return; }
    API.rpc('is_admin').then(function (ok) {
      if (ok === true) { renderShell(); } else { API.signOut(); renderLogin(); }
    }, function () { API.signOut(); renderLogin('Ta session a expiré. Reconnecte-toi.'); });
  }
  start();
})();
