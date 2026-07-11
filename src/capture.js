export function buildEntry(text, createdAt) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  return {
    id: crypto.randomUUID(),
    text: trimmed,
    createdAt,
  };
}

export function initCaptureView(store, root) {
  const textarea = root.querySelector('#capture-input');
  const micButton = root.querySelector('#mic-button');
  let startedAt = null;

  function markStart() {
    if (startedAt === null) startedAt = Date.now();
  }

  async function save() {
    if (startedAt === null) return;
    const capturedAt = startedAt;
    startedAt = null;
    const entry = buildEntry(textarea.value, capturedAt);
    textarea.value = '';
    if (entry) {
      await store.addEntry(entry);
    }
  }

  textarea.addEventListener('input', markStart);
  textarea.addEventListener('blur', () => { save(); });
  textarea.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      save().then(() => textarea.focus());
    }
  });

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition && micButton) {
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      markStart();
      textarea.value = textarea.value ? `${textarea.value} ${transcript}` : transcript;
      textarea.focus();
    };
    micButton.addEventListener('mousedown', (event) => event.preventDefault());
    micButton.addEventListener('click', () => recognition.start());
  } else if (micButton) {
    micButton.remove();
  }

  textarea.focus();
}
