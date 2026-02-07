// Render a viewer into a given container element using provided user data
function renderStars(rating) {
    const fullStars = Math.floor(rating);
    const hasHalf = rating % 1 >= 0.5;
    let stars = '';

    for (let i = 0; i < fullStars; i++) stars += '<span class="star">★</span>';
    if (hasHalf) stars += '<span class="star half">★</span>';
    for (let i = fullStars + (hasHalf ? 1 : 0); i < 5; i++) stars += '<span class="star empty">★</span>';
    return stars;
}

window.renderViewer = function (container, user) {
    if (!container) return;

    const watchedData = user.watched || user.watchedData || [];
    const ratingsData = user.ratings || user.ratingsData || [];
    const reviewsData = user.reviews || user.reviewsData || [];
    const watchlistData = user.watchlist || user.watchlistData || [];
    const likesData = user.likes || user.likesData || [];

    const tpl = `
        <div class="viewer-root">
            <header class="header">
                <h1 class="cinema-title">CINE·MA</h1>
                <p class="subtitle">Letterboxd Collection</p>
                <p class="username">@${user.name || 'user'}</p>
            </header>

            <div class="stats-grid viewer-stats">
                <div class="stat-card">
                    <div class="stat-label">Films Watched</div>
                    <div class="stat-value v-totalWatched">-</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Films Rated</div>
                    <div class="stat-value v-totalRated">-</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Reviews Written</div>
                    <div class="stat-value v-totalReviews">-</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Films Liked</div>
                    <div class="stat-value v-totalLikes">-</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Watchlist</div>
                    <div class="stat-value v-totalWatchlist">-</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Avg Rating</div>
                    <div class="stat-value v-avgRating">-</div>
                </div>
            </div>

            <nav class="tabs viewer-tabs">
                <button class="tab active" data-tab="v-overview">Overview</button>
                <button class="tab" data-tab="v-ratings">Top Rated</button>
                <button class="tab" data-tab="v-reviews">Reviews</button>
                <button class="tab" data-tab="v-watchlist">Watchlist</button>
                <button class="tab" data-tab="v-recent">Recently Watched</button>
                <button class="tab" data-tab="chooseMovie">Random Movie</button>
            </nav>

            <div id="v-overview" class="content-section active">
                <div class="chart-container">
                    <h2 class="chart-title">Rating Distribution</h2>
                    <div class="bar-chart v-ratingDistribution"></div>
                </div>
                <div class="chart-container">
                    <h2 class="chart-title">Films by Year</h2>
                    <div class="bar-chart v-yearDistribution"></div>
                </div>
            </div>

            <div id="v-ratings" class="content-section">
                <div class="filter-controls">
                    <div class="filter-group">
                        <label class="filter-label">Filter by Rating</label>
                        <select class="v-ratingFilter">
                            <option value="all">All Ratings</option>
                            <option value="5">★★★★★ (5 stars)</option>
                            <option value="4.5">★★★★½ (4.5 stars)</option>
                            <option value="4">★★★★ (4 stars)</option>
                            <option value="3.5">★★★½ (3.5 stars)</option>
                            <option value="3">★★★ (3 stars)</option>
                            <option value="2.5">★★½ (2.5 stars)</option>
                            <option value="2">★★ (2 stars)</option>
                            <option value="1.5">★½ (1.5 stars)</option>
                            <option value="1">★ (1 star)</option>
                            <option value="0.5">½ (0.5 stars)</option>
                        </select>
                    </div>
                </div>
                <div class="films-grid v-ratedFilms"></div>
            </div>

            <div id="v-reviews" class="content-section">
                <div class="films-grid v-reviewedFilms"></div>
            </div>

            <div id="v-watchlist" class="content-section">
                <div class="watchlist-grid v-watchlistFilms"></div>
            </div>

            <div id="v-recent" class="content-section">
                <div class="films-grid v-recentFilms"></div>
            </div>
            
             <div id="chooseMovie" class="content-section">
                <h2 class="chart-title">Choose a Random Movie</h2>
                <button class="random-btn " id="randomMovieBtn">Pick a Movie</button>
                <div class="random-movie" id="randomMovie"></div>
            </div>
        </div>
    `;

    container.innerHTML = tpl;

    // scoped selectors
    const q = sel => container.querySelector(sel);

    // update stats
    q('.v-totalWatched').textContent = watchedData.length;
    q('.v-totalRated').textContent = ratingsData.length;
    q('.v-totalReviews').textContent = reviewsData.length;
    q('.v-totalLikes').textContent = likesData.length;
    q('.v-totalWatchlist').textContent = watchlistData.length;
    const avgRating = ratingsData.length ? (ratingsData.reduce((s, f) => s + parseFloat(f.Rating || 0), 0) / ratingsData.length) : 0;
    q('.v-avgRating').textContent = avgRating ? avgRating.toFixed(1) : '0.0';

    // rating distribution
    const ratingCounts = {};
    ratingsData.forEach(f => { ratingCounts[f.Rating] = (ratingCounts[f.Rating] || 0) + 1; });
    const maxCount = Math.max(...Object.values(ratingCounts), 1);
    const ratingHTML = ['5', '4.5', '4', '3.5', '3', '2.5', '2', '1.5', '1', '0.5'].map(r => {
        const count = ratingCounts[r] || 0;
        const pct = (count / maxCount) * 100;
        return `<div class="bar-row"><div class="bar-label">${renderStars(parseFloat(r))}</div><div class="bar-track"><div class="bar-fill" style="width:${pct}%"><span class="bar-value">${count}</span></div></div></div>`;
    }).join('');
    q('.v-ratingDistribution').innerHTML = ratingHTML;

    // year distribution
    const yearCounts = {};
    watchedData.forEach(f => { yearCounts[f.Year] = (yearCounts[f.Year] || 0) + 1; });
    const sortedYears = Object.entries(yearCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const maxYear = Math.max(...sortedYears.map(y => y[1]), 1);
    const yearHTML = sortedYears.map(([y, c]) => `<div class="bar-row"><div class="bar-label">${y}</div><div class="bar-track"><div class="bar-fill" style="width:${(c / maxYear) * 100}%"><span class="bar-value">${c}</span></div></div></div>`).join('');
    q('.v-yearDistribution').innerHTML = yearHTML;

    // rated films
    const sortedRatings = [...ratingsData].sort((a, b) => parseFloat(b.Rating) - parseFloat(a.Rating));
    q('.v-ratedFilms').innerHTML = sortedRatings.map(f => `<div class="film-card" data-rating="${f.Rating}"><div class="film-header"><div><h3 class="film-title">${f.Name}</h3><p class="film-year">${f.Year}</p></div></div><div class="film-rating">${renderStars(parseFloat(f.Rating))}</div><p class="film-date">Rated on ${new Date(f.Date).toLocaleDateString('es-ES')}</p><a href="${f['Letterboxd URI']}" target="_blank" class="film-link">View on Letterboxd →</a></div>`).join('');

    // reviews
    q('.v-reviewedFilms').innerHTML = reviewsData.map(f => `<div class="film-card"><div class="film-header"><div><h3 class="film-title">${f.Name}</h3><p class="film-year">${f.Year}</p></div></div>${f.Rating ? `<div class="film-rating">${renderStars(parseFloat(f.Rating))}</div>` : ''}${f.Review ? `<div class="film-review">"${f.Review}"</div>` : ''}<p class="film-date">Watched on ${new Date(f['Watched Date'] || f.Date).toLocaleDateString('es-ES')}</p><a href="${f['Letterboxd URI']}" target="_blank" class="film-link">View on Letterboxd →</a></div>`).join('');

    // watchlist
    q('.v-watchlistFilms').innerHTML = watchlistData.map(f => `<div class="watchlist-card"><h3 class="watchlist-title">${f.Name}</h3><p class="watchlist-year">${f.Year}</p><a href="${f['Letterboxd URI']}" target="_blank" class="film-link">View on Letterboxd →</a></div>`).join('');

    // recent
    const recent = [...watchedData].sort((a, b) => new Date(b.Date) - new Date(a.Date)).slice(0, 20);
    q('.v-recentFilms').innerHTML = recent.map(f => { const r = ratingsData.find(rr => rr.Name === f.Name && rr.Year === f.Year); const rev = reviewsData.find(rr => rr.Name === f.Name && rr.Year === f.Year); return `<div class="film-card"><div class="film-header"><div><h3 class="film-title">${f.Name}</h3><p class="film-year">${f.Year}</p></div></div>${r ? `<div class="film-rating">${renderStars(parseFloat(r.Rating))}</div>` : ''}${rev && rev.Review ? `<div class="film-review">"${rev.Review}"</div>` : ''}<p class="film-date">Watched on ${new Date(f.Date).toLocaleDateString('es-ES')}</p><a href="${f['Letterboxd URI']}" target="_blank" class="film-link">View on Letterboxd →</a></div>`; }).join('');

    q('#randomMovieBtn').addEventListener('click', () => {
        const randomIndex = Math.floor(Math.random() * watchlistData.length);
        const randomMovie = watchlistData[randomIndex];
        q('#randomMovie').innerHTML = `<div class="film-card"><div class="film-header"><div><h3 class="film-title">${randomMovie.Name}</h3><p class="film-year">${randomMovie.Year}</p></div></div><a href="${randomMovie['Letterboxd URI']}" target="_blank" class="film-link">View on Letterboxd →</a></div>`;
    });

    // tabs (scoped)
    container.querySelectorAll('.viewer-tabs .tab').forEach(tab => {
        tab.addEventListener('click', () => {
            container.querySelectorAll('.viewer-tabs .tab').forEach(t => t.classList.remove('active'));
            container.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });

    // rating filter
    const ratingFilter = q('.v-ratingFilter');
    ratingFilter.addEventListener('change', (e) => {
        const v = e.target.value;
        container.querySelectorAll('.v-ratedFilms .film-card').forEach(card => {
            card.style.display = (v === 'all' || card.dataset.rating === v) ? 'block' : 'none';
        });
    });
};