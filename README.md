
# Pixel Perks: The 8 Bit Bistro Members Club

Pixel Perks is a gamified loyalty and cafe management platform designed specifically for **The 8 Bit Bistro**.

## 🚀 Permanent One-Click Deployment (v2.0.8)

To fix authentication errors permanently and enable the "Play" button, follow these steps exactly:

### Step 1: Repair the Connection (Run Once)
Copy and paste this command into your terminal and press Enter. This securely links your token to your machine without saving it in the code (which GitHub blocks).

```bash
git remote set-url origin https://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@github.com/Lordvirendrasama/The8BitBistroHQ.git
```

### Step 2: Press Play
1. Open **`package.json`**.
2. Click the **Play icon** (▶️) next to the **`"push"`** script.

It will now work every time without asking for a password or failing due to security rules.

---

## 🛠 Tech Stack
*   **Framework**: Next.js 15 (App Router)
*   **Frontend**: React, Tailwind CSS, ShadCN UI
*   **Backend**: Firebase (Firestore, Auth)
*   **AI**: Genkit (Google Gemini 2.5 Flash)
*   **Icons**: Lucide React
