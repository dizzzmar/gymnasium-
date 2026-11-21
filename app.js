// Reserva de sala comunitaria.
// Con config.js (Supabase) usa la base de datos real; sin él funciona en modo maqueta con datos de ejemplo.
// Ninguna clave ni PIN real vive en este archivo: la configuración llega en config.js, que no está en git.
(function () {
  'use strict';

  var DAY = 86400000;
  var cfg = window.APP_CONFIG || {};
  var live = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && !/TU[-_]/.test(cfg.SUPABASE_URL + cfg.SUPABASE_ANON_KEY));

  function startOfDay(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  function at(dayOffset, h, m) {
    var d = startOfDay(new Date());
    d.setDate(d.getDate() + dayOffset);
    d.setHours(h, m || 0, 0, 0);
    return d;
  }

  /* ---------- Capa de datos ---------- */
  var ERRORS = {
    datos_invalidos: 'Revisa los datos: nombre, horas y un PIN de 4 cifras.',
    inicio_pasado: 'El inicio ya pasó. Elige una hora a partir de ahora.',
    solape: 'La sala ya está ocupada en ese horario. He actualizado las reservas.',
    demasiadas_reservas: 'Ya tienes 5 reservas futuras con ese nombre. Cancela alguna para reservar más.',
    red: 'No se pudo conectar. Comprueba tu conexión e inténtalo de nuevo.'
  };
  var GENERIC_ERROR = 'Ha ocurrido un error. Inténtalo de nuevo.';

  function makeLiveApi() {
    var base = cfg.SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/rpc/';
    function rpc(fn, args) {
      return fetch(base + fn, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: cfg.SUPABASE_ANON_KEY,
          Authorization: 'Bearer ' + cfg.SUPABASE_ANON_KEY
        },
        body: JSON.stringify(args || {})
      }).then(function (res) {
        return res.json().catch(function () { return null; }).then(function (body) {
          if (!res.ok) { var e = new Error('rpc'); e.code = body && body.message; throw e; }
          return body;
        });
      }, function () { var e = new Error('red'); e.code = 'red'; throw e; });
    }
    return {
      list: function () {
        return rpc('list_bookings').then(function (rows) {
          return (rows || []).map(function (r) {
            return { id: r.id, name: r.name, start: new Date(r.start_at), end: new Date(r.end_at) };
          });
        });
      },
      create: function (b, pin) {
        return rpc('create_booking', { p_name: b.name, p_start: b.start.toISOString(), p_end: b.end.toISOString(), p_pin: pin });
      },
      cancel: function (id, pin, admin) {
        return rpc(admin ? 'admin_cancel_booking' : 'cancel_booking', { p_id: id, p_pin: pin });
      }
    };
  }

  function makeDemoApi() {
    var nextId = 1;
    var nextHour = new Date(); nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
    var data = [
      { name: 'Marta', start: new Date(nextHour.getTime() + 2 * 3600000), end: new Date(nextHour.getTime() + 3.5 * 3600000) },
      { name: 'Pablo', start: at(1, 10), end: at(1, 12) },
      { name: 'Lucía', start: at(1, 18), end: at(1, 19, 30) },
      { name: 'Dani', start: at(2, 22), end: at(3, 1) },
      { name: 'Marta', start: at(3, 8), end: at(3, 9) },
      { name: 'Asociación de vecinos', start: at(5, 17), end: at(5, 21) }
    ].map(function (b) { b.id = nextId++; b.pin = '1234'; return b; });
    var done = function (v) { return Promise.resolve(v); };
    return {
      list: function () { return done(data.map(function (b) { return { id: b.id, name: b.name, start: b.start, end: b.end }; })); },
      create: function (b, pin) {
        var clash = data.some(function (x) { return b.start < x.end && b.end > x.start; });
        if (clash) { var e = new Error('solape'); e.code = 'solape'; return Promise.reject(e); }
        data.push({ id: nextId++, name: b.name, start: b.start, end: b.end, pin: pin });
        return done(nextId);
      },
      cancel: function (id, pin, admin) {
        var b = data.filter(function (x) { return x.id === id; })[0];
        if (!b) return done('no_existe');
        if (pin !== b.pin && !(admin && pin === '0000')) return done('pin_incorrecto'); // PIN de prueba: solo modo maqueta
        data = data.filter(function (x) { return x.id !== id; });
        return done('ok');
      }
    };
  }

  var api = live ? makeLiveApi() : makeDemoApi();
  var bookings = [];

  var $ = function (id) { return document.getElementById(id); };
  var el = {
    word: $('estado-titulo'), detail: $('estado-detalle'), form: $('form'),
    nombre: $('nombre'), iF: $('inicio-fecha'), iH: $('inicio-hora'),
    fF: $('fin-fecha'), fH: $('fin-hora'), pin: $('pin'),
    check: $('check'), error: $('form-error'), confirm: $('confirm'),
    days: $('days'), agendaTitle: $('agenda-titulo'), submit: document.querySelector('.btn-primary'),
    foot: document.querySelector('.foot')
  };
  if (live) el.foot.hidden = true;

  /* ---------- Formato ---------- */
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var fmtTime = function (d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  var fmtDate = function (d) {
    return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '');
  };
  var toDateValue = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var toTimeValue = function (d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); };

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function relDay(d) {
    var diff = Math.round((startOfDay(d) - startOfDay(new Date())) / DAY);
    if (diff === 0) return 'hoy';
    if (diff === 1) return 'mañana';
    if (diff === -1) return 'ayer';
    return fmtDate(d);
  }
  function fullLabel(b) {
    var sameDay = startOfDay(b.start).getTime() === startOfDay(b.end).getTime();
    return fmtDate(b.start) + ', ' + fmtTime(b.start) + ' → ' + (sameDay ? '' : fmtDate(b.end) + ', ') + fmtTime(b.end);
  }

  /* ---------- Reglas (la base de datos es la que manda; aquí solo se avisa antes) ---------- */
  function parseInputs() {
    function p(dv, tv) {
      if (!dv || !tv) return null;
      var d = new Date(dv + 'T' + tv);
      return isNaN(d) ? null : d;
    }
    return { start: p(el.iF.value, el.iH.value), end: p(el.fF.value, el.fH.value) };
  }

  function validate(start, end) {
    if (!start || !end) return { ok: false, msg: '' };
    if (end <= start) return { ok: false, msg: 'La hora de fin tiene que ser posterior al inicio.' };
    var limit = new Date(); limit.setSeconds(0, 0);
    if (start < limit) return { ok: false, msg: ERRORS.inicio_pasado };
    for (var i = 0; i < bookings.length; i++) {
      var b = bookings[i];
      if (start < b.end && end > b.start) {
        return { ok: false, msg: 'La sala está ocupada por ' + b.name + ' (' + fullLabel(b) + ').' };
      }
    }
    return { ok: true, msg: 'La sala está libre en ese horario.' };
  }

  function liveCheck() {
    var v = parseInputs();
    var r = validate(v.start, v.end);
    if (!v.start || !v.end) { el.check.textContent = ''; el.check.removeAttribute('data-ok'); return r; }
    el.check.textContent = r.msg;
    el.check.setAttribute('data-ok', r.ok ? 'true' : 'false');
    return r;
  }

  /* ---------- Estado ---------- */
  function renderStatus() {
    var t = new Date();
    var current = null, next = null;
    bookings.slice().sort(function (a, b) { return a.start - b.start; }).forEach(function (b) {
      if (b.start <= t && b.end > t) current = b;
      else if (b.start > t && !next) next = b;
    });
    if (current) {
      el.word.textContent = 'Ocupada';
      el.word.setAttribute('data-state', 'ocupada');
      var endDay = startOfDay(current.end).getTime() === startOfDay(t).getTime() ? '' : ' ' + relDay(current.end);
      el.detail.innerHTML = 'Hasta las <strong>' + fmtTime(current.end) + '</strong>' + escapeHtml(endDay) +
        ', reservada por ' + escapeHtml(current.name) + '.';
    } else {
      el.word.textContent = 'Libre';
      el.word.setAttribute('data-state', 'libre');
      el.detail.innerHTML = next
        ? 'Libre hasta las <strong>' + fmtTime(next.start) + '</strong> ' + escapeHtml(relDay(next.start)) +
          ', cuando empieza la reserva de ' + escapeHtml(next.name) + '.'
        : 'No hay reservas próximas. Puedes reservar ya.';
    }
  }

  /* ---------- Agenda ---------- */
  function renderDays() {
    var t = new Date();
    var open = document.querySelector('.cancel-panel:not([hidden])');
    var openId = open ? open.getAttribute('data-for') : null;
    var html = '';
    for (var i = 0; i < 7; i++) {
      var ds = at(i, 0), de = new Date(ds); de.setDate(de.getDate() + 1);
      var segs = bookings.filter(function (b) { return b.start < de && b.end > ds; })
        .sort(function (a, b) { return a.start - b.start; });
      var title = (i === 0 ? 'Hoy · ' : i === 1 ? 'Mañana · ' : '') + fmtDate(ds);
      var blocks = segs.map(function (b) {
        var s = Math.max(b.start, ds), e = Math.min(b.end, de);
        return '<span class="block" style="left:' + ((s - ds) / DAY * 100).toFixed(3) + '%;width:' + ((e - s) / DAY * 100).toFixed(3) + '%"></span>';
      }).join('');
      var nowMark = i === 0 ? '<span class="now" style="left:' + ((t - ds) / DAY * 100).toFixed(3) + '%"></span>' : '';
      var summary = segs.length
        ? 'Ocupada: ' + segs.map(function (b) { return fmtTime(new Date(Math.max(b.start, ds))) + ' a ' + (b.end >= de ? '24:00' : fmtTime(b.end)); }).join(', ')
        : 'Libre todo el día';

      var list = segs.length ? segs.map(function (b) {
        var from = b.start < ds ? 'desde ayer ' + fmtTime(b.start) : fmtTime(b.start);
        var to = b.end > de ? 'hasta mañana ' + fmtTime(b.end) : fmtTime(b.end);
        var pid = 'cp-' + b.id + '-' + i;
        var isOpen = String(openId) === String(b.id);
        return '<li class="booking">' +
          '<div class="booking-row">' +
            '<div><p class="booking-who">' + escapeHtml(b.name) + '</p><p class="booking-when">' + from + ' → ' + to + '</p></div>' +
            '<button type="button" class="btn-ghost" data-cancel="' + escapeHtml(b.id) + '" aria-expanded="' + isOpen + '" aria-controls="' + pid + '">Cancelar</button>' +
          '</div>' +
          '<div class="cancel-panel" id="' + pid + '" data-for="' + escapeHtml(b.id) + '"' + (isOpen ? '' : ' hidden') + '>' +
            '<div class="cancel-fields">' +
              '<div class="field"><label for="c' + pid + '" data-pin-label>PIN de la reserva</label>' +
              '<input id="c' + pid + '" type="password" maxlength="64" autocomplete="off"></div>' +
              '<label class="check-row"><input type="checkbox" data-admin> Soy administrador</label>' +
              '<button type="button" class="btn-danger" data-confirm="' + escapeHtml(b.id) + '">Cancelar reserva</button>' +
              '<button type="button" class="btn-ghost" data-back="' + escapeHtml(b.id) + '">Volver</button>' +
            '</div>' +
            '<p class="cancel-msg" role="alert"></p>' +
          '</div>' +
        '</li>';
      }).join('') : '<li class="empty">Sin reservas. La sala está libre todo el día.</li>';

      html += '<article class="day"><h3>' + title + '</h3>' +
        '<div class="strip-wrap"><div class="strip" role="img" aria-label="' + escapeHtml(summary) + '">' + blocks + nowMark + '</div>' +
        '<div class="ticks" aria-hidden="true"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div></div>' +
        '<ul class="bookings">' + list + '</ul></article>';
    }
    el.days.innerHTML = html;
  }

  function render() { renderStatus(); renderDays(); }

  function reload() {
    return api.list().then(function (list) { bookings = list; render(); liveCheck(); });
  }

  function announce(text) { el.confirm.hidden = false; el.confirm.textContent = text; }

  /* ---------- Cancelar ---------- */
  el.days.addEventListener('change', function (e) {
    if (!e.target.hasAttribute('data-admin')) return;
    var panel = e.target.closest('.cancel-panel');
    panel.querySelector('[data-pin-label]').textContent = e.target.checked ? 'PIN de administrador' : 'PIN de la reserva';
    panel.querySelector('input[type="password"]').focus();
  });

  el.days.addEventListener('click', function (e) {
    var btn = e.target.closest('button');
    if (!btn) return;
    var li = btn.closest('.booking');

    if (btn.hasAttribute('data-cancel')) {
      var panel = li.querySelector('.cancel-panel');
      var willOpen = panel.hasAttribute('hidden');
      document.querySelectorAll('.cancel-panel').forEach(function (p) { p.setAttribute('hidden', ''); });
      document.querySelectorAll('[data-cancel]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
      if (willOpen) {
        panel.removeAttribute('hidden');
        btn.setAttribute('aria-expanded', 'true');
        panel.querySelector('input[type="password"]').focus();
      }
    } else if (btn.hasAttribute('data-back')) {
      li.querySelector('.cancel-panel').setAttribute('hidden', '');
      li.querySelector('[data-cancel]').setAttribute('aria-expanded', 'false');
      li.querySelector('[data-cancel]').focus();
    } else if (btn.hasAttribute('data-confirm')) {
      var rawId = btn.getAttribute('data-confirm');
      var b = bookings.filter(function (x) { return String(x.id) === rawId; })[0];
      var id = b ? b.id : rawId;
      var input = li.querySelector('.cancel-panel input[type="password"]');
      var isAdmin = li.querySelector('[data-admin]').checked;
      var msg = li.querySelector('.cancel-msg');
      if (!isAdmin && !/^\d{4}$/.test(input.value)) { msg.textContent = 'Escribe un PIN de 4 cifras.'; input.focus(); return; }
      if (isAdmin && !input.value) { msg.textContent = 'Escribe el PIN de administrador.'; input.focus(); return; }
      btn.disabled = true;
      msg.textContent = '';
      api.cancel(id, input.value, isAdmin).then(function (result) {
        if (result === 'ok') {
          return reload().then(function () {
            el.agendaTitle.focus();
            announce('Reserva de ' + (b ? b.name : '') + ' cancelada.');
          });
        }
        btn.disabled = false;
        if (result === 'bloqueado') msg.textContent = 'Demasiados intentos fallidos. Inténtalo de nuevo en 15 minutos.';
        else if (result === 'no_existe') { msg.textContent = 'Esa reserva ya no existe.'; reload(); }
        else if (result === 'sin_admin') msg.textContent = 'El administrador todavía no está configurado.';
        else { msg.textContent = 'PIN incorrecto. No se ha cancelado la reserva.'; input.select(); }
      }, function (err) {
        btn.disabled = false;
        msg.textContent = ERRORS[err && err.code] || GENERIC_ERROR;
      });
    }
  });

  /* ---------- Reservar ---------- */
  function setDefaults() {
    var s = new Date();
    s.setMinutes(Math.ceil((s.getMinutes() + 1) / 15) * 15, 0, 0);
    var e = new Date(s.getTime() + 3600000);
    el.iF.value = toDateValue(s); el.iH.value = toTimeValue(s);
    el.fF.value = toDateValue(e); el.fH.value = toTimeValue(e);
    el.iF.min = el.fF.min = toDateValue(new Date());
  }

  function showError(text, field) {
    el.error.textContent = text;
    el.error.hidden = false;
    [el.nombre, el.pin].forEach(function (i) { i.removeAttribute('aria-invalid'); });
    if (field) { field.setAttribute('aria-invalid', 'true'); field.focus(); }
  }
  function clearError() {
    el.error.hidden = true;
    el.error.textContent = '';
    [el.nombre, el.pin].forEach(function (i) { i.removeAttribute('aria-invalid'); });
  }

  el.form.addEventListener('submit', function (e) {
    e.preventDefault();
    clearError();
    el.confirm.hidden = true;
    var name = el.nombre.value.trim();
    if (!name) return showError('Escribe tu nombre para reservar.', el.nombre);
    var v = parseInputs();
    if (!v.start || !v.end) return showError('Indica la fecha y la hora de inicio y de fin.', el.iF);
    var r = validate(v.start, v.end);
    if (!r.ok) return showError(r.msg, el.iF);
    if (!/^\d{4}$/.test(el.pin.value)) return showError('El PIN tiene que tener 4 cifras.', el.pin);

    var booking = { name: name, start: v.start, end: v.end };
    var label = el.submit.textContent;
    el.submit.disabled = true;
    el.submit.textContent = 'Reservando…';
    api.create(booking, el.pin.value).then(function () {
      el.pin.value = '';
      setDefaults();
      return reload().then(function () {
        el.confirm.hidden = false;
        el.confirm.innerHTML = '<strong>Reservada a nombre de ' + escapeHtml(name) + '.</strong> ' + escapeHtml(fullLabel(booking)) +
          '. Apunta tu PIN: lo necesitarás para cancelar.';
        el.confirm.focus();
      });
    }).catch(function (err) {
      var code = err && err.code;
      showError(ERRORS[code] || GENERIC_ERROR, code === 'solape' ? el.iF : null);
      if (code === 'solape') reload().catch(function () {});
    }).then(function () {
      el.submit.disabled = false;
      el.submit.textContent = label;
    });
  });

  [el.iF, el.iH, el.fF, el.fH].forEach(function (i) {
    i.addEventListener('input', function () { clearError(); liveCheck(); });
  });
  [el.nombre, el.pin].forEach(function (i) { i.addEventListener('input', clearError); });
  el.pin.addEventListener('input', function () { el.pin.value = el.pin.value.replace(/\D/g, '').slice(0, 4); });

  /* ---------- Arranque ---------- */
  setDefaults();
  el.word.textContent = 'Cargando';
  el.detail.textContent = live ? 'Consultando las reservas…' : '';
  reload().catch(function (err) {
    el.word.textContent = 'Sin conexión';
    el.detail.textContent = ERRORS[err && err.code] || GENERIC_ERROR;
  });

  // Refresco cada 30 s para ver las reservas de otros vecinos (no mientras se escribe un PIN de cancelación).
  setInterval(function () {
    if (document.hidden) return;
    var typing = document.querySelector('.cancel-panel:not([hidden])');
    if (typing) { renderStatus(); return; }
    reload().catch(function () {});
  }, 30000);
})();
