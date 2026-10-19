export const inGame = typeof window.GetParentResourceName === 'function';

const RESOURCE = inGame ? window.GetParentResourceName() : 'executor';

let devId = 1000;
let devSaved = [];

function emit(data) {
    window.postMessage(data, '*');
}

function devPost(name, body) {
    switch (name) {
        case 'save':
            devSaved = [{ ...body, name: body.name || body.line.slice(0, 60), id: String(++devId), by: 'dev', at: Math.floor(Date.now() / 1000) }, ...devSaved];
            emit({ action: 'saved', saved: devSaved });
            return 1;
        case 'rename':
            devSaved = devSaved.map((s) => (s.id === body.id ? { ...s, name: body.name } : s));
            emit({ action: 'saved', saved: devSaved });
            return 1;
        case 'unsave':
            devSaved = devSaved.filter((s) => s.id !== body.id);
            emit({ action: 'saved', saved: devSaved });
            return 1;
        case 'run': {
            const async = body.mode.startsWith('sv_') || body.mode === 'cl_callback';
            const value = /export|callback/.test(body.mode) ? '[{"count":4},true]' : 'sent';
            if (!async) return { ok: true, value };
            const id = ++devId;
            setTimeout(() => emit({ action: 'result', id, ok: true, value }), 150);
            return { pending: id };
        }
        default:
            return 1;
    }
}

export async function post(name, body = {}) {
    if (!inGame) return devPost(name, body);
    try {
        const res = await fetch(`https://${RESOURCE}/${name}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=UTF-8' },
            body: JSON.stringify(body),
        });
        return await res.json();
    } catch {
        return { ok: false, value: 'NUI request failed' };
    }
}

export const storage = {
    get(key, fallback) {
        try {
            return JSON.parse(localStorage.getItem(`executor:${key}`)) ?? fallback;
        } catch {
            return fallback;
        }
    },
    set(key, value) {
        try {
            localStorage.setItem(`executor:${key}`, JSON.stringify(value));
        } catch {}
    },
};
