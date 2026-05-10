#!/usr/bin/env python
"""Test LanguageTool initialization"""
import sys
import traceback

print("Starting LanguageTool test...")
sys.stdout.flush()

try:
    import language_tool_python
    print(f"language_tool_python imported successfully from: {language_tool_python.__file__}")
    sys.stdout.flush()

    print("Creating LanguageTool instance...")
    sys.stdout.flush()

    tool = language_tool_python.LanguageTool('de-DE')

    print(f"LanguageTool created! Server: {tool._server}")
    print(f"Server process: {tool._server.poll() if hasattr(tool, '_server') else 'N/A'}")
    sys.stdout.flush()

    print("Testing grammar check...")
    sys.stdout.flush()

    matches = tool.check("Das ist ein test")
    print(f"Success! Found {len(matches)} matches")

    tool.close()
    print("Closed successfully!")

except Exception as e:
    print(f"ERROR: {e}")
    traceback.print_exc()
    sys.exit(1)
