#!/usr/bin/env python
# -*- coding: utf-8 -*-

import os
import sys
import re

# Reconfigure stdout and stderr to use UTF-8 to prevent encoding errors on Windows
if sys.platform.startswith("win"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except AttributeError:
        # Python versions < 3.7 might not have reconfigure
        pass

def parse_markdown_tables(file_path):
    entries = []
    if not os.path.exists(file_path):
        return entries
        
    filename = os.path.basename(file_path)
    with open(file_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line.startswith("|") and line.endswith("|"):
                parts = [p.strip() for p in line.split("|")[1:-1]]
                if len(parts) >= 2:
                    # Filter out headers and dividers
                    col1_lower = parts[0].lower()
                    if col1_lower in ["english term", "rank (english)", "chinese", "field", "name", "english"]:
                        continue
                    if all(c in ":- " for c in parts[0]) or all(c in ":- " for c in parts[1]):
                        continue
                        
                    english = parts[0]
                    burmese = parts[1]
                    notes = parts[2] if len(parts) > 2 else ""
                    
                    entries.append({
                        "english": english,
                        "burmese": burmese,
                        "notes": notes,
                        "source": filename
                    })
    return entries

def search_glossary(query, entries):
    query_lower = query.lower()
    matches = []
    for entry in entries:
        if (query_lower in entry["english"].lower() or 
            query_lower in entry["burmese"].lower() or 
            query_lower in entry["notes"].lower()):
            matches.append(entry)
    return matches

def search_episodes(query, episodes_dir):
    matches = []
    if not os.path.exists(episodes_dir):
        return matches
        
    print(f"\nScanning translated files in '{episodes_dir}' for '{query}'...")
    
    # Walk through the directory recursively
    for root, dirs, files in os.walk(episodes_dir):
        for file in files:
            if file.endswith(".md"):
                file_path = os.path.join(root, file)
                rel_path = os.path.relpath(file_path, episodes_dir)
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        for line_num, line in enumerate(f, 1):
                            if query.lower() in line.lower():
                                matches.append({
                                    "file": rel_path,
                                    "line_num": line_num,
                                    "content": line.strip()
                                })
                except Exception as e:
                    # Ignore binary or read errors
                    pass
    return matches

def main():
    if len(sys.argv) < 2:
        print("Renegade Immortal Translation Lookup Tool (0-Token Local Search)")
        print("================================================================")
        print("Usage:")
        print("  python lookup.py \"<term>\"          - Search in standard glossaries (xian_ni_ref.md & SKILL.md)")
        print("  python lookup.py -f \"<text>\"       - Search inside all translated Burmese episode files")
        print("\nExamples:")
        print("  python lookup.py \"Core Formation\"")
        print("  python lookup.py \"ဝမ်လင်း\"")
        print("  python lookup.py -f \"သိုလှောင်အိတ်\"")
        sys.exit(0)

    # Check if we want to search within translated files
    search_files_mode = False
    query = ""
    
    if sys.argv[1] in ["-f", "--files"]:
        if len(sys.argv) < 3:
            print("Error: Please provide a search term after -f")
            sys.exit(1)
        search_files_mode = True
        query = " ".join(sys.argv[2:])
    else:
        query = " ".join(sys.argv[1:])

    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    if search_files_mode:
        episodes_dir = os.path.join(script_dir, "burmese-episodes")
        file_matches = search_episodes(query, episodes_dir)
        
        if not file_matches:
            print(f"\nNo occurrences of '{query}' found in any translated Burmese episodes.")
        else:
            print(f"\nFound {len(file_matches)} occurrence(s) of '{query}':")
            print("=" * 80)
            # Limit results to top 50 to prevent flooding the terminal
            for m in file_matches[:50]:
                print(f"File: burmese-episodes/{m['file']} (Line {m['line_num']})")
                print(f"  > {m['content']}")
                print("-" * 80)
            if len(file_matches) > 50:
                print(f"... and {len(file_matches) - 50} more matches.")
    else:
        # Standard glossary search
        ref_path = os.path.join(script_dir, "xian_ni_ref.md")
        skill_path = os.path.join(script_dir, "SKILL.md")
        
        entries = parse_markdown_tables(ref_path) + parse_markdown_tables(skill_path)
        glossary_matches = search_glossary(query, entries)
        
        if not glossary_matches:
            print(f"\nNo match found for '{query}' in glossary files.")
            print("Would you like to search in translated episode files instead?")
            print(f"Run: python lookup.py -f \"{query}\"")
        else:
            print(f"\nFound {len(glossary_matches)} match(es) in glossary:")
            print("=" * 80)
            for m in glossary_matches:
                print(f"English:  {m['english']}")
                print(f"Burmese:  {m['burmese']}")
                if m['notes']:
                    print(f"Context:  {m['notes']}")
                print(f"Source:   {m['source']}")
                print("-" * 80)

if __name__ == "__main__":
    main()
