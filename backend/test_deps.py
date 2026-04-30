#!/usr/bin/env python3
"""Test dependency parsing to see subject-verb relationships"""

import spacy

nlp = spacy.load("de_core_news_sm")

sentences = [
    "Du liest ein Buch",
    "Sie singt schön",
    "Es regnet heute"
]

for sentence in sentences:
    print(f"\n{'='*60}")
    print(f"Sentence: {sentence}")
    print('='*60)

    doc = nlp(sentence)

    print(f"{'Text':<12} {'POS':<8} {'Dep':<8} {'Head':<12} {'Children'}")
    print("-" * 60)

    for token in doc:
        children = ", ".join([child.text + "(" + child.dep_ + ")" for child in token.children])
        print(f"{token.text:<12} {token.pos_:<8} {token.dep_:<8} {token.head.text:<12} {children}")

    # Find verbs and their subjects
    print("\nVerb-Subject pairs:")
    for token in doc:
        if token.pos_ in ["VERB", "AUX"]:
            subjects = [child for child in token.children if child.dep_ == "sb"]
            if subjects:
                for subj in subjects:
                    print(f"  {token.text} ← {subj.text} (subject)")
            else:
                print(f"  {token.text} (no subject found)")
