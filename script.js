const MAX_ATTEMPTS = 8;

let piloti = [];
let secretPilot = null;
let guesses = [];
let gameOver = false;
let selectedAutocompleteIndex = -1;

const searchInput = document.getElementById('search-input');
const autocompleteList = document.getElementById('autocomplete-list');
const guessesGrid = document.getElementById('guesses-grid');
const attemptsCount = document.getElementById('attempts-count');
const gameResult = document.getElementById('game-result');
const resultMessage = document.getElementById('result-message');
const shareBtn = document.getElementById('share-btn');
const copyFeedback = document.getElementById('copy-feedback');

init();

async function init() {
  const res = await fetch('piloti.json');
  piloti = await res.json();

  secretPilot = getPilotaDelGiorno(piloti);
  loadState();
  renderExistingGuesses();
  updateUI();

  searchInput.addEventListener('input', onSearchInput);
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-container')) {
      autocompleteList.innerHTML = '';
    }
  });
  shareBtn.addEventListener('click', shareResult);
}

/* -------- Selezione pilota del giorno (deterministica per tutti) -------- */
function getPilotaDelGiorno(lista) {
  const oggi = new Date();
  const dataRif = new Date(2024, 0, 1); // punto di riferimento fisso
  const diffGiorni = Math.floor((oggi.setHours(0,0,0,0) - dataRif.setHours(0,0,0,0)) / 86400000);
  const index = ((diffGiorni % lista.length) + lista.length) % lista.length;
  return lista[index];
}

function getTodayKey() {
  const now = new Date();
  return `f1dle-${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

/* -------- Persistenza (localStorage, reset automatico a mezzanotte) -------- */
function loadState() {
  const key = getTodayKey();
  const saved = localStorage.getItem(key);

  // Pulisce eventuali salvataggi di giorni precedenti
  Object.keys(localStorage)
    .filter(k => k.startsWith('f1dle-') && k !== key)
    .forEach(k => localStorage.removeItem(k));

  if (saved) {
    const state = JSON.parse(saved);
    guesses = state.guesses || [];
    gameOver = state.gameOver || false;
  } else {
    guesses = [];
    gameOver = false;
  }
}

function saveState() {
  const key = getTodayKey();
  localStorage.setItem(key, JSON.stringify({ guesses, gameOver }));
}

/* -------- Autocomplete -------- */
function onSearchInput() {
  const query = searchInput.value.trim().toLowerCase();
  autocompleteList.innerHTML = '';
  selectedAutocompleteIndex = -1;

  if (!query || gameOver) return;

  const alreadyGuessed = guesses.map(g => g.Nome);
  const matches = piloti.filter(p =>
    p.Nome.toLowerCase().includes(query) && !alreadyGuessed.includes(p.Nome)
  );

  if (matches.length === 0) {
    const div = document.createElement('div');
    div.className = 'autocomplete-item disabled';
    div.textContent = 'Nessun pilota trovato';
    autocompleteList.appendChild(div);
    return;
  }

  matches.slice(0, 8).forEach(p => {
    const div = document.createElement('div');
    div.className = 'autocomplete-item';
    div.textContent = `${p.Nome} — ${p.Scuderia}`;
    div.addEventListener('click', () => selectPilot(p));
    autocompleteList.appendChild(div);
  });
}

function selectPilot(pilot) {
  searchInput.value = '';
  autocompleteList.innerHTML = '';
  makeGuess(pilot);
}

/* -------- Logica del tentativo -------- */
function makeGuess(pilot) {
  if (gameOver || guesses.length >= MAX_ATTEMPTS) return;

  guesses.push(pilot);

  const won = pilot.Nome === secretPilot.Nome;
  const lost = !won && guesses.length >= MAX_ATTEMPTS;

  if (won || lost) {
    gameOver = true;
  }

  saveState();
  renderGuessRow(pilot);
  updateUI();
}

/* -------- Rendering -------- */
function renderExistingGuesses() {
  guessesGrid.innerHTML = '';
  guesses.forEach(g => renderGuessRow(g));
}

function renderGuessRow(pilot) {
  const row = document.createElement('div');
  row.className = 'guess-row';

  row.appendChild(makeCell(pilot.Nome, pilot.Nome === secretPilot.Nome ? 'correct' : 'wrong'));
  row.appendChild(makeCell(pilot.Nazionalità, pilot.Nazionalità === secretPilot.Nazionalità ? 'correct' : 'wrong'));
  row.appendChild(makeCell(pilot.Scuderia, pilot.Scuderia === secretPilot.Scuderia ? 'correct' : 'wrong'));
  row.appendChild(makeNumericCell(pilot.Numero, secretPilot.Numero));
  row.appendChild(makeNumericCell(pilot.AnnoNascita, secretPilot.AnnoNascita));
  row.appendChild(makeNumericCell(pilot.CampionatiVinti, secretPilot.CampionatiVinti));

  guessesGrid.appendChild(row);
}

function makeCell(text, statusClass) {
  const cell = document.createElement('div');
  cell.className = `cell ${statusClass}`;
  cell.textContent = text;
  return cell;
}

function makeNumericCell(guessValue, secretValue) {
  const cell = document.createElement('div');
  const correct = guessValue === secretValue;
  cell.className = `cell ${correct ? 'correct' : 'wrong'}`;

  let content = String(guessValue);
  if (!correct) {
    const arrow = secretValue > guessValue ? '⬆️' : '⬇️';
    content += ` <span class="arrow">${arrow}</span>`;
  }
  cell.innerHTML = content;
  return cell;
}

/* -------- Stato UI -------- */
function updateUI() {
  attemptsCount.textContent = guesses.length;

  if (gameOver) {
    searchInput.disabled = true;
    searchInput.placeholder = 'Partita terminata';
    autocompleteList.innerHTML = '';
    gameResult.classList.remove('hidden');

    const won = guesses.some(g => g.Nome === secretPilot.Nome);
    resultMessage.textContent = won
      ? `🏆 Hai indovinato in ${guesses.length}/${MAX_ATTEMPTS} tentativi!`
      : `❌ Hai esaurito i tentativi. Il pilota era: ${secretPilot.Nome}`;
  } else {
    searchInput.disabled = false;
    gameResult.classList.add('hidden');
  }
}

/* -------- Condivisione -------- */
function shareResult() {
  const won = guesses.some(g => g.Nome === secretPilot.Nome);
  const header = `F1dle ${new Date().toLocaleDateString('it-IT')} - ${won ? guesses.length : 'X'}/${MAX_ATTEMPTS}`;

  const lines = guesses.map(g => {
    const nome = g.Nome === secretPilot.Nome ? '🟩' : '🟥';
    const naz = g.Nazionalità === secretPilot.Nazionalità ? '🟩' : '🟥';
    const scud = g.Scuderia === secretPilot.Scuderia ? '🟩' : '🟥';
    const num = numericSquare(g.Numero, secretPilot.Numero);
    const anno = numericSquare(g.AnnoNascita, secretPilot.AnnoNascita);
    const camp = numericSquare(g.CampionatiVinti, secretPilot.CampionatiVinti);
    return `${nome}${naz}${scud}${num}${anno}${camp}`;
  });

  const text = `${header}\n\n${lines.join('\n')}`;

  navigator.clipboard.writeText(text).then(() => {
    copyFeedback.classList.remove('hidden');
    setTimeout(() => copyFeedback.classList.add('hidden'), 2000);
  }).catch(() => {
    alert('Impossibile copiare automaticamente. Ecco il risultato:\n\n' + text);
  });
}

function numericSquare(guessValue, secretValue) {
  if (guessValue === secretValue) return '🟩';
  return secretValue > guessValue ? '🟥⬆️' : '🟥⬇️';
}
