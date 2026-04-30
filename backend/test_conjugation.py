#!/usr/bin/env python3
"""Test conjugation pronoun detection"""

import requests

# Test sentence with various pronouns and conjugations
sentences = [
    "Ich gebe dem Mann einen Apfel",
    "Du liest ein Buch",
    "Er spielt Fußball",
    "Sie singt schön",
    "Es regnet heute",
    "Wir gehen ins Kino",
    "Ihr macht Hausaufgaben",
    "Sie kommen morgen"
]

for sentence in sentences:
    print(f"\n{'='*60}")
    print(f"Sentence: {sentence}")
    print('='*60)

    response = requests.post(
        "http://localhost:8000/analyze",
        json={"text": sentence}
    )

    if response.status_code == 200:
        analyzed = response.json()
        print(f"{'Text':<12} {'Type':<18} {'Conjugation':<12} {'Gender':<8} {'Case':<8}")
        print("-" * 60)
        for word in analyzed:
            conj = word.get('conjugation_pronoun', 'none')
            print(f"{word['text']:<12} {word['type']:<18} {conj:<12} {word['gender']:<8} {word['case']:<8}")
    else:
        print(f"Error: {response.status_code}")
