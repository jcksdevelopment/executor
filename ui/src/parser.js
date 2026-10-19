export const MODES = {
    client: [
        { id: 'cl_server', label: 'TriggerServerEvent' },
        { id: 'cl_event', label: 'TriggerEvent' },
        { id: 'cl_command', label: 'ExecuteCommand' },
        { id: 'cl_export', label: 'Export' },
        { id: 'cl_callback', label: 'Callback' },
    ],
    server: [
        { id: 'sv_event', label: 'TriggerEvent' },
        { id: 'sv_client', label: 'TriggerClientEvent', target: true },
        { id: 'sv_command', label: 'ExecuteCommand' },
        { id: 'sv_export', label: 'Export' },
        { id: 'sv_callback', label: 'Callback', target: true },
    ],
};

export const MODE_LABEL = Object.fromEntries(Object.values(MODES).flat().map((m) => [m.id, m.label]));

export const BUILTINS = ['help', 'clear', 'players', 'save', 'watch', 'unwatch'];

export const COMPLETIONS = [
    "TriggerServerEvent('",
    "TriggerEvent('",
    "TriggerClientEvent('",
    "ExecuteCommand('",
    'exports.',
    "lib.callback.await('",
    'vector3(',
    'GetEntityCoords(PlayerPedId())',
    'GetPlayerServerId(PlayerId())',
    'PlayerPedId()',
];

class ParseError extends Error {}

const ID_START = /[A-Za-z_]/;
const ID_CHAR = /[A-Za-z0-9_]/;

class Reader {
    constructor(src, ctx) {
        this.s = src;
        this.i = 0;
        this.ctx = ctx;
    }

    fail(msg) {
        throw new ParseError(`${msg} at column ${this.i + 1}`);
    }

    ws() {
        while (this.i < this.s.length) {
            const c = this.s[this.i];
            if (c === ' ' || c === '\t' || c === '\n' || c === '\r') this.i++;
            else if (c === '-' && this.s[this.i + 1] === '-') {
                while (this.i < this.s.length && this.s[this.i] !== '\n') this.i++;
            } else break;
        }
    }

    peek() {
        this.ws();
        return this.s[this.i];
    }

    eat(ch) {
        if (this.peek() === ch) {
            this.i++;
            return true;
        }
        return false;
    }

    expect(ch) {
        if (!this.eat(ch)) this.fail(`expected '${ch}'`);
    }

    done() {
        this.ws();
        return this.i >= this.s.length;
    }

    string() {
        const q = this.s[this.i++];
        let out = '';
        while (this.i < this.s.length) {
            const c = this.s[this.i++];
            if (c === q) return out;
            if (c === '\\') {
                const n = this.s[this.i++];
                const map = { n: '\n', t: '\t', r: '\r', '\\': '\\', '"': '"', "'": "'", 0: '\0' };
                if (n === 'u' && this.s[this.i] === '{') {
                    const end = this.s.indexOf('}', this.i);
                    out += String.fromCodePoint(parseInt(this.s.slice(this.i + 1, end), 16));
                    this.i = end + 1;
                } else if (n === 'u') {
                    out += String.fromCharCode(parseInt(this.s.slice(this.i, this.i + 4), 16));
                    this.i += 4;
                } else out += map[n] ?? n;
            } else out += c;
        }
        this.fail('unterminated string');
    }

    longString() {
        const m = /^\[(=*)\[/.exec(this.s.slice(this.i));
        const close = `]${m[1]}]`;
        const start = this.i + m[0].length;
        const end = this.s.indexOf(close, start);
        if (end < 0) this.fail('unterminated long string');
        this.i = end + close.length;
        return this.s.slice(start, end).replace(/^\r?\n/, '');
    }

    number() {
        const m = /^-?(?:0[xX][0-9a-fA-F]+|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/.exec(this.s.slice(this.i));
        if (!m) this.fail('invalid number');
        this.i += m[0].length;
        const raw = m[0];
        const neg = raw.startsWith('-');
        const body = neg ? raw.slice(1) : raw;
        const n = /^0x/i.test(body) ? parseInt(body, 16) : Number(body);
        return neg ? -n : n;
    }

    ident() {
        const start = this.i;
        while (this.i < this.s.length && (ID_CHAR.test(this.s[this.i]) || ((this.s[this.i] === '.' || this.s[this.i] === ':') && ID_START.test(this.s[this.i + 1] ?? '')))) this.i++;
        return this.s.slice(start, this.i);
    }

    list(close) {
        const out = [];
        if (this.eat(close)) return out;
        do {
            if (this.peek() === close) break;
            out.push(this.value());
        } while (this.eat(','));
        this.expect(close);
        return out;
    }

    table() {
        this.i++;
        const entries = [];
        let pos = 0;
        while (this.peek() !== '}') {
            if (this.done()) this.fail("expected '}'");
            let key;
            const save = this.i;
            if (this.peek() === '[' && this.s[this.i + 1] !== '[' && this.s[this.i + 1] !== '=') {
                this.i++;
                key = this.value();
                this.expect(']');
                this.expect('=');
            } else if (ID_START.test(this.peek())) {
                const start = this.i;
                while (this.i < this.s.length && ID_CHAR.test(this.s[this.i])) this.i++;
                const name = this.s.slice(start, this.i);
                if (this.peek() === '=' && this.s[this.i + 1] !== '=') {
                    this.i++;
                    key = name;
                } else this.i = save;
            } else if (this.peek() === '"' || this.peek() === "'") {
                this.ws();
                const str = this.string();
                if (this.eat(':')) key = str;
                else this.i = save;
            }
            const value = this.value();
            if (key === undefined) entries.push([++pos, value]);
            else entries.push([key, value]);
            if (!this.eat(',') && !this.eat(';')) break;
        }
        this.expect('}');
        const positional = entries.every(([k], idx) => k === idx + 1);
        if (positional) return entries.map(([, v]) => v);
        if (entries.every(([k]) => typeof k === 'string')) return Object.fromEntries(entries);
        return { __t: entries };
    }

    special(name, args) {
        const lower = name.toLowerCase();
        if (/^(vector|vec)[234]?$/.test(lower)) {
            if (!args.length || args.length > 4 || args.some((a) => typeof a !== 'number')) this.fail(`${name}() takes 2 to 4 numbers`);
            return { __vec: args };
        }
        if (name === 'PlayerPedId' || (name === 'GetPlayerPed' && args[0] === -1)) return { __ped: true };
        if (name === 'PlayerId') return { __pid: true };
        if (name === 'GetPlayerServerId' && args[0]?.__pid) return this.ctx.me;
        if (name === 'GetEntityCoords' && args[0]?.__ped) return { __coords: true };
        if (name === 'GetVehiclePedIsIn' && args[0]?.__ped) return { __veh: true };
        if (name === 'json.decode' && typeof args[0] === 'string') {
            try {
                return JSON.parse(args[0]);
            } catch {
                this.fail('json.decode: invalid JSON');
            }
        }
        this.fail(`unsupported function ${name}()`);
    }

    value() {
        const c = this.peek();
        if (c === undefined) this.fail('expected a value');
        if (c === '"' || c === "'") return this.string();
        if (c === '[' && /^\[=*\[/.test(this.s.slice(this.i))) return this.longString();
        if (c === '[') {
            this.i++;
            return this.list(']');
        }
        if (c === '{') return this.table();
        if (c === '-' || c === '.' || (c >= '0' && c <= '9')) return this.number();
        if (ID_START.test(c)) {
            const name = this.ident();
            if (this.peek() === '(') {
                this.i++;
                return this.special(name, this.list(')'));
            }
            switch (name) {
                case 'true': return true;
                case 'false': return false;
                case 'nil':
                case 'null': return null;
                case 'source':
                case 'me':
                case 'cache.serverId': return this.ctx.me;
                case 'cache.ped': return { __ped: true };
                case 'cache.coords': return { __coords: true };
                case 'cache.vehicle': return { __veh: true };
            }
            this.fail(`unknown identifier '${name}'`);
        }
        this.fail(`unexpected '${c}'`);
    }
}

const CALL = /^(TriggerServerEvent|TriggerClientEvent|TriggerEvent|ExecuteCommand|lib\.callback\.await|lib\.callback)\s*\(/;
const EXPORT = /^exports\s*(?:\.\s*([A-Za-z0-9_-]+)|\[\s*(['"])([^'"]+)\2\s*\])\s*(?:[:.]\s*([A-Za-z_]\w*)|\[\s*(['"])([^'"]+)\5\s*\])\s*\(/;

function needName(args, what) {
    if (typeof args[0] !== 'string' || !args[0]) throw new ParseError(`${what}: first argument must be a quoted name`);
    return args[0];
}

function needTarget(v, me) {
    const t = v?.__pid ? me : v;
    if (typeof t !== 'number' || !Number.isInteger(t)) throw new ParseError('target must be a player id or -1');
    return t;
}

export function parseLine(input, ctx) {
    let line = input.trim().replace(/;+\s*$/, '');
    if (!line) return null;

    const word = line.split(/\s+/)[0].toLowerCase();
    if (BUILTINS.includes(word) && !line.includes('(')) {
        return { builtin: word, rest: line.slice(word.length).trim() };
    }

    if (line.startsWith('/')) {
        const cmd = line.slice(1).trim();
        if (!cmd) throw new ParseError('missing command after /');
        return { mode: ctx.side === 'server' ? 'sv_command' : 'cl_command', name: cmd, args: [] };
    }

    const call = CALL.exec(line);
    if (call) {
        const r = new Reader(line, ctx);
        r.i = call[0].length;
        const args = r.list(')');
        if (!r.done()) r.fail('unexpected input after call');
        const fn = call[1];
        if (fn === 'TriggerServerEvent') return { mode: 'cl_server', name: needName(args, fn), args: args.slice(1) };
        if (fn === 'TriggerClientEvent') {
            return { mode: 'sv_client', name: needName(args, fn), args: args.slice(2), target: needTarget(args[1], ctx.me) };
        }
        if (fn === 'TriggerEvent') return { mode: ctx.side === 'server' ? 'sv_event' : 'cl_event', name: needName(args, fn), args: args.slice(1) };
        if (fn === 'ExecuteCommand') return { mode: ctx.side === 'server' ? 'sv_command' : 'cl_command', name: needName(args, fn), args: [] };
        if (ctx.side === 'server') {
            return { mode: 'sv_callback', name: needName(args, fn), args: args.slice(2), target: needTarget(args[1], ctx.me) };
        }
        return { mode: 'cl_callback', name: needName(args, fn), args: args.slice(2) };
    }

    const exp = EXPORT.exec(line);
    if (exp) {
        const r = new Reader(line, ctx);
        r.i = exp[0].length;
        const args = r.list(')');
        if (!r.done()) r.fail('unexpected input after call');
        return {
            mode: ctx.side === 'server' ? 'sv_export' : 'cl_export',
            name: exp[4] ?? exp[6],
            resource: exp[1] ?? exp[3],
            args,
        };
    }

    if (ctx.mode === 'cl_command' || ctx.mode === 'sv_command') return { mode: ctx.mode, name: line, args: [] };

    const r = new Reader(line, ctx);
    let name;
    if (line[0] === '"' || line[0] === "'") name = r.string();
    else {
        const m = /^\S+/.exec(line);
        name = m[0].replace(/,$/, '');
        r.i = m[0].length;
    }
    const args = [];
    if (!r.done()) {
        r.eat(',');
        do {
            args.push(r.value());
        } while (r.eat(','));
        if (!r.done()) r.fail('separate arguments with commas');
    }

    const mode = ctx.mode;
    const out = { mode, name, args };
    if (mode === 'cl_export' || mode === 'sv_export') {
        const m = /^([A-Za-z0-9_-]+)[:.]([A-Za-z_]\w*)$/.exec(name);
        if (!m) throw new ParseError('use resource:function for exports');
        out.resource = m[1];
        out.name = m[2];
    }
    if (mode === 'sv_client' || mode === 'sv_callback') out.target = needTarget(ctx.target, ctx.me);
    return out;
}

export { ParseError };
