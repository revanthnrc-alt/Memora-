import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import type { ServerOptions as HttpsServerOptions } from 'https';

// https://vitejs.dev/config/
export default defineConfig(() => {
  // Check if mkcert-generated certificate files exist in the project root.
  // fix: Remove __dirname as path.resolve() defaults to the CWD, which is the project root where vite.config.ts lives.
  const keyPath = path.resolve('./localhost-key.pem');
  const certPath = path.resolve('./localhost.pem');
  const useMkcert = fs.existsSync(keyPath) && fs.existsSync(certPath);

  if (useMkcert) {
    // If files are found, use them for a trusted local HTTPS server (ideal for mobile).
    console.log('✅ Found mkcert certificates. Using them for a trusted HTTPS server.');
    const httpsConfig: HttpsServerOptions = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
      minVersion: 'TLSv1.2',
    };

    return {
      plugins: [react()],
      server: {
        https: httpsConfig,
        host: true,
        proxy: {
          '/api': 'http://localhost:8081',
        },
      },
      build: {
        rollupOptions: {
          // Dependencies are now bundled by Vite, so the external option is no longer needed.
        }
      }
    };
  } else {
    // Without mkcert, use plain HTTP locally. This avoids broken TLS handshakes
    // and keeps the demo websocket on ws://localhost:8081 usable in the browser.
    console.log('⚠️ Could not find mkcert certificates. Starting the dev server over HTTP.');
    console.log('   For mobile HTTPS testing, generate localhost.pem and localhost-key.pem as described in README.md.');
  }

  return {
    plugins: [react()],
    server: {
      host: true,  // Expose to the network to allow access from mobile devices
      // Local proxy for backend APIs (Gemini proxy, uploads, etc.) when demo-server runs on 8081.
      proxy: {
        '/api': 'http://localhost:8081',
      },
    },
    build: {
      rollupOptions: {
        // Dependencies are now bundled by Vite, so the external option is no longer needed.
      }
    }
  };
});
