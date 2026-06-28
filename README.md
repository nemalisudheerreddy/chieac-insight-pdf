# ChiEAC InsightPDF

**Designed and developed by Sudheer Reddy Nemali for the ChiEAC Data Science Alliance.**

ChiEAC InsightPDF is a polished Retrieval-Augmented Generation (RAG) web application. A visitor uploads a PDF, asks questions in a chat interface, and receives answers grounded in relevant excerpts from that document.

## What makes this an original project

- Custom FastAPI RAG pipeline written from scratch
- PDF extraction and overlapping chunking
- OpenAI `text-embedding-3-small` embeddings
- Lightweight NumPy cosine-similarity retrieval
- OpenAI grounded answer generation with page citations
- Automatic browser session IDs—no UUID input required
- Responsive, ChiEAC-branded React interface
- Expandable supporting excerpts for answer transparency

## Project structure

```text
chieac-insight-pdf/
├── backend/
│   ├── app/
│   │   ├── main.py       # FastAPI routes
│   │   ├── rag.py        # PDF parsing, embeddings, retrieval, answer generation
│   │   └── schemas.py    # API data models
│   ├── .env.example
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── App.jsx       # Main user experience
    │   ├── api.js        # API calls
    │   └── styles.css    # Complete visual design
    └── package.json
```

## Run locally

### 1. Backend

Use Python 3.12 rather than Python 3.14.

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Open `backend/.env`, replace api_key with your OpenAI API key, and run:

```bash
uvicorn app.main:app --reload
```

Backend: `http://127.0.0.1:8000`  
Swagger: `http://127.0.0.1:8000/docs`

Swagger does **not** require a manually created UUID. For `/api/upload`, enter any readable test value such as `swagger-demo` in `session_id`. For `/api/ask`, reuse the same value in the JSON body.

### 2. Frontend

Open a second terminal:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Frontend: `http://localhost:5173`

The frontend silently generates and manages a session ID for each visitor.

## Deploy publicly

### Backend on Render

Create a Render Web Service from this GitHub repository:

- Root Directory: `backend`
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Environment variables:
  - `OPENAI_API_KEY`
  - `OPENAI_CHAT_MODEL=gpt-4.1-mini`
  - `OPENAI_EMBEDDING_MODEL=text-embedding-3-small`
  - `FRONTEND_ORIGIN=https://YOUR-VERCEL-SITE.vercel.app`

### Frontend on Vercel

Import the same repository:

- Root Directory: `frontend`
- Framework: Vite
- Environment variable:
  - `VITE_API_BASE_URL=https://YOUR-RENDER-BACKEND.onrender.com`

Redeploy after adding the environment variable. Send Benjamin the final **Vercel frontend URL**, not the Render API URL.

## Security and demo limitations

- Never commit `.env` or an OpenAI API key.
- The API key remains only on the backend.
- Documents are stored in server memory for the current app instance and are removed when the service restarts.
- This version supports text-based PDFs up to 15 MB. Scanned-image OCR can be added later.
- For production use, add authentication, persistent encrypted storage, rate limiting, malware scanning, and a managed vector database.

## Suggested demonstration

1. Upload a public education, policy, or community-resource PDF.
2. Ask for a concise summary.
3. Ask a specific question about a date, requirement, or responsibility.
4. Expand the supporting excerpts to show grounded retrieval.
