import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { COMPLETIONS, MODES } from '../parser.js';
import Value from './Value.jsx';

function isJson(text) {
    return typeof text === 'string' && (text[0] === '[' || text[0] === '{');
}

const Line = memo(function Line({ line, load }) {
    if (line.type === 'input') {
        return (
            <div className="mt-1.5 flex gap-3 px-3 first:mt-0 hover:bg-panel">
                <span className="shrink-0 text-muted">{line.time}</span>
                <span className="text-muted">&gt;</span>
                <button
                    type="button"
                    disabled={!line.entry}
                    onClick={() => load(line.entry)}
                    title={line.entry ? 'Edit' : undefined}
                    className="min-w-0 flex-1 cursor-text break-all text-left text-white disabled:cursor-default"
                >
                    {line.text}
                </button>
                <span className="shrink-0 text-muted">{line.side}</span>
            </div>
        );
    }

    if (line.type === 'caught') {
        return (
            <div className="mt-1.5 px-3">
                <div className="flex gap-3">
                    <span className="shrink-0 text-muted">{line.time}</span>
                    <span className="text-dim">
                        [{line.side}] <span className="text-white">{line.text}</span>
                        {line.from !== undefined && line.from !== null && line.from !== '' && <> from {line.from}</>}
                    </span>
                </div>
                <Value value={line.body} className="pl-[76px]" />
            </div>
        );
    }

    const tone = line.type === 'error' ? 'text-white' : line.type === 'info' ? 'text-muted' : 'text-dim';
    const json = isJson(line.text);

    return (
        <div className="px-3">
            <div className={`flex gap-3 ${tone}`}>
                <span className="w-16 shrink-0" />
                <span className="min-w-0 flex-1 break-all">
                    {line.type === 'error' && <span className="mr-2 rounded-sm bg-hover px-1 font-semibold">error</span>}
                    {line.label && <span className="text-muted">{line.label}: </span>}
                    {json ? 'returned' : line.text}
                </span>
            </div>
            {json && <Value value={line.text} className="pl-[76px] text-fg" />}
            {line.body && <Value value={line.body} className="pl-[76px]" />}
        </div>
    );
});

const Output = memo(function Output({ lines, load }) {
    const ref = useRef(null);
    const follow = useRef(true);

    useLayoutEffect(() => {
        if (follow.current && ref.current) ref.current.scrollTop = ref.current.scrollHeight;
    }, [lines]);

    return (
        <div
            ref={ref}
            onScroll={(e) => {
                const el = e.currentTarget;
                follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
            }}
            className="min-h-0 flex-1 overflow-y-auto py-2 font-mono text-[12.5px] leading-5 select-text"
        >
            {lines.length === 0 && <p className="px-3 text-muted">Type a trigger and press Enter. Type help for syntax.</p>}
            {lines.map((line) => <Line key={line.id} line={line} load={load} />)}
        </div>
    );
});

function Prompt({ execute, clear, side, mode, target, history, draft, save }) {
    const [value, setValue] = useState('');
    const [index, setIndex] = useState(-1);
    const typed = useRef('');
    const ref = useRef(null);

    useEffect(() => ref.current?.focus(), []);

    useEffect(() => {
        if (!draft) return;
        setValue(draft.line);
        setIndex(-1);
        ref.current?.focus();
    }, [draft]);

    const suggestions = useMemo(() => [...new Set([...history.map((h) => h.line), ...COMPLETIONS])], [history]);

    const hint = useMemo(() => {
        if (value.length < 2) return '';
        const match = suggestions.find((s) => s.length > value.length && s.startsWith(value));
        return match ? match.slice(value.length) : '';
    }, [value, suggestions]);

    const submit = () => {
        if (!value.trim()) return;
        execute(value);
        setValue('');
        setIndex(-1);
    };

    const onKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            submit();
        } else if (e.key === 'Tab') {
            e.preventDefault();
            if (hint) setValue(value + hint);
        } else if (e.key === 'ArrowUp' && history.length) {
            e.preventDefault();
            if (index === -1) typed.current = value;
            const next = Math.min(index + 1, history.length - 1);
            setIndex(next);
            setValue(history[next].line);
        } else if (e.key === 'ArrowDown' && index !== -1) {
            e.preventDefault();
            const next = index - 1;
            setIndex(next);
            setValue(next === -1 ? typed.current : history[next].line);
        } else if (e.ctrlKey && e.key.toLowerCase() === 'l') {
            e.preventDefault();
            clear();
        }
    };

    return (
        <>
            <div className="relative min-w-0 flex-1">
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre px-2.5 font-mono text-[12.5px] leading-8">
                    <span className="invisible">{value}</span>
                    <span className="text-muted">{hint}</span>
                </div>
                <input
                    ref={ref}
                    value={value}
                    onChange={(e) => {
                        setValue(e.target.value);
                        setIndex(-1);
                    }}
                    onKeyDown={onKeyDown}
                    spellCheck={false}
                    autoComplete="off"
                    aria-label="Command"
                    placeholder={hint ? '' : "TriggerServerEvent('event', 'arg')"}
                    className="input relative w-full bg-transparent font-mono text-[12.5px]"
                />
            </div>
            <button type="button" className="button-primary" onClick={submit}>Run</button>
            <button
                type="button"
                className="button"
                disabled={!value.trim()}
                onClick={() => save({ line: value.trim(), side, mode, target })}
            >
                Save
            </button>
        </>
    );
}

export default function Console({ lines, execute, clear, side, mode, changeSide, changeMode, target, setTarget, players, refreshPlayers, history, draft, save, load }) {
    const needsTarget = MODES[side].find((m) => m.id === mode)?.target;

    return (
        <div className="flex h-full flex-col">
            <Output lines={lines} load={load} />
            <div className="flex items-center gap-2 border-t border-border bg-panel p-2">
                <select className="input w-24" value={side} onChange={(e) => changeSide(e.target.value)} aria-label="Side">
                    <option value="client">Client</option>
                    <option value="server">Server</option>
                </select>
                <select className="input w-44" value={mode} onChange={(e) => changeMode(side, e.target.value)} aria-label="Default type" title="Used when you only type a name">
                    {MODES[side].map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
                {needsTarget && (
                    <select
                        className="input w-40"
                        value={target}
                        onChange={(e) => setTarget(Number(e.target.value))}
                        onFocus={refreshPlayers}
                        aria-label="Target"
                    >
                        <option value={-1}>All players (-1)</option>
                        {players.map((p) => <option key={p.id} value={p.id}>{p.id} - {p.name}</option>)}
                    </select>
                )}
                <Prompt execute={execute} clear={clear} side={side} mode={mode} target={target} history={history} draft={draft} save={save} />
            </div>
        </div>
    );
}
