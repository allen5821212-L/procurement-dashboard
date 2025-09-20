# 採購週報 Dashboard（靜態版）

這是一個 **無需建置（No-Build）** 的靜態 Dashboard：直接把本資料夾上傳到 GitHub（或 GitHub Pages）即可使用。

## 功能
- 買方（採購姓名）與週別篩選
- KPI 紅/黃/綠 指標（達成率、交期達成率、平均毛利率）
- 類別金額長條圖、週別趨勢折線圖
- 採購 × 類別 Pivot 表
- 原始明細表
- 一鍵匯出 **PDF / Excel (.xlsx)**

## 檔案結構
```
.
├─ index.html          # 主頁（Tailwind、Chart.js、SheetJS、jsPDF CDN）
├─ assets/
│  └─ app.js          # 主邏輯
├─ data/
│  └─ sample.csv      # 範例資料（可替換為每週 CSV）
└─ .github/workflows/
   └─ pages.yml       # GitHub Pages 自動部署（可選）
```

## 使用方式
1. 直接上傳整個資料夾至 GitHub repository 的根目錄。
2. 進到 GitHub repo → Settings → Pages → Source 選擇 **Deploy from a branch**，Branch 選擇 `main` 與 `/ (root)`，儲存。
3. 等待 1–2 分鐘，Pages URL 會出現（例如 `https://<你的帳號>.github.io/<repo>`）。

###（可選）改用 GitHub Actions 自動發佈
- 你也可以啟用 `.github/workflows/pages.yml`，讓每次 push 自動部署 Pages。

## 導入你的資料
- 把你的每週報表轉成 `data/weekly_YYYY-Www.csv` 格式（或覆蓋 `sample.csv`）。
- 欄位固定為：
  - `date`（YYYY-MM-DD）
  - `week`（ISO 週，例如 2025-W37）
  - `buyer`（採購姓名）
  - `category`（商品類別）
  - `item`（品名）
  - `qty`（數量）
  - `amount`（金額，數字）
  - `target`（目標金額，數字）
  - `margin`（毛利率，小數例如 0.12）
  - `ontime`（交期是否準時，1 = 準時, 0 = 延遲）

你可以把多個 CSV 都放到 `data/`，並在 `assets/app.js` 把 `./data/sample.csv` 改成你要的路徑（或做下拉選單切換來源）。

## 後續擴充建議
- 新增「採購姓名」下拉的預設值讀取登入者（若你有 SSO/登入機制）。
- 加入「權重與門檻設定」面板（例如 ≥100% 綠、95–99.9% 黃、<95% 紅，可自定）。
- 以 `SheetJS` 直接讀取 `.xlsx`，內建上傳匯入功能。
- 加入「報告模板」與「一鍵生成 PPTX」。

---

Made for Sinya 采購週報 by ChatGPT
