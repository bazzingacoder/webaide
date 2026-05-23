document.addEventListener('DOMContentLoaded', async () => {
    
    //================================================================
    // ELEMENT SELECTORS
    //================================================================
    const themeToggleBtn = document.getElementById('theme-toggle');
    const htmlEl = document.documentElement;
    const skeletonLoader = document.getElementById('skeleton-loader');
    const resourcesContainer = document.getElementById('resources');
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search-btn');
    const suggestionsList = document.getElementById('suggestions-list');
    const announcer = document.getElementById('search-results-announcer');
    const backToTopButton = document.getElementById('back-to-top');
    const filterContainer = document.getElementById('filter-container');
    const searchControls = document.getElementById('search-and-filter-controls');
    const modalOverlay = document.getElementById('feedback-modal-overlay');
    const modalWindow = document.getElementById('feedback-modal');
    const openModalBtn = document.getElementById('open-feedback-modal-btn');
    const closeModalBtn = document.getElementById('close-feedback-modal-btn');
    const submissionTypeRadios = document.querySelectorAll('input[name="submission-type"]');
    const feedbackFields = document.getElementById('feedback-fields');
    const resourceFields = document.getElementById('resource-fields');
    const resourceCategorySelect = document.getElementById('resource-category');
    const noResultsMessage = document.getElementById('no-results-message');
    
    const viewToggleBtn = document.getElementById('view-toggle');
    
    //================================================================
    // STATE VARIABLES
    //================================================================
    let allResourceData = [];
    let elementToFocusOnClose = null;
    let favoriteResources = new Set();
    const activeFilters = {
        categories: new Set(),
        showFavorites: false
    };
    let activeSuggestionIndex = -1;
    let lastScrollY = window.scrollY;
    let activeViewMode = localStorage.getItem('webaide_view_mode') || 'grid';
 
    //================================================================
    // TOAST NOTIFICATIONS
    //================================================================
    function showToast(message, type = 'success') {
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) return;

        const toast = document.createElement('div');
        toast.className = `toast-msg ${type}`;
        
        let iconSVG = '';
        if (type === 'success') {
            iconSVG = `<svg class="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
        } else {
            iconSVG = `<svg class="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
        }

        toast.innerHTML = `${iconSVG}<span>${message}</span>`;
        toastContainer.appendChild(toast);

        // Screen reader announcer notification
        announcer.textContent = message;

        // Animate slide out and remove toast
        setTimeout(() => {
            toast.style.animation = 'slideInToast 300ms cubic-bezier(0.16, 1, 0.3, 1) reverse forwards';
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 3000);
    }

    //================================================================
    // VIEW SWITCHER MANAGEMENT
    //================================================================
    function initializeViewMode() {
        // Synchronize initial UI state
        viewToggleBtn.classList.toggle('view-mode-list', activeViewMode === 'list');
        viewToggleBtn.setAttribute('aria-label', activeViewMode === 'grid' ? 'Switch to List View' : 'Switch to Grid View');
        
        viewToggleBtn.addEventListener('click', toggleViewMode);
    }

    function toggleViewMode() {
        const nextMode = activeViewMode === 'grid' ? 'list' : 'grid';
        setViewMode(nextMode);
    }

    function setViewMode(mode) {
        activeViewMode = mode;
        localStorage.setItem('webaide_view_mode', mode);

        // Update button visual class & aria
        viewToggleBtn.classList.toggle('view-mode-list', mode === 'list');
        viewToggleBtn.setAttribute('aria-label', mode === 'grid' ? 'Switch to List View' : 'Switch to Grid View');

        // Apply grid/list layout styles
        document.querySelectorAll('#resources .grid').forEach(grid => {
            if (mode === 'list') {
                grid.className = 'grid resources-list-layout';
            } else {
                grid.className = 'grid grid-cols-responsive';
            }
        });
        
        filterAndSearch();
        showToast(`Layout switched to ${mode} mode.`);
    }

    //================================================================
    // FAVORITES MANAGEMENT
    //================================================================
    function loadFavorites() {
        const storedFavorites = localStorage.getItem('webaide_favorites');
        if (storedFavorites) {
            favoriteResources = new Set(JSON.parse(storedFavorites));
        }
    }

    function saveFavorites() {
        localStorage.setItem('webaide_favorites', JSON.stringify([...favoriteResources]));
    }
    
    function toggleFavorite(resourceURL, button) {
        const resourceTitle = button.dataset.title;
        if (favoriteResources.has(resourceURL)) {
            favoriteResources.delete(resourceURL);
            button.classList.remove('active');
            button.setAttribute('aria-pressed', 'false');
            button.setAttribute('aria-label', `Add ${resourceTitle} to favorites`);
            showToast(`${resourceTitle} removed from favorites.`, 'success');
        } else {
            favoriteResources.add(resourceURL);
            button.classList.add('active');
            button.setAttribute('aria-pressed', 'true');
            button.setAttribute('aria-label', `Remove ${resourceTitle} from favorites`);
            showToast(`${resourceTitle} added to favorites!`, 'success');
        }
        saveFavorites();
        updateFavoritesButton();
    }

    //================================================================
    // THEME MANAGEMENT
    //================================================================
    function applyTheme(theme) {
        if (theme === 'dark') {
            htmlEl.classList.add('dark');
            themeToggleBtn.setAttribute('aria-label', 'Activate light mode');
            localStorage.setItem('theme', 'dark');
        } else {
            htmlEl.classList.remove('dark');
            themeToggleBtn.setAttribute('aria-label', 'Activate dark mode');
            localStorage.setItem('theme', 'light');
        }
    }

    function toggleTheme() {
        const currentTheme = htmlEl.classList.contains('dark') ? 'dark' : 'light';
        const targetTheme = currentTheme === 'dark' ? 'light' : 'dark';
        applyTheme(targetTheme);
        showToast(`Theme switched to ${targetTheme} mode.`, 'success');
    }
    
    function initializeTheme() {
        const isDark = htmlEl.classList.contains('dark');
        themeToggleBtn.setAttribute('aria-label', isDark ? 'Activate light mode' : 'Activate dark mode');
        themeToggleBtn.addEventListener('click', toggleTheme);
    }

    //================================================================
    // DATA FETCHING
    //================================================================
    async function fetchResources() {
        try {
            const response = await fetch('resources.json');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            allResourceData = await response.json();
            skeletonLoader.classList.add('hidden');
        } catch (error) {
            console.error("Could not fetch resources:", error);
            skeletonLoader.classList.add('hidden');
            resourcesContainer.innerHTML = `<p class="text-center text-red-500 font-bold">Could not load resources. Please try again later.</p>`;
            showToast("Failed to fetch resource registry database.", "error");
        }
    }

    //================================================================
    // URL STATE MANAGEMENT
    //================================================================
    function updateURL() {
        const params = new URLSearchParams();
        const searchTerm = searchInput.value.trim();

        if (searchTerm) params.set('search', searchTerm);
        if (activeFilters.categories.size > 0) params.set('categories', [...activeFilters.categories].join(','));
        if (activeFilters.showFavorites) params.set('favorites', 'true');

        const queryString = params.toString();
        const newUrl = queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname;
        history.pushState({ path: newUrl }, '', newUrl);
    }

    function applyStateFromURL() {
        const params = new URLSearchParams(window.location.search);
        const searchTerm = params.get('search');
        const categoriesParam = params.get('categories');
        const favoritesParam = params.get('favorites');

        if (searchTerm) {
            searchInput.value = searchTerm;
            clearSearchBtn.classList.remove('hidden');
        }
        if (favoritesParam === 'true') {
            activeFilters.showFavorites = true;
        }

        if (categoriesParam) {
            const categories = categoriesParam.split(',');
            categories.forEach(cat => activeFilters.categories.add(cat));
        }
        updateActiveFilterButtons();
    }
            
    //================================================================
    // MODAL HANDLING
    //================================================================
    function setupModal() {
        const allCategories = [...new Set(allResourceData.map(item => item.Category))];
        allCategories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            resourceCategorySelect.appendChild(option);
        });

        openModalBtn.addEventListener('click', () => showModal());
        closeModalBtn.addEventListener('click', hideModal);
        modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) hideModal(); });
        modalOverlay.addEventListener('keydown', handleModalTrapFocus);
        
        submissionTypeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                const selectedValue = e.target.value;
                const feedbackTextarea = feedbackFields.querySelector('textarea');
                
                feedbackFields.classList.toggle('hidden', selectedValue !== 'feedback');
                resourceFields.classList.toggle('hidden', selectedValue !== 'resource');

                feedbackTextarea.required = selectedValue === 'feedback';
                resourceFields.querySelectorAll('input[required], select[required]').forEach(input => {
                    input.required = selectedValue === 'resource';
                });
            });
        });

        const feedbackForm = document.getElementById('feedback-form');
        feedbackForm.addEventListener('submit', handleFormSubmit);
    }

    async function handleFormSubmit(event) {
        const form = event.target;
        const formData = new FormData(form);
        const submissionType = formData.get('submission-type');

        if (submissionType === 'resource') {
            event.preventDefault(); 

            try {
                const response = await fetch('/.netlify/functions/submit-resource', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams(formData).toString(),
                });

                if (response.ok) {
                    showToast('Resource submitted successfully! A Pull Request will be created.', 'success');
                    form.reset();
                    hideModal();
                } else {
                    throw new Error('Function submission failed.');
                }
            } catch (error) {
                console.error('Submission error:', error);
                showToast('Submission error. Please try again later.', 'error');
            }
        } else {
            // "feedback" submission let it process standard Netlify post
            showToast('Feedback submitted successfully. Thank you!', 'success');
        }
    }

    function showModal(context = {}) {
        const { type = 'general', resourceTitle = '' } = context;
        const modalTitle = document.getElementById('feedback-modal-title');
        const contextInput = document.getElementById('feedback-context');

        if (type === 'report-issue') {
            modalTitle.textContent = `Report an Issue / Suggest Edit`;
            document.getElementById('type-feedback').checked = true;
            document.getElementById('type-feedback').dispatchEvent(new Event('change'));
            contextInput.value = `Issue with resource: ${resourceTitle}`;
        } else {
            modalTitle.textContent = 'Submit Feedback or Suggest a Resource';
            contextInput.value = 'General Feedback';
        }
        
        elementToFocusOnClose = document.activeElement;
        modalOverlay.style.display = 'flex';
        setTimeout(() => document.getElementById('submitter-name').focus(), 100);
    }

    function hideModal() {
        modalOverlay.style.display = 'none';
        if (elementToFocusOnClose) elementToFocusOnClose.focus();
    }

    function handleModalTrapFocus(e) {
        if (e.key === 'Escape') hideModal();
        if (e.key === 'Tab') {
            const focusableElements = Array.from(modalWindow.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter(el => !el.closest('.hidden'));
            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];
            if (e.shiftKey) {
                if (document.activeElement === firstElement) { lastElement.focus(); e.preventDefault(); }
            } else {
                if (document.activeElement === lastElement) { firstElement.focus(); e.preventDefault(); }
            }
        }
    }

    //================================================================
    // DYNAMIC CONTENT RENDERING
    //================================================================
    const categoryIconMap = {
        "Accessibility Standards": `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 17.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A11.953 11.953 0 0 1 12 16.5c-2.998 0-5.74-1.1-7.843-2.918m15.686-5.418A8.959 8.959 0 0 0 21 12c0 .778-.099 1.533-.284 2.253m0 0a8.997 8.997 0 0 1-7.843 4.582M12 16.5a8.997 8.997 0 0 0-7.843-4.582m7.843 0a11.953 11.953 0 0 0 7.843-2.918m-15.686 0A11.953 11.953 0 0 0 12 10.5c2.998 0 5.74 1.1 7.843 2.918"/></svg>`,
        "Useful tools, resources and references": `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25M19.5 5.25l-7.5 7.5-7.5-7.5m15 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 5.25m16.5 0V3.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v1.5"/></svg>`,
        "Guides & Cheat Sheets": `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"/></svg>`,
        "Checklists": `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.4-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.4-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.4 1.593-3.068a3.745 3.745 0 01 1.043-3.296 3.746 3.746 0 01 3.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.4.63 3.068 1.593a3.746 3.746 0 01 3.296 1.043 3.746 3.746 0 01 1.043 3.296A3.745 3.745 0 0121 12z"/></svg>`,
        "Auditing and Testing tools": `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 9l10.5-3m0 0L21 9M19.5 6l-3 9.75M9 9a3 3 0 11-6 0 3 3 0 016 0zm3 9a3 3 0 11-6 0 3 3 0 016 0zm9 0a3 3 0 11-6 0 3 3 0 016 0z"/></svg>`,
        "License/Certificates": `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/></svg>`,
        "Other": `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.007 5.25H3.75v.008h.008V12zm-.007 5.25h.007v.008H3.75v-.008z"/></svg>`,
        "Other must read resources from web accessibility initiative": `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"/></svg>`,
        "blogs / people / other resources to follow": `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>`
    };

    function createSections() {
        const allCategories = [...new Set(allResourceData.map(item => item.Category))];
        
        allCategories.forEach(category => {
            const section = document.createElement('section');
            const title = document.createElement('h2');
            
            const iconSVG = categoryIconMap[category] || '';
            title.innerHTML = `${iconSVG}<span>${category}</span>`;

            const grid = document.createElement('div');
            grid.className = activeViewMode === 'list' ? 'grid resources-list-layout' : 'grid grid-cols-responsive';
            
            section.appendChild(title);
            section.appendChild(grid);
            resourcesContainer.appendChild(section);
        });
    }

    function renderCards(dataToRender) {
        resourcesContainer.querySelectorAll('.grid').forEach(grid => grid.innerHTML = '');
        
        if (dataToRender.length === 0) {
            noResultsMessage.classList.remove('hidden');
        } else {
            noResultsMessage.classList.add('hidden');
        }

        const categoryGlowColors = {
            "Accessibility Standards": "rgba(99, 102, 241, 0.2)",
            "Useful tools, resources and references": "rgba(16, 185, 129, 0.2)",
            "Guides & Cheat Sheets": "rgba(245, 158, 11, 0.2)",
            "Checklists": "rgba(59, 130, 246, 0.2)",
            "Auditing and Testing tools": "rgba(6, 182, 212, 0.2)",
            "License/Certificates": "rgba(139, 92, 246, 0.2)",
            "Other": "rgba(236, 72, 153, 0.2)",
            "Other must read resources from web accessibility initiative": "rgba(167, 139, 250, 0.2)",
            "blogs / people / other resources to follow": "rgba(249, 115, 22, 0.2)"
        };

        const categoryTextClass = {
            "Accessibility Standards": "text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/40",
            "Useful tools, resources and references": "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/40",
            "Guides & Cheat Sheets": "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40",
            "Checklists": "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/40",
            "Auditing and Testing tools": "text-cyan-600 bg-cyan-50 dark:text-cyan-400 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-900/40",
            "License/Certificates": "text-violet-600 bg-violet-50 dark:text-violet-400 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-900/40",
            "Other": "text-pink-600 bg-pink-50 dark:text-pink-400 dark:bg-pink-950/40 border border-pink-200 dark:border-pink-900/40",
            "Other must read resources from web accessibility initiative": "text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/40",
            "blogs / people / other resources to follow": "text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-900/40"
        };
        
        dataToRender.forEach((item) => {
            const parentSection = Array.from(document.querySelectorAll('#resources section')).find(s => s.querySelector('h2 > span').textContent === item.Category);
            if (parentSection) {
                const grid = parentSection.querySelector('.grid');
                const card = document.createElement('div');
                card.className = 'resource-card';
                card.setAttribute('data-category', item.Category);
                card.style.setProperty('--glow-color', categoryGlowColors[item.Category] || 'rgba(99, 102, 241, 0.15)');
                
                const badgeClass = categoryTextClass[item.Category] || "text-slate-600 bg-slate-50 border border-slate-200";
                const isFavorite = favoriteResources.has(item.URL);
                const favoriteLabel = isFavorite ? `Remove ${item['Resource Text']} from favorites` : `Add ${item['Resource Text']} to favorites`;
                const menuId = `menu-for-item-${item.URL.replace(/[^a-zA-Z0-9]/g, "")}`;
                let descriptionHTML = item.Description ? `<p>${item.Description}</p>` : '';
                
                card.innerHTML = `
                    <div class="card-content">
                        <span class="card-category-badge ${badgeClass}">
                            ${categoryIconMap[item.Category] || ''}
                            <span>${item.Category}</span>
                        </span>
                        <div class="card-text-group">
                            <h3><a href="${item.URL}" target="_blank" rel="noopener noreferrer">${item['Resource Text']}</a></h3>
                            ${descriptionHTML}
                        </div>
                    </div>
                    <div class="card-actions">
                        <button class="favorite-btn ${isFavorite ? 'active' : ''}" data-url="${item.URL}" data-title="${item['Resource Text']}" aria-pressed="${isFavorite}" aria-label="${favoriteLabel}">
                            <svg class="w-5 h-5 star-outline" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path></svg>
                            <svg class="w-5 h-5 star-fill" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>
                        </button>
                        <div class="relative">
                            <button class="card-menu-btn text-slate-500 dark:text-slate-400" aria-haspopup="true" aria-expanded="false" aria-controls="${menuId}" aria-label="Options for ${item['Resource Text']}">
                                <svg class="w-5 h-5 pointer-events-none" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 5v.01M12 12v.01M12 19v.01"></path></svg>
                            </button>
                            <div id="${menuId}" class="card-menu hidden" role="menu" aria-label="Share options for ${item['Resource Text']}">
                                <button class="card-menu-item" role="menuitem" data-action="share-twitter"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path></svg>Share on X</button>
                                <button class="card-menu-item" role="menuitem" data-action="share-facebook"><svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z"></path></svg>Share on Facebook</button>
                                <button class="card-menu-item" role="menuitem" data-action="share-linkedin"><svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.98 3.5c0 1.381-1.11 2.5-2.48 2.5s-2.48-1.119-2.48-2.5c0-1.38 1.11-2.5 2.48-2.5s2.48 1.12 2.48 2.5zm.02 4.5h-5v16h5v-16zm7.982 0h-4.98v16h4.98v-8.369c0-2.029 1.56-2.029 1.56 0v8.369h4.98v-10.36c0-4.008-2.903-3.674-4.98-1.745z"></path></svg>Share on LinkedIn</button>
                                <button class="card-menu-item" role="menuitem" data-action="copy"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg><span class="copy-text">Copy Link</span></button>
                                <button class="card-menu-item" role="menuitem" data-action="report-issue"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>Report Issue</button>
                            </div>
                        </div>
                    </div>
                `;
                grid.appendChild(card);
            }
        });

        // Staggered fade in load effect
        requestAnimationFrame(() => {
            const renderedCards = resourcesContainer.querySelectorAll('.resource-card');
            renderedCards.forEach((card, index) => {
                card.style.setProperty('--delay', `${index * 0.04}s`);
                card.classList.add('is-visible');
            });
        });
    }
    
    function createFilterButtons() {
        const allCategories = [...new Set(allResourceData.map(item => item.Category))];
        const categoryCounts = allResourceData.reduce((acc, item) => { acc[item.Category] = (acc[item.Category] || 0) + 1; return acc; }, {});
        
        const favoritesBtn = document.createElement('button');
        favoritesBtn.className = 'filter-btn hidden';
        favoritesBtn.innerHTML = `★ Favorites <span id="favorites-count"></span>`;
        favoritesBtn.dataset.category = 'Favorites';
        favoritesBtn.setAttribute('aria-pressed', 'false');
        filterContainer.appendChild(favoritesBtn);
        
        const allBtn = document.createElement('button');
        allBtn.className = 'filter-btn active';
        allBtn.textContent = `All (${allResourceData.length})`;
        allBtn.dataset.category = 'All';
        allBtn.setAttribute('aria-pressed', 'true');
        filterContainer.appendChild(allBtn);

        allCategories.forEach(category => {
            const btn = document.createElement('button');
            btn.className = 'filter-btn';
            btn.setAttribute('aria-pressed', 'false');
            btn.textContent = `${category} (${categoryCounts[category] || 0})`;
            btn.dataset.category = category;
            filterContainer.appendChild(btn);
        });
        updateFavoritesButton();
    }
    
    function updateFavoritesButton() {
        const favoritesBtn = filterContainer.querySelector('[data-category="Favorites"]');
        if (!favoritesBtn) return;
        
        const count = favoriteResources.size;
        const countSpan = favoritesBtn.querySelector('#favorites-count');
        
        if (count > 0) {
            favoritesBtn.classList.remove('hidden');
            countSpan.textContent = `(${count})`;
        } else {
            favoritesBtn.classList.add('hidden');
            if (activeFilters.showFavorites) {
                activeFilters.showFavorites = false;
                filterAndSearch();
            }
        }
        favoritesBtn.classList.toggle('active', activeFilters.showFavorites);
        favoritesBtn.setAttribute('aria-pressed', activeFilters.showFavorites);
    }

    function filterAndSearch() {
        const searchTerm = searchInput.value.toLowerCase().trim();
        let filteredData = allResourceData;

        // Filter by favorites
        if (activeFilters.showFavorites) {
            filteredData = filteredData.filter(item => favoriteResources.has(item.URL));
        }

        // Filter by categories
        if (activeFilters.categories.size > 0) {
            filteredData = filteredData.filter(item => activeFilters.categories.has(item.Category));
        }

        // Filter by search term
        if (searchTerm) {
            filteredData = filteredData.filter(item => 
                item['Resource Text'].toLowerCase().includes(searchTerm) || 
                (item.Description && item.Description.toLowerCase().includes(searchTerm)) || 
                item.Category.toLowerCase().includes(searchTerm)
            );
        }
        
        renderCards(filteredData);
        updateURL();
    }

    //================================================================
    // EVENT LISTENERS & HANDLERS
    //================================================================
    function setupEventListeners() {
        filterContainer.addEventListener('click', handleFilterClick);
        searchInput.addEventListener('input', showSuggestions);
        searchInput.addEventListener('keydown', handleKeyboardNavigation);
        document.addEventListener('click', handleDocumentClick);
        window.addEventListener('scroll', handleScroll);

        backToTopButton.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('main-heading').focus({preventScroll: true});
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        
        resourcesContainer.addEventListener('click', handleResourceCardClick);
        resourcesContainer.addEventListener('keydown', handleResourceCardKeydown);
        setupGlobalShare();

        document.getElementById('footer-suggest-link').addEventListener('click', (e) => {
            e.preventDefault();
            showModal();
        });
        
        // Search clear button
        searchInput.addEventListener('input', () => {
            if (searchInput.value.trim().length > 0) {
                clearSearchBtn.classList.remove('hidden');
            } else {
                clearSearchBtn.classList.add('hidden');
            }
        });

        clearSearchBtn.addEventListener('click', () => {
            searchInput.value = '';
            clearSearchBtn.classList.add('hidden');
            searchInput.focus();
            showSuggestions();
            filterAndSearch();
            showToast('Search query cleared.', 'success');
        });
    }

    function updateActiveFilterButtons() {
        document.querySelectorAll('.filter-btn').forEach(btn => {
            const category = btn.dataset.category;
            let isActive = false;
            if (category === 'All') {
                isActive = !activeFilters.showFavorites && activeFilters.categories.size === 0;
            } else if (category === 'Favorites') {
                isActive = activeFilters.showFavorites;
            } else {
                isActive = activeFilters.categories.has(category);
            }
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-pressed', isActive);
        });
    }

    function handleFilterClick(e) {
        const targetButton = e.target.closest('.filter-btn');
        if (!targetButton) return;

        const category = targetButton.dataset.category;
        
        if (category === 'All') {
            activeFilters.categories.clear();
            activeFilters.showFavorites = false;
        } else if (category === 'Favorites') {
            activeFilters.showFavorites = true;
            activeFilters.categories.clear();
        } else {
            activeFilters.showFavorites = false;
            if (activeFilters.categories.has(category)) {
                activeFilters.categories.delete(category);
            } else {
                activeFilters.categories.add(category);
            }
        }
        updateActiveFilterButtons();
        filterAndSearch();
    }

    function showSuggestions() {
        const query = searchInput.value.toLowerCase().trim();
        suggestionsList.innerHTML = '';
        if (query.length < 2) {
            suggestionsList.classList.add('hidden');
            searchInput.setAttribute('aria-expanded', 'false');
            return;
        }

        const filteredSuggestions = allResourceData
            .filter(item => item['Resource Text'].toLowerCase().includes(query))
            .slice(0, 5);
            
        if (filteredSuggestions.length > 0) {
            filteredSuggestions.forEach((item, index) => {
                const li = document.createElement('li');
                li.textContent = item['Resource Text'];
                li.className = 'suggestion-item';
                li.setAttribute('role', 'option');
                li.id = `suggestion-${index}`;
                li.addEventListener('click', () => {
                    searchInput.value = item['Resource Text'];
                    clearSearchBtn.classList.remove('hidden');
                    suggestionsList.classList.add('hidden');
                    searchInput.setAttribute('aria-expanded', 'false');
                    filterAndSearch();
                });
                suggestionsList.appendChild(li);
            });
            suggestionsList.classList.remove('hidden');
            searchInput.setAttribute('aria-expanded', 'true');
        } else {
            suggestionsList.classList.add('hidden');
            searchInput.setAttribute('aria-expanded', 'false');
        }
        activeSuggestionIndex = -1;
    }

    function handleKeyboardNavigation(e) {
        const items = suggestionsList.querySelectorAll('.suggestion-item');
        if (suggestionsList.classList.contains('hidden') && e.key !== 'Enter') return;

        if (e.key === 'Enter') {
            e.preventDefault();
            if (activeSuggestionIndex > -1 && items[activeSuggestionIndex]) {
                items[activeSuggestionIndex].click();
            } else {
                filterAndSearch();
            }
            suggestionsList.classList.add('hidden');
            searchInput.setAttribute('aria-expanded', 'false');
            return;
        }

        if (items.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            activeSuggestionIndex = (activeSuggestionIndex + 1) % items.length;
            updateSuggestionHighlight(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            activeSuggestionIndex = (activeSuggestionIndex - 1 + items.length) % items.length;
            updateSuggestionHighlight(items);
        } else if (e.key === 'Escape') {
            suggestionsList.classList.add('hidden');
            searchInput.setAttribute('aria-expanded', 'false');
        }
    }

    function updateSuggestionHighlight(items) {
        items.forEach(item => item.classList.remove('active'));
        const currentActiveItem = items[activeSuggestionIndex];
        if (currentActiveItem) { 
            currentActiveItem.classList.add('active'); 
            searchInput.setAttribute('aria-activedescendant', currentActiveItem.id); 
            currentActiveItem.scrollIntoView({ block: 'nearest' }); 
        }
    }

    function handleScroll() {
        const currentScrollY = window.scrollY;
        const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
        
        // Circular progress depth indicator
        const scrollPercent = totalHeight > 0 ? (currentScrollY / totalHeight) * 100 : 0;
        const progressCircle = document.querySelector('#back-to-top .bar');
        if (progressCircle) {
            // Stroke dasharray is 100
            const offset = 100 - scrollPercent;
            progressCircle.style.strokeDashoffset = offset;
        }

        if (currentScrollY > 300) {
            backToTopButton.classList.add('visible');
        } else {
            backToTopButton.classList.remove('visible');
        }
        
        // Floating Nav effects on scroll
        const headerEl = document.querySelector('header');
        if (currentScrollY > 40) {
            headerEl.classList.add('is-scrolled');
            searchControls.classList.add('is-glassy');
        } else {
            headerEl.classList.remove('is-scrolled');
            searchControls.classList.remove('is-glassy');
        }

        // Hide search bar on scroll down
        if (currentScrollY > lastScrollY && currentScrollY > 200 && modalOverlay.style.display !== 'flex') {
            searchControls.classList.add('is-hidden');
        } else {
            searchControls.classList.remove('is-hidden');
        }
        lastScrollY = currentScrollY <= 0 ? 0 : currentScrollY;
    }

    function handleDocumentClick(e) {
        if (!e.target.closest('#search-container')) {
            suggestionsList.classList.add('hidden');
            searchInput.setAttribute('aria-expanded', 'false');
        }
        const card = e.target.closest('.resource-card');
        if (!card) {
             document.querySelectorAll('.card-menu').forEach(menu => {
                const button = menu.parentElement.querySelector('.card-menu-btn');
                if(button && button.getAttribute('aria-expanded') === 'true') {
                    closeMenu(menu, button);
                }
            });
        }
    }

    function setupGlobalShare() {
        const pageTitle = document.title;
        const globalShareText = `Check out this awesome collection of accessibility resources: "${pageTitle}"`;
        document.getElementById('share-twitter').href = `https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(globalShareText)}`;
        document.getElementById('share-facebook').href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`;
        document.getElementById('share-linkedin').href = `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(window.location.href)}&title=${encodeURIComponent(pageTitle)}`;
        
        const copyLinkBtn = document.getElementById('copy-link-btn');
        const copyLinkText = document.getElementById('copy-link-text');
        copyLinkBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(window.location.href).then(() => {
                showToast('Website link copied to clipboard!', 'success');
                copyLinkText.textContent = 'Copied!';
                copyLinkBtn.setAttribute('aria-label', 'Link copied to clipboard');
                setTimeout(() => {
                    copyLinkText.textContent = 'Copy Link';
                    copyLinkBtn.setAttribute('aria-label', 'Copy page link');
                }, 2000);
            }).catch(err => { console.error('Failed to copy text: ', err); });
        });
    }

    // Card Actions Click Handler
    function handleResourceCardClick(e) {
        const favoriteButton = e.target.closest('.favorite-btn');
        if (favoriteButton) {
            toggleFavorite(favoriteButton.dataset.url, favoriteButton);
            return;
        }
        
        const menuButton = e.target.closest('.card-menu-btn');
        if (menuButton) {
            toggleMenu(menuButton);
            return;
        }
        
        const menuItem = e.target.closest('.card-menu-item');
        if(menuItem) {
            handleMenuAction(menuItem);
            return;
        }
    }
    
    function handleResourceCardKeydown(e) {
        const menuButton = e.target.closest('.card-menu-btn');
        if (menuButton && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggleMenu(menuButton); }
        
        const menuItem = e.target.closest('.card-menu-item');
        if (menuItem && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); handleMenuAction(menuItem); }
        
        if (e.key === 'Escape') { 
            const openMenu = document.querySelector('.card-menu:not(.hidden)'); 
            if (openMenu) { 
                const button = openMenu.parentElement.querySelector('.card-menu-btn'); 
                closeMenu(openMenu, button); 
                button.focus(); 
            }
        }
        
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            const activeItem = document.activeElement.closest('.card-menu-item');
            if(activeItem) {
                 e.preventDefault();
                 const items = Array.from(activeItem.parentElement.children).filter(el => el.matches('.card-menu-item'));
                 const currentIndex = items.indexOf(activeItem);
                 const nextIndex = e.key === 'ArrowDown' ? (currentIndex + 1) % items.length : (currentIndex - 1 + items.length) % items.length;
                 items[nextIndex].focus();
            }
        }
    }
    
    function toggleMenu(button) {
        const menu = button.nextElementSibling;
        const isExpanded = button.getAttribute('aria-expanded') === 'true';
        // Close all other active menus
        document.querySelectorAll('.card-menu').forEach(m => {
            if (m !== menu) {
                const b = m.parentElement.querySelector('.card-menu-btn');
                if(b) closeMenu(m,b);
            }
        });
        if (isExpanded) closeMenu(menu, button); else openMenu(menu, button);
    }

    function openMenu(menu, button) {
        menu.classList.remove('hidden');
        button.setAttribute('aria-expanded', 'true');
        const firstItem = menu.querySelector('.card-menu-item');
        if(firstItem) firstItem.focus();
    }

    function closeMenu(menu, button) {
        menu.classList.add('hidden');
        button.setAttribute('aria-expanded', 'false');
    }

    function handleMenuAction(menuItem) {
        const card = menuItem.closest('.resource-card');
        const button = card.querySelector('.card-menu-btn');
        const menu = menuItem.closest('.card-menu');

        const titleElement = card.querySelector('h3 a');
        const data = allResourceData.find(d => d['Resource Text'] === titleElement.textContent);
        if (!data) return;

        const action = menuItem.dataset.action;
        
        closeMenu(menu, button);
        button.focus();

        switch (action) {
            case 'report-issue':
                showModal({ type: 'report-issue', resourceTitle: data['Resource Text'] });
                break;
            case 'share-twitter':
            case 'share-facebook':
            case 'share-linkedin':
            case 'copy':
                const textToShare = `${data['Resource Text']}\n\n${data.Description || ''}\n\n${data.URL}\n\nFind more resources at ${window.location.href}`;
                if (action === 'share-twitter') {
                    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(textToShare)}`, '_blank');
                } else if (action === 'share-facebook') {
                    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(data.URL)}`, '_blank');
                } else if (action === 'share-linkedin') {
                    window.open(`https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(data.URL)}&title=${encodeURIComponent(data['Resource Text'])}`, '_blank');
                } else if (action === 'copy') {
                    navigator.clipboard.writeText(textToShare).then(() => {
                        showToast(`Copied ${data['Resource Text']} details to clipboard!`, 'success');
                    });
                }
                break;
        }
    }

    // --- Skip Links Logic ---
    function setupSkipLinks() {
        document.getElementById('skip-to-search').addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('search-input').focus();
        });

        document.getElementById('skip-to-main').addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('main-heading').focus();
        });
    }

    //================================================================
    // INITIALIZATION
    //================================================================
    async function init() {
        initializeTheme();
        initializeViewMode();
        loadFavorites();
        await fetchResources();
        if (allResourceData.length > 0) {
            createSections();
            createFilterButtons();
            applyStateFromURL();
            filterAndSearch();
            setupModal();
        }
        setupEventListeners();
        setupSkipLinks();
    }

    init();
});