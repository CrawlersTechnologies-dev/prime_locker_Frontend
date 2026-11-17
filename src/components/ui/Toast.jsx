import { createContext, useCallback, useContext, useState } from 'react';
import Icon from './Icon';

const ToastContext = createContext(() => {});

/** toast('Reminder sent') or toast('Couldn’t save', 'bad') */
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const toast = useCallback((text, tone = 'ok') => {
    const id = Math.random().toString(36).slice(2);
    setItems((l) => [...l, { id, text, tone }]);
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), 3500);
  }, []);
  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast tone-${t.tone}`}>
            <Icon name={t.tone === 'bad' ? 'alert' : 'check'} size={16} />{t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
