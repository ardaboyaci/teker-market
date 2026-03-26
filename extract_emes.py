import pandas as pd

file_path = "2026 BÜTÜN LİSTELER 5.xlsx"
xl = pd.ExcelFile(file_path)

# Look at EMES 2026
df_emes = xl.parse('EMES 2026 ')
# Drop fully empty rows
df_emes = df_emes.dropna(how='all')
# Find a column that looks like it has product codes (e.g., strings)
for col in df_emes.columns:
    sample = df_emes[col].dropna().astype(str)
    if not sample.empty:
        print(f"Column: {col}, First 5 non-nulls: {sample.head().tolist()}")

print("\n--- EMES KULP 2026 ---")
df_emes_kulp = xl.parse('EMES KULP 2026')
print(df_emes_kulp['Emes Ürün Kodu'].dropna().head(10).tolist())

print("\n--- YEDEK EMES 2026 ---")
df_yedek = xl.parse('YEDEK EMES 2026')
for col in df_yedek.columns:
    sample = df_yedek[col].dropna().astype(str)
    if not sample.empty:
        print(f"Column: {col}, First 5 non-nulls: {sample.head().tolist()}")
