# 採購週報 Dashboard v2（靜態版）

**新功能**  
- ✅ 多資料來源切換（`data/sources.json`）  
- ✅ 上傳 **Excel / CSV** 即時解析（SheetJS）  
- ✅ KPI 門檻可自訂（localStorage 儲存，紅/黃/綠即時套用）

## 快速開始
1. 將全部檔案上傳到 GitHub repo 根目錄。
2. 打開 `Settings → Pages` 啟用 GitHub Pages（或使用 `.github/workflows/pages.yml` 自動部署）。
3. 開啟頁面後，右上可切換資料來源、上傳 Excel/CSV、調整 KPI 門檻。

## 資料來源管理
- 編輯 `data/sources.json`：
```json
{
  "default": "data/sample_w36.csv",
  "options": [
    { "label": "範例 W36", "path": "data/sample_w36.csv" },
    { "label": "範例 W37", "path": "data/sample_w37.csv" }
  ]
}
```
- CSV 欄位需為：`date, week, buyer, category, item, qty, amount, target, margin, ontime`。

## KPI 門檻設定（預設值）
- 達成率：綠 ≥ **100%**、黃 ≥ **95%**
- 交期達成率：綠 ≥ **95%**、黃 ≥ **90%**

你可以按「KPI 設定」開啟設定視窗，修改後會儲存在瀏覽器的 localStorage。

## 上傳 Excel（.xlsx）對應欄位
若你的 Excel 為中文欄名，支援以下自動對應：  
`日期→date`、`週別→week`、`採購→buyer`、`類別→category`、`品名→item`、`數量→qty`、`金額→amount`、`目標→target`、`毛利率→margin`、`交期→ontime`

## 檔案結構
```
.
├─ index.html
├─ assets/
│  └─ app.js
├─ data/
│  ├─ sample_w36.csv
│  ├─ sample_w37.csv
│  └─ sources.json
└─ .github/workflows/
   └─ pages.yml
```

---
Made for Sinya 采購週報 by ChatGPT
