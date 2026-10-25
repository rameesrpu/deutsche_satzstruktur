export class LevelSelector {
    constructor(levelContent, callbacks) {
        this.levelContent = levelContent;
        this.onSelect = callbacks.onSelect;
        this.getCachedSentence = callbacks.getCachedSentence;
        this.getUserSentences = callbacks.getUserSentences;
        this.onEdit = callbacks.onEdit;
        this.onDelete = callbacks.onDelete;
        this.getCurrentSentenceId = callbacks.getCurrentSentenceId;
        this.onLibraryLoad = callbacks.onLibraryLoad || null;
        this.isMastered = callbacks.isMastered || (() => false);

        // `${level}/${category}` → Promise<string[]> of that category's sentence texts
        this.textsCache = new Map();

        this.currentLevel = '';
        this.currentCategory = '';
        this.currentSentences = [];

        this.levelSelect = null;
        this.categorySelect = null;
        this.sentenceList = null;
    }

    init() {
        this.levelSelect = document.getElementById('library-level-select');
        this.categorySelect = document.getElementById('library-category-select');
        this.sentenceList = document.getElementById('library-sentence-list');

        if (!this.levelSelect || !this.categorySelect || !this.sentenceList) return;

        this.levelSelect.addEventListener('change', () => this.handleLevelChange());
        this.categorySelect.addEventListener('change', () => this.handleCategoryChange());
    }

    handleLevelChange() {
        const level = this.levelSelect.value;
        this.currentLevel = level;
        this.currentCategory = '';
        this.currentSentences = [];
        this.sentenceList.innerHTML = '';

        this.categorySelect.innerHTML = '<option value="">-- Category --</option>';
        this.categorySelect.disabled = true;
        this.categorySelect.style.display = '';

        if (!level) return;

        if (level === 'custom') {
            this.categorySelect.style.display = 'none';
            this.renderCustomSentences();
            return;
        }

        const levelData = this.levelContent[level];
        if (!levelData) return;

        Object.entries(levelData.categories).forEach(([key, cat]) => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = cat.label;
            this.categorySelect.appendChild(option);
        });

        this.categorySelect.disabled = false;
        this.updateCategoryMastery();
    }

    /**
     * Sentence texts of a category (from its data/levels file), fetched once.
     * @returns {Promise<string[]>}
     */
    loadCategoryTexts(level, category) {
        const key = `${level}/${category}`;
        if (!this.textsCache.has(key)) {
            const catData = this.levelContent[level].categories[category];
            const promise = fetch(catData.file)
                .then(r => {
                    if (!r.ok) throw new Error(`HTTP ${r.status}`);
                    return r.json();
                })
                .then(data => (data.sentences || []).map(t => t.trim()));
            promise.catch(() => this.textsCache.delete(key)); // retry on next use
            this.textsCache.set(key, promise);
        }
        return this.textsCache.get(key);
    }

    /** @returns {{mastered: number, total: number}} */
    countMastered(level, category, texts) {
        const mastered = texts.filter(t => this.isMastered(level, category, t)).length;
        return { mastered, total: texts.length };
    }

    /** Append "mastered/total" to each category option of the current level. */
    async updateCategoryMastery() {
        const level = this.currentLevel;
        const levelData = this.levelContent[level];
        if (!levelData) return;
        await Promise.all(Array.from(this.categorySelect.options).map(async option => {
            const cat = levelData.categories[option.value];
            if (!cat) return;
            try {
                const texts = await this.loadCategoryTexts(level, option.value);
                if (this.currentLevel !== level) return;
                const { mastered, total } = this.countMastered(level, option.value, texts);
                option.textContent = `${cat.label} (${mastered}/${total})`;
            } catch (e) {
                option.textContent = cat.label;
            }
        }));
    }

    async handleCategoryChange() {
        const category = this.categorySelect.value;
        this.currentCategory = category;
        this.sentenceList.innerHTML = '';

        if (!this.currentLevel || !category) return;

        const catData = this.levelContent[this.currentLevel].categories[category];
        if (!catData) return;

        this.sentenceList.innerHTML = '<div class="library-status">Loading...</div>';

        try {
            const libraryFile = catData.file.replace('data/levels/', 'data/library/');
            const [texts, libraryResponse] = await Promise.all([
                this.loadCategoryTexts(this.currentLevel, category),
                fetch(libraryFile).catch(() => null)
            ]);
            this.currentSentences = texts;

            if (libraryResponse && libraryResponse.ok && this.onLibraryLoad) {
                const libraryData = await libraryResponse.json();
                this.onLibraryLoad(this.currentLevel, category, libraryData);
            }

            this.renderLibrarySentences();
        } catch (error) {
            console.error('Level content load error:', error);
            this.sentenceList.innerHTML = '<div class="library-status library-error">Failed to load sentences.</div>';
        }
    }

    renderLibrarySentences() {
        if (!this.sentenceList) return;

        if (this.currentSentences.length === 0) {
            this.sentenceList.innerHTML = '<div class="library-status">No sentences found.</div>';
            return;
        }

        const currentId = this.getCurrentSentenceId();
        this.sentenceList.innerHTML = '';

        const { mastered, total } = this.countMastered(this.currentLevel, this.currentCategory, this.currentSentences);
        const summary = document.createElement('div');
        summary.className = 'library-mastery';
        summary.textContent = `${mastered}/${total} mastered`;
        summary.title = 'Mastered: the last 2 plays were perfect';
        this.sentenceList.appendChild(summary);

        this.currentSentences.forEach((text, i) => {
            const cached = this.getCachedSentence(this.currentLevel, this.currentCategory, text);
            const isActive = cached && cached.id === currentId;
            const isMastered = this.isMastered(this.currentLevel, this.currentCategory, text);

            const item = document.createElement('div');
            item.className = 'sentence-item' + (isActive ? ' active' : '') + (cached ? '' : ' library-uncached') +
                (isMastered ? ' mastered' : '');
            item.dataset.index = i;

            const textDiv = document.createElement('div');
            textDiv.className = 'sentence-item-text';
            textDiv.textContent = text;
            if (isMastered) {
                const badge = document.createElement('span');
                badge.className = 'sentence-mastered-badge';
                badge.title = 'Mastered';
                badge.textContent = '✓';
                textDiv.prepend(badge);
            }
            item.appendChild(textDiv);

            if (cached) {
                const actions = document.createElement('div');
                actions.className = 'sentence-item-actions';
                actions.innerHTML = `
                    <button class="sentence-item-edit" data-sentence-id="${cached.id}" title="Edit sentence">✏</button>
                    <button class="sentence-item-delete" data-sentence-id="${cached.id}" title="Delete sentence">✕</button>
                `;
                item.appendChild(actions);
            }

            item.addEventListener('click', (e) => {
                if (e.target.classList.contains('sentence-item-edit') ||
                    e.target.classList.contains('sentence-item-delete')) return;
                this.onSelect({ type: 'library', level: this.currentLevel, category: this.currentCategory, text });
            });

            if (cached) {
                item.querySelector('.sentence-item-edit').addEventListener('click', (e) => {
                    this.onEdit(cached.id, e);
                });
                item.querySelector('.sentence-item-delete').addEventListener('click', (e) => {
                    this.onDelete(cached.id, e);
                });
            }

            this.sentenceList.appendChild(item);
        });
    }

    renderCustomSentences() {
        if (!this.sentenceList) return;

        const sentences = this.getUserSentences();
        const currentId = this.getCurrentSentenceId();

        if (sentences.length === 0) {
            this.sentenceList.innerHTML = '<div class="library-status">No saved sentences yet.</div>';
            return;
        }

        this.sentenceList.innerHTML = '';
        sentences.slice().reverse().forEach(s => {
            const isActive = s.id === currentId;
            const item = document.createElement('div');
            item.className = 'sentence-item' + (isActive ? ' active' : '');
            item.dataset.sentenceId = s.id;
            item.innerHTML = `
                <div class="sentence-item-text">${s.text}</div>
                <div class="sentence-item-actions">
                    <button class="sentence-item-edit" data-sentence-id="${s.id}" title="Edit sentence">✏</button>
                    <button class="sentence-item-delete" data-sentence-id="${s.id}" title="Delete sentence">✕</button>
                </div>
            `;

            item.addEventListener('click', (e) => {
                if (e.target.classList.contains('sentence-item-edit') ||
                    e.target.classList.contains('sentence-item-delete')) return;
                this.onSelect({ type: 'custom', sentenceId: s.id });
            });

            item.querySelector('.sentence-item-edit').addEventListener('click', (e) => {
                this.onEdit(s.id, e);
            });
            item.querySelector('.sentence-item-delete').addEventListener('click', (e) => {
                this.onDelete(s.id, e);
            });

            this.sentenceList.appendChild(item);
        });
    }

    refresh() {
        if (!this.levelSelect) return;
        const level = this.levelSelect.value;
        if (!level) {
            if (this.sentenceList) this.sentenceList.innerHTML = '';
        } else if (level === 'custom') {
            this.renderCustomSentences();
        } else {
            if (this.currentCategory && this.currentSentences.length > 0) this.renderLibrarySentences();
            this.updateCategoryMastery();
        }
    }
}
