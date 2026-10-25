/**
 * Game-mode HUD: the word bar above the grid (score pill + streak, auto-placed words, current word
 * with its case shape and timer bar, next-word preview) and the sentence-complete card.
 * Display only — reads GameMode state, never changes game logic.
 */

// Visual design tokens for SVG presentation attributes.
// Hard-coded hex values mirror the CSS custom properties in styles.css —
// var(--x) does NOT reliably resolve inside SVG presentation attributes.
export const GM_UI = {
    indigo: '#4f46e5',      // brand
    indigoSoft: '#c7d2fe',  // indigo-200
    text: '#0f172a',        // primary text
    secondary: '#64748b',   // secondary text
    muted: '#94a3b8',       // muted text
    border: '#e2e8f0',      // borders
    surface: '#f8fafc',     // light bg
    surfaceAlt: '#f1f5f9',  // muted pill bg
    white: '#ffffff',
    success: '#10b981',
    danger: '#ef4444',
    amber: '#f59e0b'
};

/**
 * Estimate display width for a text string at the given font size (px).
 * Uses ~0.62 em per character as a generous average for bold/normal Latin text.
 */
export function estimateTextWidth(text, fontSize, padding = 40) {
    return Math.max(text.length * (fontSize * 0.62) + padding, padding + 60);
}

/**
 * Create the shaped container for the center word in the top bar.
 * Default (no case): dashed outline, transparent fill.
 * Selected case mirrors the gridview case-box shapes.
 */
export function createTopBarWordShape(caseType, centerX, topY, width, height) {
    const x = centerX - width / 2;
    let shape;

    // Restyled: prominent white pill with soft shadow. Geometry per case is
    // unchanged (shape still encodes the selected case); border switches from
    // subtle dashed indigo (no case) to saturated indigo (case selected).
    if (!caseType) {
        shape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        shape.setAttribute('x', x);
        shape.setAttribute('y', topY);
        shape.setAttribute('width', width);
        shape.setAttribute('height', height);
        shape.setAttribute('rx', '14');
        shape.setAttribute('fill', 'url(#gm-pill-grad)');
        shape.setAttribute('stroke', GM_UI.indigoSoft);
        shape.setAttribute('stroke-width', '2');
        shape.setAttribute('stroke-dasharray', '8,5');
    } else if (caseType === 'nom') {
        shape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        shape.setAttribute('x', x);
        shape.setAttribute('y', topY);
        shape.setAttribute('width', width);
        shape.setAttribute('height', height);
        shape.setAttribute('rx', '20');
        shape.setAttribute('ry', '20');
        shape.setAttribute('fill', 'url(#gm-pill-grad)');
        shape.setAttribute('stroke', GM_UI.indigo);
        shape.setAttribute('stroke-width', '3');
    } else if (caseType === 'akk') {
        shape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        shape.setAttribute('x', x);
        shape.setAttribute('y', topY);
        shape.setAttribute('width', width);
        shape.setAttribute('height', height);
        shape.setAttribute('rx', '5');
        shape.setAttribute('ry', '5');
        shape.setAttribute('fill', 'url(#gm-pill-grad)');
        shape.setAttribute('stroke', GM_UI.indigo);
        shape.setAttribute('stroke-width', '3');
    } else if (caseType === 'dat') {
        shape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        const slope = 15;
        const points = `${x + slope},${topY} ${x + width - slope},${topY} ${x + width},${topY + height} ${x},${topY + height}`;
        shape.setAttribute('points', points);
        shape.setAttribute('fill', 'url(#gm-pill-grad)');
        shape.setAttribute('stroke', GM_UI.indigo);
        shape.setAttribute('stroke-width', '3');
    } else if (caseType === 'gen') {
        shape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        const slant = 10;
        const points = `${x + slant},${topY} ${x + width + slant},${topY} ${x + width - slant},${topY + height} ${x - slant},${topY + height}`;
        shape.setAttribute('points', points);
        shape.setAttribute('fill', 'url(#gm-pill-grad)');
        shape.setAttribute('stroke', GM_UI.indigo);
        shape.setAttribute('stroke-width', '3');
    }

    if (shape) shape.setAttribute('filter', 'url(#gm-shadow)');
    return shape;
}

// t: 0 (fresh) → 1 (expired)
export function getTimerColor(t) {
    // Shifts indigo #4f46e5 → amber #f59e0b → red #ef4444
    // (hard-coded hex mirrors CSS design tokens)
    const lerp = (a, b, u) => Math.round(a + (b - a) * u);
    if (t < 0.55) {
        const u = t / 0.55;
        return `rgb(${lerp(79, 245, u)},${lerp(70, 158, u)},${lerp(229, 11, u)})`;
    }
    const u = (t - 0.55) / 0.45;
    return `rgb(${lerp(245, 239, u)},${lerp(158, 68, u)},${lerp(11, 68, u)})`;
}

export function drawTimerBar(group, centerX, topY, barHeight, wordWidth, wordStartTime) {
    const elapsed = wordStartTime ? Date.now() - wordStartTime : 0;
    const remaining = Math.max(0, 1 - elapsed / 10000);
    const t = 1 - remaining;

    const barX = centerX - wordWidth / 2;
    const barY = topY + barHeight + 2;
    const trackHeight = 6;

    const track = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    track.setAttribute('id', 'game-timer-bar-track');
    track.setAttribute('data-width', wordWidth);
    track.setAttribute('x', barX);
    track.setAttribute('y', barY);
    track.setAttribute('width', wordWidth);
    track.setAttribute('height', trackHeight);
    track.setAttribute('rx', '3');
    track.setAttribute('fill', GM_UI.border);
    track.setAttribute('pointer-events', 'none');
    group.appendChild(track);

    const fill = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    fill.setAttribute('id', 'game-timer-bar-fill');
    fill.setAttribute('x', barX);
    fill.setAttribute('y', barY);
    fill.setAttribute('width', Math.max(0, wordWidth * remaining));
    fill.setAttribute('height', trackHeight);
    fill.setAttribute('rx', '3');
    fill.setAttribute('fill', getTimerColor(t));
    if (remaining < 0.3 && remaining > 0) {
        fill.setAttribute('class', 'gm-timer-pulse');
    }
    fill.setAttribute('pointer-events', 'none');
    group.appendChild(fill);
}

/**
 * Draw the HUD into game.gameGroup (score, accumulated auto-words on left, current word in center).
 * @param {import('./gamemode.js').GameMode} game
 * @returns {SVGGElement} the overlay group
 */
export function drawHud(game) {
    const overlayGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    overlayGroup.setAttribute('class', 'game-ui-overlay');
    game.gameGroup.appendChild(overlayGroup);

    // Position word bar just above the grid. Compact on desktop; much
    // larger on mobile, where the viewBox down-scaling shrinks everything
    const isMobile = window.innerWidth <= 768;
    const barHeight = isMobile ? 84 : 48;
    const gridStartY = game.getGridStartY();
    const topY = Math.max(6, gridStartY - barHeight - 10); // 10px gap above grid

    // Bar geometry: pills center on the grid's horizontal center
    // (desktop grid: x 50–800 → center 425; mobile grid: x 50–1100 → 575)
    const gridStartX = game.getGridStartX();
    const cellWidth = game.gridViewModel.cellWidth;
    const gridEndX = gridStartX + (3 * cellWidth);
    const barCenterX = gridStartX + (3 * cellWidth) / 2;

    // --- Score cluster (drawn FIRST so the word pills always render on
    // top of it — on long sentences the words win the overlap) ---
    // White pill right-aligned with the grid, in the word-bar band.
    // #gm-score-text is updated in place by the score rAF loop between
    // full redraws.
    const scoreLabel = `${game.getDisplayedScore()}/${game.targetScore}`;
    const scoreFont = isMobile ? 30 : 18;
    const scoreSubFont = isMobile ? 20 : 13;
    const scorePillW = Math.max(scoreLabel.length * scoreFont * 0.67 + 28, isMobile ? 150 : 100);
    const scorePillH = isMobile ? 76 : 48;
    const scorePillX = gridEndX - scorePillW;
    const scorePillY = topY + (barHeight - scorePillH) / 2;

    const scorePill = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    scorePill.setAttribute('x', scorePillX);
    scorePill.setAttribute('y', scorePillY);
    scorePill.setAttribute('width', scorePillW);
    scorePill.setAttribute('height', scorePillH);
    scorePill.setAttribute('rx', '14');
    scorePill.setAttribute('fill', GM_UI.white);
    scorePill.setAttribute('stroke', GM_UI.indigoSoft); // indigo-200 accent
    scorePill.setAttribute('stroke-width', '2');
    scorePill.setAttribute('filter', 'url(#gm-shadow)');
    scorePill.setAttribute('pointer-events', 'none');
    overlayGroup.appendChild(scorePill);

    const scoreText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    scoreText.setAttribute('id', 'gm-score-text');
    scoreText.setAttribute('x', gridEndX - 14);
    scoreText.setAttribute('y', scorePillY + (isMobile ? 33 : 21));
    scoreText.setAttribute('text-anchor', 'end');
    scoreText.setAttribute('fill', GM_UI.indigo); // brand accent for the headline stat
    scoreText.setAttribute('font-size', scoreFont);
    scoreText.setAttribute('font-weight', 'bold');
    scoreText.setAttribute('font-family', "'Inter', sans-serif");
    scoreText.setAttribute('pointer-events', 'none');
    scoreText.textContent = scoreLabel;
    overlayGroup.appendChild(scoreText);

    // Current sentence score (below total score)
    const sentenceScoreText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    sentenceScoreText.setAttribute('x', gridEndX - 14);
    sentenceScoreText.setAttribute('y', scorePillY + (isMobile ? 62 : 40));
    sentenceScoreText.setAttribute('text-anchor', 'end');
    sentenceScoreText.setAttribute('fill', GM_UI.secondary);
    sentenceScoreText.setAttribute('font-size', scoreSubFont);
    sentenceScoreText.setAttribute('font-weight', 'normal');
    sentenceScoreText.setAttribute('font-family', "'Inter', sans-serif");
    sentenceScoreText.setAttribute('pointer-events', 'none');
    sentenceScoreText.textContent = `+${game.currentSentenceScore}`;
    overlayGroup.appendChild(sentenceScoreText);

    // Streak indicator (display only, never feeds back into scoring):
    // small 🔥×N tucked inside the score pill, on the second line next
    // to the sentence score
    if (game.displayStreak >= 2) {
        const streakText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        streakText.setAttribute('x', scorePillX + 14);
        streakText.setAttribute('y', scorePillY + (isMobile ? 62 : 40));
        streakText.setAttribute('text-anchor', 'start');
        streakText.setAttribute('fill', '#c2410c'); // amber-700
        streakText.setAttribute('font-size', scoreSubFont);
        streakText.setAttribute('font-weight', 'bold');
        streakText.setAttribute('font-family', "'Inter', sans-serif");
        streakText.setAttribute('pointer-events', 'none');
        streakText.textContent = `🔥×${game.displayStreak}`;
        overlayGroup.appendChild(streakText);
    }

    // Left-aligned word flow in sentence order: [auto words] [current
    // word] [preview], starting at the grid's left edge. Uses the full
    // bar width and keeps pills from running off-canvas on long sentences.
    let currentWordBoxLeft = gridStartX;
    let currentWordBoxWidth = 0;

    if (game.currentWordDisplay && game.currentIndex < game.manualItems.length) {
        const activeItem = game.manualItems[game.currentIndex];

        if (activeItem.type === 'box') {
            const phraseText = activeItem.item.words.map(w => w.text).join(' ');
            currentWordBoxWidth = estimateTextWidth(phraseText, isMobile ? 42 : 28);
        } else {
            currentWordBoxWidth = estimateTextWidth(activeItem.item.text, isMobile ? 42 : 28);
        }
    }

    // Get visible auto-placed words in original sentence order
    const visibleAutoWords = game.getVisibleAutoWords();

    // Draw accumulated auto-placed words first (muted pills, left to right)
    if (visibleAutoWords.length > 0) {
        const autoWordWidths = visibleAutoWords.map(word => estimateTextWidth(word, isMobile ? 34 : 24));

        let currentX = gridStartX;

        visibleAutoWords.forEach((wordText, index) => {
            const wordWidth = autoWordWidths[index];
            const centerX = currentX + wordWidth / 2;
            const centerY = topY + barHeight / 2;

            // Muted gray pill for each auto-placed/past word
            const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            bgRect.setAttribute('x', currentX);
            bgRect.setAttribute('y', topY);
            bgRect.setAttribute('width', wordWidth);
            bgRect.setAttribute('height', barHeight);
            bgRect.setAttribute('fill', GM_UI.surfaceAlt);
            bgRect.setAttribute('stroke', GM_UI.border);
            bgRect.setAttribute('stroke-width', '1.5');
            bgRect.setAttribute('rx', '14');
            overlayGroup.appendChild(bgRect);

            const autoText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            autoText.setAttribute('x', centerX);
            autoText.setAttribute('y', centerY + (isMobile ? 12 : 8));
            autoText.setAttribute('text-anchor', 'middle');
            autoText.setAttribute('fill', GM_UI.secondary);
            autoText.setAttribute('font-size', isMobile ? 34 : 24);
            autoText.setAttribute('font-weight', '600');
            autoText.setAttribute('font-family', "'Nunito', sans-serif");
            autoText.textContent = wordText;
            overlayGroup.appendChild(autoText);

            currentX += wordWidth + 10; // Move right for next word
        });

        // Current word starts after the auto words (15px total gap)
        currentWordBoxLeft = currentX + 5;
    }

    // Draw current word (manual placement) after the auto words
    if (game.currentWordDisplay && game.currentIndex < game.manualItems.length) {
        const activeItem = game.manualItems[game.currentIndex];
        const centerX = currentWordBoxLeft + currentWordBoxWidth / 2;
        const centerY = topY + barHeight / 2;

        // Reuse the width computed before the auto-words (same font size)
        // so the pill shape, its text, and the preview offset all agree —
        // a second measurement here with a different size shifts the pill
        // off its slot and overlaps the neighbors
        const wordWidth = currentWordBoxWidth;
        const displayText = activeItem.type === 'box'
            ? activeItem.item.words.map(w => w.text).join(' ')
            : activeItem.item.text;

        // Wrapper group so a wrong placement can trigger a brief CSS shake
        // (purely visual; coordinates unchanged)
        const centerWordGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        if (Date.now() < game.wrongShakeUntil) {
            centerWordGroup.setAttribute('class', 'gm-shake');
        }
        overlayGroup.appendChild(centerWordGroup);

        // Draw center word shape — shape depends on currently selected case
        const centerShape = createTopBarWordShape(game.selectedCase, centerX, topY, wordWidth, barHeight);
        centerWordGroup.appendChild(centerShape);

        // Timer bar for time challenge mode
        if (game.timeChallengeMode && game.wordStartTime !== null) {
            drawTimerBar(overlayGroup, centerX, topY, barHeight, wordWidth, game.wordStartTime);
        }

        // German word in Nunito 700 on the white pill
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', centerX);
        text.setAttribute('y', centerY + (isMobile ? 15 : 9));
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', GM_UI.text);
        text.setAttribute('font-size', isMobile ? 42 : 28);
        text.setAttribute('font-weight', '700');
        text.setAttribute('font-family', "'Nunito', sans-serif");
        text.textContent = displayText;
        centerWordGroup.appendChild(text);

        // Draw next word preview (to the right, in grey).
        // Look at the word immediately after the current item in sentence order.
        // If that word is the start of a box, show the full box phrase.
        const nextWordInSentence = game.words[game.getItemWordRange(activeItem)[1] + 1];
        let nextWordText = null;
        if (nextWordInSentence) {
            const nextManual = game.wordToManualItem.get(nextWordInSentence);
            nextWordText = (nextManual && nextManual.type === 'box')
                ? nextManual.item.words.map(w => w.text).join(' ')
                : nextWordInSentence.text;
        }

        if (nextWordText) {
            let nextWordWidth;
            nextWordWidth = estimateTextWidth(nextWordText, isMobile ? 34 : 24);

            const nextWordX = currentWordBoxLeft + wordWidth + 15; // 15px gap
            const centerX = nextWordX + nextWordWidth / 2;
            const centerY = topY + barHeight / 2;

            // Faded preview pill for the upcoming word
            const boxWidth = nextWordWidth;
            const boxHeight = barHeight;
            const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            bgRect.setAttribute('x', centerX - boxWidth / 2);
            bgRect.setAttribute('y', topY);
            bgRect.setAttribute('width', boxWidth);
            bgRect.setAttribute('height', boxHeight);
            bgRect.setAttribute('fill', GM_UI.white);
            bgRect.setAttribute('fill-opacity', '0.55');
            bgRect.setAttribute('stroke', GM_UI.muted);
            bgRect.setAttribute('stroke-width', '1.5');
            bgRect.setAttribute('stroke-dasharray', '7,5');
            bgRect.setAttribute('rx', '14');
            bgRect.setAttribute('opacity', '0.75');
            overlayGroup.appendChild(bgRect);

            // Text
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', centerX);
            text.setAttribute('y', centerY + (isMobile ? 12 : 8));
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('fill', GM_UI.muted);
            text.setAttribute('font-size', isMobile ? 34 : 24);
            text.setAttribute('font-weight', '600');
            text.setAttribute('font-family', "'Nunito', sans-serif");
            text.setAttribute('opacity', '0.85');
            text.textContent = nextWordText;
            overlayGroup.appendChild(text);
        }
    } else if (game.currentIndex >= game.manualItems.length && game.waitingForContinue) {
        // Sentence complete — one elegant card in the word-bar slot:
        // headline + phase-aware tap hint. Nothing else is drawn over the
        // grid, so the player can admire the completed sentence layout.
        // Gated on waitingForContinue so the card appears only once the
        // tap actually works (showGameComplete fires ~600ms after the
        // last placement; during that gap the ✓/confetti feedback plays).
        const headline = '🎉  Complete!';
        const hint = game.pendingFelderReview
            ? 'Tap to review the structure'
            : 'Tap for the next sentence';
        const headFont = isMobile ? 40 : 26;
        const hintFont = isMobile ? 20 : 14;
        const cardW = Math.max(
            estimateTextWidth(headline, headFont),
            estimateTextWidth(hint, hintFont)
        ) + 56;
        const cardH = isMobile ? 100 : 56;
        // Anchor the card just above the grid so it never covers tiles
        const cardY = Math.max(4, gridStartY - cardH - 6);

        const cardGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        // Redraws rebuild this card from scratch, which would replay the
        // pop animation — only apply it the first time per sentence
        if (!game.completeCardPopped) {
            cardGroup.setAttribute('class', 'gm-pop');
            game.completeCardPopped = true;
        }
        cardGroup.setAttribute('pointer-events', 'none');
        overlayGroup.appendChild(cardGroup);

        const cardRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        cardRect.setAttribute('x', barCenterX - cardW / 2);
        cardRect.setAttribute('y', cardY);
        cardRect.setAttribute('width', cardW);
        cardRect.setAttribute('height', cardH);
        cardRect.setAttribute('fill', '#ecfdf5'); // mirrors CSS token --success-bg
        cardRect.setAttribute('fill-opacity', '0.97');
        cardRect.setAttribute('stroke', GM_UI.success);
        cardRect.setAttribute('stroke-width', '2');
        cardRect.setAttribute('rx', '16');
        cardRect.setAttribute('filter', 'url(#gm-shadow)');
        cardGroup.appendChild(cardRect);

        const completeText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        completeText.setAttribute('x', barCenterX);
        completeText.setAttribute('y', cardY + (isMobile ? 44 : 24));
        completeText.setAttribute('text-anchor', 'middle');
        completeText.setAttribute('fill', '#059669'); // mirrors CSS token --success-600
        completeText.setAttribute('font-size', headFont);
        completeText.setAttribute('font-weight', '700');
        completeText.setAttribute('font-family', "'Nunito', sans-serif");
        completeText.textContent = headline;
        cardGroup.appendChild(completeText);

        const hintText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        hintText.setAttribute('x', barCenterX);
        hintText.setAttribute('y', cardY + (isMobile ? 82 : 45));
        hintText.setAttribute('text-anchor', 'middle');
        hintText.setAttribute('fill', GM_UI.secondary);
        hintText.setAttribute('font-size', hintFont);
        hintText.setAttribute('font-weight', '500');
        hintText.setAttribute('font-family', "'Inter', sans-serif");
        hintText.setAttribute('class', 'gm-hint-pulse');
        hintText.textContent = hint;
        cardGroup.appendChild(hintText);
    }

    return overlayGroup;
}
