/* Page publique : prestations, galerie, réservation en 4 étapes, infos. */
(function () {
  var h = U.h, API = SalonAPI;
  var settings = null, services = [];
  var st = { service: null, date: null, slot: null, slots: [], busy: false, place: 'sur_place', address: '', pending: null };
  var avail = { rows: [], loading: true, error: null, token: 0 };
  var KEY = 'rdv-items-v1';
  var box = document.getElementById('booking');

  var ERREURS = {
    CRENEAU_INDISPONIBLE: "Ce créneau vient d'être pris ou n'est plus disponible. Choisis-en un autre.",
    TELEPHONE_INVALIDE: 'Le numéro de téléphone semble incorrect. Utilise seulement des chiffres, avec l\'indicatif (ex. 229 suivi du numéro).',
    NOM_INVALIDE: 'Écris ton nom (entre 2 et 80 caractères).',
    PRESTATION_INDISPONIBLE: "Cette prestation n'est plus disponible.",
    TROP_DE_RESERVATIONS: "Tu as déjà 3 rendez-vous à venir avec ce numéro. Contacte le salon pour en ajouter ou en modifier un.",
    ADRESSE_REQUISE: 'Indique ton quartier ou un repère pour qu\'on puisse te trouver.',
    DOMICILE_INDISPONIBLE: 'Le service à domicile n\'est pas disponible. Choisis « Sur place ».',
    LIEU_INVALIDE: 'Choisis où aura lieu le rendez-vous.',
    TROP_DE_DEMANDES: 'Beaucoup de demandes en même temps. Réessaie dans quelques minutes.'
  };
  function errText(e) {
    if (e && e.status === 0) { return "Pas de connexion. Vérifie ton internet et réessaie."; }
    var m = String((e && e.message) || '');
    for (var k in ERREURS) { if (m.indexOf(k) >= 0) { return ERREURS[k]; } }
    return "Un problème est survenu. Réessaie dans un instant ou contacte le salon.";
  }

  function salonName() { return (settings && settings.name) || 'Salon de coiffure'; }

  function renderHeader() {
    var name = salonName();
    var where = [settings && settings.district, settings && settings.city].filter(Boolean).join(' · ') || 'Parakou';
    document.getElementById('brand').textContent = name;
    document.getElementById('title').textContent = name;
    document.getElementById('where').textContent = where;
    var lede = document.getElementById('lede'); if (lede) { lede.textContent = 'Réserve ton rendez-vous en ligne, choisis ta prestation et ton créneau. ' + name + ' te confirme ensuite ta demande.'; }
    document.getElementById('foot').textContent = name + ' · ' + (settings && settings.city || 'Parakou');
    document.title = name + ' à ' + (settings && settings.city || 'Parakou') + (settings && settings.district ? ', ' + settings.district : '');
  }

  function renderServices() {
    var g = document.getElementById('services'); U.clear(g);
    if (!services.length) {
      g.appendChild(h('div', { class: 'empty', text: 'Les prestations et leurs prix seront affichés ici très bientôt.' }));
      return;
    }
    services.forEach(function (s) {
      var ph = U.safePhoto(s.photo);
      g.appendChild(h('article', { class: 'card' }, [
        ph ? h('img', { class: 'svc-img', src: ph, alt: s.name, loading: 'lazy' }) : null,
        h('h3', { text: s.name }),
        s.description ? h('p', { class: 'muted', text: s.description }) : null,
        h('p', { class: 'muted', text: 'Durée : environ ' + s.duration_min + ' min' }),
        s.price_from_fcfa != null ? h('p', { class: 'price', text: 'À partir de ' + U.fcfa(s.price_from_fcfa) }) : null,
        h('button', { type: 'button', class: 'btn small', onclick: function () { chooseService(s); document.getElementById('reserver').scrollIntoView(); } }, ['Choisir cette coiffure'])
      ]));
    });
  }

  function renderGallery() {
    var photos = (window.SALON_PHOTOS || []).filter(function (p) { return p && /^photos\/[\w.\- ]+$/.test(p.src || ''); });
    if (!photos.length) { return; }
    var g = document.getElementById('gallery'); U.clear(g);
    var w = h('div', { class: 'gallery' });
    photos.forEach(function (p) { w.appendChild(h('img', { src: p.src, alt: p.alt || 'Photo du salon', loading: 'lazy' })); });
    g.appendChild(w);
  }

  function renderInfos() {
    var g = document.getElementById('infos-grid'); U.clear(g);
    var s = settings || {};
    var closed = [1, 2, 3, 4, 5, 6, 7].filter(function (d) { return (s.open_days || []).indexOf(d) < 0; }).map(function (d) { return U.JOURS[d]; });
    var open = (s.open_days || []).map(function (d) { return U.JOURS[d]; });
    g.appendChild(h('div', { class: 'card' }, [
      h('h3', { text: 'Horaires' }),
      h('p', { text: U.hhmm(s.open_time) + ' – ' + U.hhmm(s.close_time) }),
      h('p', { class: 'muted', text: 'Ouvert : ' + open.join(', ') }),
      closed.length ? h('p', { class: 'muted', text: 'Fermé : ' + closed.join(', ') }) : null
    ]));
    g.appendChild(h('div', { class: 'card' }, [
      h('h3', { text: 'Où nous trouver' }),
      h('p', { text: [s.district, s.city].filter(Boolean).join(', ') }),
      h('p', { class: 'muted', text: s.address ? s.address : (s.home_visits ? "L'adresse exacte est communiquée à la confirmation du rendez-vous." : "L'adresse exacte sera bientôt ajoutée.") }),
      s.home_visits ? h('p', { text: 'Rendez-vous sur place ou à ton domicile, selon ta préférence. Tu le choisis en réservant.' }) : null
    ]));
    var contact = [h('h3', { text: 'Contact' })];
    var ph = U.digits(s.phone);
    if (ph.length >= 8) {
      contact.push(h('p', { text: '+' + ph }));
      contact.push(h('a', { class: 'btn small', href: 'https://wa.me/' + ph, target: '_blank', rel: 'noopener' }, ['Écrire sur WhatsApp']));
    } else { contact.push(h('p', { class: 'muted', text: 'Le numéro du salon sera bientôt ajouté.' })); }
    g.appendChild(h('div', { class: 'card' }, contact));
    if (s.cancellation_policy) {
      g.appendChild(h('div', { class: 'card' }, [h('h3', { text: 'Annulation et retards' }), h('p', { text: s.cancellation_policy })]));
    }
  }

  /* ---------- Réservation ---------- */
  function stepBox(n, title, locked, kids) {
    return h('section', { class: 'step' + (locked ? ' locked' : ''), 'aria-label': title }, [h('h3', {}, [h('span', { class: 'num', text: String(n) }), title])].concat(kids));
  }

  function renderBooking() {
    U.clear(box);
    if (!services.length) {
      box.appendChild(h('div', { class: 'empty', text: "La réservation en ligne ouvrira dès que les prestations seront ajoutées. En attendant, contacte le salon." }));
      return;
    }
    // 1. prestation
    var chips = h('div', { class: 'chips' });
    services.forEach(function (s) {
      var ph = U.safePhoto(s.photo);
      chips.appendChild(h('button', { type: 'button', class: ph ? 'svc-pick' : 'chip', 'aria-pressed': st.service && st.service.id === s.id ? 'true' : 'false', onclick: function () { chooseService(s); } }, [
        ph ? h('img', { src: ph, alt: '' }) : null,
        s.name + (s.price_from_fcfa != null ? ' · dès ' + U.fcfa(s.price_from_fcfa) : '')
      ]));
    });
    box.appendChild(stepBox(1, 'Choisis ta prestation', false, [chips]));

    // 2. jour
    var days = h('div', { class: 'chips' });
    var today = U.todayLocal();
    var span = Math.min(settings.max_days_ahead || 30, 21);
    for (var i = 0; i <= span; i++) {
      (function (iso) {
        var open = (settings.open_days || []).indexOf(U.isoDow(iso)) >= 0;
        days.appendChild(h('button', { type: 'button', class: 'chip', disabled: !open, 'aria-pressed': st.date === iso ? 'true' : 'false', onclick: function () { st.date = iso; st.slot = null; st.notice = null; loadSlots(); } }, [U.fmtDate(iso)]));
      })(U.addDays(today, i));
    }
    box.appendChild(stepBox(2, 'Choisis le jour', !st.service, [days, h('p', { class: 'muted', text: 'Les jours grisés sont fermés.' })]));

    // 3. heure
    var slotsEl = h('div', { class: 'chips', 'aria-live': 'polite' });
    if (st.notice) { slotsEl.appendChild(h('p', { class: 'msg bad', style: 'flex-basis:100%', text: st.notice })); }
    if (st.date && st.service) {
      if (st.loadingSlots) { slotsEl.appendChild(h('p', { class: 'muted', text: 'Chargement des créneaux…' })); }
      else if (st.slotsError) { slotsEl.appendChild(h('p', { class: 'msg bad', text: st.slotsError })); }
      else if (!st.slots.length) { slotsEl.appendChild(h('p', { class: 'muted', text: 'Aucun créneau libre ce jour-là. Essaie un autre jour.' })); }
      else { st.slots.forEach(function (t) {
        slotsEl.appendChild(h('button', { type: 'button', class: 'chip', 'aria-pressed': st.slot === t ? 'true' : 'false', onclick: function () { st.slot = t; st.notice = null; renderBooking(); } }, [U.fmtTime(t)]));
      }); }
    }
    box.appendChild(stepBox(3, "Choisis l'heure", !(st.service && st.date), [slotsEl]));

    // 4. coordonnées + récapitulatif
    var msg = h('p', { class: 'msg', id: 'form-msg', role: 'alert' });
    var name = h('input', { id: 'f-name', type: 'text', autocomplete: 'name', maxlength: '80', placeholder: 'Ex : Aïcha' });
    var phone = h('input', { id: 'f-phone', type: 'tel', inputmode: 'tel', autocomplete: 'tel', placeholder: 'Ex : 229 01 23 45 67 89' });
    var btn = h('button', { type: 'submit', class: 'btn', id: 'f-send' }, ['Envoyer ma demande']);
    var addr = h('input', { id: 'f-addr', type: 'text', maxlength: '200', autocomplete: 'street-address', placeholder: 'Ex : Albarika, près du marché, maison bleue', value: st.address || '' });
    addr.addEventListener('input', function () { st.address = addr.value; });
    var placeBox = null;
    if (settings.home_visits) {
      var pc = h('div', { class: 'chips' });
      [['sur_place', 'Je viens sur place'], ['domicile', 'À mon domicile']].forEach(function (o) {
        pc.appendChild(h('button', { type: 'button', class: 'chip', 'aria-pressed': st.place === o[0] ? 'true' : 'false', onclick: function () { st.place = o[0]; renderBooking(); } }, [o[1]]));
      });
      placeBox = h('div', { class: 'field' }, [h('label', { text: 'Où veux-tu ton rendez-vous ?' }), pc,
        st.place === 'domicile' ? h('div', { class: 'field', style: 'margin-top:8px' }, [h('label', { for: 'f-addr', text: 'Ton quartier ou un repère' }), addr]) : null]);
    }
    var recap = h('div', { class: 'recap' });
    if (st.service && st.slot) {
      recap.appendChild(h('div', {}, [h('b', { text: st.service.name })]));
      recap.appendChild(h('div', { text: U.fmtDate(U.fmtDay(st.slot), true) + ' à ' + U.fmtTime(st.slot) + ' (durée d\'environ ' + st.service.duration_min + ' min)' }));
      if (settings.home_visits) { recap.appendChild(h('div', { text: st.place === 'domicile' ? 'Lieu : à ton domicile' + (st.address ? ' (' + st.address + ')' : '') : 'Lieu : sur place' })); }
      if (st.service.price_from_fcfa != null) { recap.appendChild(h('div', { class: 'muted', text: 'Prix : à partir de ' + U.fcfa(st.service.price_from_fcfa) + '. Le prix final est confirmé au salon. Paiement sur place.' })); }
    } else { recap.appendChild(h('div', { class: 'muted', text: 'Ton récapitulatif apparaîtra ici.' })); }
    var form = h('form', { novalidate: true, class: 'step', style: 'border:0;padding:0' }, [
      recap,
      placeBox,
      h('div', { class: 'inline' }, [h('div', { class: 'field' }, [h('label', { for: 'f-name', text: 'Ton nom' }), name]), h('div', { class: 'field' }, [h('label', { for: 'f-phone', text: 'Ton numéro' }), phone])]),
      h('p', { class: 'muted', style: 'font-size:.9rem', text: "Ton nom et ton numéro servent seulement à gérer ton rendez-vous. Ta demande est ensuite confirmée par le salon." }),
      msg, btn
    ]);
    form.addEventListener('submit', function (e) { e.preventDefault(); submit(name, phone, msg, btn); });
    box.appendChild(stepBox(4, 'Tes coordonnées', !st.slot, [form]));
  }

  function chooseService(s) {
    st.service = s; st.notice = null;
    var p = st.pending; st.pending = null;
    if (p) { st.date = p.date; st.slot = null; st.slots = []; loadSlots(p.slot); }
    else { st.date = null; st.slot = null; st.slots = []; renderBooking(); }
    loadAvail();
  }

  function loadSlots(keep) {
    st.loadingSlots = true; st.slotsError = null; st.slots = []; renderBooking();
    var wanted = st.date + '|' + st.service.id;
    API.rpc('get_available_slots', { p_date: st.date, p_service_id: st.service.id }).then(function (rows) {
      if (wanted !== st.date + '|' + st.service.id) { return; }
      st.slots = (rows || []).map(function (r) { return r.slot_start; });
      if (keep) {
        var k = st.slots.filter(function (t) { return new Date(t).getTime() === new Date(keep).getTime(); })[0];
        if (k) { st.slot = k; } else { st.notice = "L'heure choisie n'est pas possible pour cette prestation (durée plus longue). Choisis une autre heure."; }
      }
    }, function (e) { st.slotsError = errText(e); }).then(function () { st.loadingSlots = false; renderBooking(); });
  }

  function submit(nameEl, phoneEl, msg, btn) {
    if (st.busy) { return; }
    msg.className = 'msg'; msg.textContent = '';
    var nm = nameEl.value.trim(), ph = U.digits(phoneEl.value);
    if (nm.length < 2) { msg.className = 'msg bad'; msg.textContent = ERREURS.NOM_INVALIDE; nameEl.focus(); return; }
    if (ph.length < 8 || ph.length > 15) { msg.className = 'msg bad'; msg.textContent = ERREURS.TELEPHONE_INVALIDE; phoneEl.focus(); return; }
    if (st.place === 'domicile' && (st.address || '').trim().length < 3) { msg.className = 'msg bad'; msg.textContent = ERREURS.ADRESSE_REQUISE; var a = document.getElementById('f-addr'); if (a) { a.focus(); } return; }
    st.busy = true; btn.disabled = true; btn.textContent = 'Envoi en cours…';
    API.rpc('create_booking', { p_service_id: st.service.id, p_starts_at: st.slot, p_name: nm, p_phone: ph, p_place: st.place, p_address: st.place === 'domicile' ? st.address.trim() : null }).then(function (rows) {
      var r = rows && rows[0];
      if (!r || !r.reference) { throw new Error('REPONSE_INVALIDE'); }
      remember({ reference: r.reference, phone: ph });
      showDone(r, nm);
      loadMine(); loadAvail();
    }, function (e) {
      st.busy = false; btn.disabled = false; btn.textContent = 'Envoyer ma demande';
      msg.className = 'msg bad'; msg.textContent = errText(e);
      if (String(e && e.message).indexOf('CRENEAU_INDISPONIBLE') >= 0) { st.slot = null; st.notice = errText(e); loadSlots(); }
    });
  }

  function showDone(r, nm) {
    st.busy = false;
    U.clear(box);
    var ph = U.digits(settings && settings.phone);
    box.appendChild(h('section', { class: 'step' }, [
      h('h3', { text: 'Demande enregistrée' }),
      h('p', { class: 'msg ok', text: 'Merci ' + nm + ' ! Ta demande est bien reçue.' }),
      h('div', { class: 'recap' }, [
        h('div', {}, [h('b', { text: st.service.name })]),
        h('div', { text: U.fmtDate(U.fmtDay(r.starts_at), true) + ' à ' + U.fmtTime(r.starts_at) }),
        settings.home_visits ? h('div', { text: st.place === 'domicile' ? 'À ton domicile' : 'Sur place' }) : null,
        h('div', { text: 'Référence : ' + r.reference })
      ]),
      h('p', { class: 'msg info', text: "Important : ton rendez-vous n'est pas encore confirmé. Tu vas être contactée pour le confirmer. Garde ta référence : tu retrouveras aussi ce rendez-vous dans « Mes rendez-vous » sur cet appareil." }),
      ph.length >= 8 ? h('a', { class: 'btn', target: '_blank', rel: 'noopener', href: 'https://wa.me/' + ph + '?text=' + encodeURIComponent('Bonjour, j\'ai fait une demande de rendez-vous. Référence ' + r.reference + '.') }, ['Prévenir le salon sur WhatsApp']) : null,
      h('button', { type: 'button', class: 'btn ghost', onclick: function () { st = { service: null, date: null, slot: null, slots: [], busy: false, place: 'sur_place', address: '', pending: null }; renderBooking(); loadAvail(); } }, ['Faire une autre demande'])
    ]));
  }

  /* ---------- Disponibilités (visibles à chaque visite) ---------- */
  function loadAvail() {
    var my = ++avail.token;
    avail.loading = true; avail.error = null; renderAvail();
    API.rpc('get_availability', { p_service_id: st.service ? st.service.id : null, p_days: 7 }).then(function (rows) {
      if (my !== avail.token) { return; }
      avail.rows = rows || [];
    }, function (e) { if (my === avail.token) { avail.error = errText(e); avail.rows = []; } }).then(function () {
      if (my !== avail.token) { return; }
      avail.loading = false; renderAvail();
    });
  }

  function pickAvail(day, slot) {
    if (st.service) {
      st.date = day; st.slot = slot; st.notice = null;
      st.slots = avail.rows.filter(function (r) { return r.day === day; }).map(function (r) { return r.slot_start; });
      renderBooking();
      document.getElementById('booking').scrollIntoView();
    } else {
      st.pending = { date: day, slot: slot };
      st.notice = null;
      var m = document.getElementById('avail-msg');
      if (m) { m.className = 'msg info'; m.textContent = 'Le ' + U.fmtDate(day, true) + ' à ' + U.fmtTime(slot) + ' est noté. Choisis maintenant ta coiffure ci-dessous.'; }
      document.getElementById('booking').scrollIntoView();
    }
  }

  function renderAvail() {
    var g = document.getElementById('avail'); if (!g) { return; }
    U.clear(g);
    g.appendChild(h('h3', { text: 'Jours et heures libres cette semaine' }));
    g.appendChild(h('p', { class: 'muted', text: st.service ? 'Pour : ' + st.service.name + '. Touche une heure pour la réserver.' : 'Touche une heure pour la réserver. Les heures déjà prises ne sont pas affichées.' }));
    g.appendChild(h('p', { id: 'avail-msg', role: 'status', class: 'msg' }));
    if (avail.loading) { g.appendChild(h('p', { class: 'muted', text: 'Chargement des disponibilités…' })); return; }
    if (avail.error) { g.appendChild(h('p', { class: 'msg bad', text: avail.error })); return; }
    var days = [], by = {};
    avail.rows.forEach(function (r) { if (!by[r.day]) { by[r.day] = []; days.push(r.day); } by[r.day].push(r.slot_start); });
    if (!days.length) { g.appendChild(h('p', { class: 'empty', text: 'Aucune heure libre dans les 7 prochains jours. Écris au salon sur WhatsApp ou reviens bientôt.' })); return; }
    var list = h('div', { style: 'display:flex;flex-direction:column;gap:8px;margin-top:10px' });
    days.forEach(function (d, i) {
      var chips = h('div', { class: 'chips' });
      by[d].forEach(function (t) { chips.appendChild(h('button', { type: 'button', class: 'chip', onclick: function () { pickAvail(d, t); } }, [U.fmtTime(t)])); });
      var det = h('details', { class: 'day' }, [h('summary', {}, [U.fmtDate(d, true), ' ', h('span', { text: '· ' + by[d].length + ' heure' + (by[d].length > 1 ? 's' : '') + ' libre' + (by[d].length > 1 ? 's' : '') })]), chips]);
      if (i === 0) { det.setAttribute('open', ''); }
      list.appendChild(det);
    });
    g.appendChild(list);
  }

  /* ---------- Mes rendez-vous (mémorisés sur cet appareil) ---------- */
  var mine = { items: [], rows: [], loading: false, error: null, lookupMsg: '' };

  function readStore() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY) || '[]');
      return (Array.isArray(v) ? v : []).filter(function (x) { return x && typeof x.reference === 'string' && typeof x.phone === 'string'; }).slice(0, 10);
    } catch (e) { return []; }
  }
  function writeStore(items) { try { localStorage.setItem(KEY, JSON.stringify(items.slice(0, 10))); } catch (e) { /* stockage indisponible */ } }
  function remember(it) {
    var list = readStore().filter(function (x) { return x.reference.toUpperCase() !== String(it.reference).toUpperCase(); });
    list.unshift({ reference: String(it.reference).toUpperCase(), phone: U.digits(it.phone) });
    writeStore(list); mine.items = list.slice(0, 10);
  }
  var STATUT = { pending: ['En attente de confirmation', 'info'], confirmed: ['Confirmé', 'ok'], cancelled: ['Annulé', 'bad'] };

  function loadMine() {
    mine.items = readStore();
    if (!mine.items.length) { mine.rows = []; mine.loading = false; renderMine(); return; }
    mine.loading = true; mine.error = null; renderMine();
    API.rpc('get_my_bookings', { p_items: mine.items }).then(function (rows) { mine.rows = rows || []; }, function (e) { mine.error = errText(e); }).then(function () { mine.loading = false; renderMine(); });
  }

  function lookup(refEl, phEl) {
    var ref = refEl.value.trim().toUpperCase(), ph = U.digits(phEl.value);
    if (ref.length < 4 || ph.length < 8) { mine.lookupMsg = 'Écris ta référence et le numéro utilisé pour réserver.'; renderMine(); return; }
    API.rpc('get_my_bookings', { p_items: [{ reference: ref, phone: ph }] }).then(function (rows) {
      if (rows && rows.length) { remember({ reference: ref, phone: ph }); mine.lookupMsg = ''; loadMine(); }
      else { mine.lookupMsg = 'Aucun rendez-vous trouvé. Vérifie la référence et le numéro de téléphone.'; renderMine(); }
    }, function (e) { mine.lookupMsg = errText(e); renderMine(); });
  }

  function renderMine() {
    var g = document.getElementById('mine'); if (!g) { return; }
    U.clear(g);
    if (mine.loading) { g.appendChild(h('p', { class: 'muted', text: 'Chargement de tes rendez-vous…' })); }
    else if (mine.error) { g.appendChild(h('p', { class: 'msg bad', text: mine.error })); }
    else if (!mine.rows.length) { g.appendChild(h('p', { class: 'muted', text: "Tu n'as pas encore de rendez-vous sur cet appareil. Quand tu réserves, il apparaît ici à chaque visite." })); }
    var now = Date.now();
    var wrap = h('div', { style: 'display:flex;flex-direction:column;gap:12px;margin-top:6px' });
    mine.rows.slice().sort(function (a, b) {
      var pa = new Date(a.ends_at) < now, pb = new Date(b.ends_at) < now;
      if (pa !== pb) { return pa ? 1 : -1; }
      return (new Date(a.starts_at) - new Date(b.starts_at)) * (pa ? -1 : 1);
    }).forEach(function (r) {
      var sv = STATUT[r.status] || [r.status, 'info'];
      var past = new Date(r.ends_at) < now;
      wrap.appendChild(h('div', { class: 'mine-card', style: past ? 'opacity:.7' : null }, [
        h('b', { text: r.service_name }),
        h('div', { text: U.fmtDate(U.fmtDay(r.starts_at), true) + ' à ' + U.fmtTime(r.starts_at) + (past ? ' (passé)' : '') }),
        h('div', { class: 'muted', text: (r.place === 'domicile' ? 'À ton domicile' : 'Sur place') + ' · Réf. ' + r.reference }),
        h('span', { class: 'msg ' + sv[1], style: 'align-self:flex-start;padding:4px 10px;font-size:.9rem', text: sv[0] })
      ]));
    });
    g.appendChild(wrap);
    // retrouver un rendez-vous (autre appareil, navigateur vidé)
    var ref = h('input', { id: 'm-ref', type: 'text', maxlength: '20', autocomplete: 'off', placeholder: 'Ex : AB12CD34' });
    var ph = h('input', { id: 'm-phone', type: 'tel', inputmode: 'tel', autocomplete: 'tel', placeholder: 'Le numéro utilisé pour réserver' });
    var f = h('form', { novalidate: true, style: 'margin-top:22px', class: 'card' }, [
      h('h3', { text: 'Retrouver un rendez-vous' }),
      h('p', { class: 'muted', text: "Tu as changé de téléphone ou vidé ton navigateur ? Entre ta référence et ton numéro." }),
      h('div', { class: 'inline' }, [h('div', { class: 'field' }, [h('label', { for: 'm-ref', text: 'Référence' }), ref]), h('div', { class: 'field' }, [h('label', { for: 'm-phone', text: 'Ton numéro' }), ph])]),
      h('p', { class: 'msg ' + (mine.lookupMsg ? 'bad' : ''), role: 'alert', text: mine.lookupMsg }),
      h('button', { type: 'submit', class: 'btn small' }, ['Retrouver'])
    ]);
    f.addEventListener('submit', function (e) { e.preventDefault(); lookup(ref, ph); });
    g.appendChild(f);
    if (mine.items.length) {
      g.appendChild(h('p', { style: 'margin-top:14px' }, [h('button', { type: 'button', class: 'btn ghost small', onclick: function () { writeStore([]); mine.items = []; mine.rows = []; renderMine(); } }, ['Oublier mes rendez-vous sur cet appareil'])]));
      g.appendChild(h('p', { class: 'muted', style: 'font-size:.85rem;margin-top:6px', text: "Utile sur un téléphone partagé. Tes rendez-vous ne sont pas supprimés, seulement retirés de cet appareil." }));
    }
  }

  /* ---------- Démarrage ---------- */
  renderGallery();
  Promise.all([
    API.get('salon_settings?select=*&id=eq.1'),
    API.get('services?select=*&active=eq.true&order=sort.asc,name.asc')
  ]).then(function (res) {
    settings = (res[0] && res[0][0]) || { open_days: [1, 2, 3, 4, 6, 7], open_time: '08:00', close_time: '18:30', max_days_ahead: 30 };
    services = res[1] || [];
    renderHeader(); renderServices(); renderInfos(); renderBooking(); loadAvail(); loadMine();
  }, function () {
    settings = { open_days: [], max_days_ahead: 1 };
    avail.loading = false; avail.error = 'Impossible de charger les disponibilités.'; renderAvail(); loadMine();
    U.clear(box);
    box.appendChild(h('div', { class: 'msg bad', text: "Impossible de charger le salon pour l'instant. Vérifie ta connexion et recharge la page." }));
  });
})();
