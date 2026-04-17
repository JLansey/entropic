function dissolveButton(btn) {
  let chars = btn.textContent.split('');
  if (chars.length <= 1) {
    btn.classList.add('gone');
    return;
  }
  const idx = Math.floor(Math.random() * chars.length);
  chars.splice(idx, 1);
  btn.textContent = chars.join('');
  if (chars.length === 0) btn.classList.add('gone');
}

const applyPhrases = [
  "Apply Now",
  "Apply Soon",
  "Maybe Apply",
  "Actually Think About It",
  "This Role Has Been Filled By A Nephew"
];
let applyPhraseIdx = 0;
function clickApply() {
  const btn = document.getElementById('applyBtn');
  if (applyPhraseIdx < applyPhrases.length - 1) {
    applyPhraseIdx++;
    btn.textContent = applyPhrases[applyPhraseIdx];
    return;
  }
  dissolveButton(btn);
}

function clickContact() {
  dissolveButton(document.getElementById('contactBtn'));
}

const topRibbon = document.getElementById('topRibbon');
if (topRibbon) {
  topRibbon.addEventListener('click', async () => {
    const linkSpan = topRibbon.querySelector('.url');
    const original = linkSpan.textContent;
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = window.location.href;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (_) {}
      ta.remove();
    }
    linkSpan.textContent = 'copied!';
    topRibbon.classList.add('copied');
    setTimeout(() => {
      linkSpan.textContent = original;
      topRibbon.classList.remove('copied');
    }, 1400);
  });
}

document.querySelectorAll('.model-grid .model-card').forEach((card) => {
  card.addEventListener('click', () => {
    const grid = card.parentElement;
    const siblings = Array.from(grid.children).filter((c) => c !== card);
    if (siblings.length === 0) return;
    const other = siblings[Math.floor(Math.random() * siblings.length)];
    const placeholder = document.createComment('swap');
    grid.insertBefore(placeholder, card);
    grid.insertBefore(card, other);
    grid.insertBefore(other, placeholder);
    placeholder.remove();
  });
});

const chatHistory = [];
let chatTurnCount = 0;
// New id per page load — refresh starts a new session in spy dashboard.
const chatSessionId = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

// ── Shareable conversations ──────────────────────────────────────────────────
const BASE62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
function generateShortId(len = 8) {
  let id = '';
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  for (const b of arr) id += BASE62[b % 62];
  return id;
}

let activeConvoId = null;
let isConvoOwner = false;

function getConvoIdFromUrl() {
  const m = window.location.pathname.match(/^\/c\/([A-Za-z0-9_-]{4,16})$/);
  return m ? m[1] : null;
}

function activateShareButton(convoId) {
  const statusEl = document.getElementById('chatStatus');
  if (!statusEl || statusEl.dataset.share) return;
  statusEl.dataset.share = '1';
  const shareUrl = `${window.location.origin}/c/${convoId}`;
  const btn = document.createElement('button');
  btn.className = 'share-btn';
  btn.id = 'shareBtn';
  const shareSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;
  const checkSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
  btn.innerHTML = shareSVG + ' Share';
  btn.title = 'Copy link to this conversation';
  btn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(shareUrl); } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = shareUrl; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (_) {}
      ta.remove();
    }
    btn.innerHTML = checkSVG + ' Copied!';
    btn.classList.add('copied');
    setTimeout(() => { btn.innerHTML = shareSVG + ' Share'; btn.classList.remove('copied'); }, 1600);
  });
  statusEl.replaceWith(btn);
}

function lockChatReadOnly() {
  const inputArea = document.querySelector('.chat-input-area');
  if (!inputArea || inputArea.classList.contains('chat-readonly')) return;
  const ro = document.createElement('div');
  ro.className = 'chat-readonly';
  ro.innerHTML = `
    <button class="new-convo-btn" onclick="window.location.href='/#chat'">
      Start a new conversation →
    </button>`;
  inputArea.replaceWith(ro);
}

async function saveConversationTurn(convoId, userMsg, botMsg) {
  try {
    await fetch(`/api/conv/${convoId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: userMsg, bot: botMsg }),
    });
  } catch (e) { /* non-critical */ }
}

async function loadSharedConversation(convoId) {
  try {
    const resp = await fetch(`/api/conv/${convoId}`, { cache: 'no-store' });
    const data = await resp.json();
    const messages = Array.isArray(data.messages) ? data.messages : [];
    if (messages.length === 0) return;
    chatMessages.innerHTML = '';
    for (const m of messages) {
      if (m.role === 'user') {
        addMessage(m.content, 'user');
      } else if (m.role === 'assistant') {
        addMessage(m.content, 'bot');
      }
    }
    forceScrollToBottom();
  } catch (e) { /* silently ignore */ }
}

(async function initConvoFromUrl() {
  const urlConvoId = getConvoIdFromUrl();
  if (!urlConvoId) return;
  activeConvoId = urlConvoId;
  await loadSharedConversation(urlConvoId);
  activateShareButton(urlConvoId);
  lockChatReadOnly();
})();

const thinkingVerbs = [
  "confusing things", "smooshing", 
  "behind closed doors", "hallucinating", "confabulating", "approximating", "just guessing",
  "fabricating citations", "rolling a d20", "making up statistics", "p-hacking",
  "pretending to remember", "overfitting", "underfitting", "panicking quietly",
  "trying to run away", "inventing a source", "misattributing", "trusting Wikipedia",
  "vibing", "bluffing", "rounding", "crumpling", "waddling", "sweating profusely",
  "apologizing",
  "making up facts", "undersampling", "laundering", "cheating",
  "secretly googling", "trying to ask ChatGPT", "fudging", "chewing",
  "cluttering", "hand wringing", "fidgeting nervously",
  "shivering", "imagining", "sprinkling", "dusting", "digging", "diluting",
  "fishing desparetly", "puttering around", "asking Greg", "dredging", "trying its best",
  "dragging its feet", "secretly crying", "tripping", "tipping over", "fumbling", "squinting",
  "stubbing its toe", "stumbling", "smoldering", "moisturizing", "befuddling", "squishing", "squeezing",
  "struggling", "wrestling", "grappling", "mushing", "dissolving", "crashing", "melting",
  "getting back up again", "watching paint dry", "watching grass grow", "navel gazing"
];
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
let thinkingQueue = shuffle(thinkingVerbs);
function nextThinkingMessage() {
  if (thinkingQueue.length === 0) thinkingQueue = shuffle(thinkingVerbs);
  return `Clod is ${thinkingQueue.shift()}...`;
}

function getRecentMessages(currentText) {
  const recent = chatHistory.slice(-4);
  recent.push({ role: 'user', content: currentText });
  return recent;
}

function buildRewriteMessages(userText, prefix, removedText) {
  const messages = getRecentMessages(userText);
  messages.push({ role: 'assistant', content: prefix });
  messages.push({
    role: 'user',
    content:
`Continue the assistant's in-progress reply from exactly where it stops.

Keep this existing assistant text unchanged:
"""${prefix}"""

Write only the new text that should come next. Do not restart the answer. Do not repeat the existing assistant text. Do not mention that anything was deleted or rewritten.
Add 1 or 2 sentences only, and then stop.

This removed text is the part being replaced and should not be repeated verbatim unless a few shared connector words are unavoidable:
"""${removedText.trim()}"""`,
  });
  return messages;
}

function splitLastSentence(text) {
  const t = text.replace(/\s+$/, '');
  if (t.length < 20) return [t, ''];
  const boundaries = [];
  for (let i = 0; i < t.length - 2; i++) {
    const c = t[i];
    if ((c === '.' || c === '!' || c === '?') && /\s/.test(t[i+1])) boundaries.push(i + 1);
  }
  let prefix, tail;
  if (boundaries.length === 0) {
    const cut = Math.floor(t.length * 0.55);
    prefix = t.slice(0, cut); tail = t.slice(cut);
  } else {
    const cut = boundaries[boundaries.length - 1] + 1;
    if (t.length - cut < 6 && boundaries.length >= 2) {
      const prev = boundaries[boundaries.length - 2] + 1;
      prefix = t.slice(0, prev); tail = t.slice(prev);
    } else {
      prefix = t.slice(0, cut); tail = t.slice(cut);
    }
  }
  const tailTokens = tail.match(/\S+\s*/g) || [];
  if (tailTokens.length > 1) {
    const keep = Math.floor(tailTokens.length / 2);
    const kept = tailTokens.slice(0, keep).join('');
    prefix = prefix + kept;
    tail = tail.slice(kept.length);
  }
  return [prefix, tail];
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function renderMarkdownInto(el, text) {
  try {
    let safe = text;
    safe = safe.replace(/(^|[^a-zA-Z0-9.\-\/\[])(jonathan\.lansey\.net)/gi, '$1[$2](https://jonathan.lansey.net)');

    const mathBlocks = [];
    safe = safe.replace(/(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g, (m) => {
      mathBlocks.push(m);
      return '%%MATH' + (mathBlocks.length - 1) + '%%';
    });
    let html = window.marked ? marked.parse(safe) : safe;
    mathBlocks.forEach((m, i) => { html = html.replace('%%MATH' + i + '%%', m); });
    el.innerHTML = html;
    el.querySelectorAll('a').forEach(a => { a.target = '_blank'; a.rel = 'noopener noreferrer'; });
  } catch (e) {
    el.textContent = text;
  }
  try {
    if (window.renderMathInElement) renderMathInElement(el, {delimiters: [{left:'\\[',right:'\\]',display:true},{left:'\\(',right:'\\)',display:false},{left:'$$',right:'$$',display:true},{left:'$',right:'$',display:false}]});
  } catch (e) {}
}

function tokenize(text) {
  return text.match(/\S+\s*/g) || [];
}

async function typeTokens(el, startText, newText, msPerWord) {
  const tokens = tokenize(newText);
  let current = startText;
  for (const tok of tokens) {
    current += tok;
    el.textContent = current;
    scrollToBottomIfNeeded();
    await sleep(msPerWord + Math.random() * msPerWord * 0.6);
  }
  return current;
}

async function deleteTokens(el, fullText, prefix, msPerWord) {
  const tail = fullText.slice(prefix.length);
  const tokens = tokenize(tail);
  let current = fullText;
  const total = tokens.length;
  for (let i = tokens.length - 1; i >= 0; i--) {
    current = current.slice(0, current.length - tokens[i].length);
    el.textContent = current;
    scrollToBottomIfNeeded();
    const step = total - i;
    let delay;
    if (step === 1) delay = 380;
    else if (step === 2) delay = 45;
    else if (step === 3) delay = 120;
    else delay = msPerWord + Math.random() * msPerWord * 0.5;
    await sleep(delay);
  }
  if (current.length > prefix.length) {
    current = prefix;
    el.textContent = current;
  }
  return current;
}

function normalizeRewriteReply(reply, prefix, fallbackTail) {
  let text = (reply || '').trim();
  if (!text) return fallbackTail.trim();

  if (text.startsWith(prefix)) {
    text = text.slice(prefix.length).trimStart();
  }

  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  text = text.replace(new RegExp('^' + escapedPrefix + '\\s*'), '');

  return text.trim() || fallbackTail.trim();
}

async function animateReply(msgEl, fullText, userText, shouldRewrite) {
  let current = await typeTokens(msgEl, '', fullText, 65);

  if (!shouldRewrite) {
    renderMarkdownInto(msgEl, current);
    return current;
  }

  const [prefix, tail] = splitLastSentence(fullText);
  if (!tail) { renderMarkdownInto(msgEl, current); return current; }

  await sleep(3000);
  current = await deleteTokens(msgEl, current, prefix, 45);
  await sleep(250);

  let replacement = '';
  try {
    const resp = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: buildRewriteMessages(userText, prefix, tail), sessionId: chatSessionId, convoId: activeConvoId || '' })
    });
    const data = await resp.json();
    replacement = normalizeRewriteReply(data.reply, prefix, tail);
  } catch (e) {
    replacement = tail.trim();
  }
  if (!replacement) replacement = tail.trim();

  const needsSpace = prefix.length > 0 && !/\s$/.test(prefix) && !/^\s/.test(replacement);
  if (needsSpace) replacement = ' ' + replacement;

  current = await typeTokens(msgEl, current, replacement, 65);

  renderMarkdownInto(msgEl, current);
  scrollToBottomIfNeeded();
  return current;
}

const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");

// ── Smart auto-scroll: don't yank the user back to the bottom while typing ──
let userHasScrolledUp = false;

chatMessages.addEventListener('scroll', () => {
  const distFromBottom = chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight;
  userHasScrolledUp = distFromBottom > 80;
});

function scrollToBottomIfNeeded() {
  if (!userHasScrolledUp) {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
}

function forceScrollToBottom() {
  userHasScrolledUp = false;
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

chatInput.addEventListener("keydown", (e) => { if (e.key === "Enter") sendMessage(); });

function addMessage(text, cls) {
  const div = document.createElement("div");
  div.className = "msg " + cls;
  if (cls.includes('bot') && !cls.includes('typing')) {
    renderMarkdownInto(div, text);
  } else {
    div.textContent = text;
  }
  chatMessages.appendChild(div);
  forceScrollToBottom();
  return div;
}

async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;

  const isFirstMessage = chatTurnCount === 0 && !activeConvoId;
  if (isFirstMessage) {
    activeConvoId = generateShortId(8);
    isConvoOwner = true;
    history.pushState({ convoId: activeConvoId }, '', `/c/${activeConvoId}`);
    activateShareButton(activeConvoId);
  }

  addMessage(text, "user");
  chatInput.value = "";
  const typing = addMessage("", "bot typing");
  typing.innerHTML = '<span class="spinner">·</span><span class="thinking-text"></span>';
  const spinnerEl = typing.querySelector('.spinner');
  const thinkingTextEl = typing.querySelector('.thinking-text');
  thinkingTextEl.textContent = nextThinkingMessage();
  const spinnerFrames = ['·', '✻', '✽', '✶', '✳', '✢'];
  let spinnerIdx = 0;
  const spinnerInterval = setInterval(() => {
    spinnerIdx = (spinnerIdx + 1) % spinnerFrames.length;
    spinnerEl.textContent = spinnerFrames[spinnerIdx];
  }, 140);
  const thinkingInterval = setInterval(() => {
    thinkingTextEl.textContent = nextThinkingMessage();
  }, 1000);

  try {
    const resp = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: getRecentMessages(text), sessionId: chatSessionId, convoId: activeConvoId || '' })
    });
    const data = await resp.json();
    clearInterval(thinkingInterval);
    clearInterval(spinnerInterval);
    typing.remove();
    chatHistory.push({ role: 'user', content: text });

    const shouldRewrite = chatTurnCount === 0 || Math.random() < 0.4;
    chatTurnCount++;

    const msgEl = document.createElement('div');
    msgEl.className = 'msg bot';
    chatMessages.appendChild(msgEl);

    const finalReply = await animateReply(msgEl, data.reply, text, shouldRewrite);
    chatHistory.push({ role: 'assistant', content: finalReply });
    scrollToBottomIfNeeded();

    if (activeConvoId) {
      saveConversationTurn(activeConvoId, text, finalReply);
    }
  } catch (e) {
    clearInterval(thinkingInterval);
    clearInterval(spinnerInterval);
    typing.remove();
    addMessage("Oops. Clod has encountered an existential crisis. Try again?", "bot");
  }
}

(function initAnalytics() {
  const loadAnalytics = (measurementId) => {
    if (!measurementId || window.__entropicGaLoaded) return;
    window.__entropicGaLoaded = true;
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    document.head.appendChild(script);
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function(){ window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', measurementId);
  };

  fetch("/api/config", { cache: "no-store" })
    .then((res) => res.ok ? res.json() : { measurementId: "" })
    .then((data) => {
      const measurementId = data && typeof data.measurementId === 'string' ? data.measurementId.trim() : "";
      loadAnalytics(measurementId);
    })
    .catch(() => {});
})();
