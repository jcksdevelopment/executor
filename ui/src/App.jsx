import { useCallback, useEffect, useRef, useState } from 'react';
import { MODES, MODE_LABEL, parseLine } from './parser.js';
import { inGame, post, storage } from './nui.js';
import Header from './components/Header.jsx';
import Console from './components/Console.jsx';
import Saved from './components/Saved.jsx';
import Watch from './components/Watch.jsx';
import History from './components/History.jsx';
import Help from './components/Help.jsx';

const MAX_LINES = 500;
const MAX_HISTORY = 150;

let lineId = 0;

function now() {
    return new Date().toLocaleTimeString('en-GB', { hour12: false });
}

function loadModes() {
    const stored = storage.get('modes', {});
    const valid = (side, id) => MODES[side].some((m) => m.id === id);
    return {
        client: valid('client', stored?.client) ? stored.client : 'cl_server',
        server: valid('server', stored?.server) ? stored.server : 'sv_event',
    };
}

function loadHistory() {
    const list = storage.get('history', []);
    return Array.isArray(list) ? list.filter((h) => h && typeof h.line === 'string' && h.line) : [];
}

function defaultName(line, side, mode, target, me) {
    try {
        const parsed = parseLine(line, { side, mode, target, me });
        if (parsed?.name) return (parsed.resource ? `${parsed.resource}:${parsed.name}` : parsed.name).slice(0, 60);
    } catch {}
    return line.slice(0, 60);
}

export default function App() {
    const [visible, setVisible] = useState(!inGame);
    const [view, setView] = useState('console');
    const [side, setSide] = useState(() => (storage.get('side', 'client') === 'server' ? 'server' : 'client'));
    const [modes, setModes] = useState(loadModes);
    const [target, setTarget] = useState(-1);
    const [me, setMe] = useState(inGame ? 0 : 1);
    const [players, setPlayers] = useState(inGame ? [] : [{ id: 1, name: 'dev' }, { id: 4, name: 'player4' }]);
    const [saved, setSaved] = useState([]);
    const [watching, setWatching] = useState([]);
    const [lines, setLines] = useState([]);
    const [history, setHistory] = useState(loadHistory);
    const [draft, setDraft] = useState(null);
    const pending = useRef(new Map());
    const lastRun = useRef(null);

    const print = useCallback((entry) => {
        setLines((prev) => {
            const next = prev.length >= MAX_LINES ? prev.slice(-MAX_LINES + 1) : prev.slice();
            next.push({ id: ++lineId, time: now(), ...entry });
            return next;
        });
    }, []);

    const close = useCallback(() => {
        if (!inGame) return;
        setVisible(false);
        post('close');
    }, []);

    const changeSide = useCallback((next) => {
        setSide(next);
        storage.set('side', next);
    }, []);

    const changeMode = useCallback((forSide, mode) => {
        setModes((prev) => {
            const next = { ...prev, [forSide]: mode };
            storage.set('modes', next);
            return next;
        });
    }, []);

    const remember = useCallback((entry) => {
        setHistory((prev) => {
            const next = [entry, ...prev.filter((h) => h.line !== entry.line || h.side !== entry.side)].slice(0, MAX_HISTORY);
            storage.set('history', next);
            return next;
        });
    }, []);

    const save = useCallback((entry, name) => {
        const label = (name || defaultName(entry.line, entry.side, entry.mode, entry.target, me)).slice(0, 60);
        post('save', { name: label, line: entry.line, side: entry.side, mode: entry.mode, target: entry.target });
        print({ type: 'info', text: `saved as "${label}"` });
    }, [me, print]);

    const watch = useCallback(async (name, watchSide, on) => {
        const mode = `${watchSide === 'server' ? 'sv' : 'cl'}_${on ? 'watch' : 'unwatch'}`;
        const res = await post('run', { mode, name, args: [], n: 0 });
        if (res.ok === false) return print({ type: 'error', text: res.value });
        if (res.pending) pending.current.set(res.pending, { quiet: true });
        setWatching((prev) => {
            const rest = prev.filter((w) => w.name !== name || w.side !== watchSide);
            return on ? [...rest, { name, side: watchSide }] : rest;
        });
        print({ type: 'info', text: `${on ? 'watching' : 'stopped watching'} ${name} (${watchSide})` });
    }, [print]);

    const command = useCallback((cmd, rest) => {
        switch (cmd) {
            case 'clear':
                setLines([]);
                break;
            case 'help':
                setView('help');
                break;
            case 'players':
                print({ type: 'info', text: `${players.length} online`, body: players.map((p) => `${String(p.id).padEnd(5)}${p.name}`).join('\n') });
                break;
            case 'save':
                if (!lastRun.current) print({ type: 'error', text: 'nothing to save yet' });
                else save(lastRun.current, rest);
                break;
            case 'watch':
            case 'unwatch': {
                const [name, where] = rest.split(/\s+/);
                if (!name) print({ type: 'error', text: `usage: ${cmd} <event> [server]` });
                else watch(name, where === 'server' ? 'server' : 'client', cmd === 'watch');
                break;
            }
        }
    }, [players, print, save, watch]);

    const execute = useCallback(async (line, opts = {}) => {
        const runSide = opts.side ?? side;
        const runMode = opts.mode ?? modes[runSide];
        const runTarget = opts.target ?? target;
        const text = line.trim();
        let parsed;
        try {
            parsed = parseLine(text, { side: runSide, mode: runMode, target: runTarget, me });
        } catch (err) {
            print({ type: 'input', text, side: runSide });
            print({ type: 'error', text: err.message });
            return;
        }
        if (!parsed) return;

        print({ type: 'input', text, side: runSide, entry: { line: text, side: runSide, mode: runMode, target: runTarget } });
        if (parsed.builtin) return command(parsed.builtin, parsed.rest);

        const entry = { line: text, side: runSide, mode: runMode, target: runTarget };
        lastRun.current = entry;
        remember(entry);

        const data = {};
        if (parsed.resource) data.resource = parsed.resource;
        if (parsed.target !== undefined) data.target = parsed.target;
        const res = await post('run', { mode: parsed.mode, name: parsed.name, args: parsed.args, n: parsed.args.length, data });
        const label = MODE_LABEL[parsed.mode];
        if (res.pending) pending.current.set(res.pending, { label });
        else print({ type: res.ok ? 'ok' : 'error', text: res.value, label });
    }, [side, modes, target, me, print, command, remember]);

    useEffect(() => {
        const onMessage = ({ data: msg }) => {
            if (!msg || typeof msg !== 'object') return;
            switch (msg.action) {
                case 'open': {
                    const d = msg.data ?? {};
                    if (Array.isArray(d.players)) setPlayers(d.players);
                    if (Array.isArray(d.saved)) setSaved(d.saved);
                    if (typeof d.me === 'number') setMe(d.me);
                    setVisible(true);
                    break;
                }
                case 'close':
                    setVisible(false);
                    break;
                case 'players':
                    setPlayers(Array.isArray(msg.players) ? msg.players : []);
                    break;
                case 'saved':
                    setSaved(Array.isArray(msg.saved) ? msg.saved : []);
                    break;
                case 'result': {
                    const p = pending.current.get(msg.id);
                    pending.current.delete(msg.id);
                    if (p?.quiet && msg.ok) break;
                    print({ type: msg.ok ? 'ok' : 'error', text: msg.value, label: p?.label });
                    break;
                }
                case 'caught':
                    print({ type: 'caught', side: msg.side === 'server' ? 'server' : 'client', text: msg.name, from: msg.from, body: msg.args });
                    break;
            }
        };
        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
    }, [print]);

    useEffect(() => {
        if (!visible) return;
        const onKey = (e) => {
            if (e.key === 'Escape' && !e.defaultPrevented) close();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [visible, close]);

    const load = useCallback((entry) => {
        const s = entry.side === 'server' ? 'server' : 'client';
        changeSide(s);
        if (entry.mode && MODES[s].some((m) => m.id === entry.mode)) changeMode(s, entry.mode);
        if (typeof entry.target === 'number') setTarget(entry.target);
        setDraft({ line: entry.line, key: Date.now() });
        setView('console');
    }, [changeSide, changeMode]);

    const run = useCallback((entry) => {
        setView('console');
        execute(entry.line, { side: entry.side, mode: entry.mode, target: entry.target });
    }, [execute]);

    if (!visible) return null;

    return (
        <div className={`fixed inset-0 flex items-center justify-center p-10 ${inGame ? '' : 'bg-[#3a3b3f]'}`}>
            <div className="flex h-full max-h-[720px] w-full max-w-[1100px] flex-col overflow-hidden rounded-md border border-border bg-bg shadow-2xl shadow-black/60">
                <Header view={view} setView={setView} counts={{ saved: saved.length, watch: watching.length }} onClose={close} />
                <div className="min-h-0 flex-1">
                    {view === 'console' && (
                        <Console
                            lines={lines}
                            execute={execute}
                            clear={() => setLines([])}
                            side={side}
                            mode={modes[side]}
                            changeSide={changeSide}
                            changeMode={changeMode}
                            target={target}
                            setTarget={setTarget}
                            players={players}
                            refreshPlayers={() => post('players')}
                            history={history}
                            draft={draft}
                            save={save}
                            load={load}
                        />
                    )}
                    {view === 'saved' && (
                        <Saved
                            saved={saved}
                            run={run}
                            load={load}
                            rename={(id, name) => post('rename', { id, name })}
                            remove={(id) => post('unsave', { id })}
                        />
                    )}
                    {view === 'watch' && <Watch watching={watching} watch={watch} />}
                    {view === 'history' && (
                        <History
                            history={history}
                            run={run}
                            load={load}
                            clear={() => {
                                setHistory([]);
                                storage.set('history', []);
                            }}
                        />
                    )}
                    {view === 'help' && <Help />}
                </div>
            </div>
        </div>
    );
}
