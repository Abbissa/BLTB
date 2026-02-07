const userData = [];
let currentMode = 'comparison';
let selectedUser = null;

// Parse CSV helper
function parseCSV(text) {
    const lines = text.trim().split('\n');
    if (lines.length === 0) return [];

    const headers = lines[0].split(',').map(h => h.trim());

    return lines.slice(1).map(line => {
        const values = [];
        let current = '';
        let inQuotes = false;

        for (let char of line) {
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current.trim());

        const obj = {};
        headers.forEach((header, i) => {
            obj[header] = values[i] || '';
        });
        return obj;
    });
}

// Upload zone drag and drop
const uploadZone = document.getElementById('uploadZone');
const zipInput = document.getElementById('zipInput');

uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('dragover');
});

uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('dragover');
});

uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.zip'));
    files.forEach(file => processZipFile(file));
});

zipInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => processZipFile(file));
});

// Process ZIP file
async function processZipFile(file) {
    try {
        const zip = await JSZip.loadAsync(file);
        const user = {
            name: file.name.replace('.zip', '').replace('letterboxd-', '').replace(/-\d{4}-\d{2}-\d{2}.*/, ''),
            watched: [],
            ratings: [],
            reviews: [],
            watchlist: [],
            likes: [],
            enabled: true
        };

        // Extract all CSV files
        const files = {
            'watched.csv': 'watched',
            'ratings.csv': 'ratings',
            'reviews.csv': 'reviews',
            'watchlist.csv': 'watchlist',
            'likes/films.csv': 'likes'
        };

        for (const [filename, key] of Object.entries(files)) {
            const file = zip.file(filename);
            if (file) {
                const content = await file.async('text');
                user[key] = parseCSV(content);
            }
        }

        userData.push(user);
        renderUserCards();
        updateComparison();
        updateUI();
    } catch (error) {
        console.error('Error processing ZIP:', error);
        alert('Error processing ZIP file. Make sure it\'s a valid Letterboxd export.');
    }
}

// Render user cards
function renderUserCards() {
    const grid = document.getElementById('usersGrid');
    grid.innerHTML = userData.map((user, index) => {
        const avgRating = user.ratings.length > 0
            ? (user.ratings.reduce((sum, f) => sum + parseFloat(f.Rating || 0), 0) / user.ratings.length).toFixed(1)
            : '0.0';

        return `
                    <div class="user-card ${!user.enabled ? 'user-card-disabled' : ''}">
                        <div style="position: absolute; top: 1rem; right: 1rem; display: flex; gap: 0.5rem; z-index: 10;">
                            <button class="toggle-user-btn" onclick="toggleUserEnabled(${index})" title="${user.enabled ? 'Disable' : 'Enable'}">${user.enabled ? '👁️' : '🚫'}</button>
                            <button class="remove-user" onclick="removeUser(${index})">×</button>
                        </div>
                        <div class="user-header">
                            <h3 class="user-name">${user.name}</h3>
                            <p class="user-meta">Letterboxd User ${!user.enabled ? '(Disabled)' : ''}</p>
                        </div>
                        <div class="user-stats">
                            <div class="stat-item">
                                <span class="stat-value">${user.watched.length}</span>
                                <span class="stat-label">Watched</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-value">${user.ratings.length}</span>
                                <span class="stat-label">Rated</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-value">${user.likes.length}</span>
                                <span class="stat-label">Liked</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-value">${user.watchlist.length}</span>
                                <span class="stat-label">Watchlist</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-value">${user.reviews.length}</span>
                                <span class="stat-label">Reviews</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-value">${avgRating}</span>
                                <span class="stat-label">Avg Rating</span>
                            </div>
                        </div>
                    </div>
                `;
    }).join('');
}

// Remove user
function removeUser(index) {
    if (confirm(`Remove ${userData[index].name}?`)) {
        userData.splice(index, 1);
        renderUserCards();
        updateComparison();
        updateUI();
    }
}

// Toggle user enabled/disabled
function toggleUserEnabled(index) {
    userData[index].enabled = !userData[index].enabled;
    renderUserCards();
    updateComparison();
    updateUI();
}

// Update comparison charts
function updateComparison() {
    const enabledUsers = userData.filter(u => u.enabled);
    if (enabledUsers.length === 0) return;

    // Watched comparison
    const maxWatched = Math.max(...enabledUsers.map(u => u.watched.length));
    document.getElementById('watchedComparison').innerHTML = enabledUsers.map(user => `
                <div class="user-bar-row">
                    <div class="user-label">${user.name}</div>
                    <div class="bar-track">
                        <div class="bar-fill" style="width: ${(user.watched.length / maxWatched) * 100}%">
                            <span class="bar-value">${user.watched.length}</span>
                        </div>
                    </div>
                </div>
            `).join('');

    // Rating comparison
    const ratings = enabledUsers.map(u => {
        return u.ratings.length > 0
            ? u.ratings.reduce((sum, f) => sum + parseFloat(f.Rating || 0), 0) / u.ratings.length
            : 0;
    });
    const maxRating = Math.max(...ratings, 5);
    document.getElementById('ratingComparison').innerHTML = enabledUsers.map((user, i) => `
                <div class="user-bar-row">
                    <div class="user-label">${user.name}</div>
                    <div class="bar-track">
                        <div class="bar-fill" style="width: ${(ratings[i] / maxRating) * 100}%">
                            <span class="bar-value">${ratings[i].toFixed(1)}</span>
                        </div>
                    </div>
                </div>
            `).join('');

    // Reviews comparison
    const maxReviews = Math.max(...enabledUsers.map(u => u.reviews.length), 1);
    document.getElementById('reviewsComparison').innerHTML = enabledUsers.map(user => `
                <div class="user-bar-row">
                    <div class="user-label">${user.name}</div>
                    <div class="bar-track">
                        <div class="bar-fill" style="width: ${(user.reviews.length / maxReviews) * 100}%">
                            <span class="bar-value">${user.reviews.length}</span>
                        </div>
                    </div>
                </div>
            `).join('');

    // Watchlist comparison
    const maxWatchlist = Math.max(...enabledUsers.map(u => u.watchlist.length), 1);
    document.getElementById('watchlistComparison').innerHTML = enabledUsers.map(user => `
                <div class="user-bar-row">
                    <div class="user-label">${user.name}</div>
                    <div class="bar-track">
                        <div class="bar-fill" style="width: ${(user.watchlist.length / maxWatchlist) * 100}%">
                            <span class="bar-value">${user.watchlist.length}</span>
                        </div>
                    </div>
                </div>
            `).join('');
}

// Update UI visibility
function updateUI() {
    const hasData = userData.length > 0;
    document.getElementById('emptyState').style.display = hasData ? 'none' : 'block';
    document.getElementById('modeToggle').style.display = hasData ? 'block' : 'none';

    if (hasData) {
        updateUserSelect();
        buildMovieIndex();
        buildWatchlistIndex();
    }
}

// Update user selector
function updateUserSelect() {
    const select = document.getElementById('userSelect');
    const enabledUsers = userData.filter(u => u.enabled);
    select.innerHTML = '<option value="">Select a user...</option>' +
        enabledUsers.map((user, i) => {
            const originalIndex = userData.indexOf(user);
            return `<option value="${originalIndex}">${user.name}</option>`;
        }).join('');
}

// Mode toggle
document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        currentMode = btn.dataset.mode;
        document.getElementById('comparisonSection').classList.toggle('active', currentMode === 'comparison');
        document.getElementById('individualSection').classList.toggle('active', currentMode === 'individual');
    });
});

// User select
// update viewer.js loadData after selection
document.getElementById('userSelect').addEventListener('change', (e) => {
    const userIndex = parseInt(e.target.value);
    const viewerContainer = document.getElementById('individualViewer');
    if (!isNaN(userIndex) && userData[userIndex]) {
        selectedUser = userData[userIndex];

        // Inject the full viewer for the selected user
        if (window.renderViewer) {
            window.renderViewer(viewerContainer, {
                watched: selectedUser.watched,
                ratings: selectedUser.ratings,
                reviews: selectedUser.reviews,
                watchlist: selectedUser.watchlist,
                likes: selectedUser.likes,
                name: selectedUser.name
            });
        }
    } else {
        viewerContainer.innerHTML = '';
    }
});

// Movie Search in Comparison Mode
let allMovies = [];
let watchlistIntersection = [];

function buildMovieIndex() {
    const enabledUsers = userData.filter(u => u.enabled);
    const movieMap = new Map();

    enabledUsers.forEach(user => {
        user.watched.forEach(film => {
            const key = `${film.Name}|${film.Year}`;
            if (!movieMap.has(key)) {
                movieMap.set(key, {
                    name: film.Name,
                    year: film.Year,
                    uri: film['Letterboxd URI'],
                    users: []
                });
            }
            movieMap.get(key).users.push({
                userName: user.name,
                rating: user.ratings.find(r => r.Name === film.Name && r.Year === film.Year)?.Rating || null,
                review: user.reviews.find(r => r.Name === film.Name && r.Year === film.Year)?.Review || null
            });
        });
    });

    allMovies = Array.from(movieMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
    );
}

function buildWatchlistIndex() {
    const enabledUsers = userData.filter(u => u.enabled);
    if (enabledUsers.length === 0) {
        watchlistIntersection = [];
        return;
    }

    // Start with first enabled user's watchlist
    const firstUserWatchlist = new Set(
        enabledUsers[0].watchlist.map(f => `${f.Name}|${f.Year}`)
    );

    // Find intersection: movies in ALL enabled users' watchlists
    const intersection = Array.from(firstUserWatchlist).filter(movieKey => {
        return enabledUsers.every(user => {
            return user.watchlist.some(f => `${f.Name}|${f.Year}` === movieKey);
        });
    });

    // Map intersection keys to full movie objects
    watchlistIntersection = intersection.map(movieKey => {
        const [name, year] = movieKey.split('|');
        const users = enabledUsers.map(user => {
            const film = user.watchlist.find(f => f.Name === name && f.Year === year);
            // Check if user has watched this movie
            const watchedFilm = user.watched.find(w => w.Name === name && w.Year === year);
            const ratingFilm = user.ratings.find(r => r.Name === name && r.Year === year);
            const reviewFilm = user.reviews.find(r => r.Name === name && r.Year === year);

            return {
                userName: user.name,
                rating: ratingFilm?.Rating || null,
                review: reviewFilm?.Review || null,
                hasWatched: !!watchedFilm
            };
        });

        return {
            name: name,
            year: year,
            uri: enabledUsers[0].watchlist.find(f => `${f.Name}|${f.Year}` === movieKey)?.['Letterboxd URI'],
            users: users
        };
    }).sort((a, b) => a.name.localeCompare(b.name));
}

const movieSearchInput = document.getElementById('movieSearchInput');
const movieSearchResults = document.getElementById('movieSearchResults');
const movieComparisonContainer = document.getElementById('movieComparisonContainer');

movieSearchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();

    if (query.length < 2) {
        movieSearchResults.style.display = 'none';
        return;
    }

    const results = allMovies.filter(m =>
        m.name.toLowerCase().includes(query)
    ).slice(0, 10);

    if (results.length === 0) {
        movieSearchResults.innerHTML = '<div style="padding: 1rem; color: var(--silver);">No movies found</div>';
        movieSearchResults.style.display = 'block';
        return;
    }

    movieSearchResults.innerHTML = results.map(movie => `
        <div class="movie-search-result-item" onclick="selectMovieForComparison('${movie.name.replace(/'/g, "\\'")}', '${movie.year}')">
            <div class="movie-search-result-title">${movie.name}</div>
            <div class="movie-search-result-year">${movie.year} • Watched by ${movie.users.length} user(s)</div>
        </div>
    `).join('');
    movieSearchResults.style.display = 'block';
});

function selectMovieForComparison(movieName, movieYear) {
    const movie = allMovies.find(m => m.name === movieName && m.year === movieYear);

    if (!movie) return;

    const comparisonHTML = movie.users.map(userMovie => `
        <div class="user-bar-row">
            <div class="user-label">${userMovie.userName}</div>
            <div style="flex: 1;">
                ${userMovie.rating ? `<div style="color: var(--gold); margin-bottom: 0.5rem;">★ ${userMovie.rating}</div>` : '<div style="color: var(--silver); margin-bottom: 0.5rem;">Not rated</div>'}
                ${userMovie.review ? `<div style="color: var(--cream); font-size: 0.85rem; font-style: italic; background: rgba(212, 175, 55, 0.05); padding: 0.5rem; border-radius: 4px;">\"${userMovie.review}\"</div>` : ''}
            </div>
        </div>
    `).join('');

    document.getElementById('selectedMovieTitle').textContent = `${movie.name} (${movie.year})`;
    document.getElementById('movieComparisonData').innerHTML = comparisonHTML;
    movieComparisonContainer.style.display = 'block';
    movieSearchResults.style.display = 'none';
    movieSearchInput.value = '';
}

// Random movie in Comparison Mode
document.getElementById('randomMovieComparisonBtn').addEventListener('click', () => {
    if (watchlistIntersection.length === 0) {
        alert('No common movies in all users\' watchlists. Please load user data first.');
        return;
    }

    const randomIndex = Math.floor(Math.random() * watchlistIntersection.length);
    const randomMovie = watchlistIntersection[randomIndex];

    const comparisonHTML = randomMovie.users.map(userMovie => `
        <div class="user-bar-row">
            <div class="user-label">${userMovie.userName}</div>
            <div style="flex: 1;">
                ${userMovie.hasWatched ?
            `<div style="color: var(--gold); margin-bottom: 0.5rem;">✓ Watched - ${userMovie.rating ? `★ ${userMovie.rating}` : 'Not rated'}</div>` :
            '<div style="color: var(--silver); margin-bottom: 0.5rem;">📋 In Watchlist (Not watched yet)</div>'
        }
                ${userMovie.review ? `<div style="color: var(--cream); font-size: 0.85rem; font-style: italic; background: rgba(212, 175, 55, 0.05); padding: 0.5rem; border-radius: 4px;">\"${userMovie.review}\"</div>` : ''}
            </div>
        </div>
    `).join('');

    document.getElementById('randomMovieTitleComparison').textContent = `${randomMovie.name} (${randomMovie.year})`;
    document.getElementById('randomMovieComparisonData').innerHTML = comparisonHTML;
    document.getElementById('randomMovieComparisonContainer').style.display = 'block';
});