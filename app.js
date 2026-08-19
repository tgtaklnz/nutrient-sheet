const input = document.getElementById('search-input');
const suggestionsEl = document.getElementById('suggestions');
const resultEl = document.getElementById('result');
const emptyStateEl = document.getElementById('empty-state');

let foods = [];
let debounceTimer = null;
let activeIndex = -1;
let currentSuggestions = [];

async function loadFoods() {
  try {
    const res = await fetch('./foods.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    foods = await res.json();
  } catch (error) {
    console.error('Could not load foods.json:', error);
    resultEl.innerHTML = '<p class="result-error">The food database could not be loaded. Please try again later.</p>';
    resultEl.classList.remove('hidden');
  }
}

function debounce(fn, delay) {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(fn, delay);
}

function findSuggestions(query) {
  const q = query.toLowerCase();
  return foods
    .filter(food =>
      food.name.toLowerCase().includes(q) ||
      food.id.toLowerCase().includes(q) ||
      food.category.toLowerCase().includes(q)
    )
    .slice(0, 8);
}

function findFood(id) {
  const q = String(id).toLowerCase();
  return foods.find(food => food.id.toLowerCase() === q) ||
         foods.find(food => food.name.toLowerCase() === q) ||
         null;
}

function renderSuggestions(items) {
  currentSuggestions = items;
  activeIndex = -1;

  if (!items.length) {
    suggestionsEl.classList.add('hidden');
    suggestionsEl.innerHTML = '';
    return;
  }

  suggestionsEl.innerHTML = items
    .map(
      (item, i) => `
      <li><button type="button" data-id="${item.id}" data-index="${i}">
        ${item.name} <span class="category">&middot; ${item.category}</span>
      </button></li>`
    )
    .join('');

  suggestionsEl.classList.remove('hidden');
}

function renderResult(food) {
  emptyStateEl.classList.add('hidden');

  if (!food) {
    resultEl.innerHTML = `<p class="result-error">No entry found for that food yet. Try a different name.</p>`;
    resultEl.classList.remove('hidden');
    return;
  }

  const rows = food.nutrients
    .map(
      (n) => `
      <div class="nutrient-row">
        <div class="nutrient-top">
          <span class="nutrient-name">${n.name}</span>
          <span class="nutrient-amount">${n.amount} ${n.unit}</span>
        </div>
        ${n.context ? `<p class="nutrient-context">${n.context}</p>` : ''}
      </div>`
    )
    .join('');

  resultEl.innerHTML = `
    <div class="result-head">
      <p class="result-name">${food.name}</p>
      <p class="result-meta">Per ${food.per}</p>
    </div>
    ${rows}
    <p class="result-source">Source: ${food.source}. Nutrient roles summarized from NIH Office of Dietary Supplements fact sheets.</p>
  `;
  resultEl.classList.remove('hidden');
}

function selectFood(id) {
  suggestionsEl.classList.add('hidden');
  const food = findFood(id);
  renderResult(food);
}

input.addEventListener('input', () => {
  const query = input.value.trim();
  if (!query) {
    suggestionsEl.classList.add('hidden');
    return;
  }

  debounce(() => {
    renderSuggestions(findSuggestions(query));
  }, 150);
});

input.addEventListener('keydown', (e) => {
  if (suggestionsEl.classList.contains('hidden')) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    activeIndex = Math.min(activeIndex + 1, currentSuggestions.length - 1);
    highlightActive();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    activeIndex = Math.max(activeIndex - 1, 0);
    highlightActive();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (activeIndex >= 0) {
      selectFood(currentSuggestions[activeIndex].id);
    } else {
      const exact = findFood(input.value.trim());
      if (exact) selectFood(exact.id);
    }
  } else if (e.key === 'Escape') {
    suggestionsEl.classList.add('hidden');
  }
});

function highlightActive() {
  [...suggestionsEl.querySelectorAll('button')].forEach((btn, i) => {
    btn.classList.toggle('active', i === activeIndex);
  });
}

suggestionsEl.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-id]');
  if (btn) selectFood(btn.dataset.id);
});

document.querySelectorAll('.chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    input.value = chip.dataset.food;
    selectFood(chip.dataset.food);
  });
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.search-wrap')) {
    suggestionsEl.classList.add('hidden');
  }
});

loadFoods();
