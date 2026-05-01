#!/usr/bin/env python3
"""
Test clause detection with example German sentences
"""

import requests
import json

# Backend URL
BACKEND_URL = "http://localhost:8000"

# Test sentences with subordinate clauses
test_sentences = [
    # Simple subordinate clause with "weil"
    "Ich bleibe zu Hause, weil es regnet.",

    # Subordinate clause with "dass"
    "Ich denke, dass er morgen kommt.",

    # Subordinate clause with "ob"
    "Ich weiß nicht, ob sie Zeit hat.",

    # Subordinate clause with "wenn"
    "Wenn das Wetter schön ist, gehen wir spazieren.",

    # Multiple clauses with coordinating conjunction
    "Er isst einen Apfel und sie trinkt Wasser.",

    # Complex sentence with subordinate and coordinate clauses
    "Ich gehe ins Kino, weil ich den Film sehen möchte, und du kannst mitkommen.",
]

def test_sentence(sentence):
    """Test a single sentence"""
    print(f"\n{'='*80}")
    print(f"Testing: {sentence}")
    print(f"{'='*80}")

    try:
        response = requests.post(
            f"{BACKEND_URL}/analyze",
            json={"text": sentence}
        )

        if response.status_code == 200:
            words = response.json()

            # Group by clause
            clauses = {}
            for word in words:
                clause_id = word['clause_id']
                if clause_id not in clauses:
                    clauses[clause_id] = {
                        'type': word['clause_type'],
                        'words': []
                    }
                clauses[clause_id]['words'].append(word)

            # Display results
            for clause_id in sorted(clauses.keys()):
                clause = clauses[clause_id]
                clause_type = clause['type'].upper()
                words_text = ' '.join([w['text'] for w in clause['words']])

                print(f"\n  Clause {clause_id} [{clause_type}]: {words_text}")

                # Show word details
                for word in clause['words']:
                    conj_marker = " ← CONJUNCTION" if word['type'] in ['conjunction', 'coord-conjunction'] else ""
                    print(f"    - {word['text']:15} | type={word['type']:20} | pos={word['pos']:8}{conj_marker}")

            return True
        else:
            print(f"  ERROR: Server returned status {response.status_code}")
            print(f"  {response.text}")
            return False

    except requests.exceptions.ConnectionError:
        print(f"  ERROR: Cannot connect to backend at {BACKEND_URL}")
        print(f"  Make sure the backend is running: cd backend && python app.py")
        return False
    except Exception as e:
        print(f"  ERROR: {e}")
        return False

def main():
    print("=" * 80)
    print("German Clause Detection Test")
    print("=" * 80)

    # Check if backend is running
    try:
        response = requests.get(BACKEND_URL)
        if response.status_code == 200:
            info = response.json()
            print(f"\n✓ Backend is running")
            print(f"  Model: {info.get('model', 'unknown')}")
        else:
            print(f"\n✗ Backend returned unexpected status: {response.status_code}")
            return
    except requests.exceptions.ConnectionError:
        print(f"\n✗ Cannot connect to backend at {BACKEND_URL}")
        print(f"  Please start the backend first: cd backend && python app.py")
        return

    # Run tests
    success_count = 0
    for sentence in test_sentences:
        if test_sentence(sentence):
            success_count += 1

    # Summary
    print(f"\n{'='*80}")
    print(f"Summary: {success_count}/{len(test_sentences)} tests completed successfully")
    print(f"{'='*80}")

if __name__ == "__main__":
    main()
