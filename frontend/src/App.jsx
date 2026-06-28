import { useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  BookOpenText,
  CheckCircle2,
  FileText,
  LoaderCircle,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { askDocument, clearDocument, uploadDocument } from "./api";

const SUGGESTED_QUESTIONS = [
  "Summarize this document in five key points.",
  "What are the most important dates and deadlines?",
  "List the main people, organizations, and responsibilities.",
];

function createSessionId() {
  // Generated silently in the browser—users never need to enter a UUID.
  return crypto.randomUUID();
}

export default function App() {
  const [sessionId, setSessionId] = useState(createSessionId);
  const [documentInfo, setDocumentInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [uploading, setUploading] = useState(false);
  const [answering, setAnswering] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const isBusy = uploading || answering;
  const statusText = useMemo(() => {
    if (uploading) return "Reading and indexing your PDF…";
    if (answering) return "Searching the document and composing an answer…";
    if (documentInfo) return `${documentInfo.filename} is ready`;
    return "Secure document workspace";
  }, [uploading, answering, documentInfo]);

  async function handleFile(file) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please choose a PDF file.");
      return;
    }

    setError("");
    setUploading(true);
    setMessages([]);

    try {
      const result = await uploadDocument(sessionId, file);
      setDocumentInfo(result);
    } catch (requestError) {
      setError(requestError.message);
      setDocumentInfo(null);
    } finally {
      setUploading(false);
    }
  }

  async function submitQuestion(customQuestion) {
    const cleanQuestion = (customQuestion ?? question).trim();
    if (!cleanQuestion || !documentInfo || answering) return;

    setQuestion("");
    setError("");
    setMessages((current) => [...current, { role: "user", text: cleanQuestion }]);
    setAnswering(true);

    try {
      const result = await askDocument(sessionId, cleanQuestion);
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: result.answer,
          sources: result.sources,
          model: result.model,
        },
      ]);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setAnswering(false);
    }
  }

  async function startOver() {
    try {
      await clearDocument(sessionId);
    } catch {
      // A reset should still work visually when the backend session has expired.
    }
    setSessionId(createSessionId());
    setDocumentInfo(null);
    setMessages([]);
    setQuestion("");
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark"><BookOpenText size={23} /></div>
          <div>
            <div className="brand-name">ChiEAC <span>InsightPDF</span></div>
            <div className="brand-subtitle">Community knowledge, made conversational</div>
          </div>
        </div>
        <div className="creator-pill"><Sparkles size={15} /> Built by Sudheer Reddy Nemali</div>
      </header>

      <section className="hero">
        <div className="eyebrow"><ShieldCheck size={16} /> AI-powered document intelligence</div>
        <h1>Turn complex PDFs into<br /><span>clear, trusted answers.</span></h1>
        <p>
          Upload a document, ask questions in everyday language, and receive
          source-grounded answers in seconds.
        </p>
      </section>

      <section className="workspace">
        <aside className="document-panel glass-card">
          <div className="panel-heading">
            <div>
              <span className="step-label">STEP 01</span>
              <h2>Add your document</h2>
            </div>
            {documentInfo && <CheckCircle2 className="success-icon" size={23} />}
          </div>

          {!documentInfo ? (
            <button
              className={`dropzone ${uploading ? "is-loading" : ""}`}
              onClick={() => !uploading && fileInputRef.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                handleFile(event.dataTransfer.files?.[0]);
              }}
              disabled={uploading}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                onChange={(event) => handleFile(event.target.files?.[0])}
                hidden
              />
              <div className="upload-icon-wrap">
                {uploading ? <LoaderCircle className="spin" size={31} /> : <UploadCloud size={31} />}
              </div>
              <strong>{uploading ? "Preparing your document" : "Drop a PDF here"}</strong>
              <span>{uploading ? "Extracting text and creating a private search index" : "or click to browse · maximum 15 MB"}</span>
            </button>
          ) : (
            <div className="document-ready">
              <div className="file-art"><FileText size={30} /></div>
              <div className="file-details">
                <strong>{documentInfo.filename}</strong>
                <span>{documentInfo.page_count} pages · {documentInfo.chunk_count} searchable sections</span>
              </div>
              <div className="ready-badge">READY</div>
            </div>
          )}

          <div className="privacy-note">
            <LockKeyhole size={17} />
            <div><strong>Private by design</strong><span>Your document is isolated to this browser session.</span></div>
          </div>

          {documentInfo && (
            <button className="reset-button" onClick={startOver} disabled={isBusy}>
              <RotateCcw size={16} /> Use another PDF
            </button>
          )}
        </aside>

        <section className="chat-panel glass-card">
          <div className="panel-heading chat-heading">
            <div>
              <span className="step-label">STEP 02</span>
              <h2>Explore with AI</h2>
            </div>
            <div className="live-indicator"><i /> {statusText}</div>
          </div>

          <div className="conversation">
            {messages.length === 0 ? (
              <div className="empty-conversation">
                <div className="orb"><Sparkles size={30} /></div>
                <h3>{documentInfo ? "Your document is ready to explore" : "Answers begin with a document"}</h3>
                <p>{documentInfo ? "Start with one of these questions or write your own." : "Upload a PDF to unlock intelligent, evidence-based conversation."}</p>

                {documentInfo && (
                  <div className="suggestion-grid">
                    {SUGGESTED_QUESTIONS.map((item) => (
                      <button key={item} onClick={() => submitQuestion(item)} disabled={answering}>{item}</button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="message-list">
                {messages.map((message, index) => (
                  <article key={`${message.role}-${index}`} className={`message ${message.role}`}>
                    <div className="message-label">{message.role === "user" ? "YOU" : "CHIEAC INSIGHTPDF"}</div>
                    <div className="message-bubble">{message.text}</div>
                    {message.sources?.length > 0 && (
                      <details className="sources">
                        <summary>{message.sources.length} supporting excerpts</summary>
                        <div className="source-list">
                          {message.sources.map((source, sourceIndex) => (
                            <div className="source-card" key={`${source.page}-${sourceIndex}`}>
                              <strong>Page {source.page}</strong>
                              <span>{source.excerpt}</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </article>
                ))}
                {answering && (
                  <article className="message assistant">
                    <div className="message-label">CHIEAC INSIGHTPDF</div>
                    <div className="typing"><i /><i /><i /></div>
                  </article>
                )}
              </div>
            )}
          </div>

          {error && <div className="error-banner">{error}</div>}

          <form
            className="composer"
            onSubmit={(event) => {
              event.preventDefault();
              submitQuestion();
            }}
          >
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  submitQuestion();
                }
              }}
              placeholder={documentInfo ? "Ask anything about this document…" : "Upload a PDF to begin…"}
              disabled={!documentInfo || isBusy}
              rows="1"
            />
            <button type="submit" aria-label="Send question" disabled={!documentInfo || !question.trim() || isBusy}>
              {answering ? <LoaderCircle className="spin" size={19} /> : <ArrowUp size={19} />}
            </button>
          </form>
        </section>
      </section>

      <footer>
        <span>ChiEAC Data Science Alliance</span>
        <span>Designed & developed by Sudheer Reddy Nemali · 2026</span>
      </footer>
    </main>
  );
}
