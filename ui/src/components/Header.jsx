import { useEffect, useRef, useState } from 'react';

const VIEWS = [
    { id: 'console', label: 'Console' },
    { id: 'saved', label: 'Saved' },
    { id: 'watch', label: 'Watch' },
    { id: 'history', label: 'History' },
    { id: 'help', label: 'Help' },
];

export default function Header({ view, setView, counts, onClose }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (!open) return;
        const onClick = (e) => {
            if (!ref.current?.contains(e.target)) setOpen(false);
        };
        const onKey = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', onClick);
        window.addEventListener('keydown', onKey, true);
        return () => {
            document.removeEventListener('mousedown', onClick);
            window.removeEventListener('keydown', onKey, true);
        };
    }, [open]);

    const current = VIEWS.find((v) => v.id === view);

    return (
        <header className="flex h-10 shrink-0 items-center gap-2 border-b border-border bg-panel pl-1.5 pr-1.5">
            <div ref={ref} className="relative">
                <button
                    type="button"
                    aria-label="Menu"
                    aria-expanded={open}
                    onClick={() => setOpen((v) => !v)}
                    className={`grid size-7 place-items-center rounded ${open ? 'bg-hover text-white' : 'text-dim hover:bg-hover hover:text-white'}`}
                >
                    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                        <path d="M1 3h12M1 7h12M1 11h12" stroke="currentColor" strokeWidth="1.4" />
                    </svg>
                </button>
                {open && (
                    <ul className="absolute left-0 top-9 z-30 w-44 rounded border border-border bg-panel py-1 shadow-xl shadow-black/50">
                        {VIEWS.map((v) => (
                            <li key={v.id}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setView(v.id);
                                        setOpen(false);
                                    }}
                                    className={`flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-hover ${v.id === view ? 'text-white' : 'text-dim'}`}
                                >
                                    {v.label}
                                    {counts[v.id] > 0 && <span className="text-xs text-muted">{counts[v.id]}</span>}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <span className="font-semibold text-white">Executor</span>
            <span className="text-muted">{current?.label}</span>

            <button
                type="button"
                aria-label="Close"
                title="Close (Esc)"
                onClick={onClose}
                className="ml-auto grid size-7 place-items-center rounded text-dim hover:bg-hover hover:text-white"
            >
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                    <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.4" />
                </svg>
            </button>
        </header>
    );
}
