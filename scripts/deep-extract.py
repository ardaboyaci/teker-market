import pandas as pd
import json

file_path = "2026 BÜTÜN LİSTELER 5.xlsx"
try:
    print("Reading Excel...")
    xl = pd.ExcelFile(file_path)
    all_text = set()
    
    for sheet in xl.sheet_names:
        df = xl.parse(sheet)
        for col in df.columns:
            # Drop nans, convert to string
            items = df[col].dropna().astype(str).tolist()
            for item in items:
                clean_item = item.strip()
                if len(clean_item) > 1:
                    all_text.add(clean_item)
                    
    with open('scripts/deep_excel_text.json', 'w', encoding='utf-8') as f:
        json.dump(list(all_text), f, ensure_ascii=False)
        
    print(f"Extracted {len(all_text)} unique string cells from entire Excel.")
except Exception as e:
    print(f"Error: {e}")
