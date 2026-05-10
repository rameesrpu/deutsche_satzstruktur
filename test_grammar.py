#!/usr/bin/env python3
"""
Test script for grammar checking feature
"""
import requests
import json

# Test sentences with known errors
test_sentences = [
    # Correct sentence
    {
        "text": "Ich lese das Buch.",
        "expected": "no errors"
    },
    # Wrong article gender
    {
        "text": "Der Haus ist groß.",  # Should be "Das Haus"
        "expected": "article error"
    },
    # Wrong verb conjugation
    {
        "text": "Ich gehen nach Hause.",  # Should be "gehe"
        "expected": "verb conjugation error"
    },
    # Wrong adjective declination
    {
        "text": "Der groß Mann",  # Should be "große"
        "expected": "adjective declination error"
    },
    # Case error with preposition
    {
        "text": "Ich gehe zu der Schule.",  # Should be "zur"
        "expected": "case/contraction error"
    }
]

def test_grammar_check():
    url = "http://localhost:8000/check-grammar"

    print("Testing Grammar Check Endpoint")
    print("=" * 60)

    for i, test in enumerate(test_sentences, 1):
        print(f"\nTest {i}: {test['expected']}")
        print(f"Sentence: {test['text']}")

        try:
            response = requests.post(
                url,
                json={"text": test['text']},
                headers={"Content-Type": "application/json"}
            )

            if response.status_code == 200:
                data = response.json()
                print(f"✓ Status: {response.status_code}")
                print(f"  Errors found: {data['error_count']}")

                if data['error_count'] > 0:
                    for j, error in enumerate(data['errors'], 1):
                        print(f"  Error {j}: {error['message']}")
                        if error['suggestions']:
                            print(f"    Suggestions: {', '.join(error['suggestions'][:3])}")
                else:
                    print("  ✓ No errors found!")
            else:
                print(f"✗ Error: Status {response.status_code}")
                print(f"  {response.text}")

        except Exception as e:
            print(f"✗ Request failed: {e}")

    print("\n" + "=" * 60)

if __name__ == "__main__":
    test_grammar_check()
