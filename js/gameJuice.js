import { GRAMMAR_PALETTE } from './grammaticalConfig.js';
/**
 * Game-mode "juice": shared SVG defs, confetti bursts, floating "+N" text, the ✓/✗ feedback
 * animation and the final celebration overlay. Display only — no game-logic effects.
 * Self-animating effects take an `isActive()` callback and stop when game mode ends.
 */
import { GM_UI } from './gameHud.js';

// Confetti palette (design palette + grammar-semantic accents)
// Confetti in the grammar palette's hues (docs/redesign-plan.md)
export const GM_CONFETTI_COLORS = ['masc', 'fem', 'neut', 'pl', 'ich', 'du', 'ihr'].map(k => GRAMMAR_PALETTE[k].c);

/**
 * Ensure the shared soft drop-shadow filter exists (id 'gm-shadow').
 * Called once per draw() after the SVG is cleared. Guarded against
 * duplicates; ids are 'gm-' prefixed so we never clash with other
 * agents' defs ('tok-'/'fm-'/'gv-').
 */
export function ensureJuiceDefs(svg, parent) {
    if (svg.querySelector('#gm-shadow')) return;

    const svgNS = 'http://www.w3.org/2000/svg';
    const defs = document.createElementNS(svgNS, 'defs');
    defs.setAttribute('class', 'gm-defs');

    const filter = document.createElementNS(svgNS, 'filter');
    filter.setAttribute('id', 'gm-shadow');
    filter.setAttribute('x', '-30%');
    filter.setAttribute('y', '-30%');
    filter.setAttribute('width', '160%');
    filter.setAttribute('height', '160%');

    const shadow = document.createElementNS(svgNS, 'feDropShadow');
    shadow.setAttribute('dx', '0');
    shadow.setAttribute('dy', '2');
    shadow.setAttribute('stdDeviation', '3');
    shadow.setAttribute('flood-color', '#0f172a'); // mirrors CSS text token
    shadow.setAttribute('flood-opacity', '0.18');
    filter.appendChild(shadow);

    defs.appendChild(filter);

    // Gentle vertical gradient for the current-word pill (white → indigo-50)
    const grad = document.createElementNS(svgNS, 'linearGradient');
    grad.setAttribute('id', 'gm-pill-grad');
    grad.setAttribute('x1', '0');
    grad.setAttribute('y1', '0');
    grad.setAttribute('x2', '0');
    grad.setAttribute('y2', '1');
    const stop1 = document.createElementNS(svgNS, 'stop');
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('stop-color', '#ffffff');
    const stop2 = document.createElementNS(svgNS, 'stop');
    stop2.setAttribute('offset', '100%');
    stop2.setAttribute('stop-color', '#eef2ff'); // mirrors CSS token --brand-50
    grad.appendChild(stop1);
    grad.appendChild(stop2);
    defs.appendChild(grad);

    parent.appendChild(defs);
}

/**
 * Burst of small confetti particles (design palette) from (x, y).
 * Self-animating via requestAnimationFrame, self-removing after ~700ms.
 * Survives full SVG redraws by re-attaching to the SVG root.
 */
export function spawnConfetti(svg, x, y, count = 8, spread = 90, isActive = () => true) {
    const svgNS = 'http://www.w3.org/2000/svg';
    const group = document.createElementNS(svgNS, 'g');
    group.setAttribute('class', 'gm-confetti');
    group.setAttribute('pointer-events', 'none');

    const particles = [];
    for (let i = 0; i < count; i++) {
        let el;
        if (i % 2 === 0) {
            el = document.createElementNS(svgNS, 'rect');
            el.setAttribute('x', '-3.5');
            el.setAttribute('y', '-3.5');
            el.setAttribute('width', '7');
            el.setAttribute('height', '7');
            el.setAttribute('rx', '1.5');
        } else {
            el = document.createElementNS(svgNS, 'circle');
            el.setAttribute('r', '3.5');
        }
        el.setAttribute('fill', GM_CONFETTI_COLORS[i % GM_CONFETTI_COLORS.length]);
        const angle = Math.random() * Math.PI * 2;
        const speed = spread * (0.4 + Math.random() * 0.6);
        particles.push({
            el: el,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - spread * 0.5, // upward bias
            rot: 120 + Math.random() * 360
        });
        group.appendChild(el);
    }

    svg.appendChild(group);

    const start = performance.now();
    const duration = 700;
    const tick = (now) => {
        const t = Math.min((now - start) / duration, 1);
        if (t >= 1 || !isActive()) {
            if (group.parentNode) group.parentNode.removeChild(group);
            return;
        }
        // draw() clears the SVG on redraws — re-attach so bursts survive
        if (!group.parentNode) svg.appendChild(group);
        particles.forEach(p => {
            const px = x + p.vx * t;
            const py = y + p.vy * t + spread * 1.6 * t * t; // gravity
            p.el.setAttribute('transform', `translate(${px}, ${py}) rotate(${p.rot * t})`);
        });
        group.setAttribute('opacity', t > 0.55 ? String((1 - t) / 0.45) : '1');
        requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
}

/**
 * Floating "+N" indicator that drifts upward and fades where the
 * placement happened. Self-removing within ~700ms.
 */
export function spawnFloatingText(svg, str, x, y, color, isActive = () => true) {
    const svgNS = 'http://www.w3.org/2000/svg';
    const text = document.createElementNS(svgNS, 'text');
    text.setAttribute('class', 'gm-float-text');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('font-size', '26');
    text.setAttribute('font-weight', '700');
    text.setAttribute('font-family', "'Inter', sans-serif");
    text.setAttribute('fill', color || GM_UI.success);
    text.setAttribute('stroke', 'white');
    text.setAttribute('stroke-width', '4');
    text.setAttribute('paint-order', 'stroke');
    text.setAttribute('pointer-events', 'none');
    text.setAttribute('x', x);
    text.setAttribute('y', y);
    text.textContent = str;
    svg.appendChild(text);

    const start = performance.now();
    const duration = 700;
    const tick = (now) => {
        const t = Math.min((now - start) / duration, 1);
        if (t >= 1 || !isActive()) {
            if (text.parentNode) text.parentNode.removeChild(text);
            return;
        }
        if (!text.parentNode) svg.appendChild(text);
        const ease = 1 - Math.pow(1 - t, 3);
        text.setAttribute('y', y - 44 * ease);
        text.setAttribute('opacity', t < 0.5 ? '1' : String((1 - t) / 0.5));
        requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
}

/**
 * Transform/opacity of the ✓/✗/+N feedback at the current time (600ms grow/float + fade).
 * @param {{symbol: string, x: number, y: number, startTime: number}} anim
 */
function feedbackFrame(anim) {
    const { symbol, x, y, startTime } = anim;
    const progress = Math.min((Date.now() - startTime) / 600, 1);
    const isScorePopup = symbol.startsWith('+');
    const scale = 1 + progress * (isScorePopup ? 0.2 : 0.5);
    const floatY = isScorePopup ? -50 * progress : 0;
    return { transform: `translate(${x}, ${y + floatY}) scale(${scale})`, opacity: 1 - progress };
}

/**
 * Draw feedback animation (tick/cross)
 */
export function drawFeedbackAnimation(parent, anim) {
    if (!anim) return;

    const { symbol, color } = anim;
    const isScorePopup = symbol.startsWith('+');
    const frame = feedbackFrame(anim);

    const feedbackGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    feedbackGroup.setAttribute('class', 'feedback-animation');
    feedbackGroup.setAttribute('transform', frame.transform);
    feedbackGroup.setAttribute('opacity', frame.opacity);
    feedbackGroup.setAttribute('pointer-events', 'none');

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', 0);
    text.setAttribute('y', 0);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('font-size', isScorePopup ? '64' : '100');
    text.setAttribute('font-weight', 'bold');
    text.setAttribute('fill', color);
    text.setAttribute('stroke', 'white');
    text.setAttribute('stroke-width', '4');
    text.setAttribute('paint-order', 'stroke');
    text.textContent = symbol;
    feedbackGroup.appendChild(text);

    parent.appendChild(feedbackGroup);
}

/**
 * Update the floating feedback element's transform/opacity in place.
 */
export function updateFeedbackElement(svg, anim) {
    const feedbackEl = svg.querySelector('.feedback-animation');
    if (!feedbackEl || !anim) return;
    const frame = feedbackFrame(anim);
    feedbackEl.setAttribute('transform', frame.transform);
    feedbackEl.setAttribute('opacity', frame.opacity);
}

/**
 * Final game-complete screen: dark scrim + white rounded card + confetti.
 * Replaces the old alert(); pure DOM overlay, removed on dismiss.
 */
export function showFinalCelebration(finalScore) {
    const existing = document.getElementById('gm-complete-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'gm-complete-overlay';

    // Falling confetti pieces (CSS-animated, removed with the overlay)
    for (let i = 0; i < 18; i++) {
        const piece = document.createElement('span');
        piece.className = 'gm-dom-confetti';
        piece.style.left = `${Math.random() * 100}%`;
        piece.style.background = GM_CONFETTI_COLORS[i % GM_CONFETTI_COLORS.length];
        piece.style.animationDelay = `${(Math.random() * 0.5).toFixed(2)}s`;
        overlay.appendChild(piece);
    }

    const card = document.createElement('div');
    card.className = 'gm-complete-card';

    const emoji = document.createElement('div');
    emoji.className = 'gm-complete-emoji';
    emoji.textContent = '🎉';
    card.appendChild(emoji);

    const title = document.createElement('h2');
    title.className = 'gm-complete-title';
    title.textContent = 'Geschafft!';
    card.appendChild(title);

    const score = document.createElement('div');
    score.className = 'gm-complete-score';
    score.textContent = String(finalScore);
    card.appendChild(score);

    const sub = document.createElement('p');
    sub.className = 'gm-complete-sub';
    sub.textContent = 'points — you mastered German sentence structure!';
    card.appendChild(sub);

    const btn = document.createElement('button');
    btn.className = 'gm-complete-btn';
    btn.textContent = 'Weiter';
    btn.addEventListener('click', () => overlay.remove());
    card.appendChild(btn);

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });

    overlay.appendChild(card);
    document.body.appendChild(overlay);
}
