import { useState } from 'react';

export default function Watch({ watching, watch }) {
    const [name, setName] = useState('');
    const [side, setSide] = useState('client');

    const submit = (e) => {
        e.preventDefault();
        const event = name.trim();
        if (!event || watching.some((w) => w.name === event && w.side === side)) return;
        watch(event, side, true);
        setName('');
    };

    return (
        <div className="flex h-full flex-col">
            <form onSubmit={submit} className="flex items-center gap-2 border-b border-border p-2">
                <input className="input w-72 font-mono text-[12.5px]" placeholder="esx:setJob" value={name} onChange={(e) => setName(e.target.value)} spellCheck={false} aria-label="Event name" />
                <select className="input w-24" value={side} onChange={(e) => setSide(e.target.value)} aria-label="Side">
                    <option value="client">Client</option>
                    <option value="server">Server</option>
                </select>
                <button type="submit" className="button" disabled={!name.trim()}>Watch</button>
                <span className="ml-2 text-muted">Caught events are printed to the console.</span>
            </form>
            <div className="min-h-0 flex-1 overflow-y-auto">
                {watching.length === 0 && <p className="p-3 text-muted">Not watching anything.</p>}
                {watching.map((w) => (
                    <div key={`${w.side}:${w.name}`} className="flex items-center gap-3 border-b border-border/60 px-3 py-1.5 hover:bg-panel">
                        <span className="flex-1 font-mono text-[12.5px] text-white">{w.name}</span>
                        <span className="w-16 text-muted">{w.side}</span>
                        <button type="button" className="link" onClick={() => watch(w.name, w.side, false)}>Stop</button>
                    </div>
                ))}
            </div>
        </div>
    );
}
