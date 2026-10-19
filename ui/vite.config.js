import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [react(), tailwindcss()],
    base: './',
    build: {
        outDir: '../web',
        emptyOutDir: true,
        target: 'chrome110',
        assetsInlineLimit: 0,
        cssCodeSplit: false,
        modulePreload: false,
        reportCompressedSize: false,
        rollupOptions: {
            output: {
                entryFileNames: 'assets/app.js',
                chunkFileNames: 'assets/[name].js',
                assetFileNames: 'assets/[name][extname]',
            },
        },
    },
});
