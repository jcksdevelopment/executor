import { useMemo, useState } from 'react';

function Name({ value, onChange }) {
    const [editing, setEditing] = useState(false);
    const [text, setText] = useState(value);

    if (!editing) {
        return (
            <button
                type="button"
                title="Rename"
                onClick={() => {
                    setText(value);
                    setEditing(true);
                }}
                className="max-w-full truncate text-left text-white hover:underline"
            >
                {value}
            </button>
        );
    }

    const commit = () => {
        const next = text.trim();
        if (next && next !== value) onChange(next);
        setEditing(false);
    };

    return (
        <input
            autoFocus
            className="input h-7 w-full"
            maxLength={60}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
                if (e.key === 'Enter') commit();
                if (e.key === 'Escape') {
                    e.preventDefault();
                    setEditing(false);
                }
            }}
        />
    );
}

function DeleteButton({ onConfirm }) {
    const [armed, setArmed] = useState(false);
    return (
        <button type="button" className="link" onClick={() => (armed ? onConfirm() : setArmed(true))} onMouseLeave={() => setArmed(false)}>
            {armed ? 'Confirm' : 'Delete'}
        </button>
    );
}

export default function Saved({ saved, run, load, rename, remove }) {
    const [filter, setFilter] = useState('');

    const list = useMemo(() => {
        const q = filter.trim().toLowerCase();
        if (!q) return saved;
        return saved.filter((s) => s.name.toLowerCase().includes(q) || s.line.toLowerCase().includes(q));
    }, [saved, filter]);

    return (
        <div className="flex h-full flex-col">
            <div className="flex items-center gap-3 border-b border-border p-2">
                <input className="input w-64" placeholder="Filter" value={filter} onChange={(e) => setFilter(e.target.value)} spellCheck={false} />
                <span className="text-muted">{saved.length} saved</span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
                {list.length === 0 ? (
                    <p className="p-3 text-muted">{saved.length ? 'No matches.' : 'Nothing saved yet. Use the Save button in the console.'}</p>
                ) : (
                    <table className="w-full table-fixed">
                        <thead className="sticky top-0 bg-bg text-left text-muted">
                            <tr className="border-b border-border">
                                <th className="w-52 px-3 py-1.5 font-normal">Name</th>
                                <th className="px-3 py-1.5 font-normal">Line</th>
                                <th className="w-16 px-3 py-1.5 font-normal">Side</th>
                                <th className="w-48 px-3 py-1.5 font-normal" />
                            </tr>
                        </thead>
                        <tbody>
                            {list.map((s) => (
                                <tr key={s.id} className="border-b border-border/60 hover:bg-panel">
                                    <td className="px-3 py-1.5">
                                        <Name value={s.name} onChange={(name) => rename(s.id, name)} />
                                    </td>
                                    <td className="truncate px-3 py-1.5 font-mono text-[12px] text-dim" title={s.line}>{s.line}</td>
                                    <td className="px-3 py-1.5 text-muted">{s.side}</td>
                                    <td className="px-3 py-1.5 text-right">
                                        <button type="button" className="link mr-3" onClick={() => run(s)}>Run</button>
                                        <button type="button" className="link mr-3" onClick={() => load(s)}>Edit</button>
                                        <DeleteButton onConfirm={() => remove(s.id)} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
