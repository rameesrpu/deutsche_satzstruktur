#!/usr/bin/env python3
"""Test to see the structure of token.morph.to_dict()"""

import spacy

nlp = spacy.load("de_core_news_sm")

test_sentences = [
    "Ich gebe dem Mann einen Apfel",
    "Wie heißt du?",
    "Wie alt bist du?",
    "Woher kommst du?",
    "Was machst du?",
]

for sentence in test_sentences:
    print(f"\n{'='*60}")
    print(f"Sentence: {sentence}")
    print('='*60)
    doc = nlp(sentence)

    for token in doc:
        morph_dict = token.morph.to_dict()
        children_deps = [(c.text, c.dep_) for c in token.children]
        print(
            f"  {token.text:<12} pos={token.pos_:<6} dep={token.dep_:<8} "
            f"head={token.head.text:<10} "
            f"Person={morph_dict.get('Person',''):<3} "
            f"Number={morph_dict.get('Number',''):<5} "
            f"Case={morph_dict.get('Case',''):<5} "
            f"children={children_deps}"
        )
