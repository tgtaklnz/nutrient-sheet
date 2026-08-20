const input = document.getElementById('search-input');
const suggestionsEl = document.getElementById('suggestions');
const resultEl = document.getElementById('result');
const emptyStateEl = document.getElementById('empty-state');

let foods = [];
let debounceTimer = null;
let activeIndex = -1;
let currentSuggestions = [];

// Which section a nutrient belongs in. Anything not matched here falls
// through to "Minerals" (the catch-all secondary section).
const VITAMIN_NAMES = new Set([
  'Vitamin A', 'Vitamin B6', 'Vitamin B12', 'Vitamin C', 'Vitamin D',
  'Vitamin E', 'Vitamin K', 'Folate', 'Niacin', 'Riboflavin', 'Thiamin', 'Choline'
]);
const MACRO_NAMES = new Set(['Carbohydrate', 'Protein', 'Fat']);
const CALORIE_NAME = 'Calories';
const FIBER_NAME = 'Fiber';

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

function nutrientRow(n) {
  return `
    <div class="nutrient-row">
      <div class="nutrient-top">
        <span class="nutrient-name">${n.name}</span>
        <span class="nutrient-amount">${n.amount} ${n.unit}</span>
      </div>
      ${n.context ? `<p class="nutrient-context">${n.context}</p>` : ''}
    </div>`;
}

function renderResult(food) {
  emptyStateEl.classList.add('hidden');

  if (!food) {
    resultEl.innerHTML = `<p class="result-error">No entry found for that food yet. Try a different name.</p>`;
    resultEl.classList.remove('hidden');
    return;
  }

  const vitamins = food.nutrients.filter(n => VITAMIN_NAMES.has(n.name));
  const macros = food.nutrients.filter(n => MACRO_NAMES.has(n.name));
  const calorieEntry = food.nutrients.find(n => n.name === CALORIE_NAME);
  const fiberEntry = food.nutrients.find(n => n.name === FIBER_NAME);
  const minerals = food.nutrients.filter(
    n => !VITAMIN_NAMES.has(n.name) && !MACRO_NAMES.has(n.name) &&
         n.name !== CALORIE_NAME && n.name !== FIBER_NAME
  );

  const statLine = [
    calorieEntry ? `${calorieEntry.amount} ${calorieEntry.unit}` : null,
    fiberEntry ? `${fiberEntry.amount}${fiberEntry.unit} fiber` : null,
  ].filter(Boolean).join(' &middot; ');

  const vitaminsHtml = vitamins.length
    ? `<p class="section-label section-label-accent">Vitamins</p>
       <div class="section-block">${vitamins.map(nutrientRow).join('')}</div>`
    : '';

  const macroTile = (n) => `
    <div class="macro-tile">
      <p class="macro-label">${n.name === 'Carbohydrate' ? 'Carbs' : n.name}</p>
      <p class="macro-value">${n.amount}${n.unit}</p>
    </div>`;

  const macrosHtml = macros.length
    ? `<p class="section-label">Macros</p>
       <div class="macro-grid">${macros.map(macroTile).join('')}</div>`
    : '';

  const mineralsHtml = minerals.length
    ? `<details class="minerals-details">
         <summary class="section-label">Minerals</summary>
         <div class="section-block section-block-tight">${minerals.map(nutrientRow).join('')}</div>
       </details>`
    : '';

  resultEl.innerHTML = `
    <div class="result-head">
      <p class="result-name">${food.name}</p>
      <p class="result-meta">Per ${food.per}${food.householdServing ? ` &middot; ${food.householdServing}` : ''}</p>
      ${statLine ? `<p class="result-stat-line">${statLine}</p>` : ''}
    </div>
    ${vitaminsHtml}
    ${macrosHtml}
    ${mineralsHtml}
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
