import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import './NeverHallucinateAIPage.css';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
};

const IDK_VARIANTS = [
  "I don't know.",
  "I do not know.",
  "I honestly don't know.",
  "I can't tell — I don't know.",
  "Unknown. I don't know.",
  "I don't know yet.",
];

export default function NeverHallucinateAIPage() {
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Ask anything. This is the AI that never hallucinates.',
    },
  ]);

  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const sendMessage = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isThinking) return;

    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        role: 'user',
        text: trimmed,
      },
    ]);
    setInput('');
    setIsThinking(true);

    timeoutRef.current = window.setTimeout(() => {
      const variant = IDK_VARIANTS[Math.floor(Math.random() * IDK_VARIANTS.length)];

      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          text: variant,
        },
      ]);
      setIsThinking(false);
    }, 1400);
  };

  return (
    <div className="never-hallucinate-page">
      <div className="glass-bg-orb orb-a" />
      <div className="glass-bg-orb orb-b" />
      <div className="glass-bg-orb orb-c" />

      <main className="chat-shell">
        <header className="chat-header">
          <a href="/" className="back-link">
            ← Home
          </a>
          <div className="badge">Never Hallucinate AI</div>
          <h1>The first AI chatbot that never hallucinates</h1>
          <p>Truth-first model behavior. Zero fabrication. Maximum honesty.</p>
        </header>

        <section className="chat-panel" aria-live="polite">
          <div className="chat-messages">
            {messages.map((message) => (
              <article key={message.id} className={`chat-bubble ${message.role}`}>
                <span className="bubble-role">{message.role === 'user' ? 'You' : 'Model'}</span>
                <p>{message.text}</p>
              </article>
            ))}

            {isThinking && (
              <article className="chat-bubble assistant thinking-bubble">
                <span className="bubble-role">Model</span>
                <div className="liquid-loader" aria-label="Generating response">
                  <span />
                  <span />
                  <span />
                </div>
                <p>Calibrating certainty...</p>
              </article>
            )}
          </div>

          <form className="composer" onSubmit={sendMessage}>
            <input
              type="text"
              placeholder="Ask me anything..."
              value={input}
              onChange={(event) => setInput(event.target.value)}
              disabled={isThinking}
            />
            <button type="submit" disabled={isThinking || !input.trim()}>
              Send
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}