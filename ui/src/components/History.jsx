import { useMemo, useState } from 'react';

export default function History({ history, run, load, clear }) {
    const [filter, setFilter] = useState('');

    const list = useMemo(() => {
        const q = filter.trim().toLowerCase();
        return q ? history.filter((h) => h.line.toLowerCase().includes(q)) : history;
    }, [history, filter]);

    return (
        <div className="flex h-full flex-col">
            <div className="flex items-center gap-3 border-b border-border p-2">
                <input className="input w-64" placeholder="Filter" value={filter} onChange={(e) => setFilter(e.target.value)} spellCheck={false} />
                <span className="text-muted">{history.length} entries</span>
                {history.length > 0 && <button type="button" className="link ml-auto mr-1" onClick={clear}>Clear</button>}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
                {list.length === 0 && <p className="p-3 text-muted">{history.length ? 'No matches.' : 'History is empty.'}</p>}
                {list.map((h, i) => (
                    <div key={`${i}:${h.line}`} className="flex items-center gap-3 border-b border-border/60 px-3 py-1.5 hover:bg-panel">
                        <span className="w-12 shrink-0 text-muted">{h.side}</span>
                        <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-fg" title={h.line}>{h.line}</span>
                        <button type="button" className="link" onClick={() => run(h)}>Run</button>
                        <button type="button" className="link" onClick={() => load(h)}>Edit</button>
                    </div>
                ))}
            </div>
        </div>
    );
}
