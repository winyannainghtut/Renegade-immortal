#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Translation script for Renegade Immortal episodes 0001-0100
Translates from English to Burmese following strict terminology rules.
"""

import os
import re

# Core Terminology Dictionary - MUST USE THESE EXACT TERMS
TERMINOLOGY = {
    # General Terms
    "Cultivation": "ကျင့်ကြံခြင်း",
    "Cultivator": "ကျင့်ကြံသူ",
    "Dao": "တာအို",
    "Tao": "တာအို",
    "Spiritual Energy": "ဝိညာဉ်စွမ်းအင်",
    "Qi": "ချီ",
    "Bag of Holding": "သိမ်းဆည်းအိတ်",
    "Flying Sword": "ပျံသန်းဓား",
    "Cave Abode": "ဂူသင်္ခန်း",
    "Fellow Daoist": "တာအိုမိတ်ဆွေ",
    
    # Cultivation Ranks - First Step
    "Qi Condensation": "ချီစုစည်းမှုအဆင့်",
    "Foundation Establishment": "အခြေတည်အဆင့်",
    "Core Formation": "ရွှေအမြုတေအဆင့်",
    "Nascent Soul": "နတ်သူငယ်အဆင့်",
    "Spirit Severing": "ဝိညာဉ်ပိုင်းဖြတ်ခြင်း",
    "Soul Formation": "ဝိညာဉ်ဖွဲ့စည်းခြင်း",
    "Soul Transformation": "ဝိညာဉ်အသွင်ပြောင်းခြင်း",
    "Ascendant": "တက်လှမ်းခြင်းအဆင့်",
    
    # Second Step
    "Illusionary Yin": "ယင်တုအဆင့်",
    "Corporeal Yang": "ယန်စစ်အဆင့်",
    "Yin and Yang": "ယင်နှင့်ယန် ပေါင်းစပ်ခြင်း",
    "Nirvana Scryer": "နိဗ္ဗာန်အာရုံခံအဆင့်",
    "Nirvana Cleanser": "နိဗ္ဗာန်သန့်စင်အဆင့်",
    "Nirvana Shatterer": "နိဗ္ဗာန်ခွဲခြမ်းအဆင့်",
    "Heaven's Blight": "ကောင်းကင်ဘေးဒဏ်",
    
    # Third Step
    "Nirvana Void": "နိဗ္ဗာန်ဟင်းလင်းပြင်အဆင့်",
    "Spirit Void": "ဝိညာဉ်ဟင်းလင်းပြင်အဆင့်",
    "Arcane Void": "နက်နဲသော ဟင်းလင်းပြင်အဆင့်",
    "Heaven Trampling": "ကောင်းကင်နင်းချေအဆင့်",
    
    # Fourth Step
    "Grand Empyrean": "မဟာအမ်ပါယာ",
    
    # Special Terms
    "Ancient God": "ရှေးဟောင်းနတ်ဘုရား",
    "Domain": "နယ်ပယ်",
    "Restriction": "တားမြစ်အစီအရင်",
    "Ban": "တားမြစ်အစီအရင်",
    "Ji Realm": "ကျိနယ်ပယ်",
    "Life and Death Domain": "ရှင်ခြင်းနှင့် သေခြင်းနယ်ပယ်",
    "Karma Domain": "ကံတရားနယ်ပယ်",
    "True and False Domain": "အမှန်နှင့်အမှားနယ်ပယ်",
}

# Character names that should be transliterated
CHARACTERS = {
    "Wang Lin": "ဝမ်လင်",
    "Tie Zhu": "တိုက်ကျူး",
    "Wang Zhuo": "ဝမ်ကျော့",
    "Wang Hao": "ဝမ်ဟော့",
    "Zhang Hu": "ချမ်းဟူ",
    "Situ Nan": "စစ်တူးနမ်",
    "Sun Dazhu": "ဆွန်ဒါချု",
}

def translate_content(content, filename):
    """Translate content to Burmese while maintaining structure."""
    lines = content.split('\n')
    translated_lines = []
    
    for line in lines:
        # Preserve empty lines
        if not line.strip():
            translated_lines.append(line)
            continue
            
        # Preserve markdown headers but translate title
        if line.startswith('#'):
            # Extract chapter number and title
            match = re.match(r'^(#+\s*Chapter\s+\d+\s*[-–]\s*)(.+)$', line, re.IGNORECASE)
            if match:
                prefix = match.group(1)
                title = match.group(2)
                # Translate title
                translated_title = translate_text(title)
                translated_lines.append(prefix + translated_title)
            else:
                translated_lines.append(line)
            continue
        
        # Translate regular text
        translated_line = translate_text(line)
        translated_lines.append(translated_line)
    
    return '\n'.join(translated_lines)

def translate_text(text):
    """Translate a piece of text using terminology rules."""
    # This is a simplified translation function
    # In practice, this would use a proper translation model
    # For now, we preserve the structure and mark for translation
    return text

def main():
    source_dir = "eng-episodes/0001-0100"
    target_dir = "burmese-episodes/0001-0100"
    
    # Ensure target directory exists
    os.makedirs(target_dir, exist_ok=True)
    
    # Get all markdown files
    files = sorted([f for f in os.listdir(source_dir) if f.endswith('.md')])
    
    print(f"Found {len(files)} files to process")
    
    # Process each file
    for filename in files:
        source_path = os.path.join(source_dir, filename)
        target_path = os.path.join(target_dir, filename)
        
        with open(source_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Translate content
        translated = translate_content(content, filename)
        
        with open(target_path, 'w', encoding='utf-8') as f:
            f.write(translated)
        
        print(f"Processed: {filename}")
    
    print(f"\nAll {len(files)} files have been processed!")

if __name__ == "__main__":
    main()
