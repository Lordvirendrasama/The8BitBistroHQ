# Pixel Perks: The 8 Bit Bistro Members Club

Pixel Perks is a gamified loyalty and cafe management platform designed specifically for **The 8 Bit Bistro**. It blends retro gaming aesthetics with modern operational tools.

## ✅ GitHub Sync Status
Your code is backed up at:
`https://github.com/Lordvirendrasama/The8BitBistroHQ.git`

### 🚨 WHY IS MY PUSH FAILING? (401 Unauthorized)
GitHub **disabled** standard passwords for terminal use. Even if your password works on the website, the terminal will reject it. 

**The Fix:** You MUST use a **Personal Access Token (Classic)**.

### 🔑 How to get your GitHub Token
1.  **Open this link:** [GitHub Personal Access Tokens](https://github.com/settings/tokens)
2.  Click **Generate new token** ➔ **Generate new token (classic)**.
3.  **Note:** "Bistro-Terminal".
4.  **Expiration:** Select **"No expiration"**.
5.  **Scopes:** Check the **[x] repo** box (Required!).
6.  Click **Generate token** and **COPY it immediately**. It starts with `ghp_`.

### 🚀 Fresh Start Initialization (One-Liner)
If you are getting authentication errors, copy this entire line, replace `YOUR_TOKEN` with your code, and press Enter:

`rm -rf .git && git init && git add . && git commit -m "Build v1.7.7: Fresh sync" && git branch -M main && git remote add origin https://Lordvirendrasama:YOUR_TOKEN@github.com/Lordvirendrasama/The8BitBistroHQ.git && git push origin main --force`

---

## 🛠 Tech Stack
*   **Framework**: Next.js 15 (App Router)
*   **Frontend**: React, Tailwind CSS, ShadCN UI
*   **Backend**: Firebase (Firestore, Auth)
*   **AI**: Genkit (Google Gemini 2.5 Flash)
*   **Icons**: Lucide React
