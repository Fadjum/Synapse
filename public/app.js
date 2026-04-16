
/**
 * Synapse — Frontend Application
 * Eritage ENT Care · GBP Command Center
 */

const VIEW_META = {
    dashboard: { title: 'Dashboard',  subtitle: 'Overview of your Google Business Profile' },
    reviews:   { title: 'Reviews',    subtitle: 'Manage patient feedback and responses' },
    posts:     { title: 'Posts',       subtitle: 'Your Google Business posts' },
    qa:        { title: 'Q & A',       subtitle: 'Customer questions and answers' },
    services:  { title: 'Services',    subtitle: 'Medical services offered at Eritage ENT Care' },
    media:     { title: 'Media',       subtitle: 'Photos and videos on your listing' },
};

const STAR_MAP = { FIVE: 5, FOUR: 4, THREE: 3, TWO: 2, ONE: 1 };

// ─── Utilities ────────────────────────────────────────────
const $ = id => document.getElementById(id);
const fmt = d => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const initials = name => (name || '?').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
function starHTML(rating) {
    const n = STAR_MAP[rating] ?? 0;
    return Array.from({ length: 5 }, (_, i) =>
        `<span class="star${i < n ? ' filled' : ''}">★</span>`
    ).join('');
}
function avgRating(reviews) {
    if (!reviews.length) return 0;
    const total = reviews.reduce((s, r) => s + (STAR_MAP[r.starRating] ?? 0), 0);
    return (total / reviews.length).toFixed(1);
}

// ─── App ──────────────────────────────────────────────────
// API key lives ONLY in memory — never written to localStorage,
// sessionStorage, or any browser storage. Closing/refreshing the
// tab always requires re-entering the key.
let _apiKey = '';
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

const app = {
    state: {
        currentView: 'dashboard',
        profile:  null,
        insights: null,
        reviews:  [],
        posts:    [],
        services: [],
        media:    [],
        qa:       [],
        reviewFilter: 'all',
        dataLoaded: { reviews: false, posts: false, services: false, media: false, qa: false },
        nextPageTokens: {
            reviews: null,
            posts: null,
            media: null
        }
    },

    // ── API Key management (memory only) ──────────────────
    getApiKey() { return _apiKey; },
    setApiKey(key) { _apiKey = key; },
    clearApiKey() { _apiKey = ''; },
    apiHeaders(extra = {}) {
        return { 'x-api-key': _apiKey, ...extra };
    },

    // ── Idle timeout ──────────────────────────────────────
    _idleTimer: null,
    resetIdleTimer() {
        clearTimeout(this._idleTimer);
        this._idleTimer = setTimeout(() => {
            this.clearApiKey();
            this.showKeyPrompt();
            this.toast('Session locked after 30 minutes of inactivity.', 'info');
        }, IDLE_TIMEOUT_MS);
    },
    startIdleWatcher() {
        ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'].forEach(evt =>
            document.addEventListener(evt, () => this.resetIdleTimer(), { passive: true })
        );
        this.resetIdleTimer();
    },
    stopIdleWatcher() {
        clearTimeout(this._idleTimer);
    },

    // ── Key prompt ────────────────────────────────────────
    showKeyPrompt() {
        this.stopIdleWatcher();
        $('key-overlay').classList.remove('hidden');
        $('key-input').value = '';
        setTimeout(() => $('key-input').focus(), 50);
    },
    hideKeyPrompt() {
        $('key-overlay').classList.add('hidden');
    },
    async submitKeyPrompt() {
        const key = $('key-input').value.trim();
        if (!key) { this.toast('Please enter your password.', 'error'); return; }
        $('key-submit-btn').disabled = true;
        $('key-submit-btn').textContent = 'Checking…';
        try {
            const res = await fetch('/api/gbp/getProfile', { headers: { 'x-api-key': key } });
            if (res.status === 401) {
                this.toast('Wrong password — try again.', 'error');
                $('key-submit-btn').disabled = false;
                $('key-submit-btn').textContent = 'Unlock';
                $('key-input').value = '';
                $('key-input').focus();
                return;
            }
            this.setApiKey(key);
            this.hideKeyPrompt();
            this.startIdleWatcher();
            this.loadDashboard();
        } catch {
            this.toast('Could not reach server. Try again.', 'error');
            $('key-submit-btn').disabled = false;
            $('key-submit-btn').textContent = 'Unlock';
        }
    },
    handle401() {
        this.clearApiKey();
        this.showKeyPrompt();
        this.toast('Session expired — please log in again.', 'error');
    },

    // ── Init ─────────────────────────────────────────────
    init() {
        lucide.createIcons();
        this.bindEvents();
        $('key-submit-btn').addEventListener('click', () => this.submitKeyPrompt());
        $('key-input').addEventListener('keydown', e => { if (e.key === 'Enter') this.submitKeyPrompt(); });
        // Always prompt on every page load — key is never persisted
        this.showKeyPrompt();
    },

    bindEvents() {
        // Hamburger — toggle sidebar on mobile
        $('hamburger-btn').addEventListener('click', () => this.toggleSidebar());

        // Overlay — tap outside to close sidebar
        $('sidebar-overlay').addEventListener('click', () => this.closeSidebar());

        // Nav
        document.querySelectorAll('.nav-item').forEach(el => {
            el.addEventListener('click', e => {
                e.preventDefault();
                this.switchView(el.dataset.view);
                this.closeSidebar(); // always close on mobile after nav
            });
        });

        // Sync button
        $('refresh-btn').addEventListener('click', () => {
            this.state.dataLoaded = { reviews: false, posts: false, services: false, media: false, qa: false };
            this.loadDashboard(true);
            if (this.state.currentView !== 'dashboard') this.loadView(this.state.currentView, true);
            this.toast('Syncing with Google…', 'info');
        });

        // Modal close
        $('modal-backdrop').addEventListener('click', e => {
            if (e.target === $('modal-backdrop')) this.closeModal();
        });
        $('modal-close').addEventListener('click', () => this.closeModal());

        // Review filters
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.state.reviewFilter = btn.dataset.filter;
                this.renderReviews();
            });
        });

        // Dashboard — "View all" reviews button
        $('view-all-reviews-btn').addEventListener('click', () => this.switchView('reviews'));

        // New Post
        $('new-post-btn').addEventListener('click', () => this.openNewPostModal());

        // Upload Media
        $('upload-media-btn').addEventListener('click', () => this.openUploadMediaModal());
    },

    // ── View switching ────────────────────────────────────
    switchView(viewId) {
        if (this.state.currentView === viewId) return;
        this.state.currentView = viewId;

        // Update nav
        document.querySelectorAll('.nav-item').forEach(el => {
            el.classList.toggle('active', el.dataset.view === viewId);
        });

        // Show view
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(`view-${viewId}`).classList.add('active');

        // Update topbar
        const meta = VIEW_META[viewId] || { title: viewId, subtitle: '' };
        $('page-title').textContent = meta.title;
        $('page-subtitle').textContent = meta.subtitle;

        lucide.createIcons();
        this.loadView(viewId);
    },

    loadView(viewId, force = false) {
        // Data already cached — render from state immediately, skip network call
        if (!force && this.state.dataLoaded[viewId]) {
            switch (viewId) {
                case 'reviews':  this.renderReviews();  break;
                case 'posts':    this.renderPosts();    break;
                case 'services': this.renderServices(); break;
                case 'media':    this.renderMedia();    break;
                case 'qa':       this.renderQA();       break;
            }
            return;
        }
        // Not yet loaded — fetch from API
        switch (viewId) {
            case 'reviews':  this.fetchReviews();  break;
            case 'posts':    this.fetchPosts();    break;
            case 'services': this.fetchServices(); break;
            case 'media':    this.fetchMedia();    break;
            case 'qa':       this.fetchQA();       break;
        }
    },

    // ── Dashboard ─────────────────────────────────────────
    async loadDashboard(force = false) {
        try {
            const hdrs = { headers: this.apiHeaders() };
            const [profileRes, insightsRes, reviewsRes] = await Promise.all([
                fetch('/api/gbp/getProfile',   hdrs),
                fetch('/api/gbp/getInsights',  hdrs),
                fetch('/api/gbp/fetchReviews', hdrs),
            ]);
            if (profileRes.status === 401 || insightsRes.status === 401 || reviewsRes.status === 401) {
                return this.handle401();
            }
            const [pd, id, rd] = await Promise.all([
                profileRes.json(), insightsRes.json(), reviewsRes.json()
            ]);

            if (pd.success) { this.state.profile  = pd.profile;   this.renderProfile();  }
            if (id.success) { this.state.insights = id.insights;  this.renderChart();    }
            if (rd.success) {
                this.state.reviews = rd.reviews;
                this.state.dataLoaded.reviews = true;
                this.renderKPIs();
                this.renderDashReviews();
            } else {
                this.renderKPIs();
            }
        } catch (err) {
            this.toast('Could not connect to server.', 'error');
            this.renderKPIs();
        }
    },

    // ── Profile ───────────────────────────────────────────
    renderProfile() {
        const p = this.state.profile;
        if (!p) return;

        // Business chip in topbar
        $('business-chip').innerHTML = `<i data-lucide="map-pin"></i>${p.title}`;

        // Profile card
        const catLabel = p.categories?.primary || 'Healthcare';
        $('dash-profile').innerHTML = `
            <div class="card-head">
                <div>
                    <h3 class="card-title">Business Profile</h3>
                    <p class="card-desc">Eritage ENT Care</p>
                </div>
                <i data-lucide="building-2" class="card-icon"></i>
            </div>
            <span class="profile-category">${catLabel}</span>
            <div class="profile-details" style="margin-top:14px;">
                ${p.title ? `
                <div class="profile-row">
                    <i data-lucide="building"></i>
                    <span><strong>${p.title}</strong></span>
                </div>` : ''}
                ${p.phone ? `
                <div class="profile-row">
                    <i data-lucide="phone"></i>
                    <span>${p.phone}</span>
                </div>` : ''}
                ${p.website ? `
                <div class="profile-row">
                    <i data-lucide="globe"></i>
                    <a href="${p.website}" target="_blank" rel="noopener">${p.website.replace(/^https?:\/\//, '')}</a>
                </div>` : ''}
                ${p.address?.addressLines ? `
                <div class="profile-row">
                    <i data-lucide="map-pin"></i>
                    <span>${p.address.addressLines.join(', ')}${p.address.locality ? ', ' + p.address.locality : ''}</span>
                </div>` : ''}
                
                <button class="btn btn-ghost btn-sm" style="width:100%; margin-top:12px; border:1px solid var(--border);" onclick="app.openProfileModal()">
                    <i data-lucide="pencil"></i> Edit Profile
                </button>
            </div>
        `;
        lucide.createIcons();
    },

    openProfileModal() {
        const p = this.state.profile;
        $('modal-title').textContent = "Edit Business Profile";
        $('modal-body').innerHTML = `
            <div class="form-group">
                <label class="form-label">Business Name</label>
                <input type="text" id="edit-title" class="form-control" value="${this.esc(p.title)}" required>
            </div>
            <div class="form-group">
                <label class="form-label">Phone Number</label>
                <input type="text" id="edit-phone" class="form-control" value="${this.esc(p.phone || '')}">
            </div>
            <div class="form-group">
                <label class="form-label">Website</label>
                <input type="url" id="edit-website" class="form-control" value="${this.esc(p.website || '')}">
            </div>
            <div class="form-group">
                <label class="form-label">Description</label>
                <textarea id="edit-description" class="form-control" rows="3">${this.esc(p.description || '')}</textarea>
            </div>
            <div class="form-group">
                <label class="form-label">Address (Line 1)</label>
                <input type="text" id="edit-address-1" class="form-control" value="${this.esc(p.address?.addressLines ? p.address.addressLines[0] || '' : '')}">
            </div>
            
            <h4 style="margin: 20px 0 10px 0; font-size: 14px; font-weight:600;">Business Hours</h4>
            <div id="hours-editor" style="display:flex; flex-direction:column; gap:8px;">
                ${['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'].map(day => {
                    const dayHours = p.hours?.periods?.find(period => period.openDay === day);
                    return `
                        <div class="hour-row" style="display: flex; gap: 8px; align-items: center; justify-content: space-between;">
                            <span style="width: 80px; font-size: 12px; font-weight:500;">${day.charAt(0) + day.slice(1).toLowerCase()}</span>
                            <div style="display:flex; gap:6px; align-items:center;">
                                <input type="time" class="hour-open form-control" style="padding:4px 8px; font-size:12px;" data-day="${day}" value="${dayHours?.openTime ? `${dayHours.openTime.hours.toString().padStart(2, '0')}:${dayHours.openTime.minutes.toString().padStart(2, '0')}` : '09:00'}">
                                <span style="font-size:12px;">to</span>
                                <input type="time" class="hour-close form-control" style="padding:4px 8px; font-size:12px;" data-day="${day}" value="${dayHours?.closeTime ? `${dayHours.closeTime.hours.toString().padStart(2, '0')}:${dayHours.closeTime.minutes.toString().padStart(2, '0')}` : '17:00'}">
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>

            <div class="modal-footer" style="padding:24px 0 0 0;">
                <button type="button" class="btn btn-ghost" onclick="app.closeModal()">Cancel</button>
                <button type="button" class="btn btn-primary" onclick="app.submitProfileUpdate()">Save Changes</button>
            </div>
        `;
        this.openModal();
    },

    async submitProfileUpdate() {
        const updateData = {
            title: $('edit-title').value,
            phoneNumbers: { primaryPhone: $('edit-phone').value },
            websiteUri: $('edit-website').value,
            description: $('edit-description').value,
            storefrontAddress: {
                ...this.state.profile.address,
                addressLines: [$('edit-address-1').value]
            },
            regularHours: {
                periods: Array.from(document.querySelectorAll('.hour-row')).map(row => {
                    const day = row.querySelector('.hour-open').dataset.day;
                    const [openH, openM] = row.querySelector('.hour-open').value.split(':');
                    const [closeH, closeM] = row.querySelector('.hour-close').value.split(':');
                    return {
                        openDay: day,
                        openTime: { hours: parseInt(openH), minutes: parseInt(openM) },
                        closeDay: day,
                        closeTime: { hours: parseInt(closeH), minutes: parseInt(closeM) }
                    };
                })
            }
        };

        const updateMask = 'title,phoneNumbers,websiteUri,description,storefrontAddress,regularHours';

        this.toast('Updating profile…', 'info');
        try {
            const res = await fetch('/api/gbp/updateProfile', {
                method: 'PATCH',
                headers: this.apiHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ updateData, updateMask })
            });
            const data = await res.json();
            if (data.success) {
                this.toast('Profile updated successfully!', 'success');
                this.closeModal();
                this.loadDashboard(true);
            } else {
                this.toast(data.message || 'Failed to update profile.', 'error');
            }
        } catch (error) {
            this.toast('Network error while updating profile.', 'error');
        }
    },

    // ── KPI Cards ─────────────────────────────────────────
    renderKPIs() {
        const reviews  = this.state.reviews;
        const insights = this.state.insights || [];
        const avg = avgRating(reviews);
        const unanswered = reviews.filter(r => !r.hasReply).length;
        const impressions = insights.find(i => i.metric?.includes('IMPRESSION'))?.total ?? '—';

        // Update sidebar badge
        const badge = $('nav-reviews-badge');
        if (badge) badge.textContent = unanswered || '';

        $('kpi-row').innerHTML = `
            <div class="kpi-card kpi-clickable" data-dest="reviews" data-filter="all" title="View all reviews">
                <div class="kpi-icon indigo"><i data-lucide="star"></i></div>
                <div>
                    <div class="kpi-label">Total Reviews</div>
                    <div class="kpi-value">${reviews.length}</div>
                </div>
            </div>
            <div class="kpi-card kpi-clickable" data-dest="reviews" data-filter="all" title="View reviews">
                <div class="kpi-icon amber"><i data-lucide="award"></i></div>
                <div>
                    <div class="kpi-label">Average Rating</div>
                    <div class="kpi-value">${avg}<span class="kpi-unit">/ 5</span></div>
                </div>
            </div>
            <div class="kpi-card kpi-clickable" data-dest="reviews" data-filter="unanswered" title="View unanswered reviews">
                <div class="kpi-icon rose"><i data-lucide="message-circle"></i></div>
                <div>
                    <div class="kpi-label">Need Reply</div>
                    <div class="kpi-value">${unanswered}</div>
                </div>
            </div>
            <div class="kpi-card">
                <div class="kpi-icon teal"><i data-lucide="eye"></i></div>
                <div>
                    <div class="kpi-label">Impressions</div>
                    <div class="kpi-value" style="font-size:20px;">${impressions === '—' ? '—' : Number(impressions).toLocaleString()}</div>
                </div>
            </div>
        `;
        lucide.createIcons();

        // Wire up KPI card clicks
        $('kpi-row').querySelectorAll('.kpi-clickable').forEach(card => {
            card.addEventListener('click', () => {
                const dest   = card.dataset.dest;
                const filter = card.dataset.filter;
                if (filter) {
                    // pre-select the filter before switching
                    this.state.reviewFilter = filter;
                    document.querySelectorAll('.filter-btn').forEach(b => {
                        b.classList.toggle('active', b.dataset.filter === filter);
                    });
                }
                this.switchView(dest);
            });
        });
    },

    // ── Chart ─────────────────────────────────────────────
    renderChart() {
        const insights = this.state.insights;
        if (!Array.isArray(insights)) return;

        const ctx = $('perf-chart')?.getContext('2d');
        if (!ctx) return;
        if (window._perfChart) window._perfChart.destroy();

        const labels = ['Impressions', 'Calls', 'Website Clicks', 'Directions'];
        const values = [
            insights.find(i => i.metric?.includes('IMPRESSION'))?.total ?? 0,
            insights.find(i => i.metric?.includes('CALL'))?.total ?? 0,
            insights.find(i => i.metric?.includes('WEBSITE'))?.total ?? 0,
            insights.find(i => i.metric?.includes('DIRECTION'))?.total ?? 0,
        ];

        window._perfChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    data: values,
                    backgroundColor: ['#6366F1', '#8B5CF6', '#06B6D4', '#10B981'],
                    borderRadius: 8,
                    borderSkipped: false,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#0F172A',
                        titleFont: { family: 'Inter', size: 12 },
                        bodyFont: { family: 'Inter', size: 13 },
                        padding: 10,
                        cornerRadius: 8,
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: '#F1F5F9' },
                        ticks: { font: { family: 'Inter', size: 11 }, color: '#94A3B8' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { font: { family: 'Inter', size: 11 }, color: '#94A3B8' }
                    }
                }
            }
        });
    },

    // ── Dashboard Reviews ─────────────────────────────────
    renderDashReviews() {
        const list = $('dash-reviews-list');
        const recent = this.state.reviews.slice(0, 4);
        if (!recent.length) {
            list.innerHTML = this.emptyState('star', 'No reviews yet', 'Reviews from patients will appear here.');
            return;
        }
        list.innerHTML = recent.map(r => `
            <div class="dash-review-item" role="button" tabindex="0" title="View all reviews">
                <div class="reviewer-avatar">${initials(r.reviewer)}</div>
                <div class="dash-review-body">
                    <div class="dash-review-row1">
                        <span class="dash-review-name">${this.esc(r.reviewer)}</span>
                        <span class="star-row">${starHTML(r.starRating)}</span>
                    </div>
                    <div class="dash-review-excerpt">${r.comment ? this.esc(r.comment) : '<em>No comment</em>'}</div>
                </div>
                <i data-lucide="chevron-right" style="width:14px;height:14px;color:var(--text-subtle);flex-shrink:0;"></i>
            </div>
        `).join('');

        // Each review row navigates to the Reviews view
        list.querySelectorAll('.dash-review-item').forEach(row => {
            row.addEventListener('click', () => this.switchView('reviews'));
            row.addEventListener('keydown', e => { if (e.key === 'Enter') this.switchView('reviews'); });
        });

        lucide.createIcons();
    },

    // ── Fetch helper with 12 s timeout ───────────────────
    async apiFetch(url) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 12000);
        try {
            const res = await fetch(url, { signal: ctrl.signal, headers: this.apiHeaders() });
            clearTimeout(timer);
            if (res.status === 401) { this.handle401(); throw new Error('Unauthorized'); }
            return res.json();
        } catch (err) {
            clearTimeout(timer);
            if (err.name === 'AbortError') throw new Error('Request timed out');
            throw err;
        }
    },

    // ── Reviews View ──────────────────────────────────────
    async fetchReviews(pageToken = null) {
        const list = $('reviews-list');
        if (!pageToken) list.innerHTML = this.loadingCards(3, 90);
        try {
            const url = pageToken ? `/api/gbp/fetchReviews?pageToken=${pageToken}` : '/api/gbp/fetchReviews';
            const data = await this.apiFetch(url);
            if (data.success) {
                if (pageToken) {
                    this.state.reviews = [...this.state.reviews, ...data.reviews];
                } else {
                    this.state.reviews = data.reviews;
                }
                this.state.nextPageTokens.reviews = data.nextPageToken || null;
                this.state.dataLoaded.reviews = true;
                this.renderReviews();
                this.renderKPIs();
            } else {
                if (!pageToken) list.innerHTML = this.emptyState('alert-circle', 'Failed to load reviews', data.message || '');
            }
        } catch (err) {
            if (!pageToken) list.innerHTML = this.emptyState('wifi-off', 'Connection error', 'Check your server connection.');
        }
    },

    renderReviews() {
        const filter = this.state.reviewFilter;
        let reviews = this.state.reviews;
        if (filter === 'unanswered') reviews = reviews.filter(r => !r.hasReply);

        const count = $('reviews-count');
        if (count) count.innerHTML = `<strong>${reviews.length}</strong> review${reviews.length !== 1 ? 's' : ''}`;

        const list = $('reviews-list');
        if (!reviews.length) {
            list.innerHTML = this.emptyState('star', 'No reviews found', filter === 'unanswered' ? 'All reviews have been answered!' : 'No reviews yet.');
            return;
        }
        list.innerHTML = reviews.map(r => `
            <div class="review-card">
                <div class="review-top">
                    <div class="reviewer-meta">
                        <div class="reviewer-avatar">
                            ${r.reviewerProfilePhoto
                                ? `<img src="${r.reviewerProfilePhoto}" alt="${this.esc(r.reviewer)}" loading="lazy">`
                                : initials(r.reviewer)
                            }
                        </div>
                        <div>
                            <div class="reviewer-name">${this.esc(r.reviewer)}</div>
                            <div class="star-row">${starHTML(r.starRating)}</div>
                        </div>
                    </div>
                    <span class="review-date">${fmt(r.createTime)}</span>
                </div>
                <div class="review-comment${r.comment ? '' : ' no-comment'}">
                    ${r.comment ? this.esc(r.comment) : 'No written comment.'}
                </div>
                ${r.hasReply ? `
                    <div class="reply-box">
                        <div class="reply-box-head">
                            <div class="reply-label">Owner Response</div>
                            <div style="display:flex;gap:6px;">
                                <button class="btn btn-ghost btn-sm reply-edit-btn"
                                    data-review-name="${this.esc(r.reviewName)}"
                                    data-reviewer="${this.esc(r.reviewer)}">
                                    <i data-lucide="pencil"></i> Edit
                                </button>
                                <button class="btn btn-ghost btn-sm reply-delete-btn"
                                    data-review-name="${this.esc(r.reviewName)}"
                                    data-reviewer="${this.esc(r.reviewer)}">
                                    <i data-lucide="trash-2"></i> Delete
                                </button>
                            </div>
                        </div>
                        <div class="reply-text">${this.esc(r.replyComment)}</div>
                    </div>
                ` : `
                    <button class="btn btn-ghost btn-sm reply-new-btn" style="margin-top:4px;"
                        data-review-name="${this.esc(r.reviewName)}"
                        data-reviewer="${this.esc(r.reviewer)}">
                        <i data-lucide="reply"></i> Reply
                    </button>
                `}
            </div>
        `).join('') + (this.state.nextPageTokens.reviews ? `
            <div style="display: flex; justify-content: center; margin-top: 24px;">
                <button class="btn btn-ghost" onclick="app.fetchReviews('${this.state.nextPageTokens.reviews}')">Load More Reviews</button>
            </div>
        ` : '');

        // Wire reply buttons via delegation — avoids all inline-onclick escaping issues
        list.querySelectorAll('.reply-new-btn').forEach(btn => {
            btn.addEventListener('click', () =>
                this.openReplyModal(btn.dataset.reviewName, btn.dataset.reviewer, false)
            );
        });
        list.querySelectorAll('.reply-edit-btn').forEach(btn => {
            btn.addEventListener('click', () =>
                this.openReplyModal(btn.dataset.reviewName, btn.dataset.reviewer, true)
            );
        });
        list.querySelectorAll('.reply-delete-btn').forEach(btn => {
            btn.addEventListener('click', () =>
                this.confirmDeleteReply(btn.dataset.reviewName, btn.dataset.reviewer)
            );
        });

        lucide.createIcons();
    },

    openReplyModal(reviewName, reviewer, isEdit = false) {
        // Look up existing reply text from state — no need to pass it through HTML attributes
        const existing = isEdit
            ? (this.state.reviews.find(r => r.reviewName === reviewName)?.replyComment || '')
            : '';

        $('modal-title').textContent = isEdit ? `Edit Response — ${reviewer}` : `Reply to ${reviewer}`;
        $('modal-body').innerHTML = `
            <div class="form-group">
                <label class="form-label">Your response</label>
                <textarea class="form-control" id="reply-text"
                    placeholder="Write a professional, friendly response…"
                    rows="5">${this.esc(existing)}</textarea>
            </div>
            <div class="modal-footer" style="padding:0;">
                <button class="btn btn-ghost" id="modal-cancel-btn">Cancel</button>
                <button class="btn btn-primary" id="modal-submit-btn">
                    <i data-lucide="${isEdit ? 'save' : 'send'}"></i>
                    ${isEdit ? 'Update Reply' : 'Post Reply'}
                </button>
            </div>
        `;
        this.openModal();

        $('modal-cancel-btn').addEventListener('click', () => this.closeModal());
        $('modal-submit-btn').addEventListener('click', () => this.submitReply(reviewName, isEdit));
    },

    async submitReply(reviewName, isEdit = false) {
        const comment = $('reply-text')?.value?.trim();
        if (!comment) { this.toast('Please write a reply first.', 'error'); return; }

        this.toast(isEdit ? 'Updating reply…' : 'Posting reply…', 'info');
        try {
            const res = await fetch('/api/gbp/replyToReview', {
                method: 'POST',
                headers: this.apiHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ reviewName, replyText: comment }),
            });
            const data = await res.json();
            if (data.success) {
                this.toast(isEdit ? 'Reply updated!' : 'Reply posted!', 'success');
                this.closeModal();
                this.state.dataLoaded.reviews = false;
                this.fetchReviews();
            } else {
                this.toast(data.message || (isEdit ? 'Failed to update reply.' : 'Failed to post reply.'), 'error');
            }
        } catch {
            this.toast('Network error. Try again.', 'error');
        }
    },

    confirmDeleteReply(reviewName, reviewer) {
        $('modal-title').textContent = 'Delete Your Response?';
        $('modal-body').innerHTML = `
            <p style="font-size:14px;color:var(--text-muted);line-height:1.6;margin-bottom:20px;">
                You are about to delete your response to <strong>${this.esc(reviewer)}</strong>.
                This cannot be undone — the response will be permanently removed from Google.
            </p>
            <div class="modal-footer" style="padding:0;">
                <button class="btn btn-ghost" id="modal-cancel-btn">Keep it</button>
                <button class="btn btn-danger" id="modal-delete-btn">
                    <i data-lucide="trash-2"></i> Yes, Delete Response
                </button>
            </div>
        `;
        this.openModal();
        $('modal-cancel-btn').addEventListener('click', () => this.closeModal());
        $('modal-delete-btn').addEventListener('click', () => this.deleteReviewReply(reviewName));
    },

    async deleteReviewReply(reviewName) {
        this.toast('Deleting response…', 'info');
        this.closeModal();
        try {
            const res = await fetch('/api/gbp/deleteReviewReply', {
                method: 'DELETE',
                headers: this.apiHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ reviewName }),
            });
            const data = await res.json();
            if (data.success) {
                this.toast('Response deleted.', 'success');
                this.state.dataLoaded.reviews = false;
                this.fetchReviews();
            } else {
                this.toast(data.message || 'Failed to delete response.', 'error');
            }
        } catch {
            this.toast('Network error. Try again.', 'error');
        }
    },

    // ── Posts ─────────────────────────────────────────────
    async fetchPosts(pageToken = null) {
        const grid = $('posts-grid');
        if (!pageToken) grid.innerHTML = this.loadingCards(6, 260);
        try {
            const url = pageToken ? `/api/gbp/getPosts?pageToken=${pageToken}` : '/api/gbp/getPosts';
            const data = await this.apiFetch(url);
            if (data.success) {
                if (pageToken) {
                    this.state.posts = [...this.state.posts, ...data.posts];
                } else {
                    this.state.posts = data.posts;
                }
                this.state.nextPageTokens.posts = data.nextPageToken || null;
                this.state.dataLoaded.posts = true;
                this.renderPosts();
            } else {
                if (!pageToken) grid.innerHTML = this.emptyState('file-text', 'No posts found', data.message || '');
            }
        } catch (err) {
            if (!pageToken) grid.innerHTML = this.emptyState('wifi-off', 'Connection error', 'Check your server connection.');
        }
    },

    renderPosts() {
        const grid = $('posts-grid');
        const count = $('posts-count');
        const posts = this.state.posts;
        if (count) count.innerHTML = `<strong>${posts.length}</strong> post${posts.length !== 1 ? 's' : ''}`;

        if (!posts.length) {
            grid.innerHTML = this.emptyState('file-text', 'No posts yet', 'Create your first Google Business post.');
            return;
        }
        grid.innerHTML = posts.map(p => {
            const stateClass = p.state === 'LIVE' ? 'badge-live' : p.state === 'REJECTED' ? 'badge-rejected' : 'badge-pending';
            return `
                <div class="post-card">
                    ${p.media?.length ? `
                        <div class="post-img">
                            <img src="${p.media[0].googleUrl}" alt="Post image" loading="lazy">
                        </div>` : ''
                    }
                    <div class="post-body">
                        <div class="post-text">${this.esc(p.summary || 'No summary.')}</div>
                        <div class="post-footer">
                            <span class="badge ${stateClass}">${p.state}</span>
                            <div style="display:flex; gap:8px; align-items:center;">
                                <span class="post-date">${fmt(p.createTime)}</span>
                                <button class="icon-btn text-danger post-delete-btn" data-post-name="${this.esc(p.name)}" title="Delete Post">
                                    <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('') + (this.state.nextPageTokens.posts ? `
            <div style="grid-column: 1 / -1; display: flex; justify-content: center; margin-top: 24px;">
                <button class="btn btn-ghost" onclick="app.fetchPosts('${this.state.nextPageTokens.posts}')">Load More Posts</button>
            </div>
        ` : '');

        grid.querySelectorAll('.post-delete-btn').forEach(btn => {
            btn.addEventListener('click', () => this.confirmDeletePost(btn.dataset.postName));
        });

        lucide.createIcons();
    },

    confirmDeletePost(postName) {
        $('modal-title').textContent = 'Delete Post?';
        $('modal-body').innerHTML = `
            <p style="font-size:14px;color:var(--text-muted);line-height:1.6;margin-bottom:20px;">
                Are you sure you want to delete this post? This action cannot be undone.
            </p>
            <div class="modal-footer" style="padding:0;">
                <button class="btn btn-ghost" id="modal-cancel-btn">Cancel</button>
                <button class="btn btn-danger" id="modal-delete-btn">
                    <i data-lucide="trash-2"></i> Yes, Delete Post
                </button>
            </div>
        `;
        this.openModal();
        $('modal-cancel-btn').addEventListener('click', () => this.closeModal());
        $('modal-delete-btn').addEventListener('click', () => this.submitDeletePost(postName));
    },

    async submitDeletePost(postName) {
        this.toast('Deleting post…', 'info');
        this.closeModal();
        try {
            const res = await fetch('/api/gbp/deletePost', {
                method: 'POST',
                headers: this.apiHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ postName }),
            });
            const data = await res.json();
            if (data.success) {
                this.toast('Post deleted.', 'success');
                this.state.dataLoaded.posts = false;
                this.fetchPosts();
            } else {
                this.toast(data.message || 'Failed to delete post.', 'error');
            }
        } catch {
            this.toast('Network error. Try again.', 'error');
        }
    },

    openNewPostModal() {
        $('modal-title').textContent = 'Create New Post';
        $('modal-body').innerHTML = `
            <div class="form-group">
                <label class="form-label">Post Type</label>
                <select class="form-control" id="post-type" onchange="app.togglePostTypeFields(this.value)">
                    <option value="STANDARD">Standard (What's New)</option>
                    <option value="OFFER">Offer</option>
                    <option value="EVENT">Event</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Post Text <span style="color:var(--danger)">*</span></label>
                <textarea class="form-control" id="post-summary" placeholder="Share news, offers, or updates about Eritage ENT Care…" rows="4"></textarea>
            </div>

            <!-- Type Specific Fields -->
            <div id="offer-fields" style="display:none; flex-direction:column; gap:16px; margin-top:16px;">
                <div class="form-group">
                    <label class="form-label">Coupon Code (Optional)</label>
                    <input type="text" id="offer-code" class="form-control">
                </div>
                <div class="form-group">
                    <label class="form-label">Redemption Link (Optional)</label>
                    <input type="url" id="offer-link" class="form-control">
                </div>
                <div class="form-group">
                    <label class="form-label">Terms and Conditions (Optional)</label>
                    <textarea id="offer-terms" class="form-control" rows="2"></textarea>
                </div>
            </div>

            <div id="event-fields" style="display:none; flex-direction:column; gap:16px; margin-top:16px;">
                <div class="form-group">
                    <label class="form-label">Event Title</label>
                    <input type="text" id="event-title" class="form-control">
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <div class="form-group">
                        <label class="form-label">Start Date</label>
                        <input type="date" id="event-start-date" class="form-control">
                    </div>
                    <div class="form-group">
                        <label class="form-label">End Date</label>
                        <input type="date" id="event-end-date" class="form-control">
                    </div>
                </div>
            </div>

            <div class="form-group" style="margin-top:16px;">
                <label class="form-label">Call To Action (optional)</label>
                <select class="form-control" id="post-cta-type">
                    <option value="">None</option>
                    <option value="CALL">Call Now</option>
                    <option value="BOOK">Book Appointment</option>
                    <option value="LEARN_MORE">Learn More</option>
                    <option value="SIGN_UP">Sign Up</option>
                    <option value="ORDER">Order Online</option>
                </select>
            </div>
            <div class="form-group" id="cta-url-group" style="display:none;">
                <label class="form-label">CTA URL</label>
                <input class="form-control" id="post-cta-url" type="url" placeholder="https://...">
            </div>
            <div class="modal-footer" style="padding:24px 0 0 0;">
                <button class="btn btn-ghost" onclick="app.closeModal()">Cancel</button>
                <button class="btn btn-primary" onclick="app.submitNewPost()">
                    <i data-lucide="send"></i> Publish Post
                </button>
            </div>
        `;
        this.openModal();
        lucide.createIcons();

        $('post-cta-type').addEventListener('change', e => {
            $('cta-url-group').style.display = e.target.value ? 'block' : 'none';
        });
    },

    togglePostTypeFields(type) {
        $('offer-fields').style.display = type === 'OFFER' ? 'flex' : 'none';
        $('event-fields').style.display = type === 'EVENT' ? 'flex' : 'none';
    },

    async submitNewPost() {
        const type = $('post-type').value;
        const summary = $('post-summary')?.value?.trim();
        if (!summary) { this.toast('Post text is required.', 'error'); return; }

        const ctaType = $('post-cta-type')?.value;
        const ctaUrl  = $('post-cta-url')?.value?.trim();

        const body = { 
            languageCode: 'en',
            summary: summary,
            topicType: type
        };

        if (ctaType) body.callToAction = { actionType: ctaType, url: ctaUrl || undefined };

        if (type === 'OFFER') {
            body.offer = {
                couponCode: $('offer-code').value,
                redemptionLink: $('offer-link').value,
                termsAndConditions: $('offer-terms').value
            };
        }

        if (type === 'EVENT') {
            const startDate = $('event-start-date').value;
            const endDate = $('event-end-date').value;
            body.event = {
                title: $('event-title').value,
                schedule: {
                    startDate: startDate ? { year: parseInt(startDate.split('-')[0]), month: parseInt(startDate.split('-')[1]), day: parseInt(startDate.split('-')[2]) } : null,
                    endDate: endDate ? { year: parseInt(endDate.split('-')[0]), month: parseInt(endDate.split('-')[1]), day: parseInt(endDate.split('-')[2]) } : null
                }
            };
        }

        this.toast('Publishing post…', 'info');
        try {
            const res = await fetch('/api/gbp/createPost', {
                method: 'POST',
                headers: this.apiHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (data.success) {
                this.toast('Post published!', 'success');
                this.closeModal();
                this.state.dataLoaded.posts = false;
                this.fetchPosts();
            } else {
                this.toast(data.message || 'Failed to publish post.', 'error');
            }
        } catch {
            this.toast('Network error. Try again.', 'error');
        }
    },

    // ── Q&A ───────────────────────────────────────────────
    async fetchQA() {
        const list = $('qa-list');
        list.innerHTML = this.loadingCards(3, 80);
        try {
            const data = await this.apiFetch('/api/gbp/fetchQuestions');
            if (data.success) {
                this.state.qa = data.questions;
                this.state.dataLoaded.qa = true;
                this.renderQA();
            } else {
                list.innerHTML = this.emptyState('message-circle', 'No questions found', data.message || '');
            }
        } catch {
            list.innerHTML = this.emptyState('wifi-off', 'Connection error', 'Check your server connection.');
        }
    },

    renderQA() {
        const list = $('qa-list');
        const count = $('qa-count');
        const questions = this.state.qa;
        if (count) count.innerHTML = `<strong>${questions.length}</strong> question${questions.length !== 1 ? 's' : ''}`;

        if (!questions.length) {
            list.innerHTML = this.emptyState('message-circle', 'No questions yet', 'Customer questions will appear here.');
            return;
        }
        list.innerHTML = questions.map(q => `
            <div class="qa-card">
                <div class="qa-question">
                    <div class="qa-q-icon">Q</div>
                    <div class="qa-q-text">${this.esc(q.text || q.question || 'Question')}</div>
                </div>
                ${q.topAnswers?.length || q.answer ? `
                <div class="qa-answer">
                    <div class="qa-a-icon">A</div>
                    <div class="qa-a-text">${this.esc(q.topAnswers?.[0]?.text || q.answer || '')}</div>
                </div>` : `
                <div style="margin-top:4px;">
                    <button class="btn btn-ghost btn-sm"
                        onclick="app.openAnswerModal('${this.esc(q.name)}')">
                        <i data-lucide="reply"></i> Answer
                    </button>
                </div>`}
            </div>
        `).join('');
        lucide.createIcons();
    },

    openAnswerModal(questionName) {
        $('modal-title').textContent = 'Answer Question';
        $('modal-body').innerHTML = `
            <div class="form-group">
                <label class="form-label">Your answer</label>
                <textarea class="form-control" id="answer-text" placeholder="Write a helpful, clear answer…" rows="5"></textarea>
            </div>
            <div class="modal-footer" style="padding:0;">
                <button class="btn btn-ghost" onclick="app.closeModal()">Cancel</button>
                <button class="btn btn-primary" onclick="app.submitAnswer('${this.esc(questionName)}')">
                    <i data-lucide="send"></i> Post Answer
                </button>
            </div>
        `;
        this.openModal();
        lucide.createIcons();
    },

    async submitAnswer(questionName) {
        const text = $('answer-text')?.value?.trim();
        if (!text) { this.toast('Please write an answer first.', 'error'); return; }

        this.toast('Posting answer…', 'info');
        try {
            const res = await fetch('/api/gbp/replyToQuestion', {
                method: 'POST',
                headers: this.apiHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ questionName, answerText: text }),
            });
            const data = await res.json();
            if (data.success) {
                this.toast('Answer posted!', 'success');
                this.closeModal();
                this.state.dataLoaded.qa = false;
                this.fetchQA();
            } else {
                this.toast(data.message || 'Failed to post answer.', 'error');
            }
        } catch {
            this.toast('Network error. Try again.', 'error');
        }
    },

    // ── Services ──────────────────────────────────────────
    async fetchServices() {
        const grid = $('services-grid');
        grid.innerHTML = this.loadingCards(6, 70, true);
        try {
            const data = await this.apiFetch('/api/gbp/getServiceList');
            if (data.success) {
                this.state.services = data.services;
                this.state.dataLoaded.services = true;
                this.renderServices();
            } else {
                grid.innerHTML = this.emptyState('stethoscope', 'No services found', data.message || '');
            }
        } catch {
            grid.innerHTML = this.emptyState('wifi-off', 'Connection error', '');
        }
    },

    renderServices() {
        const grid = $('services-grid');
        const count = $('services-count');
        const services = this.state.services;
        if (count) count.innerHTML = `<strong>${services.length}</strong> service${services.length !== 1 ? 's' : ''}`;

        if (!services.length) {
            grid.innerHTML = this.emptyState('stethoscope', 'No services listed', 'Add services to your GBP listing.');
            return;
        }
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; margin-bottom: 8px;">
                <button class="btn btn-primary btn-sm" onclick="app.openServiceModal()">
                    <i data-lucide="plus"></i> Add New Service
                </button>
            </div>
        ` + services.map((s, idx) => `
            <div class="service-card">
                <div class="service-icon"><i data-lucide="activity"></i></div>
                <div style="flex:1;">
                    <div class="service-name">${this.esc(s.displayName)}</div>
                    <div class="service-desc">${this.esc(s.description || 'Professional medical service.')}</div>
                </div>
                <div style="display:flex; gap:6px;">
                    <button class="icon-btn" onclick="app.openServiceModal(${idx})"><i data-lucide="pencil" style="width:14px;height:14px;"></i></button>
                    <button class="icon-btn text-danger" onclick="app.deleteService(${idx})"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button>
                </div>
            </div>
        `).join('');
        lucide.createIcons();
    },

    openServiceModal(idx = null) {
        const s = idx !== null ? this.state.services[idx] : { displayName: '', description: '' };
        $('modal-title').textContent = idx !== null ? 'Edit Service' : 'Add New Service';
        $('modal-body').innerHTML = `
            <div class="form-group">
                <label class="form-label">Service Name</label>
                <input class="form-control" id="service-name" type="text" value="${this.esc(s.displayName)}" placeholder="e.g. Tonsillectomy">
            </div>
            <div class="form-group">
                <label class="form-label">Description</label>
                <textarea class="form-control" id="service-description" rows="3" placeholder="Describe the service…">${this.esc(s.description || '')}</textarea>
            </div>
            <div class="modal-footer" style="padding:24px 0 0 0;">
                <button class="btn btn-ghost" onclick="app.closeModal()">Cancel</button>
                <button class="btn btn-primary" onclick="app.submitServiceUpdate(${idx})">
                    ${idx !== null ? 'Save Changes' : 'Add Service'}
                </button>
            </div>
        `;
        this.openModal();
    },

    async submitServiceUpdate(idx) {
        const name = $('service-name').value.trim();
        const desc = $('service-description').value.trim();
        if (!name) { this.toast('Service name is required.', 'error'); return; }

        let newServices = [...this.state.services];
        if (idx !== null) {
            newServices[idx] = { ...newServices[idx], displayName: name, description: desc };
        } else {
            newServices.push({ displayName: name, description: desc });
        }

        this.toast(idx !== null ? 'Updating service…' : 'Adding service…', 'info');
        try {
            const res = await fetch('/api/gbp/updateServiceList', {
                method: 'PATCH',
                headers: this.apiHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ serviceListData: { serviceItems: newServices } })
            });
            const data = await res.json();
            if (data.success) {
                this.toast(idx !== null ? 'Service updated!' : 'Service added!', 'success');
                this.closeModal();
                this.state.dataLoaded.services = false;
                this.fetchServices();
            } else {
                this.toast(data.message || 'Failed to update services.', 'error');
            }
        } catch {
            this.toast('Network error.', 'error');
        }
    },

    async deleteService(idx) {
        if (!confirm(`Delete "${this.state.services[idx].displayName}"?`)) return;

        let newServices = [...this.state.services];
        newServices.splice(idx, 1);

        this.toast('Deleting service…', 'info');
        try {
            const res = await fetch('/api/gbp/updateServiceList', {
                method: 'PATCH',
                headers: this.apiHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ serviceListData: { serviceItems: newServices } })
            });
            const data = await res.json();
            if (data.success) {
                this.toast('Service deleted.', 'success');
                this.state.dataLoaded.services = false;
                this.fetchServices();
            } else {
                this.toast(data.message || 'Failed to delete service.', 'error');
            }
        } catch {
            this.toast('Network error.', 'error');
        }
    },

    // ── Media ─────────────────────────────────────────────
    async fetchMedia(pageToken = null) {
        const grid = $('media-grid');
        if (!pageToken) grid.innerHTML = this.loadingCards(8, 200, true, 'aspect-ratio:1;');
        try {
            const url = pageToken ? `/api/gbp/listMedia?pageToken=${pageToken}` : '/api/gbp/listMedia';
            const data = await this.apiFetch(url);
            if (data.success) {
                if (pageToken) {
                    this.state.media = [...this.state.media, ...data.media];
                } else {
                    this.state.media = data.media;
                }
                this.state.nextPageTokens.media = data.nextPageToken || null;
                this.state.dataLoaded.media = true;
                this.renderMedia();
            } else {
                if (!pageToken) grid.innerHTML = this.emptyState('image', 'No media found', data.message || '');
            }
        } catch (err) {
            if (!pageToken) grid.innerHTML = this.emptyState('wifi-off', 'Connection error', '');
        }
    },

    renderMedia() {
        const grid = $('media-grid');
        const count = $('media-count');
        const media = this.state.media;
        if (count) count.innerHTML = `<strong>${media.length}</strong> photo${media.length !== 1 ? 's' : ''}`;

        if (!media.length) {
            grid.innerHTML = this.emptyState('image', 'No photos yet', 'Upload photos to showcase your clinic.');
            return;
        }
        grid.innerHTML = media.map(m => `
            <div class="media-item">
                ${m.type === 'VIDEO' ? `
                    <div style="width: 100%; height: 100%; background: #000; display: flex; align-items: center; justify-content: center; color: white;">
                        <i data-lucide="play-circle" style="width: 48px; height: 48px; opacity: 0.7;"></i>
                    </div>
                ` : `<img src="${m.googleUrl}" alt="Media" loading="lazy">`}
                <div class="media-overlay">
                    <button class="media-delete-btn" data-media-id="${this.esc(m.mediaId)}" title="Delete photo">
                        <i data-lucide="trash-2"></i>
                    </button>
                    <span class="media-date">${fmt(m.createTime)}</span>
                </div>
            </div>
        `).join('') + (this.state.nextPageTokens.media ? `
            <div style="grid-column: 1 / -1; display: flex; justify-content: center; margin-top: 24px;">
                <button class="btn btn-ghost" onclick="app.fetchMedia('${this.state.nextPageTokens.media}')">Load More Media</button>
            </div>
        ` : '');

        // Wire delete buttons
        grid.querySelectorAll('.media-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.confirmDeleteMedia(btn.dataset.mediaId);
            });
        });

        lucide.createIcons();
    },

    confirmDeleteMedia(mediaId) {
        $('modal-title').textContent = 'Delete Photo?';
        $('modal-body').innerHTML = `
            <p style="font-size:14px;color:var(--text-muted);line-height:1.6;margin-bottom:20px;">
                This photo will be permanently removed from your Google Business Profile.
                This action cannot be undone.
            </p>
            <div class="modal-footer" style="padding:0;">
                <button class="btn btn-ghost" id="modal-cancel-btn">Keep it</button>
                <button class="btn btn-danger" id="modal-delete-btn">
                    <i data-lucide="trash-2"></i> Yes, Delete Photo
                </button>
            </div>
        `;
        this.openModal();
        $('modal-cancel-btn').addEventListener('click', () => this.closeModal());
        $('modal-delete-btn').addEventListener('click', () => this.deleteMedia(mediaId));
    },

    async deleteMedia(mediaId) {
        this.toast('Deleting photo…', 'info');
        this.closeModal();
        try {
            const res = await fetch('/api/gbp/deleteMedia', {
                method: 'DELETE',
                headers: this.apiHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ mediaId }),
            });
            const data = await res.json();
            if (data.success) {
                this.toast('Photo deleted.', 'success');
                this.state.dataLoaded.media = false;
                this.fetchMedia();
            } else {
                this.toast(data.message || 'Failed to delete photo.', 'error');
            }
        } catch {
            this.toast('Network error. Try again.', 'error');
        }
    },

    openUploadMediaModal() {
        $('modal-title').textContent = 'Upload Media';
        $('modal-body').innerHTML = `
            <div class="form-group">
                <label class="form-label">Media Type</label>
                <select id="upload-type" class="form-control">
                    <option value="PHOTO">Photo</option>
                    <option value="VIDEO">Video</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Source URL <span style="color:var(--danger)">*</span></label>
                <input class="form-control" id="media-url" type="url" placeholder="https://example.com/photo.jpg">
                <p style="font-size:12px;color:var(--text-muted);margin-top:6px;">
                    The file must be publicly accessible via a direct URL.
                </p>
            </div>
            <div class="form-group">
                <label class="form-label">Category</label>
                <select class="form-control" id="media-category">
                    <option value="ADDITIONAL">Additional / General</option>
                    <option value="EXTERIOR">Exterior</option>
                    <option value="INTERIOR">Interior</option>
                    <option value="TEAMS">Teams</option>
                    <option value="AT_WORK">At Work</option>
                </select>
            </div>
            <div class="modal-footer" style="padding:24px 0 0 0;">
                <button class="btn btn-ghost" onclick="app.closeModal()">Cancel</button>
                <button class="btn btn-primary" onclick="app.submitMedia()">
                    <i data-lucide="upload"></i> Upload
                </button>
            </div>
        `;
        this.openModal();
        lucide.createIcons();
    },

    async submitMedia() {
        const url      = $('media-url')?.value?.trim();
        const category = $('media-category')?.value;
        const type     = $('upload-type').value;
        if (!url) { this.toast('Media URL is required.', 'error'); return; }

        this.toast('Uploading media…', 'info');
        try {
            const res = await fetch('/api/gbp/uploadMedia', {
                method: 'POST',
                headers: this.apiHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ sourceUrl: url, mediaFormat: type, locationAssociation: { category } }),
            });
            const data = await res.json();
            if (data.success) {
                this.toast('Media uploaded!', 'success');
                this.closeModal();
                this.state.dataLoaded.media = false;
                this.fetchMedia();
            } else {
                this.toast(data.message || 'Upload failed.', 'error');
            }
        } catch {
            this.toast('Network error. Try again.', 'error');
        }
    },

    // ── Sidebar (mobile) ──────────────────────────────────
    toggleSidebar() {
        const sidebar  = document.querySelector('.sidebar');
        const overlay  = $('sidebar-overlay');
        const isOpen   = sidebar.classList.contains('open');
        sidebar.classList.toggle('open', !isOpen);
        overlay.classList.toggle('open', !isOpen);
    },
    closeSidebar() {
        document.querySelector('.sidebar').classList.remove('open');
        $('sidebar-overlay').classList.remove('open');
    },

    // ── Modal helpers ─────────────────────────────────────
    openModal() {
        $('modal-backdrop').classList.remove('hidden');
        lucide.createIcons();
    },
    closeModal() {
        $('modal-backdrop').classList.add('hidden');
    },

    // ── Toast ─────────────────────────────────────────────
    toast(msg, type = 'info') {
        const icons = { info: 'info', success: 'check-circle', error: 'alert-circle' };
        const t = document.createElement('div');
        t.className = `toast ${type}`;
        t.innerHTML = `<i data-lucide="${icons[type] || 'info'}"></i><span>${this.esc(msg)}</span>`;
        $('toast-container').appendChild(t);
        lucide.createIcons(t);
        setTimeout(() => {
            t.style.animation = 'none';
            t.style.opacity = '0';
            t.style.transform = 'translateX(20px)';
            t.style.transition = 'all 0.3s';
            setTimeout(() => t.remove(), 300);
        }, 3500);
    },

    // ── Helpers ───────────────────────────────────────────
    esc(str) {
        return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    },

    emptyState(icon, title, desc) {
        return `
            <div class="empty-state">
                <div class="empty-icon"><i data-lucide="${icon}"></i></div>
                <div class="empty-title">${title}</div>
                <div class="empty-desc">${desc}</div>
            </div>
        `;
    },

    loadingCards(n, h, grid = false, extra = '') {
        const card = `<div class="skeleton" style="height:${h}px;border-radius:12px;${extra}"></div>`;
        if (grid) return `<div style="display:contents">${Array(n).fill(card).join('')}</div>`;
        return `<div style="display:flex;flex-direction:column;gap:12px;">${Array(n).fill(card).join('')}</div>`;
    },
};

window.app = app;
document.addEventListener('DOMContentLoaded', () => app.init());
