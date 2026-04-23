const MAX_ATTEMPTS = 6;
const STORAGE_KEY = "NederWordle-state-v1";
const STATS_KEY = "NederWordle-stats-v1";

const state = {
  words: [],
  mode: "daily",
  current: null,
  guesses: [],
  evaluations: [],
  gameOver: false,
  won: false,
  dailyKey: null,
};

const els = {
  board: document.getElementById("board"),
  guessForm: document.getElementById("guessForm"),
  guessInput: document.getElementById("guessInput"),
  message: document.getElementById("message"),
  definitionNl: document.getElementById("definitionNl"),
  exampleNl: document.getElementById("exampleNl"),
  resultPanel: document.getElementById("resultPanel"),
  lengthPill: document.getElementById("lengthPill"),
  attemptsPill: document.getElementById("attemptsPill"),
  shareBtn: document.getElementById("shareBtn"),
  dailyModeBtn: document.getElementById("dailyModeBtn"),
  unlimitedModeBtn: document.getElementById("unlimitedModeBtn"),
  newUnlimitedBtn: document.getElementById("newUnlimitedBtn"),
  modeTitle: document.getElementById("modeTitle"),
  statPlayed: document.getElementById("statPlayed"),
  statWon: document.getElementById("statWon"),
  statStreak: document.getElementById("statStreak"),
};

function normalizeDutch(text) {
  return (text || "")
    .toLowerCase()
    .normalize("NFC")
    .replace(/[^a-zà-ÿ]/gi, "");
}

function getTodayKey() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function hashString(str) {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return Math.abs(hash >>> 0);
}

function getDailyWord(words, dateKey) {
  const idx = hashString(`NederWordle-${dateKey}`) % words.length;
  return words[idx];
}

function pickUnlimitedWord(words, previousWord = null) {
  if (words.length <= 1) return words[0];
  let picked = words[Math.floor(Math.random() * words.length)];
  while (previousWord && picked.word === previousWord.word) {
    picked = words[Math.floor(Math.random() * words.length)];
  }
  return picked;
}

function getStats() {
  const defaults = { played: 0, won: 0, streak: 0, lastWinDate: null };
  try {
    return { ...defaults, ...(JSON.parse(localStorage.getItem(STATS_KEY)) || {}) };
  } catch {
    return defaults;
  }
}

function setStats(stats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

function renderStats() {
  const stats = getStats();
  els.statPlayed.textContent = stats.played;
  els.statWon.textContent = stats.won;
  els.statStreak.textContent = stats.streak;
}

function saveState() {
  const payload = {
    mode: state.mode,
    currentWord: state.current?.word || null,
    guesses: state.guesses,
    evaluations: state.evaluations,
    gameOver: state.gameOver,
    won: state.won,
    dailyKey: state.dailyKey,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null;
  } catch {
    return null;
  }
}

function buildBoard() {
  const length = state.current.word.length;
  els.board.innerHTML = "";
  for (let rowIndex = 0; rowIndex < MAX_ATTEMPTS; rowIndex++) {
    const row = document.createElement("div");
    row.className = "row";
    row.style.gridTemplateColumns = `repeat(${length}, minmax(0, 1fr))`;

    const guess = state.guesses[rowIndex] || "";
    const evaluation = state.evaluations[rowIndex] || [];

    for (let col = 0; col < length; col++) {
      const tile = document.createElement("div");
      tile.className = "tile";
      tile.textContent = guess[col] ? guess[col].toUpperCase() : "";
      if (evaluation[col]) {
        tile.classList.add(evaluation[col]);
      }
      row.appendChild(tile);
    }
    els.board.appendChild(row);
  }
}

function renderClue() {
  els.definitionNl.textContent = state.current.definition_nl;
  els.exampleNl.textContent = `Voorbeeldzin: ${state.current.example_nl}`;
  els.lengthPill.textContent = `${state.current.word.length} letters`;
}

function getRevealedExampleSentence() {
  return (state.current.example_nl || "").replaceAll("BLANK", state.current.word);
}

function renderResultPanel() {
  if (state.won) {
    els.resultPanel.classList.remove("empty");
    els.resultPanel.innerHTML = `
      <p class="result-word">${escapeHtml(state.current.word)}</p>
      <p class="translation">Engels: ${escapeHtml(state.current.definition_en)}</p>
      <p><strong>Nederlandse definitie:</strong> ${escapeHtml(state.current.definition_nl)}</p>
      <p><strong>Voorbeeldzin:</strong> ${escapeHtml(getRevealedExampleSentence())}</p>
    `;
    return;
  }

  if (state.gameOver && !state.won) {
    els.resultPanel.classList.remove("empty");
    els.resultPanel.innerHTML = `
      <p class="result-word">${escapeHtml(state.current.word)}</p>
      <p class="translation">Engels: ${escapeHtml(state.current.definition_en)}</p>
      <p>Niet geraden deze ronde, maar je kunt het woord nu alsnog bestuderen.</p>
      <p><strong>Nederlandse definitie:</strong> ${escapeHtml(state.current.definition_nl)}</p>
      <p><strong>Voorbeeldzin:</strong> ${escapeHtml(getRevealedExampleSentence())}</p>
    `;
    return;
  }

  els.resultPanel.classList.add("empty");
  els.resultPanel.innerHTML = "<p>Raad het woord om de Engelse vertaling en extra uitleg te zien.</p>";
}

function renderMode() {
  const daily = state.mode === "daily";
  els.dailyModeBtn.classList.toggle("active", daily);
  els.unlimitedModeBtn.classList.toggle("active", !daily);
  els.dailyModeBtn.setAttribute("aria-pressed", String(daily));
  els.unlimitedModeBtn.setAttribute("aria-pressed", String(!daily));
  els.newUnlimitedBtn.hidden = daily;
  els.modeTitle.textContent = daily ? "Woord van vandaag" : "Onbeperkte modus";
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[ch]));
}

function evaluateGuess(guess, answer) {
  const result = Array(answer.length).fill("absent");
  const answerChars = answer.split("");
  const guessChars = guess.split("");

  const remaining = {};
  for (let i = 0; i < answer.length; i++) {
    if (guessChars[i] === answerChars[i]) {
      result[i] = "correct";
    } else {
      remaining[answerChars[i]] = (remaining[answerChars[i]] || 0) + 1;
    }
  }

  for (let i = 0; i < answer.length; i++) {
    if (result[i] === "correct") continue;
    const ch = guessChars[i];
    if (remaining[ch] > 0) {
      result[i] = "present";
      remaining[ch]--;
    }
  }

  return result;
}

function setMessage(text, isError = false) {
  els.message.textContent = text;
  els.message.style.color = isError ? "#a63f17" : "";
}

function startRound({ preserveDaily = true } = {}) {
  const today = getTodayKey();
  state.dailyKey = today;

  if (state.mode === "daily") {
    state.current = getDailyWord(state.words, today);
  } else {
    state.current = pickUnlimitedWord(state.words, state.current);
  }

  state.guesses = [];
  state.evaluations = [];
  state.gameOver = false;
  state.won = false;

  if (state.mode === "daily" && preserveDaily) {
    const saved = loadState();
    if (
      saved &&
      saved.mode === "daily" &&
      saved.dailyKey === today &&
      saved.currentWord === state.current.word
    ) {
      state.guesses = saved.guesses || [];
      state.evaluations = saved.evaluations || [];
      state.gameOver = Boolean(saved.gameOver);
      state.won = Boolean(saved.won);
    }
  }

  els.guessInput.value = "";
  els.guessInput.maxLength = state.current.word.length;
  renderMode();
  renderClue();
  buildBoard();
  renderResultPanel();
  renderStats();
  updateShareButton();
  saveState();

  if (state.gameOver) {
    setMessage(state.won ? "Je hebt het dagelijkse woord al opgelost." : "Deze dagelijkse ronde is al afgelopen.");
  } else {
    setMessage("");
    els.guessInput.focus();
  }
}

function applyEndState(won) {
  state.gameOver = true;
  state.won = won;

  const stats = getStats();
  const today = getTodayKey();

  stats.played += 1;
  if (won) {
    stats.won += 1;
    if (state.mode === "daily") {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const y = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
      stats.streak = (stats.lastWinDate === y || stats.lastWinDate === today) ? stats.streak + (stats.lastWinDate === today ? 0 : 1) : 1;
      stats.lastWinDate = today;
    }
  } else if (state.mode === "daily") {
    stats.streak = 0;
  }

  setStats(stats);
  renderStats();
  renderResultPanel();
  updateShareButton();
  saveState();
}

function submitGuess(rawGuess) {
  if (state.gameOver) {
    setMessage("Deze ronde is al afgelopen.");
    return;
  }

  const guess = normalizeDutch(rawGuess);
  const answer = normalizeDutch(state.current.word);

  if (guess.length !== answer.length) {
    setMessage(`Je gok moet ${answer.length} letters hebben.`, true);
    return;
  }


  const evaluation = evaluateGuess(guess, answer);
  state.guesses.push(guess);
  state.evaluations.push(evaluation);

  buildBoard();
  updateShareButton();
  saveState();

  if (guess === answer) {
    setMessage("Goed gedaan! Je hebt het woord geraden.");
    applyEndState(true);
    return;
  }

  if (state.guesses.length >= MAX_ATTEMPTS) {
    setMessage(`Helaas, "${state.current.word}" kaas. Het woord was "${state.current.word}".`);
    applyEndState(false);
    return;
  }

  setMessage(`Nog ${MAX_ATTEMPTS - state.guesses.length} poging(en).`);
}


function buildShareText() {
  const rows = state.evaluations.map((evaluation) =>
    evaluation.map((value) => {
      if (value === "correct") return "🟩";
      if (value === "present") return "🟧";
      return "⬜";
    }).join("")
  );

  const score = state.won ? `${state.guesses.length}/${MAX_ATTEMPTS}` : `X/${MAX_ATTEMPTS}`;
  const modeLabel = state.mode === "daily" ? `Dagelijks ${state.dailyKey}` : "Onbeperkt";
  return `NederWordle ${modeLabel} ${score}\n${rows.join("\n")}\n\nhttps://obliquadata.github.io/nederwordle`;
}

function updateShareButton() {
  if (!els.shareBtn) return;
  els.shareBtn.hidden = !(state.gameOver || state.guesses.length > 0);
}

async function shareResults() {
  const text = buildShareText();
  try {
    if (navigator.share) {
      await navigator.share({ text });
      setMessage("Resultaat gedeeld.");
      return;
    }
  } catch (error) {
    // Fall through to clipboard on cancel/error
  }

  try {
    await navigator.clipboard.writeText(text);
    setMessage("Resultaat gekopieerd naar je klembord.");
  } catch (error) {
    setMessage("Delen lukte niet automatisch.", true);
  }
}

async function init() {
  const res = await fetch("data/words.json");
  const words = await res.json();

  state.words = words
    .filter((w) => w.word && w.definition_nl && w.definition_en)
    .map((w) => ({ ...w, word: normalizeDutch(w.word) }))
    .filter((w) => w.word.length >= 3 && w.word.length <= 12);

  const saved = loadState();
  state.mode = saved?.mode === "unlimited" ? "unlimited" : "daily";

  startRound({ preserveDaily: true });

  els.guessForm.addEventListener("submit", (event) => {
    event.preventDefault();
    submitGuess(els.guessInput.value);
    els.guessInput.value = "";
    if (!state.gameOver) els.guessInput.focus();
  });

  els.dailyModeBtn.addEventListener("click", () => {
    if (state.mode !== "daily") {
      state.mode = "daily";
      startRound({ preserveDaily: true });
    }
  });

  els.unlimitedModeBtn.addEventListener("click", () => {
    if (state.mode !== "unlimited") {
      state.mode = "unlimited";
      startRound({ preserveDaily: false });
    }
  });

  els.newUnlimitedBtn.addEventListener("click", () => {
    if (state.mode === "unlimited") {
      startRound({ preserveDaily: false });
    }
  });

  if (els.shareBtn) {
    els.shareBtn.addEventListener("click", () => {
      shareResults();
    });
  }
}

init().catch((error) => {
  console.error(error);
  setMessage("Er ging iets mis bij het laden van de woordbank.", true);
});
