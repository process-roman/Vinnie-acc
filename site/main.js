// The landing page: starts the demo on a tap, so the page itself loads fast, and runs the
// like button.

const screen = document.getElementById('screen');
const poster = document.getElementById('try');
const loading = document.getElementById('loading');
const restart = document.getElementById('restart');

/** If the app never says it's ready, stop covering it after this long. */
const READY_TIMEOUT_MS = 20000;
let frame = null;
let readyTimer = null;

function hideLoading() {
  clearTimeout(readyTimer);
  loading.hidden = true;
}

function startDemo() {
  frame?.remove();
  poster.hidden = true;
  poster.style.display = 'none';
  loading.hidden = false;
  frame = document.createElement('iframe');
  frame.src = '/app/';
  frame.title = 'Vinnie demo';
  frame.allow = 'autoplay';
  screen.prepend(frame);
  restart.hidden = false;
  clearTimeout(readyTimer);
  readyTimer = setTimeout(hideLoading, READY_TIMEOUT_MS);
}

window.addEventListener('message', (e) => {
  if (e.origin === window.location.origin && e.data === 'vinnie-ready') hideLoading();
});
poster.addEventListener('click', startDemo);
restart.addEventListener('click', startDemo);

// --- The like button -----------------------------------------------------------------

const LIKED_KEY = 'vinnie-liked';
const button = document.getElementById('like');
const label = document.getElementById('like-label');
const countLine = document.getElementById('like-count');

function alreadyLiked() {
  try {
    return localStorage.getItem(LIKED_KEY) === '1';
  } catch {
    return false;
  }
}

function rememberLike() {
  try {
    localStorage.setItem(LIKED_KEY, '1');
  } catch {
    // Private mode: they could like again after a reload. Not worth more than this.
  }
}

function showLiked() {
  button.setAttribute('aria-pressed', 'true');
  label.textContent = "You're on the list";
}

function showCount(count) {
  if (typeof count !== 'number') return;
  if (count === 0) {
    countLine.textContent = 'Nobody yet. Be the first. He remembers that kind of thing.';
    return;
  }
  const people = count === 1 ? 'person wants' : 'people want';
  countLine.innerHTML = `<strong>${count.toLocaleString('en-US')}</strong> ${people} Vinnie. Capiche?`;
}

async function callLikes(method) {
  const res = await fetch('/api/likes', { method });
  if (!res.ok) throw new Error(`Likes: ${res.status}`);
  const { count } = await res.json();
  return count;
}

button.addEventListener('click', async () => {
  if (alreadyLiked()) return;
  rememberLike();
  showLiked();
  try {
    showCount(await callLikes('POST'));
  } catch {
    // The count's a nicety: the button still works if it can't be reached.
  }
});

if (alreadyLiked()) showLiked();
callLikes('GET').then(showCount, () => {});
