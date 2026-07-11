class GridViewModel {
    constructor(svg) {
        this.svg = svg;
        this.gridSize = 3; // 3x3 grid

        // Responsive configuration for mobile and desktop
        this.config = {
            mobile: {
                cellWidth: 350,
                cellHeight: 400,
                boxWidth: 280,
                boxHeight: 65,
                fontSize: '34px',
                shapeSize: 90,
                strokeWidth: '8',
                arrowWidth: 5,
                boxStrokeWidth: '4',
                cellStrokeWidth: '4',
                cellPadding: 80,
                spacing: {
                    two: 180,
                    three: 100,
                    min: 30
                }
            },
            desktop: {
                cellWidth: 250,
                cellHeight: 250,
                boxWidth: 200,
                boxHeight: 40,
                fontSize: '20px',
                shapeSize: 50,
                strokeWidth: '4',
                arrowWidth: 3,
                boxStrokeWidth: '3',
                cellStrokeWidth: '2',
                cellPadding: 60,
                spacing: {
                    two: 120,
                    three: 60,
                    min: 20
                }
            }
        };

        // Detect if mobile or desktop (based on viewport width)
        this.isMobile = window.innerWidth <= 768;
        this.currentConfig = this.isMobile ? this.config.mobile : this.config.desktop;

        // Apply current config
        this.cellWidth = this.currentConfig.cellWidth;
        this.cellHeight = this.currentConfig.cellHeight;
        this.padding = 20;

        // Define grid positions for different categories
        // [row, col] - 1-indexed for clarity
        this.positions = {
            // Subjects by pronoun
            'ich': { row: 2, col: 2, label: 'ICH' },
            'du': { row: 1, col: 2, label: 'DU' },
            'wir': { row: 3, col: 2, label: 'WIR' },
            'we': { row: 3, col: 2, label: 'WE' },
            'ihr': { row: 3, col: 1, label: 'IHR' },

            // Objects by gender/number (masculine and feminine swapped)
            'masculine': { row: 1, col: 1, label: 'MASCULINE' },
            'feminine': { row: 1, col: 3, label: 'FEMININE' },
            'neutral': { row: 2, col: 1, label: 'NEUTRAL' },
            'neuter': { row: 2, col: 1, label: 'NEUTRAL' },
            'plural': { row: 2, col: 3, label: 'PLURAL' },

            // Imperative (no subject / conjugation = none)
            'imperative': { row: 3, col: 3, label: 'IMPERATIV' }
        };
    }

    draw(wordManager) {
        // Update configuration based on current window size
        this.isMobile = window.innerWidth <= 768;
        this.currentConfig = this.isMobile ? this.config.mobile : this.config.desktop;
        this.cellWidth = this.currentConfig.cellWidth;
        this.cellHeight = this.currentConfig.cellHeight;

        // Clear existing grid elements
        const existingGroups = this.svg.querySelectorAll('.grid-view-group');
        existingGroups.forEach(g => g.remove());

        const words = wordManager.getAllWords();

        // Create main group for grid view
        const gridGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        gridGroup.setAttribute('class', 'grid-view-group');
        this.svg.appendChild(gridGroup);

        // Calculate grid boundaries
        const startX = 50;
        const startY = 50;

        // Create arrowhead marker
        this.createArrowMarker(gridGroup);

        // Always draw grid cells (even if no words)
        this.drawGridCells(gridGroup, startX, startY);

        // Categorize and position words (only if words exist)
        if (words.length > 0) {
            this.positionWords(words, gridGroup, startX, startY, wordManager);
        }
    }

    createArrowMarker(group) {
        // Delegates to the shared, guarded 'gv-' defs (kept for API compatibility)
        this.ensureGvDefs();
    }

    /**
     * Ensure shared grid-view <defs> exist on the SVG (arrowhead marker + drop shadow).
     * Guarded against duplicates since the SVG canvas is shared across views;
     * ids are prefixed 'gv-' so other views' defs ('tok-'/'fm-'/'gm-') are untouched.
     * Colors are hard-coded hex mirroring the CSS design tokens (var(--x) is
     * unreliable in SVG presentation attributes).
     */
    ensureGvDefs() {
        if (this.svg.querySelector('#gv-defs')) return;

        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        defs.setAttribute('id', 'gv-defs');

        // Sleek arrowhead marker — narrow triangle, same slate as the arrow lines
        const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        marker.setAttribute('id', 'gv-arrowhead');
        marker.setAttribute('markerWidth', '9');
        marker.setAttribute('markerHeight', '7');
        marker.setAttribute('refX', '8');
        marker.setAttribute('refY', '3.5');
        marker.setAttribute('orient', 'auto');

        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        polygon.setAttribute('points', '0 0.5, 9 3.5, 0 6.5, 2 3.5'); // Narrow swallow-tail triangle
        polygon.setAttribute('fill', '#94a3b8'); // slate-400 (mirrors CSS design tokens)

        marker.appendChild(polygon);
        defs.appendChild(marker);

        // Soft drop shadow shared by all grid-view boxes/shapes
        const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
        filter.setAttribute('id', 'gv-shadow');
        filter.setAttribute('x', '-20%');
        filter.setAttribute('y', '-20%');
        filter.setAttribute('width', '140%');
        filter.setAttribute('height', '140%');

        const shadow = document.createElementNS('http://www.w3.org/2000/svg', 'feDropShadow');
        shadow.setAttribute('dx', '0');
        shadow.setAttribute('dy', '1.5');
        shadow.setAttribute('stdDeviation', '2');
        shadow.setAttribute('flood-color', '#0f172a'); // text/ink token
        shadow.setAttribute('flood-opacity', '0.18');

        filter.appendChild(shadow);
        defs.appendChild(filter);

        this.svg.appendChild(defs);
    }

    drawGridCells(group, startX, startY) {
        const cellData = [
            // Row 1 (swapped masculine and feminine positions)
            { row: 1, col: 1, label: 'MASCULINE', color: '#3498db' },   // Blue (masculine)
            { row: 1, col: 2, label: 'DU', color: '#e67e22' },          // Orange (du)
            { row: 1, col: 3, label: 'FEMININE', color: '#e91e63' },    // Pink (feminine)
            // Row 2
            { row: 2, col: 1, label: 'NEUTRAL', color: '#8e44ad' },     // Violet (neutral)
            { row: 2, col: 2, label: 'ICH', color: '#27ae60' },         // Green (ich)
            { row: 2, col: 3, label: 'PLURAL', color: '#c0392b' },      // Red (plural)
            // Row 3
            { row: 3, col: 1, label: 'IHR', color: '#f39c12' },         // Orange/yellow (ihr)
            { row: 3, col: 2, label: 'WIR', color: '#2c3e50' },         // Dark gray (wir)
            { row: 3, col: 3, label: 'IMPERATIV', color: '#7f8c8d' }    // Gray (imperative)
        ];

        cellData.forEach(cell => {
            const x = startX + (cell.col - 1) * this.cellWidth;
            const y = startY + (cell.row - 1) * this.cellHeight;

            // Draw cell background — very low alpha tint of the semantic color,
            // rounded corners and a soft same-hue border for a clean tile look
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', x);
            rect.setAttribute('y', y);
            rect.setAttribute('width', this.cellWidth);
            rect.setAttribute('height', this.cellHeight);
            rect.setAttribute('rx', '12');
            rect.setAttribute('ry', '12');
            rect.setAttribute('fill', cell.color);
            rect.setAttribute('fill-opacity', '0.08');
            rect.setAttribute('stroke', cell.color);
            rect.setAttribute('stroke-opacity', '0.3');
            rect.setAttribute('stroke-width', this.currentConfig.cellStrokeWidth);
            rect.setAttribute('pointer-events', 'none');
            group.appendChild(rect);

            // Cell labels removed for cleaner view
        });
    }

    positionWords(words, group, startX, startY, wordManager) {
        // Parse sentence into boxes and connecting words
        const { boxes, connections, leadingWords, trailingWords } = this.parseSentenceFlow(words);

        // First pass: Count how many boxes go in each cell
        const cellOccupancy = {};
        const boxCellAssignments = [];

        boxes.forEach((box) => {
            const position = this.getWordPosition(box.mainWord);
            if (position) {
                const cellKey = `${position.row}-${position.col}`;
                if (!cellOccupancy[cellKey]) {
                    cellOccupancy[cellKey] = 0;
                }
                boxCellAssignments.push({ box, position, cellKey, indexInCell: cellOccupancy[cellKey] });
                cellOccupancy[cellKey]++;
            }
        });

        // Second pass: Draw all boxes with proper centering
        const boxPositions = [];
        boxCellAssignments.forEach(({ box, position, cellKey, indexInCell }) => {
            const cellX = startX + (position.col - 1) * this.cellWidth;
            const cellY = startY + (position.row - 1) * this.cellHeight;

            // Calculate dynamic spacing based on number of boxes
            const totalBoxesInCell = cellOccupancy[cellKey];
            const boxHeight = this.currentConfig.boxHeight;
            const cellPadding = this.currentConfig.cellPadding;
            const availableHeight = this.cellHeight - cellPadding - (totalBoxesInCell * boxHeight);

            // Calculate spacing based on number of boxes
            let boxSpacing = this.currentConfig.spacing.two;
            if (totalBoxesInCell === 2) {
                boxSpacing = this.currentConfig.spacing.two;
            } else if (totalBoxesInCell === 3) {
                boxSpacing = this.currentConfig.spacing.three;
            } else if (totalBoxesInCell > 3) {
                // For 4+ boxes, calculate dynamically
                const maxPossibleSpacing = availableHeight / (totalBoxesInCell - 1);
                boxSpacing = Math.max(this.currentConfig.spacing.min, maxPossibleSpacing);
            }

            const centerX = cellX + this.cellWidth / 2;
            const centerY = cellY + this.cellHeight / 2 + (indexInCell * boxSpacing) - ((totalBoxesInCell - 1) * boxSpacing / 2);

            // Draw the box
            this.drawPhraseBox(group, box, centerX, centerY);

            // Store position for arrow drawing
            boxPositions.push({
                centerX: centerX,
                centerY: centerY,
                box: box
            });
        });

        // Draw incoming arrow if there are leading words
        if (leadingWords.length > 0 && boxPositions.length > 0) {
            this.drawIncomingArrow(group, boxPositions[0], leadingWords, startX, wordManager);
        }

        // Draw arrows between boxes with connecting words
        for (let i = 0; i < boxPositions.length - 1; i++) {
            const fromBox = boxPositions[i];
            const toBox = boxPositions[i + 1];
            const connectionWords = connections[i] || [];

            this.drawArrow(group, fromBox, toBox, connectionWords, wordManager);
        }

        // Draw outgoing arrow for final connection (e.g., sentence-final verbs)
        // This handles the case where connections.length === boxes.length (final connection after last box)
        if (boxPositions.length > 0 && connections.length === boxPositions.length) {
            const finalConnection = connections[connections.length - 1];
            if (finalConnection && finalConnection.length > 0) {
                this.drawOutgoingArrow(group, boxPositions[boxPositions.length - 1], finalConnection, startX, wordManager);
            }
        }

        // Draw outgoing arrow if there are trailing words (legacy support)
        if (trailingWords.length > 0 && boxPositions.length > 0) {
            this.drawOutgoingArrow(group, boxPositions[boxPositions.length - 1], trailingWords, startX, wordManager);
        }

        console.log('=== END FLOW DIAGRAM ===\n');
    }

    parseSentenceFlow(words) {
        // Words that connect clauses — not part of any noun cluster
        const CONNECTOR_TYPES = new Set([
            'verb', 'modal', 'preposition', 'conjunction', 'coord-conjunction', 'other'
        ]);

        const isConnector = (word) => CONNECTOR_TYPES.has(word.type);

        // A word is noun-typed if it carries a grammatical role (subject or any object variant).
        // Adjectives and determiners share the same case but not this role — the last noun-typed
        // word in a cluster is used as mainWord for grid-cell positioning.
        const isNounType = (word) =>
            word.type === 'subject' ||
            word.type === 'direct-object' ||
            word.type.includes('object');

        const boxes = [];
        const connections = [];
        const leadingWords = [];
        const trailingWords = []; // kept for API compatibility
        let currentCluster = null;
        let pendingConnectors = [];

        const finalizeCluster = () => {
            if (!currentCluster.mainWord) {
                currentCluster.mainWord = currentCluster.words[currentCluster.words.length - 1];
            }
            boxes.push(currentCluster);
            currentCluster = null;
        };

        // Cluster key combines case and gender: "dem grünen Gras" (dat/n) and "einem Filmstar"
        // (dat/m) share the same case but differ in gender, so they form separate clusters.
        const clusterKey = (word) => `${word.case || 'nom'}/${word.gender || 'none'}`;

        const startCluster = (word) => {
            // Flush accumulated connectors into the right bucket
            if (boxes.length === 0) {
                leadingWords.push(...pendingConnectors);
            } else {
                connections.push([...pendingConnectors]);
            }
            pendingConnectors = [];
            currentCluster = {
                words: [word],
                key: clusterKey(word),
                case: word.case || 'nom',
                mainWord: isNounType(word) ? word : null
            };
        };

        for (const word of words) {
            if (isConnector(word)) {
                if (currentCluster) finalizeCluster();
                pendingConnectors.push(word);
            } else {
                if (currentCluster && currentCluster.key === clusterKey(word)) {
                    currentCluster.words.push(word);
                    // Always track the last noun-typed word so mainWord is the head noun,
                    // not the preceding determiner
                    if (isNounType(word)) currentCluster.mainWord = word;
                } else {
                    if (currentCluster) finalizeCluster();
                    startCluster(word);
                }
            }
        }

        if (currentCluster) finalizeCluster();

        // Connectors after the last box go as a final connection entry so
        // positionWords draws them on the outgoing arrow (connections.length === boxes.length)
        if (pendingConnectors.length > 0) {
            if (boxes.length === 0) {
                leadingWords.push(...pendingConnectors);
            } else {
                connections.push([...pendingConnectors]);
            }
        }

        console.log('Boxes:', boxes.map(b => `[${b.words.map(w => w.text).join(' ')}]`).join(' -> '));
        console.log('Connections:', connections.map(c => c.map(w => w.text).join(' ')));
        console.log('Leading:', leadingWords.map(w => w.text));

        return { boxes, connections, leadingWords, trailingWords };
    }

    getWordPosition(word) {
        // Subjects: Check if it's a pronoun (ich, du, wir) or a noun (use gender/number)
        if (word.type === 'subject') {
            if (word.conjugation && word.conjugation.pronoun) {
                const pronoun = word.conjugation.pronoun.toLowerCase();

                // If it's a personal pronoun (ich, du, wir, ihr), use the pronoun cell
                if (pronoun === 'ich' || pronoun === 'du' || pronoun === 'wir' || pronoun === 'we' || pronoun === 'ihr') {
                    return this.positions[pronoun] || this.positions['ich'];
                }

                // Handle sie_pl format (backend returns this for plural sie)
                if (pronoun === 'sie_pl') {
                    return this.positions['plural'];
                }

                // Otherwise (er, sie, es, sie-plural), use gender/number of the noun
                // Check number first (plural takes precedence)
                if (word.number === 'pl') {
                    return this.positions['plural'];
                }

                // Then check gender
                const gender = word.gender;
                if (gender === 'f') {
                    return this.positions['feminine'];
                } else if (gender === 'm') {
                    return this.positions['masculine'];
                } else if (gender === 'n' || gender === 'neuter') {
                    return this.positions['neutral'];
                }
            }

            // Fallback: use gender/number if no conjugation info
            if (word.number === 'pl') {
                return this.positions['plural'];
            }
            const gender = word.gender;
            if (gender === 'f') {
                return this.positions['feminine'];
            } else if (gender === 'm') {
                return this.positions['masculine'];
            } else if (gender === 'n' || gender === 'neuter') {
                return this.positions['neutral'];
            }

            // Final fallback: if subject has no gender/number info, default to MASCULINE position
            console.warn(`⚠️  Subject "${word.text}" has no gender/number info - defaulting to MASCULINE position`);
            return this.positions['masculine'];
        }

        // Objects are positioned by gender/number
        if (word.type.includes('object') || word.type === 'adjective') {
            // Check if it's an object pronoun (mich, dich, mir, dir, etc.)
            // Strip punctuation before checking
            const text = word.text.toLowerCase().replace(/[.,!?;:]$/g, '');
            const objectPronouns = {
                // Accusative pronouns
                'mich': 'ich',
                'dich': 'du',
                'uns': 'wir',
                'euch': 'ihr',
                // Dative pronouns
                'mir': 'ich',
                'dir': 'du'
            };

            if (objectPronouns[text]) {
                // Object pronouns go to their corresponding pronoun cells
                const basePronoun = objectPronouns[text];
                return this.positions[basePronoun] || this.positions['ich'];
            }

            // For regular objects (nouns), use gender/number
            if (word.number === 'pl') {
                return this.positions['plural'];
            }

            const gender = word.gender;
            if (gender === 'f') {
                return this.positions['feminine'];
            } else if (gender === 'm') {
                return this.positions['masculine'];
            } else if (gender === 'n' || gender === 'neuter') {
                return this.positions['neutral'];
            }

            // Final fallback: if object has no gender/number info, default to MASCULINE position
            console.warn(`⚠️  Object "${word.text}" has no gender/number info - defaulting to MASCULINE position`);
            return this.positions['masculine'];
        }

        // Verbs and modals are positioned based on their conjugation pronoun
        if (word.type === 'verb' || word.type === 'modal') {
            if (word.conjugation && word.conjugation.pronoun) {
                const pronoun = word.conjugation.pronoun.toLowerCase();

                // Imperative (no subject) → row 3, col 3
                if (pronoun === 'none') {
                    return this.positions['imperative'];
                }

                // If it's a personal pronoun (ich, du, wir, ihr), use the pronoun cell
                if (pronoun === 'ich' || pronoun === 'du' || pronoun === 'wir' || pronoun === 'we' || pronoun === 'ihr') {
                    return this.positions[pronoun] || this.positions['ich'];
                }

                // Handle sie_pl format (backend returns this for plural sie)
                if (pronoun === 'sie_pl') {
                    return this.positions['plural'];
                }

                // For er/sie/es (3rd person singular), map to gender-based cells
                // er → masculine, sie → feminine, es → neutral
                if (pronoun === 'er') {
                    return this.positions['masculine'];
                } else if (pronoun === 'sie' && word.number !== 'pl') {
                    return this.positions['feminine'];
                } else if (pronoun === 'es') {
                    return this.positions['neutral'];
                } else if (pronoun === 'sie' && word.number === 'pl') {
                    // sie (plural)
                    return this.positions['plural'];
                }
            }

            // Fallback: if verb has no conjugation info, default to ICH position
            console.warn(`⚠️  Verb "${word.text}" has no conjugation info - defaulting to ICH position`);
            return this.positions['ich'];
        }

        // Prepositions and other words go with objects they relate to
        // This is handled in positionWords()
        return null;
    }

    drawPhraseBox(group, phraseBox, centerX, centerY) {
        const phraseText = phraseBox.words.map(w => w.text).join(' ');
        const caseType = phraseBox.case;

        // Determine box color based on the main word's properties
        const mainWord = phraseBox.mainWord;
        let boxColor = 'rgba(255, 255, 255, 0.9)'; // Default white

        // Check if it's a personal pronoun (ich, du, wir, ihr)
        if (mainWord.conjugation && mainWord.conjugation.pronoun) {
            const pronoun = mainWord.conjugation.pronoun.toLowerCase();
            const pronounColors = {
                'ich': '#27ae60',
                'du': '#e67e22',
                'wir': '#2c3e50',
                'ihr': '#f39c12'
            };
            if (pronounColors[pronoun]) {
                boxColor = pronounColors[pronoun];
            }
        }

        // If not a personal pronoun, use gender/number colors
        if (boxColor === 'rgba(255, 255, 255, 0.9)') {
            if (mainWord.number === 'pl') {
                boxColor = '#c0392b'; // Red for plural
            } else if (mainWord.gender === 'f') {
                boxColor = '#e91e63'; // Pink for feminine
            } else if (mainWord.gender === 'm') {
                boxColor = '#3498db'; // Blue for masculine
            } else if (mainWord.gender === 'n' || mainWord.gender === 'neuter') {
                boxColor = '#8e44ad'; // Violet for neutral
            }
        }

        // Ensure shared 'gv-' defs exist (this method is also called directly by gamemode.js)
        this.ensureGvDefs();

        // Create box based on case
        const box = this.createCaseBox(caseType, centerX, centerY, boxColor);
        if (box) {
            // Opaque white base under the tinted box so the low-alpha fill reads
            // cleanly over cell tints, and carries the soft drop shadow
            const base = box.cloneNode(false);
            base.setAttribute('fill', '#ffffff');
            base.setAttribute('fill-opacity', '1');
            base.setAttribute('stroke', 'none');
            base.setAttribute('filter', 'url(#gv-shadow)');
            group.appendChild(base);
            group.appendChild(box);
        }

        // German word text — Nunito, dark ink, subtle white halo for crispness
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', centerX);
        const yOffset = this.isMobile ? 12 : 7; // Adjust y offset based on font size
        text.setAttribute('y', centerY + yOffset);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', '#0f172a'); // ink token
        text.setAttribute('stroke', 'white');
        text.setAttribute('stroke-width', this.currentConfig.strokeWidth);
        text.setAttribute('stroke-linejoin', 'round');
        text.setAttribute('paint-order', 'stroke');
        text.setAttribute('font-family', "'Nunito', 'Inter', sans-serif");
        text.setAttribute('font-size', this.currentConfig.fontSize);
        text.setAttribute('font-weight', '700');
        text.setAttribute('pointer-events', 'none');
        text.textContent = phraseText;
        group.appendChild(text);
    }

    drawArrow(group, fromBox, toBox, connectionWords, wordManager) {
        // Ensure shared 'gv-' defs exist (this method is also called directly by gamemode.js)
        this.ensureGvDefs();

        const fromX = fromBox.centerX;
        const fromY = fromBox.centerY;
        const toX = toBox.centerX;
        const toY = toBox.centerY;

        // Calculate arrow start and end points (adjust for box boundaries)
        const boxWidth = this.currentConfig.boxWidth;
        const boxHeight = this.currentConfig.boxHeight;

        // Determine if arrow is primarily vertical
        const deltaX = Math.abs(toX - fromX);
        const deltaY = Math.abs(toY - fromY);
        const isVertical = deltaY > deltaX * 1.5; // Vertical if deltaY is significantly larger
        const isSameColumn = deltaX < 50; // In same column if very close horizontally

        // Calculate angle and adjust start/end points
        const angle = Math.atan2(toY - fromY, toX - fromX);

        let startX, startY, endX, endY, pathD, midX, midY;

        // ALWAYS use CURVED PATH for all arrows to avoid overlapping
        // Determine curve direction (alternate left/right to avoid overlaps)
        const curveDirection = (fromBox.box && toBox.box) ?
            ((fromBox.box.mainWord.text.charCodeAt(0) % 2 === 0) ? 1 : -1) : 1;

        // Determine primary direction (vertical vs horizontal)
        if (isVertical || isSameColumn) {
            // Primarily VERTICAL arrows - curve horizontally

            // Horizontal offset for the curve (route to the side)
            const curveOffset = 80 * curveDirection;

            // Attach from bottom or top of box
            if (toY > fromY) {
                // Going down: start from bottom of fromBox
                startX = fromX;
                startY = fromY + boxHeight / 2;
                endX = toX;
                endY = toY - boxHeight / 2;
            } else {
                // Going up: start from top of fromBox
                startX = fromX;
                startY = fromY - boxHeight / 2;
                endX = toX;
                endY = toY + boxHeight / 2;
            }

            // Create curved path using cubic Bezier
            // Control points offset horizontally to route around boxes
            const controlY1 = startY + (endY - startY) * 0.3;
            const controlX1 = startX + curveOffset;
            const controlY2 = startY + (endY - startY) * 0.7;
            const controlX2 = endX + curveOffset;

            pathD = `M ${startX} ${startY} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${endX} ${endY}`;

            // Midpoint for text placement (on the curve)
            midX = startX + curveOffset;
            midY = (startY + endY) / 2;

        } else {
            // Primarily HORIZONTAL or DIAGONAL arrows - curve vertically

            // Start and end points from sides of boxes
            startX = fromX + Math.cos(angle) * (boxWidth / 2);
            startY = fromY + Math.sin(angle) * (boxHeight / 2);
            endX = toX - Math.cos(angle) * (boxWidth / 2);
            endY = toY - Math.sin(angle) * (boxHeight / 2);

            // Vertical offset for the curve (route above or below)
            const curveOffset = 40 * curveDirection;

            // Create curved path using cubic Bezier
            // Control points offset vertically to create smooth arc
            const controlX1 = startX + (endX - startX) * 0.3;
            const controlY1 = startY + curveOffset;
            const controlX2 = startX + (endX - startX) * 0.7;
            const controlY2 = endY + curveOffset;

            pathD = `M ${startX} ${startY} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${endX} ${endY}`;

            // Midpoint for text placement (on the curve)
            midX = (startX + endX) / 2;
            midY = (startY + endY) / 2 + curveOffset;
        }

        // Draw arrow path
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathD);
        path.setAttribute('stroke', '#94a3b8'); // slate-400 (mirrors CSS design tokens)
        path.setAttribute('stroke-width', this.currentConfig.arrowWidth);
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('fill', 'none');
        path.setAttribute('marker-end', 'url(#gv-arrowhead)');
        path.setAttribute('pointer-events', 'none');
        group.appendChild(path);

        // Draw connection words on arrow with shapes
        if (connectionWords.length > 0) {
            // Place at the midpoint of the curve (already calculated above)
            const textX = midX;
            const textY = midY;

            // Spacing based on shape size (add 20px gap between shapes)
            const shapeSpacing = this.currentConfig.shapeSize + 20;

            connectionWords.forEach((word, index) => {
                const offsetY = (index - (connectionWords.length - 1) / 2) * shapeSpacing;

                // Draw word with shape
                this.drawWordWithShape(group, word, textX, textY + offsetY, wordManager);
            });
        }
    }

    drawIncomingArrow(group, firstBox, leadingWords, startX, wordManager) {
        // Ensure shared 'gv-' defs exist (this method is also called directly by gamemode.js)
        this.ensureGvDefs();

        const boxWidth = this.currentConfig.boxWidth;

        // Arrow comes from the left edge
        const arrowStartX = startX - 100;
        const arrowStartY = firstBox.centerY;
        const arrowEndX = firstBox.centerX - boxWidth / 2;
        const arrowEndY = firstBox.centerY;

        // Create curved path for incoming arrow
        const curveOffset = -30; // Curve upward
        const controlX1 = arrowStartX + (arrowEndX - arrowStartX) * 0.3;
        const controlY1 = arrowStartY + curveOffset;
        const controlX2 = arrowStartX + (arrowEndX - arrowStartX) * 0.7;
        const controlY2 = arrowEndY + curveOffset;
        const pathD = `M ${arrowStartX} ${arrowStartY} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${arrowEndX} ${arrowEndY}`;

        // Draw curved arrow path
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathD);
        path.setAttribute('stroke', '#94a3b8'); // slate-400 (mirrors CSS design tokens)
        path.setAttribute('stroke-width', this.currentConfig.arrowWidth);
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('fill', 'none');
        path.setAttribute('marker-end', 'url(#gv-arrowhead)');
        path.setAttribute('pointer-events', 'none');
        group.appendChild(path);

        // Draw leading words on arrow with shapes
        if (leadingWords.length > 0) {
            const midX = (arrowStartX + arrowEndX) / 2;
            const midY = (arrowStartY + arrowEndY) / 2 + curveOffset;

            // Spacing based on shape size (add 20px gap between shapes)
            const shapeSpacing = this.currentConfig.shapeSize + 20;

            leadingWords.forEach((word, index) => {
                const offsetY = (index - (leadingWords.length - 1) / 2) * shapeSpacing;

                // Draw word with shape
                this.drawWordWithShape(group, word, midX, midY + offsetY, wordManager);
            });
        }
    }

    drawOutgoingArrow(group, lastBox, trailingWords, startX, wordManager) {
        // Ensure shared 'gv-' defs exist (this method is also called directly by gamemode.js)
        this.ensureGvDefs();

        const boxWidth = this.currentConfig.boxWidth;

        // Arrow goes to the right edge
        const arrowStartX = lastBox.centerX + boxWidth / 2;
        const arrowStartY = lastBox.centerY;
        const arrowEndX = startX + (this.gridSize * this.cellWidth) + 100;
        const arrowEndY = lastBox.centerY;

        // Create curved path for outgoing arrow
        const curveOffset = -30; // Curve upward
        const controlX1 = arrowStartX + (arrowEndX - arrowStartX) * 0.3;
        const controlY1 = arrowStartY + curveOffset;
        const controlX2 = arrowStartX + (arrowEndX - arrowStartX) * 0.7;
        const controlY2 = arrowEndY + curveOffset;
        const pathD = `M ${arrowStartX} ${arrowStartY} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${arrowEndX} ${arrowEndY}`;

        // Draw curved arrow path
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathD);
        path.setAttribute('stroke', '#94a3b8'); // slate-400 (mirrors CSS design tokens)
        path.setAttribute('stroke-width', this.currentConfig.arrowWidth);
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('fill', 'none');
        path.setAttribute('marker-end', 'url(#gv-arrowhead)');
        path.setAttribute('pointer-events', 'none');
        group.appendChild(path);

        // Draw trailing words on arrow with shapes
        if (trailingWords.length > 0) {
            const midX = (arrowStartX + arrowEndX) / 2;
            const midY = (arrowStartY + arrowEndY) / 2 + curveOffset;

            // Spacing based on shape size (add 20px gap between shapes)
            const shapeSpacing = this.currentConfig.shapeSize + 20;

            trailingWords.forEach((word, index) => {
                const offsetY = (index - (trailingWords.length - 1) / 2) * shapeSpacing;

                // Draw word with shape
                this.drawWordWithShape(group, word, midX, midY + offsetY, wordManager);
            });
        }
    }


    /**
     * Draw a word with its shape (for connection words on arrows)
     * Based on renderer.js createShape logic, with responsive sizing
     */
    drawWordWithShape(group, word, centerX, centerY, wordManager) {
        const shapeSize = this.currentConfig.shapeSize;
        const scale = shapeSize / 50; // Scale factor from original 50px shapes
        const halfSize = shapeSize / 2;

        // Create a group for the word (shape + text)
        const wordGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        wordGroup.setAttribute('transform', `translate(${centerX - halfSize}, ${centerY - halfSize})`);

        let shape;

        // Use the same color logic as the felder model
        const fillColor = wordManager.getColorForWord(word);

        // Helper function to scale points
        const scalePoints = (points) => {
            return points.split(' ').map(pair => {
                const [x, y] = pair.split(',').map(Number);
                return `${x * scale},${y * scale}`;
            }).join(' ');
        };

        // Create shape based on word type (same as renderer.js but scaled up)
        if (word.type === 'verb' || word.type === 'modal') {
            // Hexagon for verbs
            shape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            shape.setAttribute('points', scalePoints('25,0 45,12.5 45,37.5 25,50 5,37.5 5,12.5'));
        } else if (word.type === 'conjunction') {
            // Pentagon for subordinating conjunctions
            shape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            shape.setAttribute('points', scalePoints('25,0 50,19 40,50 10,50 0,19'));
        } else if (word.type === 'coord-conjunction') {
            // Star/cross for coordinating conjunctions
            shape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            shape.setAttribute('points', scalePoints('25,0 30,20 50,25 30,30 25,50 20,30 0,25 20,20'));
        } else if (word.type === 'preposition') {
            // Different shapes based on case
            const prepCase = wordManager.getPrepositionCase(word.text);

            if (prepCase === 'akk') {
                // Rectangle for accusative prepositions
                shape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                shape.setAttribute('x', 10 * scale);
                shape.setAttribute('y', 10 * scale);
                shape.setAttribute('width', 30 * scale);
                shape.setAttribute('height', 30 * scale);
                shape.setAttribute('rx', 3 * scale);
            } else if (prepCase === 'dat') {
                // Triangle for dative prepositions
                shape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                shape.setAttribute('points', scalePoints('25,5 45,45 5,45'));
            } else if (prepCase === 'wechsel') {
                // Parallelogram for wechsel prepositions
                shape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                shape.setAttribute('points', scalePoints('18,10 43,10 32,40 7,40'));
            } else if (prepCase === 'gen') {
                // Diamond for genitive prepositions
                shape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                shape.setAttribute('x', 12.5 * scale);
                shape.setAttribute('y', 12.5 * scale);
                shape.setAttribute('width', 25 * scale);
                shape.setAttribute('height', 25 * scale);
                shape.setAttribute('transform', `rotate(45 ${halfSize} ${halfSize})`);
            } else {
                // Default triangle
                shape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                shape.setAttribute('points', scalePoints('25,5 45,45 5,45'));
            }
        } else if (word.type === 'other') {
            // Octagon for "other"
            shape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            shape.setAttribute('points', scalePoints('15,0 35,0 50,15 50,35 35,50 15,50 0,35 0,15'));
        } else {
            // Default circle for other types
            shape = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            shape.setAttribute('cx', halfSize);
            shape.setAttribute('cy', halfSize);
            shape.setAttribute('r', halfSize);
        }

        // Opaque white base under the tinted shape so the label reads cleanly
        // over the arrow line, and carries the soft drop shadow
        const base = shape.cloneNode(false);
        base.setAttribute('fill', '#ffffff');
        base.setAttribute('stroke', 'none');
        base.setAttribute('filter', 'url(#gv-shadow)');
        base.setAttribute('pointer-events', 'none');
        wordGroup.appendChild(base);

        // Tinted rendering: low-alpha fill + saturated same-color border.
        // Shape semantics (word type / preposition case) are unchanged.
        shape.setAttribute('fill', fillColor);
        shape.setAttribute('fill-opacity', '0.14');
        shape.setAttribute('stroke', fillColor);
        shape.setAttribute('stroke-width', this.currentConfig.arrowWidth);
        shape.setAttribute('stroke-linejoin', 'round');
        shape.setAttribute('pointer-events', 'none');
        wordGroup.appendChild(shape);

        // German word text — Nunito, dark ink, subtle white halo for crispness
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', halfSize);
        const yOffset = this.isMobile ? 12 : 7; // Adjust y offset based on font size
        text.setAttribute('y', halfSize + yOffset);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', '#0f172a'); // ink token
        text.setAttribute('stroke', 'white');
        text.setAttribute('stroke-width', this.currentConfig.strokeWidth);
        text.setAttribute('stroke-linejoin', 'round');
        text.setAttribute('paint-order', 'stroke');
        text.setAttribute('font-family', "'Nunito', 'Inter', sans-serif");
        text.setAttribute('font-size', this.currentConfig.fontSize);
        text.setAttribute('font-weight', '700');
        text.setAttribute('pointer-events', 'none');
        text.textContent = word.text;
        wordGroup.appendChild(text);

        group.appendChild(wordGroup);
    }

    createCaseBox(caseType, centerX, centerY, fillColor = 'rgba(255, 255, 255, 0.9)') {
        let shape;
        const boxWidth = this.currentConfig.boxWidth;
        const boxHeight = this.currentConfig.boxHeight;
        const boxX = centerX - boxWidth / 2;
        const boxY = centerY - boxHeight / 2;

        if (caseType === 'nom') {
            // Rounded rectangle for Nominative
            shape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            shape.setAttribute('x', boxX);
            shape.setAttribute('y', boxY);
            shape.setAttribute('width', boxWidth);
            shape.setAttribute('height', boxHeight);
            shape.setAttribute('rx', '20');
            shape.setAttribute('ry', '20');
        } else if (caseType === 'akk') {
            // Rectangle with slight rounding for Accusative
            shape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            shape.setAttribute('x', boxX);
            shape.setAttribute('y', boxY);
            shape.setAttribute('width', boxWidth);
            shape.setAttribute('height', boxHeight);
            shape.setAttribute('rx', '5');
            shape.setAttribute('ry', '5');
        } else if (caseType === 'dat') {
            // Trapezoid for Dative
            shape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            const slope = 15;
            const points = `${boxX + slope},${boxY} ${boxX + boxWidth - slope},${boxY} ${boxX + boxWidth},${boxY + boxHeight} ${boxX},${boxY + boxHeight}`;
            shape.setAttribute('points', points);
        } else if (caseType === 'gen') {
            // Parallelogram for Genitive
            shape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            const slant = 10;
            const points = `${boxX + slant},${boxY} ${boxX + boxWidth + slant},${boxY} ${boxX + boxWidth - slant},${boxY + boxHeight} ${boxX - slant},${boxY + boxHeight}`;
            shape.setAttribute('points', points);
        } else {
            // Default rounded rectangle
            shape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            shape.setAttribute('x', boxX);
            shape.setAttribute('y', boxY);
            shape.setAttribute('width', boxWidth);
            shape.setAttribute('height', boxHeight);
            shape.setAttribute('rx', '10');
            shape.setAttribute('ry', '10');
        }

        // Tinted rendering: low-alpha fill of the semantic color + saturated border.
        // Case is still encoded by SHAPE; color encoding stays via the border/tint.
        if (fillColor === 'rgba(255, 255, 255, 0.9)') {
            // No semantic color found — plain white box with a neutral slate border
            shape.setAttribute('fill', '#ffffff');
            shape.setAttribute('stroke', '#94a3b8'); // slate-400 (mirrors CSS design tokens)
        } else {
            shape.setAttribute('fill', fillColor);
            shape.setAttribute('fill-opacity', '0.13');
            shape.setAttribute('stroke', fillColor);
        }
        shape.setAttribute('stroke-width', this.currentConfig.boxStrokeWidth);
        shape.setAttribute('stroke-linejoin', 'round');
        shape.setAttribute('pointer-events', 'none');

        return shape;
    }

    clear() {
        const existingGroups = this.svg.querySelectorAll('.grid-view-group');
        existingGroups.forEach(g => g.remove());
    }
}
