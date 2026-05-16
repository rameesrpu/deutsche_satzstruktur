class GridViewModel {
    constructor(svg) {
        this.svg = svg;
        this.gridSize = 3; // 3x3 grid
        this.cellWidth = 350;
        this.cellHeight = 250;
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
            'plural': { row: 2, col: 3, label: 'PLURAL' }
        };
    }

    draw(wordManager) {
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
            this.positionWords(words, gridGroup, startX, startY);
        }
    }

    createArrowMarker(group) {
        // Create a marker definition for arrowheads
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        marker.setAttribute('id', 'arrowhead');
        marker.setAttribute('markerWidth', '10');
        marker.setAttribute('markerHeight', '10');
        marker.setAttribute('refX', '9');
        marker.setAttribute('refY', '3');
        marker.setAttribute('orient', 'auto');

        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        polygon.setAttribute('points', '0 0, 10 3, 0 6');
        polygon.setAttribute('fill', '#2c3e50');

        marker.appendChild(polygon);
        defs.appendChild(marker);
        group.appendChild(defs);
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
            { row: 3, col: 3, label: '', color: '#f5f5f5' }             // Light gray
        ];

        cellData.forEach(cell => {
            const x = startX + (cell.col - 1) * this.cellWidth;
            const y = startY + (cell.row - 1) * this.cellHeight;

            // Draw cell background
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', x);
            rect.setAttribute('y', y);
            rect.setAttribute('width', this.cellWidth);
            rect.setAttribute('height', this.cellHeight);
            rect.setAttribute('fill', cell.color);
            rect.setAttribute('stroke', '#555');
            rect.setAttribute('stroke-width', 2);
            rect.setAttribute('opacity', 0.4);
            rect.setAttribute('pointer-events', 'none');
            group.appendChild(rect);

            // Draw cell label with white border
            if (cell.label) {
                // White stroke (border) - more subtle
                const textStroke = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                textStroke.setAttribute('x', x + this.cellWidth / 2);
                textStroke.setAttribute('y', y + 20);
                textStroke.setAttribute('text-anchor', 'middle');
                textStroke.setAttribute('font-size', '10px');
                textStroke.setAttribute('font-weight', 'normal');
                textStroke.setAttribute('stroke', 'white');
                textStroke.setAttribute('stroke-width', '2');
                textStroke.setAttribute('fill', 'none');
                textStroke.setAttribute('opacity', '0.7');
                textStroke.setAttribute('pointer-events', 'none');
                textStroke.textContent = cell.label;
                group.appendChild(textStroke);

                // Text fill - lighter and more subtle
                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.setAttribute('x', x + this.cellWidth / 2);
                text.setAttribute('y', y + 20);
                text.setAttribute('text-anchor', 'middle');
                text.setAttribute('font-size', '10px');
                text.setAttribute('font-weight', 'normal');
                text.setAttribute('fill', '#999');
                text.setAttribute('opacity', '0.7');
                text.setAttribute('pointer-events', 'none');
                text.textContent = cell.label;
                group.appendChild(text);
            }
        });
    }

    positionWords(words, group, startX, startY) {
        console.log('=== FLOW DIAGRAM: Parsing sentence ===');

        // Parse sentence into boxes and connecting words
        const { boxes, connections, leadingWords, trailingWords } = this.parseSentenceFlow(words);

        console.log('Boxes:', boxes.map(b => `[${b.words.map(w => w.text).join(' ')}]`).join(' -> '));
        console.log('Connections:', connections);
        console.log('Leading words:', leadingWords);
        console.log('Trailing words:', trailingWords);

        // First pass: Count how many boxes go in each cell
        const cellOccupancy = {};
        const boxCellAssignments = [];

        boxes.forEach((box, index) => {
            const position = this.getWordPosition(box.mainWord);
            console.log(`Box ${index} "${box.words.map(w => w.text).join(' ')}" -> position:`, position);
            if (position) {
                const cellKey = `${position.row}-${position.col}`;
                if (!cellOccupancy[cellKey]) {
                    cellOccupancy[cellKey] = 0;
                }
                boxCellAssignments.push({ box, position, cellKey, indexInCell: cellOccupancy[cellKey] });
                cellOccupancy[cellKey]++;
            } else {
                console.warn(`⚠️  Box ${index} "${box.words.map(w => w.text).join(' ')}" has NO POSITION - will not be drawn!`);
            }
        });

        // Second pass: Draw all boxes with proper centering
        const boxPositions = [];
        boxCellAssignments.forEach(({ box, position, cellKey, indexInCell }) => {
            const cellX = startX + (position.col - 1) * this.cellWidth;
            const cellY = startY + (position.row - 1) * this.cellHeight;

            // Calculate dynamic spacing based on number of boxes
            const totalBoxesInCell = cellOccupancy[cellKey];
            const boxHeight = 40;
            const cellPadding = 60; // 30px top + 30px bottom
            const availableHeight = this.cellHeight - cellPadding - (totalBoxesInCell * boxHeight);

            // Calculate spacing based on number of boxes
            let boxSpacing = 120;
            if (totalBoxesInCell === 2) {
                boxSpacing = 120;
            } else if (totalBoxesInCell === 3) {
                boxSpacing = 60;
            } else if (totalBoxesInCell > 3) {
                // For 4+ boxes, calculate dynamically with min 20px
                const maxPossibleSpacing = availableHeight / (totalBoxesInCell - 1);
                boxSpacing = Math.max(20, maxPossibleSpacing);
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
            this.drawIncomingArrow(group, boxPositions[0], leadingWords, startX);
        }

        // Draw arrows between boxes with connecting words
        for (let i = 0; i < boxPositions.length - 1; i++) {
            const fromBox = boxPositions[i];
            const toBox = boxPositions[i + 1];
            const connectionWords = connections[i] || [];

            this.drawArrow(group, fromBox, toBox, connectionWords);
        }

        // Draw outgoing arrow for final connection (e.g., sentence-final verbs)
        // This handles the case where connections.length === boxes.length (final connection after last box)
        if (boxPositions.length > 0 && connections.length === boxPositions.length) {
            const finalConnection = connections[connections.length - 1];
            if (finalConnection && finalConnection.length > 0) {
                this.drawOutgoingArrow(group, boxPositions[boxPositions.length - 1], finalConnection, startX);
            }
        }

        // Draw outgoing arrow if there are trailing words (legacy support)
        if (trailingWords.length > 0 && boxPositions.length > 0) {
            this.drawOutgoingArrow(group, boxPositions[boxPositions.length - 1], trailingWords, startX);
        }

        console.log('=== END FLOW DIAGRAM ===\n');
    }

    parseSentenceFlow(words) {
        console.log('📦 Starting improved phrase parsing...');

        // Phase 1: Expanded word class lists
        const DETERMINERS = new Set([
            // Definite articles
            'der', 'die', 'das', 'den', 'dem', 'des',
            // Indefinite articles
            'ein', 'eine', 'einen', 'einem', 'eines', 'einer',
            // Negative articles
            'kein', 'keine', 'keinen', 'keinem', 'keines', 'keiner',
            // Possessive pronouns
            'mein', 'meine', 'meinen', 'meinem', 'meines', 'meiner',
            'dein', 'deine', 'deinen', 'deinem', 'deines', 'deiner',
            'sein', 'seine', 'seinen', 'seinem', 'seines', 'seiner',
            'ihr', 'ihre', 'ihren', 'ihrem', 'ihres', 'ihrer',
            'unser', 'unsere', 'unseren', 'unserem', 'unseres', 'unserer',
            'euer', 'eure', 'euren', 'eurem', 'eures', 'eurer',
            // Demonstratives
            'dieser', 'diese', 'dieses', 'diesen', 'diesem',
            'jener', 'jene', 'jenes', 'jenen', 'jenem',
            'solcher', 'solche', 'solches', 'solchen', 'solchem',
            'mancher', 'manche', 'manches', 'manchen', 'manchem',
            // Quantifiers
            'alle', 'aller', 'allen', 'allem', 'alles',
            'viele', 'vieler', 'vielen', 'vielem',
            'einige', 'einiger', 'einigen', 'einigem',
            'mehrere', 'mehrerer', 'mehreren', 'mehrerem',
            'wenige', 'weniger', 'wenigen', 'wenigem',
            'beide', 'beider', 'beiden', 'beidem'
        ]);

        // Helper functions (Phase 2)
        const isNoun = (word) => {
            const text = word.text.toLowerCase();
            // CRITICAL: First check if it's a determiner - determiners are NOT nouns
            // even if they're tagged as 'subject' or 'object' types
            if (DETERMINERS.has(text) || word.type === 'article') {
                return false;
            }
            // Then check if it has a noun type
            return word.type === 'subject' ||
                   word.type === 'direct-object' ||
                   word.type === 'indirect-object' ||
                   word.type === 'prepositional-object' ||
                   word.type.includes('object');
        };

        const isVerb = (word) => {
            return word.type === 'verb' || word.type === 'modal';
        };

        const isPreposition = (word) => {
            return word.type === 'preposition';
        };

        const canBeInNounPhrase = (word) => {
            const text = word.text.toLowerCase();

            // Exclude adverbs explicitly - they modify verbs, not nouns
            if (word.type === 'adverb') {
                return false;
            }

            // Exclude verbs and modals
            if (word.type === 'verb' || word.type === 'modal') {
                return false;
            }

            return (
                DETERMINERS.has(text) ||           // Articles, possessives, demonstratives, quantifiers
                word.type === 'adjective' ||       // Adjectives
                word.type === 'article'            // Explicitly tagged articles
                // NOTE: Removed 'other' type - it was too permissive and caught adverbs
            );
        };

        const isNounPhraseBoundary = (word) => {
            // These word types mark the end of a noun phrase
            return isNoun(word) || isVerb(word);
        };

        const collectNounPhrase = (words, nounIndex, processedIndices) => {
            // Collect all words that form a noun phrase with this noun
            const phraseWords = [];
            const phraseIndices = [];

            // Look backwards from the noun to find modifiers
            let startIdx = nounIndex;
            for (let j = nounIndex - 1; j >= 0; j--) {
                // Skip already processed words
                if (processedIndices.has(j)) {
                    break;
                }

                const prevWord = words[j];

                // Stop at phrase boundaries (other nouns, verbs)
                if (isNounPhraseBoundary(prevWord)) {
                    break;
                }

                // Stop at prepositions (they connect phrases, not part of the phrase)
                if (isPreposition(prevWord)) {
                    break;
                }

                // Check if this word can be part of the noun phrase
                if (canBeInNounPhrase(prevWord)) {
                    startIdx = j;
                } else {
                    // Stop at words that don't belong in noun phrases
                    break;
                }
            }

            // Collect all words from startIdx to nounIndex
            for (let j = startIdx; j <= nounIndex; j++) {
                phraseWords.push(words[j]);
                phraseIndices.push(j);
            }

            // Log the collected phrase
            console.log(`  📦 Collected phrase: "${phraseWords.map(w => w.text).join(' ')}" (indices ${startIdx}-${nounIndex})`);

            return { phraseWords, phraseIndices };
        };

        // Phase 3: Validation helper
        const validateNounPhrase = (phraseWords, mainWord) => {
            // Find article/determiner in the phrase
            const determiner = phraseWords.find(w =>
                DETERMINERS.has(w.text.toLowerCase()) || w.type === 'article'
            );

            if (determiner && mainWord) {
                // Check case agreement
                if (determiner.case && mainWord.case && determiner.case !== mainWord.case) {
                    console.warn(`  ⚠️  Case mismatch: "${determiner.text}" (${determiner.case}) vs "${mainWord.text}" (${mainWord.case})`);
                }

                // Check gender agreement (if both have gender info)
                if (determiner.gender && mainWord.gender && determiner.gender !== mainWord.gender) {
                    console.warn(`  ⚠️  Gender mismatch: "${determiner.text}" (${determiner.gender}) vs "${mainWord.text}" (${mainWord.gender})`);
                }

                // Check number agreement
                if (determiner.number && mainWord.number && determiner.number !== mainWord.number) {
                    console.warn(`  ⚠️  Number mismatch: "${determiner.text}" (${determiner.number}) vs "${mainWord.text}" (${mainWord.number})`);
                }
            }
        };

        // Main parsing logic (Phase 2: Simplified)
        const boxes = [];
        const connections = [];
        const leadingWords = [];
        const trailingWords = [];
        const processedIndices = new Set();

        // Step 1: Identify all noun phrases (boxes)
        console.log('🔍 Step 1: Identifying noun phrases...');
        for (let i = 0; i < words.length; i++) {
            const word = words[i];

            if (isNoun(word) && !processedIndices.has(i)) {
                console.log(`  Found noun: "${word.text}" at index ${i}`);

                // Collect the complete noun phrase
                const { phraseWords, phraseIndices } = collectNounPhrase(words, i, processedIndices);

                // Mark all words in the phrase as processed
                phraseIndices.forEach(idx => processedIndices.add(idx));

                // Validate the noun phrase (Phase 3)
                validateNounPhrase(phraseWords, word);

                // Create the box
                boxes.push({
                    words: phraseWords,
                    mainWord: word,
                    case: word.case || 'nom'
                });
            }
        }

        console.log(`✅ Found ${boxes.length} noun phrases`);

        // Step 2: Collect connection words between boxes
        console.log('🔍 Step 2: Collecting connections...');
        if (boxes.length > 0) {
            for (let boxIdx = 0; boxIdx < boxes.length - 1; boxIdx++) {
                const currentBoxLastWordIdx = words.indexOf(boxes[boxIdx].words[boxes[boxIdx].words.length - 1]);
                const nextBoxFirstWordIdx = words.indexOf(boxes[boxIdx + 1].words[0]);

                const connectionWords = [];
                for (let i = currentBoxLastWordIdx + 1; i < nextBoxFirstWordIdx; i++) {
                    if (!processedIndices.has(i)) {
                        connectionWords.push(words[i]);
                        processedIndices.add(i);
                        console.log(`  ➡️  Connection word: "${words[i].text}" (between box ${boxIdx} and ${boxIdx + 1})`);
                    }
                }
                connections.push(connectionWords);
            }

            // PHASE 1 FIX: Collect connection words AFTER the last box
            // (This is where sentence-final verbs like "sehen" go)
            const lastBoxLastWordIdx = words.indexOf(boxes[boxes.length - 1].words[boxes[boxes.length - 1].words.length - 1]);
            const finalConnectionWords = [];
            for (let i = lastBoxLastWordIdx + 1; i < words.length; i++) {
                if (!processedIndices.has(i)) {
                    // Check if it's a verb or other connecting word (not a modifier)
                    if (!canBeInNounPhrase(words[i])) {
                        finalConnectionWords.push(words[i]);
                        processedIndices.add(i);
                        console.log(`  ➡️  Final connection word: "${words[i].text}"`);
                    }
                }
            }
            if (finalConnectionWords.length > 0) {
                connections.push(finalConnectionWords);
            }
        }

        console.log(`✅ Found ${connections.length} connections`);

        // Step 3: Collect leading words (before first box)
        console.log('🔍 Step 3: Collecting leading/trailing words...');
        if (boxes.length > 0) {
            const firstBoxFirstWordIdx = words.indexOf(boxes[0].words[0]);
            for (let i = 0; i < firstBoxFirstWordIdx; i++) {
                if (!processedIndices.has(i)) {
                    leadingWords.push(words[i]);
                    processedIndices.add(i);
                    console.log(`  ⬅️  Leading word: "${words[i].text}"`);
                }
            }
        }

        // Step 4: Collect trailing words (after last box, if not already collected as connections)
        if (boxes.length > 0) {
            const lastBoxLastWordIdx = words.indexOf(boxes[boxes.length - 1].words[boxes[boxes.length - 1].words.length - 1]);
            for (let i = lastBoxLastWordIdx + 1; i < words.length; i++) {
                if (!processedIndices.has(i)) {
                    trailingWords.push(words[i]);
                    processedIndices.add(i);
                    console.log(`  ➡️  Trailing word: "${words[i].text}"`);
                }
            }
        } else {
            // No boxes found - all unprocessed words are leading
            for (let i = 0; i < words.length; i++) {
                if (!processedIndices.has(i)) {
                    leadingWords.push(words[i]);
                    processedIndices.add(i);
                }
            }
        }

        console.log('✨ Parsing complete!\n');
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

        // Verbs go with their subject - this is handled in positionWords() now
        // We don't position verbs independently

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

        // Create box based on case
        const box = this.createCaseBox(caseType, centerX, centerY, boxColor);
        if (box) {
            group.appendChild(box);
        }

        // Text with white stroke outline (matching Feldermodell style)
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', centerX);
        text.setAttribute('y', centerY + 5);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', '#2c3e50');
        text.setAttribute('stroke', 'white');
        text.setAttribute('stroke-width', '3');
        text.setAttribute('paint-order', 'stroke');
        text.setAttribute('font-size', '14px');
        text.setAttribute('font-weight', 'bold');
        text.setAttribute('pointer-events', 'none');
        text.textContent = phraseText;
        group.appendChild(text);
    }

    drawArrow(group, fromBox, toBox, connectionWords) {
        const fromX = fromBox.centerX;
        const fromY = fromBox.centerY;
        const toX = toBox.centerX;
        const toY = toBox.centerY;

        // Calculate arrow start and end points (adjust for box boundaries)
        const boxWidth = 200;
        const boxHeight = 40;

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
        path.setAttribute('stroke', '#2c3e50');
        path.setAttribute('stroke-width', '2');
        path.setAttribute('fill', 'none');
        path.setAttribute('marker-end', 'url(#arrowhead)');
        path.setAttribute('pointer-events', 'none');
        group.appendChild(path);

        // Draw connection words on arrow
        if (connectionWords.length > 0) {
            // Place text at the midpoint of the curve (already calculated above)
            const textX = midX;
            const textY = midY;

            connectionWords.forEach((word, index) => {
                const offsetY = (index - (connectionWords.length - 1) / 2) * 18;

                // Text with white stroke outline (matching Feldermodell style)
                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.setAttribute('x', textX);
                text.setAttribute('y', textY + offsetY);
                text.setAttribute('text-anchor', 'middle');
                text.setAttribute('fill', '#2c3e50');
                text.setAttribute('stroke', 'white');
                text.setAttribute('stroke-width', '3');
                text.setAttribute('paint-order', 'stroke');
                text.setAttribute('font-size', '14px');
                text.setAttribute('font-weight', 'normal');
                text.setAttribute('pointer-events', 'none');
                text.textContent = word.text;
                group.appendChild(text);
            });
        }
    }

    drawIncomingArrow(group, firstBox, leadingWords, startX) {
        const boxWidth = 200;

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
        path.setAttribute('stroke', '#2c3e50');
        path.setAttribute('stroke-width', '2');
        path.setAttribute('fill', 'none');
        path.setAttribute('marker-end', 'url(#arrowhead)');
        path.setAttribute('pointer-events', 'none');
        group.appendChild(path);

        // Draw leading words on arrow (stacked vertically)
        if (leadingWords.length > 0) {
            const midX = (arrowStartX + arrowEndX) / 2;
            const midY = (arrowStartY + arrowEndY) / 2 + curveOffset;
            const textOffset = 15;

            leadingWords.forEach((word, index) => {
                const offsetY = (index - (leadingWords.length - 1) / 2) * 18;

                // Text with white stroke outline (matching Feldermodell style)
                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.setAttribute('x', midX);
                text.setAttribute('y', midY - textOffset + offsetY);
                text.setAttribute('text-anchor', 'middle');
                text.setAttribute('fill', '#2c3e50');
                text.setAttribute('stroke', 'white');
                text.setAttribute('stroke-width', '3');
                text.setAttribute('paint-order', 'stroke');
                text.setAttribute('font-size', '14px');
                text.setAttribute('font-weight', 'normal');
                text.setAttribute('pointer-events', 'none');
                text.textContent = word.text;
                group.appendChild(text);
            });
        }
    }

    drawOutgoingArrow(group, lastBox, trailingWords, startX) {
        const boxWidth = 200;

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
        path.setAttribute('stroke', '#2c3e50');
        path.setAttribute('stroke-width', '2');
        path.setAttribute('fill', 'none');
        path.setAttribute('marker-end', 'url(#arrowhead)');
        path.setAttribute('pointer-events', 'none');
        group.appendChild(path);

        // Draw trailing words on arrow (stacked vertically)
        if (trailingWords.length > 0) {
            const midX = (arrowStartX + arrowEndX) / 2;
            const midY = (arrowStartY + arrowEndY) / 2 + curveOffset;
            const textOffset = 15;

            trailingWords.forEach((word, index) => {
                const offsetY = (index - (trailingWords.length - 1) / 2) * 18;

                // Text with white stroke outline (matching Feldermodell style)
                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.setAttribute('x', midX);
                text.setAttribute('y', midY - textOffset + offsetY);
                text.setAttribute('text-anchor', 'middle');
                text.setAttribute('fill', '#2c3e50');
                text.setAttribute('stroke', 'white');
                text.setAttribute('stroke-width', '3');
                text.setAttribute('paint-order', 'stroke');
                text.setAttribute('font-size', '14px');
                text.setAttribute('font-weight', 'normal');
                text.setAttribute('pointer-events', 'none');
                text.textContent = word.text;
                group.appendChild(text);
            });
        }
    }


    createCaseBox(caseType, centerX, centerY, fillColor = 'rgba(255, 255, 255, 0.9)') {
        let shape;
        const boxWidth = 200;
        const boxHeight = 40;
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

        shape.setAttribute('fill', fillColor);
        shape.setAttribute('stroke', '#2c3e50');
        shape.setAttribute('stroke-width', '2');
        shape.setAttribute('pointer-events', 'none');

        return shape;
    }

    clear() {
        const existingGroups = this.svg.querySelectorAll('.grid-view-group');
        existingGroups.forEach(g => g.remove());
    }
}
