/**
 * Renderer - Handles SVG drawing of words and connections
 */
class Renderer {
    constructor(svgElement, wordManager) {
        this.svg = svgElement;
        this.wordManager = wordManager;
        this.svgNS = 'http://www.w3.org/2000/svg';
    }

    /**
     * Draw all connections between words
     */
    drawConnections() {
        const words = this.wordManager.getAllWords();
        if (words.length < 2) return;

        for (let i = 0; i < words.length - 1; i++) {
            const from = words[i];
            const to = words[i + 1];

            const line = document.createElementNS(this.svgNS, 'path');

            if (from.flowDirection === 'right') {
                // Horizontal rightward connection (Hauptsatz)
                const d = `M ${from.x + 50} ${from.y + 25}
                           L ${from.x + 70} ${from.y + 25}
                           L ${to.x - 20} ${to.y + 25}
                           L ${to.x} ${to.y + 25}`;
                line.setAttribute('d', d);
            } else {
                // Vertical downward connection (Nebensatz)
                const d = `M ${from.x + 25} ${from.y + 50}
                           L ${from.x + 25} ${from.y + 80}
                           L ${to.x + 25} ${to.y - 10}
                           L ${to.x + 25} ${to.y}`;
                line.setAttribute('d', d);
            }

            line.setAttribute('stroke', '#34495e');
            line.setAttribute('stroke-width', '2');
            line.setAttribute('fill', 'none');
            line.setAttribute('opacity', '0.6');
            this.svg.appendChild(line);
        }
    }

    /**
     * Draw a single word token
     */
    drawWord(word, onWordClick, onWordDragStart) {
        const group = document.createElementNS(this.svgNS, 'g');
        group.setAttribute('transform', `translate(${word.x}, ${word.y})`);
        group.style.cursor = 'move';

        // Determine color using centralized configuration
        // Priority: conjugation > plural > gender > default
        const color = this.wordManager.getColorForWord(word);

        // Create shape based on word type and case
        const shape = this.createShape(word);
        shape.setAttribute('fill', color);
        shape.setAttribute('stroke', '#2c3e50');
        shape.setAttribute('stroke-width', '2');

        // Highlight if selected
        const isSelected = this.wordManager.selectedWord && this.wordManager.selectedWord.id === word.id;
        if (isSelected) {
            shape.setAttribute('stroke', '#f39c12');
            const strokeWidth = GrammaticalConfig.getStrokeWidth(word, true);
            shape.setAttribute('stroke-width', strokeWidth.toString());
        }

        group.appendChild(shape);

        // Text label
        const text = document.createElementNS(this.svgNS, 'text');
        text.setAttribute('x', '25');
        text.setAttribute('y', '30');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', '#2c3e50');
        text.setAttribute('stroke', 'white');
        text.setAttribute('stroke-width', '3');
        text.setAttribute('paint-order', 'stroke');
        text.setAttribute('font-size', '12');
        text.setAttribute('font-weight', 'bold');
        text.setAttribute('pointer-events', 'none');
        text.textContent = word.text;

        // Case indicator
        const caseLabels = { nom: 'N', akk: 'A', dat: 'D', gen: 'G' };
        const caseText = document.createElementNS(this.svgNS, 'text');
        caseText.setAttribute('x', '45');
        caseText.setAttribute('y', '10');
        caseText.setAttribute('fill', '#2c3e50');
        caseText.setAttribute('stroke', 'white');
        caseText.setAttribute('stroke-width', '2.5');
        caseText.setAttribute('paint-order', 'stroke');
        caseText.setAttribute('font-size', '9');
        caseText.setAttribute('font-weight', 'bold');
        caseText.setAttribute('pointer-events', 'none');
        caseText.textContent = caseLabels[word.case] || '';

        group.appendChild(text);
        if (word.type === 'subject' || word.type === 'object' || word.type === 'object-akk' || word.type === 'object-dat' || word.type === 'object-gen' || word.type === 'adjective') {
            group.appendChild(caseText);
        }

        // Event handlers
        group.dataset.wordId = word.id;
        group.addEventListener('mousedown', (e) => onWordDragStart(e, word));
        group.addEventListener('click', (e) => {
            e.stopPropagation();
            onWordClick(word);
        });

        this.svg.appendChild(group);
    }

    /**
     * Create shape element based on word type and case
     */
    createShape(word) {
        let shape;

        // Verbs have a distinct hexagon shape
        if (word.type === 'verb' || word.type === 'modal') {
            shape = document.createElementNS(this.svgNS, 'polygon');
            // Hexagon points (flat top/bottom)
            shape.setAttribute('points', '25,0 45,12.5 45,37.5 25,50 5,37.5 5,12.5');
        }
        // Subordinating conjunction has a pentagon shape (pointing down for Nebensatz)
        else if (word.type === 'conjunction') {
            shape = document.createElementNS(this.svgNS, 'polygon');
            // Pentagon points
            shape.setAttribute('points', '25,0 50,19 40,50 10,50 0,19');
        }
        // Coordinating conjunction has a star/cross shape (for continuing Hauptsatz)
        else if (word.type === 'coord-conjunction') {
            shape = document.createElementNS(this.svgNS, 'polygon');
            // 4-pointed star (cross/plus shape)
            shape.setAttribute('points', '25,0 30,20 50,25 30,30 25,50 20,30 0,25 20,20');
        }
        // Preposition shapes based on case type (auto-detected from text)
        else if (word.type === 'preposition') {
            // Auto-detect preposition case from the word text
            const prepCase = this.wordManager.getPrepositionCase(word.text);

            if (prepCase === 'akk') {
                // Small rectangle for accusative prepositions (matches accusative square)
                shape = document.createElementNS(this.svgNS, 'rect');
                shape.setAttribute('x', '10');
                shape.setAttribute('y', '10');
                shape.setAttribute('width', '30');
                shape.setAttribute('height', '30');
                shape.setAttribute('rx', '3');
            } else if (prepCase === 'dat') {
                // Triangle for dative prepositions (matches dative trapezoid sloping sides)
                shape = document.createElementNS(this.svgNS, 'polygon');
                shape.setAttribute('points', '25,5 45,45 5,45');
            } else if (prepCase === 'wechsel') {
                // Parallelogram for wechsel prepositions (two-way)
                shape = document.createElementNS(this.svgNS, 'polygon');
                // Parallelogram points (slanted to the right at 20 degrees, centered at x=25)
                // Height = 30, offset = 30 * tan(20°) ≈ 11
                shape.setAttribute('points', '18,10 43,10 32,40 7,40');
            } else if (prepCase === 'gen') {
                // Small diamond for genitive prepositions (matches genitive diamond)
                shape = document.createElementNS(this.svgNS, 'rect');
                shape.setAttribute('x', '12.5');
                shape.setAttribute('y', '12.5');
                shape.setAttribute('width', '25');
                shape.setAttribute('height', '25');
                shape.setAttribute('transform', 'rotate(45 25 25)');
            } else {
                // Default triangle
                shape = document.createElementNS(this.svgNS, 'polygon');
                shape.setAttribute('points', '25,5 45,45 5,45');
            }
        }
        // "Other" has an octagon shape
        else if (word.type === 'other') {
            shape = document.createElementNS(this.svgNS, 'polygon');
            // Octagon points
            shape.setAttribute('points', '15,0 35,0 50,15 50,35 35,50 15,50 0,35 0,15');
        }
        // Subjects and Objects use case-based shapes
        else {
            if (word.case === 'nom') {
                // Circle for Nominative
                shape = document.createElementNS(this.svgNS, 'circle');
                shape.setAttribute('cx', '25');
                shape.setAttribute('cy', '25');
                shape.setAttribute('r', '25');
            } else if (word.case === 'akk') {
                // Square for Accusative
                shape = document.createElementNS(this.svgNS, 'rect');
                shape.setAttribute('x', '0');
                shape.setAttribute('y', '0');
                shape.setAttribute('width', '50');
                shape.setAttribute('height', '50');
                shape.setAttribute('rx', '5');
            } else if (word.case === 'dat') {
                // Trapezoid for Dative
                shape = document.createElementNS(this.svgNS, 'polygon');
                shape.setAttribute('points', '10,0 40,0 50,50 0,50');
            } else if (word.case === 'gen') {
                // Diamond for Genitive
                shape = document.createElementNS(this.svgNS, 'rect');
                shape.setAttribute('x', '5');
                shape.setAttribute('y', '5');
                shape.setAttribute('width', '40');
                shape.setAttribute('height', '40');
                shape.setAttribute('transform', 'rotate(45 25 25)');
            } else {
                // Default to circle
                shape = document.createElementNS(this.svgNS, 'circle');
                shape.setAttribute('cx', '25');
                shape.setAttribute('cy', '25');
                shape.setAttribute('r', '25');
            }
        }

        return shape;
    }

    /**
     * Draw all words
     */
    drawAllWords(onWordClick, onWordDragStart) {
        const words = this.wordManager.getAllWords();
        words.forEach(word => this.drawWord(word, onWordClick, onWordDragStart));
    }
}
