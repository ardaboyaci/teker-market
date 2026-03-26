import pandas as pd
import json

file_path = "2026 BÜTÜN LİSTELER 5.xlsx"
try:
    xl = pd.ExcelFile(file_path)
    all_skus = set()
    
    # We focus on the sheets we know contain Emes products
    # Based on previous exploration, sheets include: 'EMES 2026 ', 'YEDEK EMES 2026', 'KAUÇUK TAKOZ', 'EMES KULP 2026', 'E.A 2026'
    target_sheets = [s for s in xl.sheet_names if 'EMES' in s.upper() or 'KAUÇUK' in s.upper() or 'E.A' in s.upper()]
    
    for sheet in xl.sheet_names: # Let's actually read all sheets to be safe, the DB match will filter them anyway if it's in the DB
        df = xl.parse(sheet)
        # Assuming the first column contains the SKUs/Codes
        if len(df.columns) > 0:
            codes = df.iloc[:, 0].dropna().astype(str).tolist()
            for code in codes:
                code_clean = code.strip()
                if code_clean and code_clean != 'nan' and len(code_clean) > 1:
                    all_skus.add(code_clean)
                    
    with open('scripts/excel_skus.json', 'w', encoding='utf-8') as f:
        json.dump(list(all_skus), f, ensure_ascii=False)
        
    print(f"Extracted {len(all_skus)} unique SKUs from Excel.")
except Exception as e:
    print(f"Error: {e}")
