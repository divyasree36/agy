// Global State
let releaseNotes = [];
let filteredNotes = [];
let selectedNotes = new Set();
let currentCategory = 'all';
let searchQuery = '';

// DOM Elements
const notesGrid = document.getElementById('notes-grid');
const loadingState = document.getElementById('loading-state');
const errorState = document.getElementById('error-state');
const errorMessage = document.getElementById('error-message');
const emptyState = document.getElementById('empty-state');
const refreshBtn = document.getElementById('refresh-btn');
const refreshIcon = refreshBtn.querySelector('.spinner-icon');
const lastUpdatedText = document.getElementById('last-updated-text');
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search-btn');
const retryBtn = document.getElementById('retry-btn');
const clearFiltersBtn = document.getElementById('clear-filters-btn');
const statsBanner = document.getElementById('stats-banner');

// Stats Counters
const statTotal = document.getElementById('stat-total');
const statFeatures = document.getElementById('stat-features');
const statChanges = document.getElementById('stat-changes');
const statBreaking = document.getElementById('stat-breaking');

// Multi-Tweet Bar Elements
const multiTweetBar = document.getElementById('multi-tweet-bar');
const selectedCountText = document.getElementById('selected-count');
const clearSelectionBtn = document.getElementById('clear-selection-btn');
const composeThreadBtn = document.getElementById('compose-thread-btn');

// Modal Elements
const tweetModal = document.getElementById('tweet-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const cancelTweetBtn = document.getElementById('cancel-tweet-btn');
const tweetTextarea = document.getElementById('tweet-textarea');
const charCounter = document.getElementById('char-counter');
const shareIntentBtn = document.getElementById('share-intent-btn');
const tweetWarning = document.getElementById('tweet-warning');

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    fetchReleaseNotes();
    setupEventListeners();
});

// Event Listeners setup
function setupEventListeners() {
    refreshBtn.addEventListener('click', () => fetchReleaseNotes(true));
    retryBtn.addEventListener('click', () => fetchReleaseNotes(true));
    
    // Search listeners
    searchInput.addEventListener('input', handleSearch);
    clearSearchBtn.addEventListener('click', clearSearch);
    clearFiltersBtn.addEventListener('click', resetAllFilters);
    
    // Category tabs
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const category = e.currentTarget.getAttribute('data-category');
            switchTab(category);
        });
    });
    
    // Multi-tweet action bar
    clearSelectionBtn.addEventListener('click', deselectAllNotes);
    composeThreadBtn.addEventListener('click', openMultiTweetComposer);
    
    // Modal events
    closeModalBtn.addEventListener('click', closeTweetModal);
    cancelTweetBtn.addEventListener('click', closeTweetModal);
    tweetTextarea.addEventListener('input', updateCharCounter);
    shareIntentBtn.addEventListener('click', launchTwitterIntent);
    
    // Close modal on clicking overlay
    tweetModal.addEventListener('click', (e) => {
        if (e.target === tweetModal) closeTweetModal();
    });
}

// Fetch Notes from Flask API
async function fetchReleaseNotes(forceRefresh = false) {
    showLoading();
    if (forceRefresh) {
        refreshIcon.classList.add('spinning');
        refreshBtn.disabled = true;
    }
    
    try {
        const url = `/api/release-notes${forceRefresh ? '?refresh=true' : ''}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Server returned status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.status === 'success') {
            releaseNotes = result.data;
            deselectAllNotes(); // Clear selections on refetch
            updateLastUpdatedTime(result.last_fetched);
            updateStatsCounters();
            applyFilters();
            showGrid();
        } else {
            throw new Error(result.message || 'Unknown backend error');
        }
    } catch (error) {
        console.error('Fetch error:', error);
        showError(error.message);
    } finally {
        if (forceRefresh) {
            refreshIcon.classList.remove('spinning');
            refreshBtn.disabled = false;
        }
    }
}

// Set loading UI state
function showLoading() {
    loadingState.style.display = 'flex';
    notesGrid.style.display = 'none';
    errorState.style.display = 'none';
    emptyState.style.display = 'none';
}

// Set error UI state
function showError(msg) {
    loadingState.style.display = 'none';
    notesGrid.style.display = 'none';
    errorState.style.display = 'flex';
    emptyState.style.display = 'none';
    errorMessage.textContent = msg;
}

// Set standard grid UI state
function showGrid() {
    loadingState.style.display = 'none';
    errorState.style.display = 'none';
    
    if (filteredNotes.length === 0) {
        notesGrid.style.display = 'none';
        emptyState.style.display = 'flex';
    } else {
        notesGrid.style.display = 'grid';
        emptyState.style.display = 'none';
        renderCards();
    }
}

// Update Last Updated timestamp display
function updateLastUpdatedTime(isoString) {
    try {
        const date = new Date(isoString);
        const options = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
        lastUpdatedText.textContent = `Feed updated: ${date.toLocaleTimeString(undefined, options)}`;
    } catch (e) {
        lastUpdatedText.textContent = 'Feed updated recently';
    }
}

// Dynamic counters updating for tabs and stats overview
function updateStatsCounters() {
    // Categories count totals
    const counts = {
        all: releaseNotes.length,
        Feature: 0,
        Change: 0,
        Announcement: 0,
        Breaking: 0,
        Issue: 0
    };
    
    releaseNotes.forEach(note => {
        if (counts.hasOwnProperty(note.category)) {
            counts[note.category]++;
        } else {
            counts['General'] = (counts['General'] || 0) + 1;
        }
    });
    
    // Update badge values
    document.querySelector('.count-all').textContent = counts.all;
    document.querySelector('.count-feature').textContent = counts.Feature;
    document.querySelector('.count-change').textContent = counts.Change;
    document.querySelector('.count-announcement').textContent = counts.Announcement;
    document.querySelector('.count-breaking').textContent = counts.Breaking;
    document.querySelector('.count-issue').textContent = counts.Issue;
    
    // Update stats banner counters
    statTotal.textContent = counts.all;
    statFeatures.textContent = counts.Feature;
    statChanges.textContent = counts.Change;
    statBreaking.textContent = counts.Breaking;
    
    statsBanner.style.display = 'flex';
}

// Filter Tab switching
function switchTab(category) {
    currentCategory = category;
    
    // Update active tab styles
    document.querySelectorAll('.filter-tab').forEach(tab => {
        if (tab.getAttribute('data-category') === category) {
            tab.classList.add('active');
            tab.setAttribute('aria-selected', 'true');
        } else {
            tab.classList.remove('active');
            tab.setAttribute('aria-selected', 'false');
        }
    });
    
    applyFilters();
    showGrid();
}

// Search handling
function handleSearch(e) {
    searchQuery = e.target.value.toLowerCase().trim();
    
    if (searchQuery.length > 0) {
        clearSearchBtn.style.display = 'block';
    } else {
        clearSearchBtn.style.display = 'none';
    }
    
    applyFilters();
    showGrid();
}

// Reset search box content
function clearSearch() {
    searchInput.value = '';
    searchQuery = '';
    clearSearchBtn.style.display = 'none';
    applyFilters();
    showGrid();
}

// Reset everything
function resetAllFilters() {
    clearSearch();
    switchTab('all');
}

// Core filtering engine combining Category + Search
function applyFilters() {
    filteredNotes = releaseNotes.filter(note => {
        const matchesCategory = (currentCategory === 'all') || (note.category === currentCategory);
        const matchesSearch = !searchQuery || 
                              note.text.toLowerCase().includes(searchQuery) ||
                              note.date.toLowerCase().includes(searchQuery) ||
                              note.category.toLowerCase().includes(searchQuery);
        return matchesCategory && matchesSearch;
    });
}

// Generate CSS class matching categories
function getCategoryClass(category) {
    switch (category) {
        case 'Feature': return 'cat-feature';
        case 'Change': return 'cat-change';
        case 'Announcement': return 'cat-announcement';
        case 'Breaking': return 'cat-breaking';
        case 'Issue': return 'cat-issue';
        default: return 'cat-general';
    }
}

// Truncate helper for tidy snippet drafting
function smartTruncate(str, maxLength) {
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength - 3) + '...';
}

// Render release note cards to the DOM grid
function renderCards() {
    notesGrid.innerHTML = '';
    
    filteredNotes.forEach(note => {
        const cardClass = getCategoryClass(note.category);
        const isChecked = selectedNotes.has(note.id) ? 'checked' : '';
        
        const card = document.createElement('article');
        card.className = `note-card ${cardClass}`;
        card.setAttribute('data-id', note.id);
        
        card.innerHTML = `
            <div class="card-header">
                <span class="category-badge">${note.category}</span>
                <span class="card-date">${note.date}</span>
            </div>
            <div class="card-body">
                ${note.html}
            </div>
            <div class="card-footer">
                <label class="selection-toggle">
                    <input type="checkbox" data-id="${note.id}" ${isChecked}>
                    <span>Select for compilation</span>
                </label>
                <div class="card-actions">
                    <button class="btn-card-tweet" title="Tweet this update">
                        <svg viewBox="0 0 24 24">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                        <span>Tweet</span>
                    </button>
                    <a href="${note.link}" class="btn-card-link" target="_blank" rel="noopener noreferrer" title="View official release notes source">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/>
                        </svg>
                    </a>
                </div>
            </div>
        `;
        
        // Setup card actions
        const checkbox = card.querySelector('input[type="checkbox"]');
        checkbox.addEventListener('change', (e) => toggleSelection(note.id, e.target.checked));
        
        const tweetBtn = card.querySelector('.btn-card-tweet');
        tweetBtn.addEventListener('click', () => openSingleTweetComposer(note));
        
        notesGrid.appendChild(card);
    });
}

// Toggle selection checkbox for compilation tweeting
function toggleSelection(id, checked) {
    if (checked) {
        selectedNotes.add(id);
    } else {
        selectedNotes.delete(id);
    }
    updateSelectionBar();
}

// Update the float action bar at the bottom
function updateSelectionBar() {
    const count = selectedNotes.size;
    selectedCountText.textContent = count;
    
    if (count > 0) {
        multiTweetBar.classList.add('visible');
    } else {
        multiTweetBar.classList.remove('visible');
    }
}

// Deselect all cards
function deselectAllNotes() {
    selectedNotes.clear();
    updateSelectionBar();
    
    // Untick all boxes in the DOM
    document.querySelectorAll('.selection-toggle input[type="checkbox"]').forEach(box => {
        box.checked = false;
    });
}

// Single Card Tweet compose logic
function openSingleTweetComposer(note) {
    // Craft single tweet
    // Format: 📢 BigQuery [Category] ([Date]): [Snippet] \n\nSource: [Link] #BigQuery #GCP
    const tagEmoji = note.category === 'Breaking' ? '🚨' : (note.category === 'Issue' ? '⚠️' : '📢');
    const header = `${tagEmoji} BigQuery ${note.category} (${note.date}): `;
    const hashtags = `\n\n#BigQuery #GoogleCloud`;
    const linkSection = `\nSource: ${note.link}`;
    
    // Character limit budgeting
    const decorationLength = header.length + linkSection.length + hashtags.length;
    const maxSnippetLength = 280 - decorationLength;
    
    const snippet = smartTruncate(note.text, maxSnippetLength);
    const draftText = `${header}${snippet}${linkSection}${hashtags}`;
    
    openTweetModal(draftText);
}

// Multi-card combined tweet composer logic
function openMultiTweetComposer() {
    if (selectedNotes.size === 0) return;
    
    // Gather selected notes data
    const selectedList = releaseNotes.filter(note => selectedNotes.has(note.id));
    
    // Format:
    // 🧵 BigQuery Release Updates Compilation:
    // • Feature (June 30): [Truncated Text]
    // • Change (June 29): [Truncated Text]
    //
    // Feed: https://docs.cloud.google.com/bigquery/docs/release-notes #BigQuery
    
    let draftText = `🧵 BigQuery Updates Compilation:\n`;
    
    // Budget length: each list element gets a portion of the tweet.
    const footer = `\n\nFull Feed: https://docs.cloud.google.com/bigquery/docs/release-notes #BigQuery #GCP`;
    const remainingChars = 280 - draftText.length - footer.length;
    const budgetPerItem = Math.floor(remainingChars / selectedList.length);
    
    selectedList.forEach(note => {
        const prefix = `\n• ${note.category} (${note.date.split(',')[0]}): `;
        const maxTextLen = budgetPerItem - prefix.length;
        const textSnippet = smartTruncate(note.text, Math.max(20, maxTextLen));
        draftText += `${prefix}${textSnippet}`;
    });
    
    draftText += footer;
    
    openTweetModal(draftText);
}

// Show Composer Modal
function openTweetModal(text) {
    tweetTextarea.value = text;
    updateCharCounter();
    tweetModal.classList.add('visible');
    tweetTextarea.focus();
}

// Hide Composer Modal
function closeTweetModal() {
    tweetModal.classList.remove('visible');
}

// Update character counter in modal
function updateCharCounter() {
    const len = tweetTextarea.value.length;
    charCounter.textContent = len;
    
    // Style adjustments for Twitter's 280 chars limit
    if (len > 280) {
        charCounter.className = 'error';
        tweetWarning.style.display = 'block';
    } else if (len > 250) {
        charCounter.className = 'warn';
        tweetWarning.style.display = 'none';
    } else {
        charCounter.className = '';
        tweetWarning.style.display = 'none';
    }
}

// Launches Web Intent Tweet Composer
function launchTwitterIntent() {
    const text = tweetTextarea.value;
    const twitterIntentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(twitterIntentUrl, '_blank', 'noopener,noreferrer,width=550,height=420');
    closeTweetModal();
}
