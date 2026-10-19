import { memo } from 'react';

function format(value) {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string') return JSON.stringify(value, null, 2);
    if (value[0] !== '[' && value[0] !== '{') return value;
    try {
        const parsed = JSON.parse(value);
        const single = Array.isArray(parsed) && parsed.length === 1 ? parsed[0] : parsed;
        return typeof single === 'string' ? JSON.stringify(single) : JSON.stringify(single, null, 2);
    } catch {
        return value;
    }
}

export default memo(function Value({ value, className = '' }) {
    const text = format(value);
    if (text === null) return null;
    return <pre className={`max-h-64 overflow-auto whitespace-pre-wrap break-all font-mono text-[12px] leading-5 text-dim select-text ${className}`}>{text}</pre>;
});
