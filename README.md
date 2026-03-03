
# Pixel Perks: The 8 Bit Bistro Members Club

Pixel Perks is a gamified loyalty and cafe management platform designed specifically for **The 8 Bit Bistro**.

## 🚀 Permanent One-Click Deployment

To fix authentication errors permanently and enable the "Play" button, follow these steps exactly:

### Step 1: Repair the Connection (Run Once)
Replace `YOUR_TOKEN` with your GitHub Personal Access Token and run this command in your terminal:

```bash
git remote set-url origin https://YOUR_TOKEN@github.com/Lordvirendrasama/The8BitBistroHQ.git
```

### Step 2: Configure Git Identity (Run Once)
Ensure Git knows who you are so the commit doesn't fail:

```bash
git config --global user.email "you@example.com"
git config --global user.name "Your Name"
```

### Step 3: Press Play
1. Open **`package.json`**.
2. Click the **Play icon** (▶️) next to the **`"deploy"`** script.

It will now automatically commit as **"Build v1.0.4"** (and future versions) and push to GitHub without asking for a password.

---

## 🛠 Tech Stack
*   **Framework**: Next.js 15 (App Router)
*   **Frontend**: React, Tailwind CSS, ShadCN UI
*   **Backend**: Firebase (Firestore, Auth)
*   **AI**: Genkit (Google Gemini 2.5 Flash)
*   **Icons**: Lucide React
