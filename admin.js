/* Espace de la gérante : réservations, prestations, photos, réglages, créneaux bloqués.
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
    [['reservations', 'Réservations'], ['services', 'Prestations'], ['photos', 'Photos'], ['bloques', 'Créneaux bloqués'], ['reglages', 'Réglages']].forEach(function (t) {
      tabs.appendChild(h('button', { type: 'button', class: 'chip', 'aria-pressed': tab === t[0] ? 'true' : 'false', onclick: function () { tab = t[0]; renderShell(); } }, [t[1]]));
    });
    var body = h('div');
    app.appendChild(tabs); app.appendChild(body);
    ({ reservations: tabReservations, services: tabServices, photos: tabPhotos, bloques: tabBloques, reglages: tabReglages })[tab](body);
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
        if (b.status === 'cancelled') {
          acts.appendChild(h('button', { class: 'btn small danger', type: 'button', onclick: function (ev) {
            var bt = ev.currentTarget;
            if (!bt.dataset.armed) { bt.dataset.armed = '1'; bt.textContent = 'Confirmer la suppression'; return; }
            API.remove('bookings?id=eq.' + b.id + '&status=eq.cancelled').then(renderShell, function (e) { show(m, fail(e), false); });
          } }, ['Supprimer']));
        }
        acts.appendChild(h('a', { class: 'btn small ghost', target: '_blank', rel: 'noopener', href: 'https://wa.me/' + b.client_phone }, ['WhatsApp']));
        list.appendChild(h('article', { class: 'item' }, [
          h('div', { class: 'row' }, [h('b', { text: U.fmtDate(U.fmtDay(b.starts_at), true) + ' à ' + U.fmtTime(b.starts_at) }), h('span', { class: 'badge ' + b.status, text: STATUT[b.status] })]),
          h('div', { text: (b.services && b.services.name) || 'Prestation supprimée' }),
          h('div', { class: 'muted', text: b.client_name + ' · +' + b.client_phone }),
          b.place === 'domicile' ? h('div', { text: 'À domicile : ' + (b.client_address || '(adresse non précisée)') }) : null,
          acts]));
      });
    }, function (e) { show(m, fail(e), false); });
  }

  /* ---------- Photos des prestations ---------- */
  function resizeToJpeg(file) {
    return new Promise(function (resolve, reject) {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { reject(new Error('FORMAT')); return; }
      if (file.size > 15 * 1024 * 1024) { reject(new Error('TROP_GROS')); return; }
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var k = Math.min(1, 900 / Math.max(img.width, img.height));
        var c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { b ? resolve(b) : reject(new Error('CONVERSION')); }, 'image/jpeg', 0.85);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('FORMAT')); };
      img.src = url;
    });
  }
  function photoErr(e) {
    var m = String((e && e.message) || '');
    if (m === 'FORMAT') { return 'Photo non lisible. Utilise une image JPG, PNG ou WebP.'; }
    if (m === 'TROP_GROS') { return 'Photo trop lourde (15 Mo maximum).'; }
    return fail(e);
  }
  function uploadPhoto(file) {
    return resizeToJpeg(file).then(function (blob) {
      var name = Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.jpg';
      return API.upload('prestations', name, blob).then(function () { return { name: name, url: API.publicUrl('prestations', name) }; });
    });
  }
  /* Panneau de choix : photos du site + photos ajoutées + envoi d'une nouvelle photo. onPick(valeur) est appelé avec le chemin choisi. */
  function photoPicker(onPick, msg) {
    var grid = h('div', { class: 'chips', style: 'margin-top:8px' });
    function addThumb(srcRaw, alt) {
      var src = U.safePhoto(srcRaw); if (!src) { return; }
      grid.appendChild(h('button', { type: 'button', class: 'svc-pick', 'aria-label': 'Choisir cette photo', onclick: function () { onPick(src); } }, [h('img', { src: src, alt: alt || 'Photo' })]));
    }
    (window.SALON_PHOTOS || []).forEach(function (p) { addThumb(p && p.src, p && p.alt); });
    API.get('gallery_photos?select=path,alt&order=created_at.desc').then(function (rows) { (rows || []).forEach(function (r) { addThumb(r.path, r.alt); }); }, function () { /* galerie ajoutée indisponible : les photos du site restent proposées */ });
    var file = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', 'aria-label': 'Envoyer une nouvelle photo' });
    file.addEventListener('change', function () {
      var f = file.files && file.files[0]; if (!f) { return; }
      show(msg, 'Envoi de la photo…', true);
      uploadPhoto(f).then(function (r) { onPick(r.url); }).then(null, function (e) { show(msg, photoErr(e), false); });
    });
    return h('div', { class: 'card' }, [h('b', { text: 'Choisir une photo' }), grid, h('div', { class: 'field', style: 'margin-top:10px' }, [h('label', { text: 'Ou envoyer une nouvelle photo' }), file])]);
  }

  /* ---------- Prestations ---------- */
  function tabServices(body) {
    var m = msgBox(); var list = h('div', { class: 'list' });
    var name = h('input', { id: 's-name', maxlength: '80' }), dur = h('input', { id: 's-dur', type: 'number', min: '10', max: '480', step: '5', inputmode: 'numeric' });
    var price = h('input', { id: 's-price', type: 'number', min: '0', step: '500', inputmode: 'numeric' }), desc = h('input', { id: 's-desc', maxlength: '300' });
    var newPhoto = null, photoBox = h('div', { class: 'field' });
    function drawNewPhoto() {
      U.clear(photoBox);
      photoBox.appendChild(h('label', { text: 'Photo de la coiffure (facultatif)' }));
      var ok = U.safePhoto(newPhoto);
      if (ok) {
        photoBox.appendChild(h('img', { class: 'thumb', src: ok, alt: 'Photo choisie', width: '120', height: '120', style: 'object-fit:cover;object-position:50% 25%' }));
        photoBox.appendChild(h('button', { type: 'button', class: 'btn small ghost', onclick: function () { newPhoto = null; drawNewPhoto(); } }, ['Retirer la photo']));
      } else {
        photoBox.appendChild(photoPicker(function (v) { newPhoto = v; drawNewPhoto(); }, m));
      }
    }
    var add = h('form', { class: 'step', novalidate: true }, [
      h('h3', { text: 'Ajouter une prestation' }),
      h('div', { class: 'inline' }, [
        h('div', { class: 'field' }, [h('label', { for: 's-name', text: 'Nom' }), name]),
        h('div', { class: 'field' }, [h('label', { for: 's-dur', text: 'Durée (minutes)' }), dur]),
        h('div', { class: 'field' }, [h('label', { for: 's-price', text: 'Prix « à partir de » (FCFA)' }), price])]),
      h('div', { class: 'field' }, [h('label', { for: 's-desc', text: 'Description (facultatif)' }), desc]),
      photoBox,
      h('button', { class: 'btn', type: 'submit' }, ['Ajouter'])]);
    add.addEventListener('submit', function (e) {
      e.preventDefault();
      var d = parseInt(dur.value, 10), p = price.value === '' ? null : parseInt(price.value, 10);
      if (name.value.trim().length < 2) { show(m, 'Écris le nom de la prestation.', false); return; }
      if (!(d >= 10 && d <= 480)) { show(m, 'La durée doit être entre 10 et 480 minutes.', false); return; }
      if (p !== null && !(p >= 0)) { show(m, 'Le prix doit être un nombre positif.', false); return; }
      API.insert('services', { name: name.value.trim(), duration_min: d, price_from_fcfa: p, description: desc.value.trim() || null, photo: U.safePhoto(newPhoto) }).then(renderShell, function (er) { show(m, fail(er), false); });
    });
    drawNewPhoto();
    body.appendChild(add); body.appendChild(m); body.appendChild(h('div', { style: 'height:14px' })); body.appendChild(list);
    API.get('services?select=*&order=sort.asc,name.asc').then(function (rows) {
      if (!rows.length) { list.appendChild(h('div', { class: 'empty', text: 'Aucune prestation. Ajoute la première ci-dessus.' })); return; }
      rows.forEach(function (s) {
        var pv = U.safePhoto(s.photo), panel = h('div');
        function setPhoto(v) { API.patch('services?id=eq.' + s.id, { photo: v }).then(renderShell, function (e) { show(m, photoErr(e), false); }); }
        list.appendChild(h('article', { class: 'item' }, [
          pv ? h('img', { class: 'thumb', src: pv, alt: s.name, width: '96', height: '96', style: 'object-fit:cover;object-position:50% 25%' }) : null,
          h('div', { class: 'row' }, [h('b', { text: s.name }), h('span', { class: 'badge ' + (s.active ? 'confirmed' : 'cancelled'), text: s.active ? 'Visible' : 'Masquée' })]),
          h('div', { class: 'muted', text: s.duration_min + ' min' + (s.price_from_fcfa != null ? ' · dès ' + U.fcfa(s.price_from_fcfa) : '') }),
          h('div', { class: 'row' }, [
            h('button', { class: 'btn small ghost', type: 'button', onclick: function () { U.clear(panel); panel.appendChild(photoPicker(setPhoto, m)); } }, [pv ? 'Changer la photo' : 'Ajouter une photo']),
            pv ? h('button', { class: 'btn small ghost', type: 'button', onclick: function () { setPhoto(null); } }, ['Retirer la photo']) : null,
            h('button', { class: 'btn small ghost', type: 'button', onclick: function () { API.patch('services?id=eq.' + s.id, { active: !s.active }).then(renderShell, function (e) { show(m, fail(e), false); }); } }, [s.active ? 'Masquer' : 'Afficher']),
            h('button', { class: 'btn small danger', type: 'button', onclick: function (ev) {
              var b = ev.currentTarget;
              if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Confirmer la suppression'; return; }
              API.remove('services?id=eq.' + s.id).then(renderShell, function (e) { show(m, fail(e), false); });
            } }, ['Supprimer'])]), panel]));
      });
    }, function (e) { show(m, fail(e), false); });
  }

  /* ---------- Photos de la galerie ---------- */
  function tabPhotos(body) {
    var m = msgBox(), grid = h('div', { class: 'admin-gallery g-list' });
    var file = h('input', { type: 'file', id: 'g-file', accept: 'image/jpeg,image/png,image/webp', multiple: true });
    var alt = h('input', { id: 'g-alt', maxlength: '120', placeholder: 'Ex : Tresses collées avec perles' });
    var btn = h('button', { class: 'btn', type: 'submit' }, ['Ajouter à la galerie']);
    var f = h('form', { class: 'step', novalidate: true }, [
      h('h3', { text: 'Ajouter des photos' }),
      h('p', { class: 'muted', text: 'Choisis une ou plusieurs photos de tes coiffures. Elles apparaissent tout de suite sur le site, dans « Les photos ». Évite les photos où une cliente est reconnaissable sans son accord.' }),
      h('div', { class: 'field' }, [h('label', { for: 'g-file', text: 'Photos (JPG, PNG ou WebP)' }), file]),
      h('div', { class: 'field' }, [h('label', { for: 'g-alt', text: 'Description courte (facultatif)' }), alt]),
      m, btn]);
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var files = Array.prototype.slice.call(file.files || [], 0, 10);
      if (!files.length) { show(m, 'Choisis au moins une photo.', false); return; }
      btn.disabled = true; show(m, 'Envoi en cours…', true);
      var done = 0, errs = [];
      files.reduce(function (p, fl) {
        return p.then(function () {
          return uploadPhoto(fl).then(function (r) { return API.insert('gallery_photos', { path: r.url, alt: alt.value.trim() || null }); }).then(function () { done++; }, function (er) { errs.push(photoErr(er)); });
        });
      }, Promise.resolve()).then(function () {
        btn.disabled = false;
        if (errs.length) { show(m, done + ' photo(s) ajoutée(s). Problème : ' + errs[0], false); } else { show(m, done + ' photo(s) ajoutée(s).', true); }
        file.value = ''; loadList();
      });
    });
    var heroBox = h('div', { class: 'step', style: 'margin-bottom:14px' });
    body.appendChild(heroBox);
    drawHero();
    body.appendChild(f); body.appendChild(h('div', { style: 'height:14px' }));
    body.appendChild(h('h3', { text: 'Photos ajoutées' }));
    body.appendChild(grid);
    body.appendChild(h('p', { class: 'muted', style: 'margin-top:14px', text: 'Les ' + (window.SALON_PHOTOS || []).length + ' photos de départ font partie des fichiers du site : elles ne se suppriment pas d\'ici.' }));
    /* Photos de l'accueil (3 au maximum) */
    function drawHero() {
      var hm = msgBox();
      U.clear(heroBox);
      heroBox.appendChild(h('h3', { text: "Photos de la page d'accueil" }));
      heroBox.appendChild(h('p', { class: 'muted', text: "Ce sont les 3 photos qui s'affichent à côté du logo. Choisis-les parmi les photos du site ou envoie-en une nouvelle." }));
      API.get('salon_settings?select=hero_photos&id=eq.1').then(function (rows) {
        var cur = ((rows && rows[0] && rows[0].hero_photos) || []).filter(function (x) { return U.safePhoto(x); }).slice(0, 3);
        if (!cur.length) { cur = (window.SALON_PHOTOS || []).slice(0, 3).map(function (p) { return p.src; }); }
        function save(list) { API.patch('salon_settings?id=eq.1', { hero_photos: list }).then(function () { drawHero(); }, function (e) { show(hm, photoErr(e), false); }); }
        var row = h('div', { class: 'admin-gallery' }), panel = h('div');
        cur.forEach(function (src, i) {
          row.appendChild(h('figure', { class: 'ag-item' }, [
            h('img', { src: U.safePhoto(src), alt: 'Photo d\'accueil ' + (i + 1) }),
            h('button', { class: 'btn small ghost', type: 'button', onclick: function () {
              U.clear(panel); panel.appendChild(photoPicker(function (v) { var n = cur.slice(); n[i] = v; save(n); }, hm));
            } }, ['Changer']),
            cur.length > 1 ? h('button', { class: 'btn small danger', type: 'button', onclick: function () { save(cur.filter(function (_, j) { return j !== i; })); } }, ['Retirer']) : null]));
        });
        heroBox.appendChild(row);
        if (cur.length < 3) {
          heroBox.appendChild(h('button', { class: 'btn small', type: 'button', onclick: function () {
            U.clear(panel); panel.appendChild(photoPicker(function (v) { save(cur.concat([v])); }, hm));
          } }, ['Ajouter une photo d\'accueil']));
        }
        heroBox.appendChild(hm); heroBox.appendChild(panel);
      }, function (e) { heroBox.appendChild(hm); show(hm, fail(e), false); });
    }

    function loadList() {
      API.get('gallery_photos?select=id,path,alt&order=created_at.desc').then(function (rows) {
        U.clear(grid);
        if (!rows.length) { grid.appendChild(h('div', { class: 'empty', text: 'Aucune photo ajoutée pour le moment.' })); return; }
        rows.forEach(function (r) {
          var src = U.safePhoto(r.path); if (!src) { return; }
          grid.appendChild(h('figure', { class: 'ag-item' }, [
            h('img', { src: src, alt: r.alt || 'Photo ajoutée', loading: 'lazy' }),
            h('button', { class: 'btn small danger', type: 'button', onclick: function (ev) {
              var b = ev.currentTarget;
              if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Confirmer'; return; }
              API.remove('gallery_photos?id=eq.' + r.id).then(function () { return API.removeObject('prestations', src.slice(src.lastIndexOf('/') + 1)); }).then(loadList, function (e) { show(m, fail(e), false); });
            } }, ['Supprimer'])]));
        });
      }, function (e) { show(m, fail(e), false); });
    }
    loadList();
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
        home: h('input', { id: 'r-home', type: 'checkbox', style: 'width:auto;min-height:0' }),
        policy: h('textarea', { id: 'r-policy', maxlength: '500', placeholder: 'Ex : merci de prévenir au moins 24 h à l\'avance en cas d\'annulation.' }),
        open: h('input', { id: 'r-open', type: 'time', value: String(s.open_time).slice(0, 5) }),
        close: h('input', { id: 'r-close', type: 'time', value: String(s.close_time).slice(0, 5) }),
        slot: h('select', { id: 'r-slot' }, [15, 30, 45, 60].map(function (n) { return h('option', { value: String(n), text: n + ' min' }); })),
        notice: h('input', { id: 'r-notice', type: 'number', min: '0', value: String(s.min_notice_minutes) }),
        ahead: h('input', { id: 'r-ahead', type: 'number', min: '1', max: '365', value: String(s.max_days_ahead) })
      };
      f.home.checked = !!s.home_visits; f.policy.value = s.cancellation_policy || ''; f.slot.value = String(s.slot_minutes);
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
        h('div', { class: 'row' }, [f.home, h('label', { for: 'r-home', text: 'Je me déplace aussi à domicile (la cliente choisit à la réservation)', style: 'text-transform:none;letter-spacing:0;font-size:1rem;color:inherit' })]),
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
          address: f.address.value.trim() || null, phone: ph || null, cancellation_policy: f.policy.value.trim() || null, home_visits: f.home.checked,
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
