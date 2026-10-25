import { chapterOrder } from './levelContent.js';

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
        this.hasPlayed = callbacks.hasPlayed || (() => false);

        // `${level}/${category}` → Promise of that category's data/levels file
        this.dataCache = new Map();
        // Same files once loaded (sync access for story chapters: beats, texts)
        this.loadedData = new Map();

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

        // Story chapters grouped per story, then the grammar categories
        const groups = new Map();
        Object.entries(levelData.categories).forEach(([key, cat]) => {
            const groupLabel = cat.story ? `Geschichte ${cat.story.storyNo}: ${cat.story.storyTitle}` : 'Grammatik';
            if (!groups.has(groupLabel)) {
                const group = document.createElement('optgroup');
                group.label = groupLabel;
                this.categorySelect.appendChild(group);
                groups.set(groupLabel, group);
            }
            const option = document.createElement('option');
            option.value = key;
            option.textContent = cat.label;
            groups.get(groupLabel).appendChild(option);
        });

        this.categorySelect.disabled = false;
        this.updateCategoryMastery();
    }

    /**
     * A category's data/levels file (sentence texts; story chapters also carry beats), fetched once.
     * @returns {Promise<Object>}
     */
    loadCategoryData(level, category) {
        const key = `${level}/${category}`;
        if (!this.dataCache.has(key)) {
            const catData = this.levelContent[level].categories[category];
            const promise = fetch(catData.file)
                .then(r => {
                    if (!r.ok) throw new Error(`HTTP ${r.status}`);
                    return r.json();
                })
                .then(data => {
                    data.sentences = (data.sentences || []).map(t => t.trim());
                    this.loadedData.set(key, data);
                    return data;
                });
            promise.catch(() => this.dataCache.delete(key)); // retry on next use
            this.dataCache.set(key, promise);
        }
        return this.dataCache.get(key);
    }

    /**
     * Sentence texts of a category (from its data/levels file), fetched once.
     * @returns {Promise<string[]>}
     */
    loadCategoryTexts(level, category) {
        return this.loadCategoryData(level, category).then(data => data.sentences);
    }

    /** The category's data/levels file if already loaded, else null. */
    getLoadedData(level, category) {
        return this.loadedData.get(`${level}/${category}`) || null;
    }

    /** A story chapter is complete once every play sentence has been played. */
    isChapterComplete(level, chapterKey) {
        const data = this.getLoadedData(level, chapterKey);
        return !!data && data.sentences.length > 0 &&
            data.sentences.every(t => this.hasPlayed(level, chapterKey, t));
    }

    /**
     * Story chapters unlock in order: the first is always open, each next one
     * once the previous chapter is complete. Non-story categories are always open.
     * Needs the previous chapter's file loaded (see updateCategoryMastery).
     */
    isUnlocked(level, category) {
        const cat = this.levelContent[level] && this.levelContent[level].categories[category];
        if (!cat || !cat.story) return true;
        const order = chapterOrder(level);
        const idx = order.indexOf(cat.story.chapterKey);
        return idx <= 0 || this.isChapterComplete(level, order[idx - 1]);
    }

    /** @returns {{mastered: number, total: number}} */
    countMastered(level, category, texts) {
        const mastered = texts.filter(t => this.isMastered(level, category, t)).length;
        return { mastered, total: texts.length };
    }

    /**
     * Append "mastered/total" to each category option of the current level; lock
     * story chapters (and their drills) whose previous chapter isn't complete.
     */
    async updateCategoryMastery() {
        const level = this.currentLevel;
        const levelData = this.levelContent[level];
        if (!levelData) return;
        const options = Array.from(this.categorySelect.options).filter(o => levelData.categories[o.value]);
        const texts = await Promise.all(options.map(o =>
            this.loadCategoryTexts(level, o.value).catch(() => null)));
        if (this.currentLevel !== level) return;
        options.forEach((option, i) => {
            const cat = levelData.categories[option.value];
            if (!texts[i]) {
                option.textContent = cat.label;
                return;
            }
            const { mastered, total } = this.countMastered(level, option.value, texts[i]);
            const unlocked = this.isUnlocked(level, option.value);
            const done = cat.story && cat.story.kind === 'chapter' && this.isChapterComplete(level, option.value);
            const prefix = !unlocked ? '🔒 ' : done ? '✓ ' : '';
            option.disabled = !unlocked;
            option.textContent = `${prefix}${cat.label} (${mastered}/${total})`;
        });
    }

    /**
     * Select a category programmatically (e.g. "next chapter") and load it.
     * @returns {Promise<void>}
     */
    async selectCategory(level, category) {
        if (this.levelSelect.value !== level) {
            this.levelSelect.value = level;
            this.handleLevelChange();
        }
        this.categorySelect.value = category;
        await this.handleCategoryChange();
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
