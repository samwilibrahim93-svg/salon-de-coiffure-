/* Page publique : prestations, galerie, réservation en 4 étapes, infos. */
(function () {
  var h = U.h, API = SalonAPI;
  var settings = null, services = [];
  var st = { service: null, date: null, slot: null, slots: [], busy: false };
  var box = document.getElementById('booking');

  var ERREURS = {
    CRENEAU_INDISPONIBLE: "Ce créneau vient d'être pris ou n'est plus disponible. Choisis-en un autre.",
    TELEPHONE_INVALIDE: 'Le numéro de téléphone semble incorrect. Utilise seulement des chiffres, avec l\'indicatif (ex. 229 suivi du numéro).',
    NOM_INVALIDE: 'Écris ton nom (entre 2 et 80 caractères).',
    PRESTATION_INDISPONIBLE: "Cette prestation n'est plus disponible.",
    TROP_DE_RESERVATIONS: "Tu as déjà 3 rendez-vous à venir avec ce numéro. Contacte le salon pour en ajouter ou en modifier un.",
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
      g.appendChild(h('article', { class: 'card' }, [
        h('h3', { text: s.name }),
        s.description ? h('p', { class: 'muted', text: s.description }) : null,
        h('p', { class: 'muted', text: 'Durée : environ ' + s.duration_min + ' min' }),
        s.price_from_fcfa != null ? h('p', { class: 'price', text: 'À partir de ' + U.fcfa(s.price_from_fcfa) }) : null
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
      h('p', { class: 'muted', text: s.address ? s.address : "L'adresse exacte sera bientôt ajoutée." })
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
      chips.appendChild(h('button', { type: 'button', class: 'chip', 'aria-pressed': st.service && st.service.id === s.id ? 'true' : 'false', onclick: function () {
        st.service = s; st.date = null; st.slot = null; st.slots = []; st.notice = null; renderBooking();
      } }, [s.name + (s.price_from_fcfa != null ? ' · dès ' + U.fcfa(s.price_from_fcfa) : '')]));
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
    var recap = h('div', { class: 'recap' });
    if (st.service && st.slot) {
      recap.appendChild(h('div', {}, [h('b', { text: st.service.name })]));
      recap.appendChild(h('div', { text: U.fmtDate(U.fmtDay(st.slot), true) + ' à ' + U.fmtTime(st.slot) + ' (durée d\'environ ' + st.service.duration_min + ' min)' }));
      if (st.service.price_from_fcfa != null) { recap.appendChild(h('div', { class: 'muted', text: 'Prix : à partir de ' + U.fcfa(st.service.price_from_fcfa) + '. Le prix final est confirmé au salon. Paiement sur place.' })); }
    } else { recap.appendChild(h('div', { class: 'muted', text: 'Ton récapitulatif apparaîtra ici.' })); }
    var form = h('form', { novalidate: true, class: 'step', style: 'border:0;padding:0' }, [
      recap,
      h('div', { class: 'inline' }, [h('div', { class: 'field' }, [h('label', { for: 'f-name', text: 'Ton nom' }), name]), h('div', { class: 'field' }, [h('label', { for: 'f-phone', text: 'Ton numéro' }), phone])]),
      h('p', { class: 'muted', style: 'font-size:.9rem', text: "Ton nom et ton numéro servent seulement à gérer ton rendez-vous. Ta demande est ensuite confirmée par le salon." }),
      msg, btn
    ]);
    form.addEventListener('submit', function (e) { e.preventDefault(); submit(name, phone, msg, btn); });
    box.appendChild(stepBox(4, 'Tes coordonnées', !st.slot, [form]));
  }

  function loadSlots() {
    st.loadingSlots = true; st.slotsError = null; st.slots = []; renderBooking();
    var wanted = st.date + '|' + st.service.id;
    API.rpc('get_available_slots', { p_date: st.date, p_service_id: st.service.id }).then(function (rows) {
      if (wanted !== st.date + '|' + st.service.id) { return; }
      st.slots = (rows || []).map(function (r) { return r.slot_start; });
    }, function (e) { st.slotsError = errText(e); }).then(function () { st.loadingSlots = false; renderBooking(); });
  }

  function submit(nameEl, phoneEl, msg, btn) {
    if (st.busy) { return; }
    msg.className = 'msg'; msg.textContent = '';
    var nm = nameEl.value.trim(), ph = U.digits(phoneEl.value);
    if (nm.length < 2) { msg.className = 'msg bad'; msg.textContent = ERREURS.NOM_INVALIDE; nameEl.focus(); return; }
    if (ph.length < 8 || ph.length > 15) { msg.className = 'msg bad'; msg.textContent = ERREURS.TELEPHONE_INVALIDE; phoneEl.focus(); return; }
    st.busy = true; btn.disabled = true; btn.textContent = 'Envoi en cours…';
    API.rpc('create_booking', { p_service_id: st.service.id, p_starts_at: st.slot, p_name: nm, p_phone: ph }).then(function (rows) {
      var r = rows && rows[0];
      if (!r || !r.reference) { throw new Error('REPONSE_INVALIDE'); }
      showDone(r, nm);
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
        h('div', { text: 'Référence : ' + r.reference })
      ]),
      h('p', { class: 'msg info', text: "Important : ton rendez-vous n'est pas encore confirmé. Le salon va te contacter pour le confirmer. Garde ta référence." }),
      ph.length >= 8 ? h('a', { class: 'btn', target: '_blank', rel: 'noopener', href: 'https://wa.me/' + ph + '?text=' + encodeURIComponent('Bonjour, j\'ai fait une demande de rendez-vous. Référence ' + r.reference + '.') }, ['Prévenir le salon sur WhatsApp']) : null,
      h('button', { type: 'button', class: 'btn ghost', onclick: function () { st = { service: null, date: null, slot: null, slots: [], busy: false }; renderBooking(); } }, ['Faire une autre demande'])
    ]));
  }

  /* ---------- Démarrage ---------- */
  renderGallery();
  Promise.all([
    API.get('salon_settings?select=*&id=eq.1'),
    API.get('services?select=*&active=eq.true&order=sort.asc,name.asc')
  ]).then(function (res) {
    settings = (res[0] && res[0][0]) || { open_days: [1, 2, 3, 4, 6, 7], open_time: '08:00', close_time: '18:30', max_days_ahead: 30 };
    services = res[1] || [];
    renderHeader(); renderServices(); renderInfos(); renderBooking();
  }, function () {
    settings = { open_days: [], max_days_ahead: 1 };
    U.clear(box);
    box.appendChild(h('div', { class: 'msg bad', text: "Impossible de charger le salon pour l'instant. Vérifie ta connexion et recharge la page." }));
  });
})();
