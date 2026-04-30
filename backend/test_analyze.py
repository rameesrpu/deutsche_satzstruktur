#!/usr/bin/env python3
"""Test script to see what spaCy detects for a German sentence"""

import requests
import json

# Test sentence
sentence = "Ich gebe dem Mann einen Apfel"

# Call the debug endpoint
response = requests.post(
    "http://localhost:8000/analyze/debug",
    json={"text": sentence}
)

if response.status_code == 200:
    results = response.json()

    print(f"\nAnalyzing: '{sentence}'\n")
    print("-" * 80)
    print(f"{'Text':<12} {'POS':<8} {'Tag':<8} {'Dep':<8} {'Morph':<40}")
    print("-" * 80)

    for token in results:
        print(f"{token['text']:<12} {token['pos']:<8} {token['tag']:<8} {token['dep']:<8} {token['morph']:<40}")

        # Show case if present
        morph_dict = token.get('morph_dict', {})
        if 'Case' in morph_dict:
            print(f"  → Case: {morph_dict['Case']}")

    print("\n" + "=" * 80)
    print("\nNow calling /analyze endpoint:")
    print("=" * 80 + "\n")

    # Call the regular analyze endpoint
    response2 = requests.post(
        "http://localhost:8000/analyze",
        json={"text": sentence}
    )

    if response2.status_code == 200:
        analyzed = response2.json()
        print(f"{'Text':<12} {'Type':<18} {'Gender':<8} {'Case':<8} {'Number':<8}")
        print("-" * 80)
        for word in analyzed:
            print(f"{word['text']:<12} {word['type']:<18} {word['gender']:<8} {word['case']:<8} {word['number']:<8}")
else:
    print(f"Error: {response.status_code}")
    print(response.text)
