(function () {
  var app = document.getElementById('app');
  var whoEl = document.getElementById('who');
  var S = { names: [], token: null, me: null, state: null, target: null, q: 0, answers: {}, selected: [] };

  var QUESTIONS = [
    {
      key: 'traits', required: true,
      title: function (n) { return 'Ano ang mga positive traits ni ' + n + '?'; },
      help: 'What makes them a good person or a good classmate?',
      examples: ['Masipag at laging handang tumulong sa groupmates.', 'Laging nakangiti kahit stressed sa exams.', 'Magaling mag-drawing at mag-lead ng group.']
    },
    {
      key: 'memorable', required: true,
      title: function (n) { return 'Share a memorable moment with ' + n + '.'; },
      help: 'A moment you will never forget together, inside or outside the classroom.',
      examples: ['Noong intramurals, siya ang sumigaw ng pinakamalakas para sa section namin.', 'Hinati niya ang baon niya sa akin noong naiwan ko ang wallet ko.']
    },
    {
      key: 'funny', required: true,
      title: function (n) { return 'Ano ang pinaka-funny na moment ninyo ni ' + n + '?'; },
      help: 'Something that still makes you laugh. Keep it kind, walang mapapahiya!',
      examples: ['Nagising siya sa klase at biglang sumagot ng "Present po!" kahit walang roll call. 😂', 'Nadulas siya sa sayaw practice tapos ginawa niyang part ng steps.']
    },
    {
      key: 'habit', required: false,
      title: function (n) { return 'Ano ang madalas sabihin o gawin ni ' + n + '?'; },
      help: 'Their catchphrase, favorite line, or signature habit.',
      examples: ['"Ay, wait lang!"', 'Laging may dalang snacks para sa buong row.', 'Laging kumakanta habang nagsusulat.']
    },
    {
      key: 'tagline', required: true,
      title: function (n) { return 'Give ' + n + ' a positive tagline or alias!'; },
      help: 'A fun, positive title that fits them. Make it creative!',
      examples: ['Ang Mr. Pogi ng Tibiao', 'Ang Reyna ng Recitation', 'Human Calculator ng Section', 'Ang Ngiti ng Klase']
    },
    {
      key: 'message', required: false,
      title: function (n) { return 'Write a short message for ' + n + '.'; },
      help: 'Something positive you want to tell them.',
      examples: ['Salamat sa pagiging totoong kaibigan. Keep shining, tuloy lang ang pangarap!']
    }
  ];

  // ---------- helpers ----------
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function titleCase(s) { return s.toLowerCase().replace(/(^|[\s\-'.])(\S)/g, function (m, a, b) { return a + b.toUpperCase(); }); }
  function parts(raw) {
    var i = raw.indexOf(',');
    if (i < 0) return { first: titleCase(raw.trim()), full: titleCase(raw.trim()) };
    var last = titleCase(raw.slice(0, i).trim()), first = titleCase(raw.slice(i + 1).trim());
    return { first: first, full: first + ' ' + last };
  }
  function full(raw) { return parts(raw).full; }
  function first(raw) { return parts(raw).first; }
  function initials(raw) { var p = parts(raw); return (p.first[0] + (p.full.split(' ').pop()[0] || '')).toUpperCase(); }

  function api(body) {
    if (!window.API_URL) return Promise.reject(new Error('The website is not connected yet. Please tell your teacher.'));
    return fetch(window.API_URL, { method: 'POST', body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res.error === 'SESSION_EXPIRED') { logout(); throw new Error('Your session ended. Please log in again.'); }
        return res;
      });
  }
  function busy() { app.innerHTML = '<div class="spinner"></div>'; }
  function draftKey() { return 'draft:' + S.me + ':' + S.target; }
  function saveDraft() { try { localStorage.setItem(draftKey(), JSON.stringify(S.answers)); } catch (e) { } }
  function loadDraft() { try { return JSON.parse(localStorage.getItem(draftKey()) || '{}'); } catch (e) { return {}; } }
  function clearDraft() { try { localStorage.removeItem(draftKey()); } catch (e) { } }
  function saveSession() { try { sessionStorage.setItem('sess', JSON.stringify({ token: S.token, me: S.me })); } catch (e) { } }
  function logout() {
    S.token = null; S.me = null; S.state = null; whoEl.innerHTML = '';
    try { sessionStorage.removeItem('sess'); } catch (e) { }
  }
  function setWho() {
    whoEl.innerHTML = S.me ? esc(first(S.me)) + '<br><button class="btn link small" id="out">Not you? Log out</button>' : '';
    var o = document.getElementById('out');
    if (o) o.onclick = function () { logout(); showWelcome(); };
  }

  // ---------- screens ----------
  function showWelcome() {
    app.innerHTML =
      '<div class="card">' +
      '<div class="big-emoji">💌</div>' +
      '<h2 class="center">Kilalanin natin ang isa\'t isa!</h2>' +
      '<p class="center muted">Share good vibes about your classmates: their best traits, your funniest and most memorable moments, and a cool tagline for them.</p>' +
      '<p class="center muted small">Takes about 10 minutes. Your answers are only seen by your adviser.</p>' +
      '<div class="row"><button class="btn" id="go">Let\'s start →</button></div></div>';
    document.getElementById('go').onclick = showWho;
  }

  function showWho() {
    busy();
    api({ action: 'names' }).then(function (res) {
      if (!res.open) return showClosed();
      S.names = res.names;
      app.innerHTML =
        '<div class="card"><div class="step">Step 1</div><h2>Sino ka? (Who are you?)</h2>' +
        '<p class="muted">Find and tap your name.</p>' +
        '<input type="search" id="q" placeholder="Type your name, e.g. Juan" autocomplete="off">' +
        '<div class="list" id="list"></div></div>';
      var q = document.getElementById('q'), list = document.getElementById('list');
      function draw() {
        var term = q.value.trim().toLowerCase();
        list.innerHTML = '';
        S.names.filter(function (n) { return !term || full(n).toLowerCase().indexOf(term) >= 0 || n.toLowerCase().indexOf(term) >= 0; })
          .forEach(function (n) {
            var b = document.createElement('button');
            b.className = 'pick';
            b.innerHTML = '<span class="av">' + esc(initials(n)) + '</span><span>' + esc(full(n)) + '</span>';
            b.onclick = function () { showVerify(n); };
            list.appendChild(b);
          });
        if (!list.children.length) list.innerHTML = '<p class="muted">No name found.</p>';
      }
      q.oninput = draw; draw();
    }).catch(showError);
  }

  function showVerify(name) {
    app.innerHTML =
      '<div class="card"><div class="step">Step 2</div><h2>Hi, ' + esc(first(name)) + '! 👋</h2>' +
      '<p class="muted">Enter your ID number to confirm it\'s really you.</p>' +
      '<input type="text" id="id" placeholder="e.g. 2024-0123-T" autocomplete="off" autocapitalize="characters">' +
      '<div class="err" id="err"></div>' +
      '<div class="row"><button class="btn ghost" id="back">← Back</button><button class="btn" id="ok">Confirm</button></div></div>';
    var id = document.getElementById('id'), err = document.getElementById('err'), ok = document.getElementById('ok');
    id.focus();
    document.getElementById('back').onclick = showWho;
    function go() {
      if (!id.value.trim()) { err.textContent = 'Please enter your ID number.'; return; }
      ok.disabled = true; err.textContent = '';
      api({ action: 'login', name: name, id: id.value }).then(function (res) {
        ok.disabled = false;
        if (!res.ok) { err.textContent = res.error; return; }
        S.token = res.token; S.me = name; saveSession(); setWho();
        route(res);
      }).catch(function (e) { ok.disabled = false; err.textContent = e.message; });
    }
    ok.onclick = go;
    id.onkeydown = function (e) { if (e.key === 'Enter') go(); };
  }

  function route(state) {
    S.state = state;
    if (!state.open) return showClosed();
    var writing = state.mine.filter(function (m) { return m.status === 'writing'; });
    if (writing.length) return startQuestions(writing[0].target);
    if (state.options.length && state.maxNow > 0) return showPick();
    return showDone();
  }

  function refresh() {
    busy();
    api({ action: 'state', token: S.token }).then(function (res) {
      if (!res.ok) throw new Error(res.error);
      route(res);
    }).catch(showError);
  }

  function showPick(msg) {
    var st = S.state, max = st.maxNow, done = st.mine.filter(function (m) { return m.status === 'submitted'; });
    S.selected = [];
    var intro = done.length
      ? 'Salamat! You can write for ' + (max === 1 ? 'one more classmate' : 'more classmates') + ' if you want.'
      : 'Pumili ng classmate na sa tingin mo ay kilala mo nang husto. (Choose the classmate you think you know best.)';
    app.innerHTML =
      '<div class="card"><div class="step">Step 3</div><h2>Choose your classmate' + (max > 1 ? 's' : '') + '</h2>' +
      '<p class="muted">' + intro + '</p>' +
      '<p><span class="chip">You can choose ' + (max === 1 ? '1 classmate' : 'up to ' + max + ' classmates') + '</span></p>' +
      (st.bonus ? '<div class="note">Everyone already has someone writing for them, so you can choose any classmate as a bonus. 🎉</div>' : '') +
      '<div class="err" id="err">' + (msg ? esc(msg) : '') + '</div>' +
      '<input type="search" id="q" placeholder="Search a name" autocomplete="off">' +
      '<div class="list" id="list"></div>' +
      '<p class="small muted" style="margin-top:12px">Names already chosen by someone else are not shown.</p>' +
      '<div class="row">' + (done.length ? '<button class="btn ghost" id="skip">I\'m done</button>' : '') +
      '<button class="btn" id="next" disabled>Next →</button></div></div>';
    var list = document.getElementById('list'), next = document.getElementById('next'), q = document.getElementById('q');
    function draw() {
      var term = q.value.trim().toLowerCase();
      list.innerHTML = '';
      st.options.filter(function (n) { return !term || full(n).toLowerCase().indexOf(term) >= 0; }).forEach(function (n) {
        var on = S.selected.indexOf(n) >= 0;
        var b = document.createElement('button');
        b.className = 'pick' + (on ? ' on' : '');
        b.disabled = !on && S.selected.length >= max && max > 1;
        b.innerHTML = '<span class="av">' + (on ? '✓' : esc(initials(n))) + '</span><span>' + esc(full(n)) + '</span>';
        b.onclick = function () {
          if (on) S.selected.splice(S.selected.indexOf(n), 1);
          else if (max === 1) S.selected = [n];
          else if (S.selected.length < max) S.selected.push(n);
          draw();
        };
        list.appendChild(b);
      });
      next.disabled = S.selected.length === 0;
      next.textContent = S.selected.length > 1 ? 'Next (' + S.selected.length + ' chosen) →' : 'Next →';
    }
    q.oninput = draw; draw();
    var skip = document.getElementById('skip');
    if (skip) skip.onclick = showDone;
    next.onclick = function () {
      next.disabled = true;
      api({ action: 'claim', token: S.token, targets: S.selected }).then(function (res) {
        if (!res.ok) { if (res.state) S.state = res.state; return showPick(res.error); }
        route(res);
      }).catch(showError);
    };
  }

  function startQuestions(target) {
    S.target = target; S.q = 0; S.answers = loadDraft();
    showQuestion();
  }

  function showQuestion() {
    var total = QUESTIONS.length + 1;
    var Q = QUESTIONS[S.q], name = first(S.target);
    var pending = S.state.mine.filter(function (m) { return m.status === 'writing'; }).length;
    app.innerHTML =
      '<div class="card">' +
      '<div class="progress"><div style="width:' + Math.round((S.q / total) * 100) + '%"></div></div>' +
      '<div class="step">Para kay ' + esc(full(S.target)) + ' · Question ' + (S.q + 1) + ' of ' + QUESTIONS.length + '</div>' +
      '<h2>' + esc(Q.title(name)) + ' ' + (Q.required ? '' : '<span class="opt">(optional)</span>') + '</h2>' +
      '<p class="muted">' + esc(Q.help) + '</p>' +
      '<textarea id="a" maxlength="3000" placeholder="Halimbawa: ' + esc(Q.examples[0]) + '"></textarea>' +
      '<div class="example"><b>Examples</b><ul>' + Q.examples.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul></div>' +
      '<div class="err" id="err"></div>' +
      '<div class="row"><button class="btn ghost" id="back">← Back</button><button class="btn" id="next">Next →</button></div>' +
      (S.q === 0 ? '<p class="center"><button class="btn link small" id="change">Choose a different classmate</button></p>' : '') +
      (S.q === 0 && pending > 1 ? '<p class="center small muted">You have ' + pending + ' classmates to write for. We\'ll do them one at a time.</p>' : '') +
      '</div>';
    var a = document.getElementById('a');
    a.value = S.answers[Q.key] || '';
    a.focus();
    a.oninput = function () { S.answers[Q.key] = a.value; saveDraft(); };
    var back = document.getElementById('back');
    back.disabled = S.q === 0;
    back.onclick = function () { S.q--; showQuestion(); };
    document.getElementById('next').onclick = function () {
      if (Q.required && !a.value.trim()) { document.getElementById('err').textContent = 'Please write something. You can look at the examples for ideas. 😊'; return; }
      if (S.q < QUESTIONS.length - 1) { S.q++; showQuestion(); } else showReview();
    };
    var ch = document.getElementById('change');
    if (ch) ch.onclick = function () {
      if (!confirm('Choose a different classmate? What you typed for ' + name + ' will be removed.')) return;
      clearDraft(); busy();
      api({ action: 'release', token: S.token, target: S.target }).then(function (res) {
        if (!res.ok) throw new Error(res.error);
        S.state = res;
        if (res.options.length && res.maxNow > 0) showPick(); else route(res);
      }).catch(showError);
    };
  }

  function showReview() {
    app.innerHTML =
      '<div class="card"><div class="progress"><div style="width:95%"></div></div>' +
      '<div class="step">Almost done!</div><h2>Check your answers for ' + esc(first(S.target)) + '</h2>' +
      '<dl class="review">' + QUESTIONS.map(function (Q, i) {
        var v = (S.answers[Q.key] || '').trim();
        return '<dt>' + esc(Q.title(first(S.target))) + ' <button class="btn link small" data-i="' + i + '">Edit</button></dt><dd>' + (v ? esc(v) : '<span class="muted">(skipped)</span>') + '</dd>';
      }).join('') + '</dl>' +
      '<div class="err" id="err"></div>' +
      '<div class="row"><button class="btn ghost" id="back">← Back</button><button class="btn" id="send">Submit ✓</button></div></div>';
    Array.prototype.forEach.call(app.querySelectorAll('[data-i]'), function (b) {
      b.onclick = function () { S.q = Number(b.getAttribute('data-i')); showQuestion(); };
    });
    document.getElementById('back').onclick = function () { S.q = QUESTIONS.length - 1; showQuestion(); };
    var send = document.getElementById('send');
    send.onclick = function () {
      send.disabled = true; send.textContent = 'Sending…';
      api({ action: 'submit', token: S.token, target: S.target, answers: S.answers }).then(function (res) {
        if (!res.ok) { send.disabled = false; send.textContent = 'Submit ✓'; document.getElementById('err').textContent = res.error; return; }
        clearDraft();
        var name = first(S.target);
        S.state = res;
        showSent(name);
      }).catch(function (e) { send.disabled = false; send.textContent = 'Submit ✓'; document.getElementById('err').textContent = e.message + ' Your answers are saved on this device. Try again.'; });
    };
  }

  function showSent(name) {
    var more = S.state.mine.some(function (m) { return m.status === 'writing'; }) || (S.state.options.length && S.state.maxNow > 0);
    app.innerHTML =
      '<div class="card center"><div class="big-emoji">🎉</div><h2>Sent! Salamat!</h2>' +
      '<p class="muted">Your message for ' + esc(name) + ' was saved.</p>' +
      '<div class="row"><button class="btn" id="go">' + (more ? 'Continue →' : 'Finish') + '</button></div></div>';
    document.getElementById('go').onclick = function () { route(S.state); };
  }

  function showDone() {
    var done = S.state ? S.state.mine.filter(function (m) { return m.status === 'submitted'; }) : [];
    app.innerHTML =
      '<div class="card center"><div class="big-emoji">💖</div><h2>Maraming salamat, ' + esc(first(S.me)) + '!</h2>' +
      (done.length ? '<p class="muted">You wrote for: <b>' + done.map(function (m) { return esc(full(m.target)); }).join('</b> and <b>') + '</b>.</p>' :
        '<p class="muted">There are no classmates available for you right now. Please check again later.</p>') +
      '<p class="muted small">You can close this page now. Keep it a secret what you wrote. 🤫</p>' +
      '<div class="row"><button class="btn ghost" id="out2">Log out</button></div></div>';
    document.getElementById('out2').onclick = function () { logout(); showWelcome(); };
  }

  function showClosed() {
    app.innerHTML = '<div class="card center"><div class="big-emoji">⏸️</div><h2>Closed for now</h2><p class="muted">The website is not accepting answers right now. Please wait for your adviser\'s announcement.</p></div>';
  }

  function showError(e) {
    app.innerHTML = '<div class="card center"><div class="big-emoji">😕</div><h2>Something went wrong</h2><p class="muted">' + esc(e && e.message || e) + '</p>' +
      '<div class="row"><button class="btn" id="retry">Try again</button></div></div>';
    document.getElementById('retry').onclick = function () { S.token ? refresh() : showWelcome(); };
  }

  // ---------- start ----------
  try {
    var saved = JSON.parse(sessionStorage.getItem('sess') || 'null');
    if (saved && saved.token) { S.token = saved.token; S.me = saved.me; setWho(); refresh(); }
    else showWelcome();
  } catch (e) { showWelcome(); }
})();
