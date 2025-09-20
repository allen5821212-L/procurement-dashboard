# 採購週報 Dashboard v3（靜態版）

**新功能（Report Builder）**
- ✅ 一鍵生成「個人報告 PDF」：封面 + KPI + 重點摘要 + Top N 品項 + 類別貢獻 + 延遲清單
- ✅ 可選擇 Top N 件數（3–20）
- ✅ 繼承 v2 功能：多資料切換、Excel/CSV 上傳、KPI 門檻設定、PDF/XLSX 匯出、Pivot 與原始明細

## 快速開始
1. 上傳整包到 GitHub repo。
2. 啟用 **GitHub Pages** 或使用內附 `.github/workflows/pages.yml` 自動部署。
3. 開啟頁面，選擇「採購姓名」與「週別」→ 按 **生成個人報告**，即會下載 PDF。

## 報告內容說明
- 封面：顯示報告對象（採購）、週別、四大 KPI（總金額、達成率、交期達成率、平均毛利率）。
- 重點摘要：依 KPI 門檻自動產生「達標/接近/未達標」提示。
- Top N 品項：依金額排序取前 N 筆。
- 類別貢獻：列出各類別金額與占比。
- 延遲清單：列出延遲（非準時）品項供追蹤。

## 資料欄位
`date, week, buyer, category, item, qty, amount, target, margin, ontime`。Excel 上傳支援中文表頭自動對應。

---
Made for Sinya 采購週報 by ChatGPT
