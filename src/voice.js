// Adds dictation to a jot box. Removes the button where the browser has no
// speech recognition (e.g. Firefox). Failures are shown in the box instead of
// failing silently.
const ERROR_HINTS = {
  'not-allowed': 'Mic is blocked. Allow the microphone in the address bar, then try again.',
  'service-not-allowed': 'Mic is blocked. Allow the microphone in the address bar, then try again.',
  'no-speech': "Didn't hear anything. Tap the mic and try again.",
  'audio-capture': 'No microphone found.',
  network: "Voice needs an internet connection, and doesn't work in Brave.",
};

export function attachMic(button, textarea) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    button.remove();
    return;
  }
  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  const originalPlaceholder = textarea.placeholder;
  let listening = false;
  let gotResult = false;
  let failed = false;

  function setListening(on) {
    listening = on;
    button.classList.toggle('listening', on);
    textarea.placeholder = on ? 'Listening…' : originalPlaceholder;
  }

  function hint(text) {
    textarea.placeholder = text;
    setTimeout(() => { textarea.placeholder = originalPlaceholder; }, 6000);
  }

  recognition.onstart = () => { gotResult = false; failed = false; setListening(true); };
  recognition.onend = () => {
    setListening(false);
    if (!gotResult && !failed) hint('Heard nothing. Check your Mac\'s input device and try again.');
  };
  recognition.onaudiostart = () => { textarea.placeholder = 'Listening… speak now'; };
  recognition.onresult = (event) => {
    gotResult = true;
    const transcript = event.results[0][0].transcript;
    textarea.value = textarea.value ? `${textarea.value} ${transcript}` : transcript;
    textarea.focus();
  };
  recognition.onerror = (event) => {
    failed = true;
    setListening(false);
    hint(ERROR_HINTS[event.error] || `Voice error: ${event.error}`);
  };

  button.addEventListener('mousedown', (event) => event.preventDefault());
  button.addEventListener('click', () => {
    if (listening) {
      recognition.stop();
      return;
    }
    try {
      recognition.start();
    } catch (err) {
      textarea.placeholder = 'Mic could not start. Reload the page and try again.';
    }
  });
}
