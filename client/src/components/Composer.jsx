import { useEffect, useRef, useState } from 'react';

export function Composer({ onSend, onTyping, disabled }) {
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const stopTimer = useRef(null);

  useEffect(() => () => clearTimeout(stopTimer.current), []);

  function notifyTyping(isTyping) {
    onTyping(isTyping);
    clearTimeout(stopTimer.current);
    if (isTyping) {
      stopTimer.current = setTimeout(() => onTyping(false), 1200);
    }
  }

  async function submit(event) {
    event?.preventDefault();
    const text = value.trim();
    if (!text || sending) return;
    setSending(true);
    setError('');
    notifyTyping(false);
    try {
      await onSend(text);
      setValue('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <form className="composer" onSubmit={submit}>
      <label className="sr-only" htmlFor="composer">Message</label>
      <textarea
        id="composer"
        rows={2}
        value={value}
        placeholder="Write a message"
        disabled={disabled || sending}
        onChange={(event) => {
          setValue(event.target.value);
          notifyTyping(Boolean(event.target.value.trim()));
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
      />
      <button type="submit" disabled={disabled || sending || !value.trim()}>Send</button>
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
  );
}
