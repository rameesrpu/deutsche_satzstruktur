/**
 * FeldermodellRenderer - Renders Feldermodell zones for both Hauptsatz and Nebensatz
 */
class FeldermodellRenderer {
    constructor(svgElement) {
        this.svg = svgElement;
        this.svgNS = 'http://www.w3.org/2000/svg';
    }

    /**
     * Style a zone label as a modern uppercase eyebrow chip.
     * Inline styles are used so the shared .feldermodell-label CSS class
     * cannot override the design-system typography.
     * Colors are hard-coded hex mirroring the CSS design tokens
     * (#64748b = secondary text) since var(--x) is unreliable in SVG.
     */
    styleZoneLabel(text, fontSize = 10) {
        text.setAttribute('class', 'feldermodell-label');
        text.setAttribute('fill', '#64748b'); // mirrors CSS design token: secondary text
        text.setAttribute('pointer-events', 'none');
        text.setAttribute('style',
            `font-family: 'Inter', sans-serif; font-size: ${fontSize}px; font-weight: 600; ` +
            `letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.9;`);
    }

    /**
     * Draw all Feldermodell zones
     */
    draw(wordManager) {
        const words = wordManager.getAllWords();
        const hauptsatzWords = words.filter(w => w.flowDirection === 'right');
        const nebensatzGroups = wordManager.getNebensatzGroups();

        if (hauptsatzWords.length > 0) {
            // Split hauptsatz into groups based on coordinating conjunctions
            const hauptsatzGroups = this.splitHauptsatzByCoordConjunctions(hauptsatzWords);
            hauptsatzGroups.forEach(group => {
                this.drawHauptsatzZones(group.words, group.yPosition, group.startX, group.endX);
            });
        }
        this.drawNebensatzZones(nebensatzGroups);
    }

    /**
     * Get midpoint between two words (using word centers)
     */
    getMidpoint(word1, word2, axis = 'x') {
        if (!word1 || !word2) return null;
        // Calculate centers: word position + 25 (half of 50px shape size)
        const offset = 25;
        const center1 = word1[axis] + offset;
        const center2 = word2[axis] + offset;
        return (center1 + center2) / 2;
    }

    /**
     * Split hauptsatz words into groups at coordinating conjunctions
     * Each coordinating conjunction starts a new parallel hauptsatz
     * Coordinating conjunctions are excluded from both Feldermodell zones
     */
    splitHauptsatzByCoordConjunctions(hauptsatzWords) {
        const groups = [];
        let currentGroup = [];
        let currentY = hauptsatzWords.length > 0 ? hauptsatzWords[0].y : 0;
        let currentStartX = null;

        hauptsatzWords.forEach((word) => {
            // Coordinating conjunction splits groups but is not included in either
            if (word.type === 'coord-conjunction') {
                // Save the current group (if any)
                if (currentGroup.length > 0) {
                    // End the previous group just before the conjunction
                    const lastWord = currentGroup[currentGroup.length - 1];
                    groups.push({
                        words: currentGroup,
                        yPosition: currentY,
                        startX: currentStartX,
                        endX: lastWord.x + 80 // End at the last word + some padding
                    });
                }

                // Reset for new group (conjunction is excluded)
                currentGroup = [];
                currentY = word.y;
                currentStartX = word.x + 80; // Start after the conjunction
            } else {
                currentGroup.push(word);
                // Update Y and start position for the group (use the first word)
                if (currentGroup.length === 1) {
                    currentY = word.y;
                    if (currentStartX === null) {
                        currentStartX = word.x - 30; // Default start for first group
                    }
                }
            }
        });

        // Add the last group
        if (currentGroup.length > 0) {
            const lastWord = currentGroup[currentGroup.length - 1];
            groups.push({
                words: currentGroup,
                yPosition: currentY,
                startX: currentStartX,
                endX: lastWord.x + 150 // Extended end for last group
            });
        }

        return groups;
    }

    /**
     * Draw dynamic horizontal Hauptsatz zones based on verb positions
     */
    drawHauptsatzZones(words, yPosition = null, startX = null, endX = null) {
        // Find all verbs/modals in horizontal flow
        const verbs = words.filter(w => w.type === 'verb' || w.type === 'modal');

        if (verbs.length === 0) return;

        // Sort words by x position
        const sortedWords = [...words].sort((a, b) => a.x - b.x);
        const firstVerb = verbs[0];
        const lastVerb = verbs[verbs.length - 1];

        // Find indices in sorted array
        const firstVerbIndex = sortedWords.findIndex(w => w.id === firstVerb.id);
        const lastVerbIndex = sortedWords.findIndex(w => w.id === lastVerb.id);

        // Calculate boundaries with verb-centered Klammer zones
        const leftBoundaryLinkeKlammer = firstVerbIndex > 0 ?
            this.getMidpoint(sortedWords[firstVerbIndex - 1], firstVerb) :
            firstVerb.x - 15; // Symmetric fallback (center - 40)

        const rightBoundaryLinkeKlammer = firstVerbIndex < sortedWords.length - 1 ?
            this.getMidpoint(firstVerb, sortedWords[firstVerbIndex + 1]) :
            firstVerb.x + 65; // Symmetric fallback (center + 40)

        const leftBoundaryRechteKlammer = lastVerbIndex > 0 ?
            this.getMidpoint(sortedWords[lastVerbIndex - 1], lastVerb) :
            lastVerb.x - 15; // Symmetric fallback (center - 40)

        const rightBoundaryRechteKlammer = lastVerbIndex < sortedWords.length - 1 ?
            this.getMidpoint(lastVerb, sortedWords[lastVerbIndex + 1]) :
            lastVerb.x + 65; // Symmetric fallback (center + 40)

        // Use provided start/end boundaries or calculate from words
        const vorfeldStart = startX !== null ? startX : 0;
        const nachfeldEnd = endX !== null ? endX : (Math.max(...sortedWords.map(w => w.x)) + 150);

        const boundaries = {
            vorfeld: {
                start: vorfeldStart,
                end: leftBoundaryLinkeKlammer
            },
            linkeKlammer: {
                start: leftBoundaryLinkeKlammer,
                end: rightBoundaryLinkeKlammer
            },
            mittelfeld: {
                start: rightBoundaryLinkeKlammer,
                end: leftBoundaryRechteKlammer
            },
            rechteKlammer: {
                start: leftBoundaryRechteKlammer,
                end: rightBoundaryRechteKlammer
            },
            nachfeld: {
                start: rightBoundaryRechteKlammer,
                end: nachfeldEnd
            }
        };

        // If first and last verb are the same, adjust zones
        if (firstVerb.id === lastVerb.id) {
            // Single verb: Mittelfeld extends from end of LK to before Nachfeld
            boundaries.mittelfeld = {
                start: boundaries.linkeKlammer.end,
                end: boundaries.nachfeld.start
            };
            // RK is collapsed at the boundary between Mittelfeld and Nachfeld
            boundaries.rechteKlammer = {
                start: boundaries.nachfeld.start,
                end: boundaries.nachfeld.start
            };
        }

        // Define zones with calculated boundaries.
        // Fills are very-low-alpha indigo/slate tints (mirroring CSS design
        // tokens #4f46e5 indigo and #64748b slate) so word colors still pop.
        const zones = [
            { label: 'Vorfeld', x: boundaries.vorfeld.start, width: boundaries.vorfeld.end - boundaries.vorfeld.start, color: 'rgba(99, 102, 241, 0.05)' },
            { label: 'LK', x: boundaries.linkeKlammer.start, width: boundaries.linkeKlammer.end - boundaries.linkeKlammer.start, color: 'rgba(79, 70, 229, 0.06)' },
            { label: 'Mittelfeld', x: boundaries.mittelfeld.start, width: boundaries.mittelfeld.end - boundaries.mittelfeld.start, color: 'rgba(100, 116, 139, 0.05)' },
            { label: 'RK', x: boundaries.rechteKlammer.start, width: boundaries.rechteKlammer.end - boundaries.rechteKlammer.start, color: 'rgba(79, 70, 229, 0.06)' },
            { label: 'Nachfeld', x: boundaries.nachfeld.start, width: boundaries.nachfeld.end - boundaries.nachfeld.start, color: 'rgba(99, 102, 241, 0.05)' }
        ];

        // Use provided y position or first word's y position for hauptsatz
        const firstWordY = yPosition !== null ? yPosition : sortedWords[0].y;
        const yStart = firstWordY - 30;
        const height = 100; // Compact fixed height for horizontal strip

        zones.forEach(zone => {
            if (zone.width <= 0) return; // Skip zones with no width

            // Draw zone rectangle (soft tint, rounded corners, subtle border)
            const rect = document.createElementNS(this.svgNS, 'rect');
            rect.setAttribute('x', zone.x);
            rect.setAttribute('y', yStart);
            rect.setAttribute('width', zone.width);
            rect.setAttribute('height', height);
            rect.setAttribute('rx', '10');
            rect.setAttribute('fill', zone.color);
            rect.setAttribute('stroke', '#e2e8f0'); // mirrors CSS design token: border
            rect.setAttribute('stroke-width', '1');
            rect.setAttribute('pointer-events', 'none'); // Don't block clicks
            this.svg.appendChild(rect);

            // Draw zone label (uppercase eyebrow chip style)
            const text = document.createElementNS(this.svgNS, 'text');
            text.setAttribute('x', zone.x + zone.width / 2);
            text.setAttribute('y', yStart + 20);
            text.setAttribute('text-anchor', 'middle');
            this.styleZoneLabel(text, 10);
            text.textContent = zone.label;
            this.svg.appendChild(text);
        });

        // Draw boundary lines between zones
        const boundaryPositions = [
            boundaries.vorfeld.end,
            boundaries.linkeKlammer.end,
            boundaries.mittelfeld.end,
            boundaries.rechteKlammer.end
        ];

        boundaryPositions.forEach(x => {
            const line = document.createElementNS(this.svgNS, 'line');
            line.setAttribute('x1', x);
            line.setAttribute('y1', yStart);
            line.setAttribute('x2', x);
            line.setAttribute('y2', yStart + height);
            line.setAttribute('stroke', '#cbd5e1'); // mirrors CSS design token: border (darker step)
            line.setAttribute('stroke-width', '1');
            line.setAttribute('stroke-dasharray', '3,6');
            line.setAttribute('stroke-linecap', 'round');
            line.setAttribute('opacity', '0.9');
            line.setAttribute('pointer-events', 'none'); // Don't block clicks
            this.svg.appendChild(line);
        });
    }

    /**
     * Draw dynamic vertical Nebensatz zones for each group
     */
    drawNebensatzZones(nebensatzGroups) {
        nebensatzGroups.forEach(group => {
            if (group.words.length === 0) return;

            // Split nebensatz by coordinating conjunctions to create parallel nebensätze
            const subGroups = this.splitNebensatzByCoordConjunctions(group.words);

            subGroups.forEach(subGroup => {
                this.drawSingleNebensatzZone(subGroup.words);
            });
        });
    }

    /**
     * Split nebensatz words into groups at coordinating conjunctions
     * Each coordinating conjunction starts a new parallel nebensatz
     * Coordinating conjunctions are excluded from both Feldermodell zones
     */
    splitNebensatzByCoordConjunctions(nebensatzWords) {
        const groups = [];
        let currentGroup = [];

        nebensatzWords.forEach((word) => {
            // Coordinating conjunction splits groups but is not included in either
            if (word.type === 'coord-conjunction') {
                // Save the current group (if any)
                if (currentGroup.length > 0) {
                    groups.push({
                        words: currentGroup
                    });
                }

                // Reset for new group (conjunction is excluded)
                currentGroup = [];
            } else {
                currentGroup.push(word);
            }
        });

        // Add the last group
        if (currentGroup.length > 0) {
            groups.push({
                words: currentGroup
            });
        }

        return groups;
    }

    /**
     * Draw a single nebensatz zone
     */
    drawSingleNebensatzZone(words) {
        if (words.length === 0) return;

            // Find all verbs/modals in this nebensatz
            const verbs = words.filter(w => w.type === 'verb' || w.type === 'modal');

            // Sort words by y position (vertical flow)
            const sortedWords = [...words].sort((a, b) => a.y - b.y);

            const firstWord = sortedWords[0];
            const lastWord = sortedWords[sortedWords.length - 1];

            // Calculate x position (centered on the words)
            const minX = Math.min(...words.map(w => w.x));
            const maxX = Math.max(...words.map(w => w.x));
            const xStart = minX - 60;
            // Account for word width (50px) + padding on both sides (60px each = 120px)
            const width = Math.max(150, maxX - minX + 50 + 120);

            let boundaries;

            if (verbs.length === 0) {
                // No verbs - use simple layout
                const yStart = firstWord.y - 20;
                const yEnd = lastWord.y + 70; // Account for word height (50px) + margin

                boundaries = {
                    konj: { start: yStart, end: yStart + 60 },
                    mittelfeld: { start: yStart + 60, end: yEnd - 60 },
                    verben: { start: yEnd - 60, end: yEnd }
                };
            } else {
                // Dynamic layout based on verb positions
                const firstVerb = verbs[0];
                const lastVerb = verbs[verbs.length - 1];

                const firstVerbIndex = sortedWords.findIndex(w => w.id === firstVerb.id);
                const lastVerbIndex = sortedWords.findIndex(w => w.id === lastVerb.id);

                // Calculate verb zone boundaries with centering
                const topBoundaryVerben = firstVerbIndex > 0 ?
                    this.getMidpoint(sortedWords[firstVerbIndex - 1], firstVerb, 'y') :
                    firstVerb.y - 15; // Symmetric fallback (center - 40)

                const bottomBoundaryVerben = lastVerbIndex < sortedWords.length - 1 ?
                    this.getMidpoint(lastVerb, sortedWords[lastVerbIndex + 1], 'y') :
                    lastVerb.y + 65; // Symmetric fallback (center + 40)

                // Konj zone: from start to top boundary of verben zone
                const konjEnd = firstVerbIndex > 1 ?
                    this.getMidpoint(sortedWords[0], sortedWords[1], 'y') :
                    topBoundaryVerben;

                // Mittelfeld: between konj and verben (if there are words between)
                boundaries = {
                    konj: {
                        start: firstWord.y - 30,
                        end: konjEnd
                    },
                    mittelfeld: {
                        start: konjEnd,
                        end: topBoundaryVerben
                    },
                    verben: {
                        start: topBoundaryVerben,
                        end: bottomBoundaryVerben
                    }
                };

                // If conjunction is immediately followed by verb, collapse mittelfeld
                if (firstVerbIndex <= 1) {
                    boundaries.konj.end = topBoundaryVerben;
                    boundaries.mittelfeld = {
                        start: topBoundaryVerben,
                        end: topBoundaryVerben
                    };
                }
            }

            // Define zones with calculated boundaries.
            // Low-alpha indigo/slate tints mirroring CSS design tokens
            // (#4f46e5 indigo, #64748b slate) so word colors still pop.
            const zones = [
                { label: 'Konj.', y: boundaries.konj.start, height: boundaries.konj.end - boundaries.konj.start, color: 'rgba(79, 70, 229, 0.06)' },
                { label: 'Mittelfeld', y: boundaries.mittelfeld.start, height: boundaries.mittelfeld.end - boundaries.mittelfeld.start, color: 'rgba(100, 116, 139, 0.05)' },
                { label: 'Verben', y: boundaries.verben.start, height: boundaries.verben.end - boundaries.verben.start, color: 'rgba(79, 70, 229, 0.06)' }
            ];

            zones.forEach(zone => {
                if (zone.height <= 0) return; // Skip zones with no height

                // Draw zone rectangle (soft tint, rounded corners, subtle border)
                const rect = document.createElementNS(this.svgNS, 'rect');
                rect.setAttribute('x', xStart);
                rect.setAttribute('y', zone.y);
                rect.setAttribute('width', width);
                rect.setAttribute('height', zone.height);
                rect.setAttribute('rx', '10');
                rect.setAttribute('fill', zone.color);
                rect.setAttribute('stroke', '#e2e8f0'); // mirrors CSS design token: border
                rect.setAttribute('stroke-width', '1');
                rect.setAttribute('pointer-events', 'none'); // Don't block clicks
                this.svg.appendChild(rect);

                // Draw zone label (uppercase eyebrow chip style)
                const text = document.createElementNS(this.svgNS, 'text');
                text.setAttribute('x', xStart + width - 10);
                text.setAttribute('y', zone.y + 15);
                text.setAttribute('text-anchor', 'end');
                this.styleZoneLabel(text, 9);
                text.textContent = zone.label;
                this.svg.appendChild(text);
            });

            // Draw boundary lines between zones (vertical in nebensatz)
            const boundaryYPositions = [
                boundaries.konj.end,
                boundaries.mittelfeld.end
            ];

            boundaryYPositions.forEach(y => {
                const line = document.createElementNS(this.svgNS, 'line');
                line.setAttribute('x1', xStart);
                line.setAttribute('y1', y);
                line.setAttribute('x2', xStart + width);
                line.setAttribute('y2', y);
                line.setAttribute('stroke', '#cbd5e1'); // mirrors CSS design token: border (darker step)
                line.setAttribute('stroke-width', '1');
                line.setAttribute('stroke-dasharray', '3,6');
                line.setAttribute('stroke-linecap', 'round');
                line.setAttribute('opacity', '0.9');
                line.setAttribute('pointer-events', 'none'); // Don't block clicks
                this.svg.appendChild(line);
            });

            // Add "NEBENSATZ" label
            this.drawNebensatzLabel(xStart, boundaries.konj.start, width);
    }

    /**
     * Draw "NEBENSATZ" label for a subordinate clause
     */
    drawNebensatzLabel(x, y, width = 150) {
        // Background: rounded pill with a soft indigo tint
        // (colors mirror CSS design token #4f46e5 indigo accent)
        const labelBg = document.createElementNS(this.svgNS, 'rect');
        labelBg.setAttribute('x', x);
        labelBg.setAttribute('y', y - 35);
        labelBg.setAttribute('width', width);
        labelBg.setAttribute('height', '20');
        labelBg.setAttribute('fill', 'rgba(79, 70, 229, 0.08)');
        labelBg.setAttribute('stroke', 'rgba(79, 70, 229, 0.2)');
        labelBg.setAttribute('stroke-width', '1');
        labelBg.setAttribute('rx', '10'); // half of height = full pill
        labelBg.setAttribute('pointer-events', 'none'); // Don't block clicks
        this.svg.appendChild(labelBg);

        // Text: indigo eyebrow label
        const labelText = document.createElementNS(this.svgNS, 'text');
        labelText.setAttribute('x', x + width / 2);
        labelText.setAttribute('y', y - 21);
        labelText.setAttribute('text-anchor', 'middle');
        labelText.setAttribute('fill', '#4f46e5'); // mirrors CSS design token: indigo accent
        labelText.setAttribute('style',
            "font-family: 'Inter', sans-serif; font-size: 10px; font-weight: 600; letter-spacing: 0.08em;");
        labelText.setAttribute('pointer-events', 'none'); // Don't block clicks
        labelText.textContent = 'NEBENSATZ';
        this.svg.appendChild(labelText);
    }
}
