// All browser-to-backend communication lives here, keeping App.jsx readable.
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

async function parseResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || "The server could not complete this request.");
  }
  return data;
}

export async function uploadDocument(sessionId, file) {
  const formData = new FormData();
  formData.append("session_id", sessionId);
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/api/upload`, {
    method: "POST",
    body: formData,
  });
  return parseResponse(response);
}

export async function askDocument(sessionId, question) {
  const response = await fetch(`${API_BASE_URL}/api/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, question }),
  });
  return parseResponse(response);
}

export async function clearDocument(sessionId) {
  const response = await fetch(`${API_BASE_URL}/api/session/${sessionId}`, {
    method: "DELETE",
  });
  return parseResponse(response);
}
