#!/usr/bin/env python3
"""
Test script to validate the PPT processor workflow
"""
import sys
import os
sys.path.append('/app')

import pandas as pd
import io
from backend.app.ppt_processor import PPTProcessor

def test_workflow():
    print("Testing PPT Processor Workflow...")
    
    # Create test Excel data (Column B has RSID, columns D-H have possible results)
    excel_data = {
        'A': ['Gene1', 'Gene2', 'Gene3'],
        'B': ['rs57108', 'rs131415', 'rs999999'],  # SNP column
        'C': ['Text1', 'Text2', 'Text3'],
        'D': ['TC,TT', 'AA', ''],              # BLUE column
        'E': ['CG', 'TC,TT', 'GG'],           # GREEN column  
        'F': ['', 'CG', 'TC'],                # YELLOW column
        'G': ['AA', '', 'AA,GG'],             # ORANGE column
        'H': ['GG', 'GG', '']                 # RED column
    }
    
    # Create test TXT data (RSID -> RESULT mapping)
    txt_data = {
        'RSID': ['rs57108', 'rs131415', 'rs999999'],
        'CHROMOSOME': ['1', '2', '3'], 
        'POSITION': ['100', '200', '300'],
        'RESULT': ['TC', 'TT', 'GG']  # These should match with Excel columns
    }
    
    processor = PPTProcessor()
    
    # Simulate loading data
    processor.excel_data = pd.DataFrame(excel_data)
    processor.txt_data = pd.DataFrame(txt_data)
    
    print("Excel data:")
    print(processor.excel_data)
    print("\nTXT data:")
    print(processor.txt_data)
    
    # Test color finding logic
    test_cases = [
        ('rs57108', 'BLUE'),   # TC should be found in column D -> BLUE
        ('rs131415', 'GREEN'), # TT should be found in column E -> GREEN  
        ('rs999999', 'ORANGE') # GG should be found in column G -> ORANGE
    ]
    
    for rsid, expected_color in test_cases:
        color = processor.find_color_for_rsid(rsid)
        color_name = None
        if color:
            color_map_reverse = {
                str(processor.COLOR_MAP['D']): 'BLUE',
                str(processor.COLOR_MAP['E']): 'GREEN', 
                str(processor.COLOR_MAP['F']): 'YELLOW',
                str(processor.COLOR_MAP['G']): 'ORANGE',
                str(processor.COLOR_MAP['H']): 'RED'
            }
            color_name = color_map_reverse.get(str(color), 'UNKNOWN')
        
        print(f"RSID {rsid}: Expected {expected_color}, Got {color_name}")
        
        if color_name == expected_color:
            print(f"✅ {rsid} correctly mapped to {color_name}")
        else:
            print(f"❌ {rsid} failed - expected {expected_color} but got {color_name}")

if __name__ == "__main__":
    test_workflow()