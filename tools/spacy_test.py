#!/usr/bin/env python3
"""
Quick spaCy diagnostic for a German sentence.
Usage: python spacy_test.py "Welche Farbe hat das Auto?"
"""

import sys
import spacy

nlp = spacy.load("de_core_news_sm")


def analyze(sentence: str):
    doc = nlp(sentence)

    print(f"\nSentence: {sentence}")
    print(f"{'Token':<14} {'POS':<7} {'DEP':<9} {'Head':<12} {'Person':<8} {'Number':<7} {'Case':<6} {'Gender':<7} {'Lemma':<14} {'SB-children'}")
    print("-" * 110)

    for token in doc:
        if token.is_punct:
            continue
        m = token.morph.to_dict()
        sb = [c.text for c in token.children if c.dep_ in ["sb", "ep"]]
        print(
            f"  {token.text:<12} {token.pos_:<7} {token.dep_:<9} {token.head.text:<12} "
            f"{m.get('Person',''):<8} {m.get('Number',''):<7} {m.get('Case',''):<6} "
            f"{m.get('Gender',''):<7} {token.lemma_:<14} {sb}"
        )

    # Simulate verb_subject_map
    verb_subject_map = {}
    for token in doc:
        is_pred = token.pos_ in ["VERB", "AUX"] or (
            token.dep_ == "ROOT"
            and any(c.dep_ in ["sb", "ep"] for c in token.children)
        )
        if is_pred:
            for child in token.children:
                if child.dep_ in ["sb", "ep"]:
                    verb_subject_map[token.i] = child
                    break

    if verb_subject_map:
        print("\nVerb → Subject map:")
        for vi, subj in verb_subject_map.items():
            print(f"  {doc[vi].text!r} → {subj.text!r}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python spacy_test.py \"<sentence>\"")
        sys.exit(1)
    analyze(" ".join(sys.argv[1:]))
