#!/usr/bin/env python3
"""Test to see the structure of token.morph.to_dict()"""

import spacy

nlp = spacy.load("de_core_news_sm")
doc = nlp("Ich gebe dem Mann einen Apfel")

for token in doc:
    print(f"\n{token.text}:")
    print(f"  token.morph = {token.morph}")
    print(f"  token.morph.to_dict() = {token.morph.to_dict()}")
    print(f"  type(token.morph.to_dict()) = {type(token.morph.to_dict())}")

    morph_dict = token.morph.to_dict()
    if "Case" in morph_dict:
        case_value = morph_dict.get("Case")
        print(f"  Case value = {case_value}")
        print(f"  Case type = {type(case_value)}")
        print(f"  Case[0] = {case_value[0] if case_value else 'N/A'}")

    if "Gender" in morph_dict:
        gender_value = morph_dict.get("Gender")
        print(f"  Gender value = {gender_value}")
        print(f"  Gender type = {type(gender_value)}")
        print(f"  Gender[0] = {gender_value[0] if gender_value else 'N/A'}")
