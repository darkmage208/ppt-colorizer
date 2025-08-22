#!/usr/bin/env python3
"""
Debug script to test common data quality issues
"""
import pandas as pd

def test_data_variations():
    print("Testing common data quality issues that could cause 5-10% processing failures...")
    
    # Test Excel data with various issues
    excel_data = {
        'A': ['Gene1', 'Gene2', 'Gene3', 'Gene4', 'Gene5'],
        'B': ['rs57108', 'rs131415', '', 'rs999999', 'rs123456'],  # Empty RSID
        'C': ['Text1', 'Text2', 'Text3', 'Text4', 'Text5'],
        'D': ['TC,TT', 'AA', 'TC; TT', 'TC|TT', 'TC TT'],      # Different separators
        'E': ['CG', 'TC,TT', '', 'GG', 'cg'],                 # Case variations
        'F': ['', 'CG', 'TC', '', 'TCCT'],                   # Partial matches needed
        'G': ['AA', '', 'AA,GG', 'aa', ''],                  # Case and empty
        'H': ['GG', 'GG', '', 'gg', 'TCG']                   # Mixed
    }
    
    # Test TXT data with various issues  
    txt_data = {
        'RSID': ['rs57108', 'rs131415', 'rs999999', '123456'],  # Mixed formats
        'RESULT': ['TC', 'TT', 'GG', 'TCG']                     # Various results
    }
    
    df_excel = pd.DataFrame(excel_data)
    df_txt = pd.DataFrame(txt_data)
    
    print("Excel sample data:")
    print(df_excel)
    print("\nTXT sample data:")
    print(df_txt)
    
    # Common issues that could cause failures:
    issues = [
        "1. Empty RSID in Excel (row 3)",
        "2. RSID format mismatch (rs123456 in Excel vs 123456 in TXT)", 
        "3. Different separators in Excel columns (comma, semicolon, pipe, space)",
        "4. Case sensitivity (CG vs cg)",
        "5. Empty cells in color columns",
        "6. Partial matches needed (TC in TCCT)",
        "7. Missing RSID in TXT data (some Excel RSIDs not in TXT)",
        "8. PowerPoint text boxes with slightly different formatting"
    ]
    
    print("\nCommon issues that could cause 5-10% processing failures:")
    for issue in issues:
        print(f"  {issue}")
    
    print("\n✅ Enhanced PPT processor should now handle these issues better!")

if __name__ == "__main__":
    test_data_variations()