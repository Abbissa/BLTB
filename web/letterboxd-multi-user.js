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
            likes: []
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
                    <div class="user-card">
                        <button class="remove-user" onclick="removeUser(${index})">×</button>
                        <div class="user-header">
                            <h3 class="user-name">${user.name}</h3>
                            <p class="user-meta">Letterboxd User</p>
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

// Update comparison charts
function updateComparison() {
    if (userData.length === 0) return;

    // Watched comparison
    const maxWatched = Math.max(...userData.map(u => u.watched.length));
    document.getElementById('watchedComparison').innerHTML = userData.map(user => `
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
    const ratings = userData.map(u => {
        return u.ratings.length > 0
            ? u.ratings.reduce((sum, f) => sum + parseFloat(f.Rating || 0), 0) / u.ratings.length
            : 0;
    });
    const maxRating = Math.max(...ratings, 5);
    document.getElementById('ratingComparison').innerHTML = userData.map((user, i) => `
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
    const maxReviews = Math.max(...userData.map(u => u.reviews.length), 1);
    document.getElementById('reviewsComparison').innerHTML = userData.map(user => `
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
    const maxWatchlist = Math.max(...userData.map(u => u.watchlist.length), 1);
    document.getElementById('watchlistComparison').innerHTML = userData.map(user => `
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
    }
}

// Update user selector
function updateUserSelect() {
    const select = document.getElementById('userSelect');
    select.innerHTML = '<option value="">Select a user...</option>' +
        userData.map((user, i) => `<option value="${i}">${user.name}</option>`).join('');
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