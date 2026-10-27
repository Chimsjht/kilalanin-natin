(function () {
  var app = document.getElementById('app');
  var reload = document.getElementById('reload');
  var pw = null, data = null, tab = 'students';
  var LABELS = { traits: 'Positive traits', memorable: 'Memorable moment', funny: 'Funny moment', habit: 'Habit / catchphrase', tagline: 'Tagline / alias', message: 'Message' };

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function api(body) {
    if (!window.API_URL) return Promise.reject(new Error('API_URL is not set in config.js yet.'));
    return fetch(window.API_URL, { method: 'POST', body: JSON.stringify(body) }).then(function (r) { return r.json(); });
  }
  function when(t) { return t ? new Date(t).toLocaleString() : ''; }

  function showLogin(msg) {
    app.innerHTML =
      '<div class="card" style="max-width:420px;margin:0 auto"><h2>Adviser login</h2>' +
      '<p class="muted small">Your password is in the <b>Settings</b> tab of your Google Sheet (TEACHER_PASSWORD).</p>' +
      '<input type="password" id="pw" placeholder="Password" autocomplete="current-password">' +
      '<div class="err" id="err">' + (msg ? esc(msg) : '') + '</div>' +
      '<div class="row"><button class="btn" id="go">Open dashboard</button></div></div>';
    var input = document.getElementById('pw');
    input.focus();
    function go() {
      pw = input.value;
      try { sessionStorage.setItem('tpw', pw); } catch (e) { }
      load();
    }
    document.getElementById('go').onclick = go;
    input.onkeydown = function (e) { if (e.key === 'Enter') go(); };
  }

  function load() {
    app.innerHTML = '<div class="spinner"></div>';
    api({ action: 'teacher', password: pw }).then(function (res) {
      if (!res.ok) { try { sessionStorage.removeItem('tpw'); } catch (e) { } return showLogin(res.error); }
      data = res; reload.hidden = false; draw();
    }).catch(function (e) { showLogin(e.message); });
  }

  function set(key, value) {
    app.style.opacity = .5;
    api({ action: 'teacherSet', password: pw, key: key, value: value }).then(function (res) {
      app.style.opacity = 1;
      if (!res.ok) return alert(res.error);
      data = res; draw();
    });
  }

  function tags(list, empty) {
    if (!list.length) return '<span class="tag none">' + empty + '</span>';
    return list.map(function (x) {
      var st = x.status === 'submitted' ? '' : (x.status === 'writing' ? ' (writing…)' : ' (left unfinished)');
      return '<span class="tag ' + x.status + '">' + esc(x.name) + st + (x.bonus ? ' ★bonus' : '') + '</span>';
    }).join('');
  }

  function draw() {
    var st = data.students;
    var wrote = st.filter(function (s) { return s.wroteFor.some(function (w) { return w.status === 'submitted'; }); });
    var notUsed = st.filter(function (s) { return !s.lastLogin; });
    var loggedNoWrite = st.filter(function (s) { return s.lastLogin && !s.wroteFor.some(function (w) { return w.status === 'submitted'; }); });
    var notAbout = st.filter(function (s) { return !s.writtenBy.some(function (w) { return w.status === 'submitted'; }); });

    var html =
      '<div class="stats">' +
      stat(st.length, 'Students') + stat(wrote.length, 'Have written') + stat(notUsed.length, 'Never logged in') +
      stat(notAbout.length, 'No message yet') + stat(data.responses.length, 'Total messages') +
      '</div>' +
      '<div class="tabs">' + ['students', 'missing', 'responses', 'settings'].map(function (t) {
        var name = { students: 'All students', missing: 'Who still needs action', responses: 'Messages', settings: 'Settings' }[t];
        return '<button data-tab="' + t + '" class="' + (tab === t ? 'on' : '') + '">' + name + '</button>';
      }).join('') + '</div>';

    if (tab === 'students') {
      html += '<div class="card tbl"><table><thead><tr><th>Student</th><th>Wrote for</th><th>Written about by</th><th>Last login</th></tr></thead><tbody>' +
        st.map(function (s) {
          return '<tr><td><b>' + esc(s.name) + '</b></td><td>' + tags(s.wroteFor, 'nothing yet') + '</td><td>' + tags(s.writtenBy, 'no one yet') + '</td><td class="small muted">' + (when(s.lastLogin) || 'never') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    } else if (tab === 'missing') {
      html += '<div class="card">' +
        section('Never used the system (' + notUsed.length + ')', notUsed) +
        section('Logged in but has not submitted anything (' + loggedNoWrite.length + ')', loggedNoWrite) +
        section('Nobody has written about them yet (' + notAbout.length + ')', notAbout) +
        (notAbout.length && notUsed.length < notAbout.length ? '' : '') +
        '<div class="note">If some students never log in, their saved slots keep a few classmates without a message. ' +
        'Turn <b>off</b> "Save a slot for students who haven\'t written" in Settings. Students who already wrote can then log in again and pick a 2nd classmate from those who have no message yet.</div>' +
        '</div>';
    } else if (tab === 'responses') {
      html += '<p><button class="btn ghost" id="csv">⬇ Download all as CSV (Excel)</button></p>';
      var byTarget = {};
      data.responses.forEach(function (r) { (byTarget[r.target] = byTarget[r.target] || []).push(r); });
      var names = Object.keys(byTarget).sort();
      if (!names.length) html += '<p class="muted">No messages yet.</p>';
      names.forEach(function (n) {
        byTarget[n].forEach(function (r) {
          html += '<div class="resp"><h3>Para kay ' + esc(n) + '</h3><p class="small muted">From ' + esc(r.writer) + ' · ' + when(r.submittedAt) + (r.bonus ? ' · bonus' : '') + '</p><dl class="review">' +
            Object.keys(LABELS).map(function (k) { return r.answers[k] ? '<dt>' + LABELS[k] + '</dt><dd>' + esc(r.answers[k]) + '</dd>' : ''; }).join('') + '</dl></div>';
        });
      });
    } else {
      var c = data.settings;
      html += '<div class="card">' +
        setting('Website open', 'When off, students see a "Closed for now" page.', toggle('OPEN', c.OPEN)) +
        setting('Save a slot for students who haven\'t written', 'Keep ON while collecting. It makes sure no student is ever left with only their own name to pick. Turn OFF near the end so others can write for the classmates absent students would have picked.', toggle('RESERVE_FOR_OTHERS', c.RESERVE_FOR_OTHERS)) +
        setting('Max classmates each student can write for', '', select('MAX_PICKS', c.MAX_PICKS, [1, 2, 3])) +
        setting('Max messages each student can receive', 'Use 1 so each student gets one writer. If you raise it, a name stays on the list until it reaches this number.', select('MAX_PER_CLASSMATE', c.MAX_PER_CLASSMATE, [1, 2, 3])) +
        setting('Release unfinished picks after', 'If a student picks someone but never submits, the name returns to the list after this time.', select('CLAIM_MINUTES', c.CLAIM_MINUTES, [30, 60, 120, 240])) +
        '</div>';
    }
    app.innerHTML = html;

    Array.prototype.forEach.call(app.querySelectorAll('[data-tab]'), function (b) { b.onclick = function () { tab = b.getAttribute('data-tab'); draw(); }; });
    Array.prototype.forEach.call(app.querySelectorAll('[data-set]'), function (el) {
      el.onchange = function () { set(el.getAttribute('data-set'), el.type === 'checkbox' ? el.checked : Number(el.value)); };
    });
    var csv = document.getElementById('csv');
    if (csv) csv.onclick = downloadCsv;
  }

  function stat(n, l) { return '<div class="stat"><div class="n">' + n + '</div><div class="l">' + l + '</div></div>'; }
  function section(title, list) {
    return '<h3 style="margin:8px 0 6px">' + title + '</h3><p>' + (list.length ? list.map(function (s) { return '<span class="tag none">' + esc(s.name) + '</span>'; }).join('') : '<span class="muted">None 🎉</span>') + '</p>';
  }
  function setting(t, d, ctrl) { return '<div class="setting"><div><div class="t">' + t + '</div>' + (d ? '<div class="small muted">' + d + '</div>' : '') + '</div><div class="toggle">' + ctrl + '</div></div>'; }
  function toggle(k, v) { return '<input type="checkbox" style="width:24px;height:24px" data-set="' + k + '"' + (v ? ' checked' : '') + '>'; }
  function select(k, v, opts) { return '<select data-set="' + k + '">' + opts.map(function (o) { return '<option' + (Number(v) === o ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select>'; }

  function downloadCsv() {
    var head = ['Classmate', 'Written by', 'Submitted'].concat(Object.keys(LABELS).map(function (k) { return LABELS[k]; }));
    var lines = [head].concat(data.responses.map(function (r) {
      return [r.target, r.writer, when(r.submittedAt)].concat(Object.keys(LABELS).map(function (k) { return r.answers[k] || ''; }));
    })).map(function (row) { return row.map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(','); });
    var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'classmate-messages.csv'; a.click();
  }

  reload.onclick = load;
  try { pw = sessionStorage.getItem('tpw'); } catch (e) { }
  if (pw) load(); else showLogin();
})();
