#!/usr/bin/env python
# -*- coding: utf-8 -*-

import os
import sys

# Reconfigure stdout/stderr to UTF-8 to prevent encoding errors on Windows
if sys.platform.startswith("win"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except AttributeError:
        pass

# Ordered by length of the target string (longest first) to prevent partial/double replacements
REPLACEMENTS = [
    # Qi Condensation
    ("ချီစုဆောင်းခြင်း အဆင့်", "ချီစုစည်းမှုအဆင့်"),
    ("ချီစုဆောင်းခြင်းအဆင့်", "ချီစုစည်းမှုအဆင့်"),
    ("ချီစုဆောင်းခြင်း", "ချီစုစည်းမှုအဆင့်"),
    
    # Foundation Establishment
    ("အခြေခံ တည်ဆောက်ခြင်း အဆင့်", "အခြေတည်အဆင့်"),
    ("အခြေခံ တည်ဆောက်ခြင်းအဆင့်", "အခြေတည်အဆင့်"),
    ("အခြေခံ တည်ဆောက်ခြင်း", "အခြေတည်အဆင့်"),
    ("အခြေခံတည်ဆောက်ခြင်း", "အခြေတည်အဆင့်"),
    ("ကျူကျီအဆင့်", "အခြေတည်အဆင့်"),
    ("ကျူကျီ", "အခြေတည်"),
    
    # Core Formation
    ("ရွှေအမြှုတေ အဆင့်", "ရွှေအမြုတေအဆင့်"),
    ("ရွှေအမြှုတေအဆင့်", "ရွှေအမြုတေအဆင့်"),
    ("ရွှေအမြှုတေ", "ရွှေအမြုတေ"),
    ("ကျဲဒန် အဆင့်", "ရွှေအမြုတေအဆင့်"),
    ("ကျဲဒန်အဆင့်", "ရွှေအမြုတေအဆင့်"),
    ("ကျဲဒန်", "ရွှေအမြုတေ"),
    ("ကျင်တန်းအဆင့်", "ရွှေအမြုတေအဆင့်"),
    ("ကျင်တန်း", "ရွှေအမြုတေ"),
    
    # Nascent Soul
    ("နတ်ဘုရား ဝိညာဉ်အဆင့်", "နတ်သူငယ်အဆင့်"),
    ("နတ်ဘုရားဝိညာဉ်အဆင့်", "နတ်သူငယ်အဆင့်"),
    ("ဝိညာဉ်သန္ဓေအဆင့်", "နတ်သူငယ်အဆင့်"),
    ("ဝိညာဉ်သန္ဓေ", "နတ်သူငယ်"),
    ("ယွမ်ရင်း အဆင့်", "နတ်သူငယ်အဆင့်"),
    ("ယွမ်ရင်းအဆင့်", "နတ်သူငယ်အဆင့်"),
    ("ယွမ်ရင်း", "နတ်သူငယ်"),
    
    # Soul Formation
    ("ဝိညာဉ်ဖွဲ့စည်းခြင်း အဆင့်", "ဝိညာဉ်ဖွဲ့စည်းခြင်းအဆင့်"),
    ("စိတ်ဝိညာဉ်ဖွဲ့စည်းခြင်း", "ဝိညာဉ်ဖွဲ့စည်းခြင်းအဆင့်"),
    ("ဝါရှန်အဆင့်", "ဝိညာဉ်ဖွဲ့စည်းခြင်းအဆင့်"),
    ("ဝါရှန်", "ဝိညာဉ်ဖွဲ့စည်းခြင်း"),
    
    # Ancient God
    ("ရှေးဦးနတ်ဘုရား", "ရှေးဟောင်းနတ်ဘုရား"),
    
    # Cave Abode
    ("ကျင့်ကြံရာဂူ", "ဂူသင်္ခန်း"),
    ("ဂူဗိမာန်", "ဂူသင်္ခန်း"),
    
    # Planet Suzaku
    ("ဆူဇားကူး", "ဆူဇာကူ"),
    ("ဆူဇာကူး", "ဆူဇာကူ"),
    
    # Dantian
    ("ဒန်တန်", "ဒန်တျန်"),
    
    # Flying Sword
    ("ဓားပျံ", "ပျံသန်းဓား"),
    
    # Soul Transformation
    ("ဝိညာဉ်အသွင်ပြောင်းလဲခြင်း", "ဝိညာဉ်အသွင်ပြောင်းခြင်း"),
    
    # Ancient Demon / Devil
    ("ရှေးဦးနတ်ဆိုး", "ရှေးဟောင်းနတ်ဆိုး"),
    ("ရှေးဦးမိစ္ဆာ", "ရှေးဟောင်းမိစ္ဆာ"),
    
    # Yuan Shen / Primordial Spirit
    ("ယွမ်ရှန်း", "မူလဝိညာဉ်"),
    
    # Heaven Trampling
    ("နင်းခြေခြင်း", "နင်းချေခြင်း"),
    
    # Flag of Souls
    ("ဝိညာဉ်အလံ", "ဝိညာဉ်စုစည်းမှုအလံ"),
    
    # Ji Realm
    ("ကျိအဆင့်", "ကျိနယ်ပယ်"),
    
    # Yuanying pinyin typo
    ("ယွမ်ယင်း", "နတ်သူငယ်"),
    
    # Domain variation
    ("စွမ်းအားနယ်ပယ်", "အသိစိတ်နယ်ပယ်"),
    
    # Shenshi pinyin typo
    ("ရှင်ရှီ", "ဝိညာဉ်အာရုံ"),
    
    # Nirvana Scryer pinyin typo
    ("ခွေးနီ", "နိဗ္ဗာန်အာရုံခံ"),
    
    # Heng Yue Sect spelling variation
    ("ဟန်ယွဲ့ဂိုဏ်း", "ဟန်ရွဲ့ဂိုဏ်း"),
    
    # Sea of Devils variation
    ("နတ်ဆိုးပင်လယ်", "မိစ္ဆာပင်လယ်"),
    
    # Rain Celestial Realm variation
    ("မိုးနတ်ဘုရားနယ်မြေ", "မိုးနတ်ဘုရားနယ်ပယ်"),
    
    # Planet spelling typo
    ("ဂြိုလ်", "ဂြိုဟ်"),
]

def standardize_file(file_path, dry_run=True):
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
    except Exception as e:
        print(f"Error reading {file_path}: {e}")
        return False, 0
        
    modified_content = content
    changes_count = 0
    
    # 1. Handle Heavenly Tribulation using regex to avoid double-suffix loops
    import re
    # Clean up any existing double suffixes
    if "ကောင်းကင်ဘေးဒဏ်ဒဏ်" in modified_content:
        count = modified_content.count("ကောင်းကင်ဘေးဒဏ်ဒဏ်")
        changes_count += count
        if not dry_run:
            modified_content = modified_content.replace("ကောင်းကင်ဘေးဒဏ်ဒဏ်", "ကောင်းကင်ဘေးဒဏ်")
            
    # Standardize ကောင်းကင်ဘေး only if NOT followed by ဒဏ်
    matches = re.findall(r"ကောင်းကင်ဘေး(?!ဒဏ်)", modified_content)
    if matches:
        count = len(matches)
        changes_count += count
        if not dry_run:
            modified_content = re.sub(r"ကောင်းကင်ဘေး(?!ဒဏ်)", "ကောင်းကင်ဘေးဒဏ်", modified_content)
            
    # 2. Process all other static replacements
    for old_term, new_term in REPLACEMENTS:
        if old_term in modified_content:
            count = modified_content.count(old_term)
            changes_count += count
            if not dry_run:
                modified_content = modified_content.replace(old_term, new_term)
                
    if changes_count > 0 and not dry_run:
        try:
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(modified_content)
        except Exception as e:
            print(f"Error writing {file_path}: {e}")
            return False, 0
            
    return changes_count > 0, changes_count

def main():
    dry_run = True
    if len(sys.argv) > 1 and sys.argv[1] == "--apply":
        dry_run = False
        
    script_dir = os.path.dirname(os.path.abspath(__file__))
    episodes_dir = os.path.join(script_dir, "burmese-episodes")
    
    if not os.path.exists(episodes_dir):
        print(f"Error: Directory '{episodes_dir}' not found.")
        sys.exit(1)
        
    print("Renegade Immortal Translation Terminology Standardizer")
    print("======================================================")
    if dry_run:
        print("[DRY RUN MODE] Showing changes that will be made without modifying files.")
        print("To actually apply changes, run: python standardize_terms.py --apply\n")
    else:
        print("[APPLY MODE] Modifying files to standardize terms...\n")
        
    total_files_checked = 0
    total_files_modified = 0
    total_replacements_made = 0
    
    for root, dirs, files in os.walk(episodes_dir):
        for file in files:
            if file.endswith(".md"):
                file_path = os.path.join(root, file)
                rel_path = os.path.relpath(file_path, episodes_dir)
                total_files_checked += 1
                
                changed, count = standardize_file(file_path, dry_run=dry_run)
                if changed:
                    total_files_modified += 1
                    total_replacements_made += count
                    status = "Would change" if dry_run else "Standardized"
                    print(f"[{status}] burmese-episodes/{rel_path} - Found {count} occurrences")
                    
    print("\nSummary:")
    print(f"  Total files checked:    {total_files_checked}")
    print(f"  Total files modified:   {total_files_modified}")
    print(f"  Total replacements:     {total_replacements_made}")
    
    if dry_run and total_files_modified > 0:
        print("\nTo apply these corrections, run: python standardize_terms.py --apply")

if __name__ == "__main__":
    main()
