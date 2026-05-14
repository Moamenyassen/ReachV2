<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1Nc5pldH0yWLlk-CeDDdt1T8Hyh2b0B_I

## Run Locally

**Prerequisites:** Node.js + Python 3


1. Install dependencies:
   `npm install`

2. Set the `GEMINI_API_KEY` (Gemini API key):
   - Frontend: [.env.local](.env.local)
   - Backend: `server_py/.env`

3. Start the backend API (required for the Analyzer chat/analyze endpoints):
   `python3 -m pip install -r server_py/requirements.txt`
   `python3 -m uvicorn server_py.main:app --port 8000 --reload`

4. Run the app:
   `npm run dev`
