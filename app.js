// Maqueta: datos de ejemplo en memoria. Nada se guarda ni se envía a ningún servidor.
// Con la base de datos real, el PIN de administrador se comprobará en el servidor, nunca aquí.
(function () {
  'use strict';

  var DEMO_ADMIN_PIN = '0000'; // solo maqueta
  var DAY = 86400000;

  function startOfDay(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  function at(dayOffset, h, m) {
    var d = startOfDay(new Date());
    d.setDate(d.getDate() + dayOffset);
    d.setHours(h, m || 0, 0, 0);
    return d;
  }

  var now = new Date();
  var nextHour = new Date(now); nextHour.setHours(now.getHours() + 1, 0, 0, 0);
  var nextId = 1;

  var bookings = [
    { name: 'Marta', pin: '1234', start: new Date(nextHour.getTime() + 2 * 3600000), end: new Date(nextHour.getTime() + 3.5 * 3600000) },
    { name: 'Pablo', pin: '1234', start: at(1, 10), end: at(1, 12) },
    { name: 'Lucía', pin: '1234', start: at(1, 18), end: at(1, 19, 30) },
    { name: 'Dani', pin: '1234', start: at(2, 22), end: at(3, 1) },
    { name: 'Marta', pin: '1234', start: at(3, 8), end: at(3, 9) },
    { name: 'Asociación de vecinos', pin: '1234', start: at(5, 17), end: at(5, 21) }
  ].map(function (b) { b.id = nextId++; return b; });

  var $ = function (id) { return document.getElementById(id); };
  var el = {
    word: $('estado-titulo'), detail: $('estado-detalle'), form: $('form'),
    nombre: $('nombre'), iF: $('inicio-fecha'), iH: $('inicio-hora'),
    fF: $('fin-fecha'), fH: $('fin-hora'), pin: $('pin'),
    check: $('check'), error: $('form-error'), confirm: $('confirm'),
    days: $('days'), agendaTitle: $('agenda-titulo')
  };

  /* ---------- Formato ---------- */
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var fmtTime = function (d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  var fmtDate = function (d) {
    return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '');
  };
  var toDateValue = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var toTimeValue = function (d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); };

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

  /* ---------- Reglas ---------- */
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
    if (start < limit) return { ok: false, msg: 'El inicio ya pasó. Elige una hora a partir de ahora.' };
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
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function renderDays() {
    var t = new Date();
    var open = document.querySelector('.cancel-panel:not([hidden])');
    var openId = open ? open.getAttribute('data-for') : null;
    var html = '';
    for (var i = 0; i < 7; i++) {
      var ds = at(i, 0), de = new Date(ds.getTime() + DAY);
      ds = startOfDay(ds); de = new Date(ds); de.setDate(de.getDate() + 1);
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
        var startsBefore = b.start < ds, endsAfter = b.end > de;
        var from = startsBefore ? 'desde ayer ' + fmtTime(b.start) : fmtTime(b.start);
        var to = endsAfter ? 'hasta mañana ' + fmtTime(b.end) : fmtTime(b.end);
        return '<li class="booking">' +
          '<div class="booking-row">' +
            '<div><p class="booking-who">' + escapeHtml(b.name) + '</p><p class="booking-when">' + from + ' → ' + to + '</p></div>' +
            '<button type="button" class="btn-ghost" data-cancel="' + b.id + '" aria-expanded="' + (openId == b.id ? 'true' : 'false') + '" aria-controls="cp-' + b.id + '-' + i + '">Cancelar</button>' +
          '</div>' +
          '<div class="cancel-panel" id="cp-' + b.id + '-' + i + '" data-for="' + b.id + '"' + (openId == b.id ? '' : ' hidden') + '>' +
            '<div class="cancel-fields">' +
              '<div class="field"><label for="cpin-' + b.id + '-' + i + '">PIN de la reserva o de administrador</label>' +
              '<input id="cpin-' + b.id + '-' + i + '" type="password" inputmode="numeric" maxlength="4" autocomplete="off"></div>' +
              '<button type="button" class="btn-danger" data-confirm="' + b.id + '">Cancelar reserva</button>' +
              '<button type="button" class="btn-ghost" data-back="' + b.id + '">Volver</button>' +
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

  /* ---------- Cancelar ---------- */
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
        panel.querySelector('input').focus();
      }
    } else if (btn.hasAttribute('data-back')) {
      var p2 = li.querySelector('.cancel-panel');
      p2.setAttribute('hidden', '');
      li.querySelector('[data-cancel]').setAttribute('aria-expanded', 'false');
      li.querySelector('[data-cancel]').focus();
    } else if (btn.hasAttribute('data-confirm')) {
      var id = Number(btn.getAttribute('data-confirm'));
      var b = bookings.filter(function (x) { return x.id === id; })[0];
      var input = li.querySelector('.cancel-panel input');
      var msg = li.querySelector('.cancel-msg');
      if (!/^\d{4}$/.test(input.value)) { msg.textContent = 'Escribe un PIN de 4 cifras.'; input.focus(); return; }
      if (input.value !== b.pin && input.value !== DEMO_ADMIN_PIN) { msg.textContent = 'PIN incorrecto. No se ha cancelado la reserva.'; input.select(); return; }
      bookings = bookings.filter(function (x) { return x.id !== id; });
      render();
      liveCheck();
      el.agendaTitle.focus();
      announce('Reserva de ' + b.name + ' cancelada.');
    }
  });

  function announce(text) {
    el.confirm.hidden = false;
    el.confirm.textContent = text;
  }

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

    var booking = { id: nextId++, name: name, pin: el.pin.value, start: v.start, end: v.end };
    bookings.push(booking);
    el.pin.value = '';
    setDefaults();
    render();
    liveCheck();
    el.confirm.hidden = false;
    el.confirm.innerHTML = '<strong>Reservada a nombre de ' + escapeHtml(name) + '.</strong> ' + escapeHtml(fullLabel(booking)) +
      '. Apunta tu PIN: lo necesitarás para cancelar.';
    el.confirm.focus();
  });

  [el.iF, el.iH, el.fF, el.fH].forEach(function (i) {
    i.addEventListener('input', function () { clearError(); liveCheck(); });
  });
  [el.nombre, el.pin].forEach(function (i) { i.addEventListener('input', clearError); });
  el.pin.addEventListener('input', function () { el.pin.value = el.pin.value.replace(/\D/g, '').slice(0, 4); });

  setDefaults();
  render();
  liveCheck();
  setInterval(function () { renderStatus(); }, 30000);
})();
