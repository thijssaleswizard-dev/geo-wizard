import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    cacheDir: path.resolve(__dirname, 'node_modules/.vite'),
    resolve: {
        alias: {
            'lucide-react': path.resolve(__dirname, 'resources/js/lib/materialize-icons.jsx'),
        },
    },
    plugins: [
        laravel({
            input: 'resources/js/app.jsx',
            refresh: true,
        }),
        react(),
    ],
    server: {
        host: '0.0.0.0',
        port: 5173,
        watch: {
            usePolling: true,
        },
    },
});
