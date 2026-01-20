import path from 'node:path';
import react from '@vitejs/plugin-react';
import { createLogger, defineConfig, loadEnv } from 'vite';
import inlineEditPlugin from './plugins/visual-editor/vite-plugin-react-inline-editor.js';
import editModeDevPlugin from './plugins/visual-editor/vite-plugin-edit-mode.js';
import iframeRouteRestorationPlugin from './plugins/vite-plugin-iframe-route-restoration.js';
import uploadProxyPlugin from './plugins/upload-proxy/vite-plugin-upload-proxy.js';

const isDev = process.env.NODE_ENV !== 'production';

const configHorizonsViteErrorHandler = `
const observer = new MutationObserver((mutations) => {
	for (const mutation of mutations) {
		for (const addedNode of mutation.addedNodes) {
			if (
				addedNode.nodeType === Node.ELEMENT_NODE &&
				(
					addedNode.tagName?.toLowerCase() === 'vite-error-overlay' ||
					addedNode.classList?.contains('backdrop')
				)
			) {
				handleViteOverlay(addedNode);
			}
		}
	}
});

observer.observe(document.documentElement, {
	childList: true,
	subtree: true
});

function handleViteOverlay(node) {
	if (!node.shadowRoot) {
		return;
	}

	const backdrop = node.shadowRoot.querySelector('.backdrop');

	if (backdrop) {
		const overlayHtml = backdrop.outerHTML;
		const parser = new DOMParser();
		const doc = parser.parseFromString(overlayHtml, 'text/html');
		const messageBodyElement = doc.querySelector('.message-body');
		const fileElement = doc.querySelector('.file');
		const messageText = messageBodyElement ? messageBodyElement.textContent.trim() : '';
		const fileText = fileElement ? fileElement.textContent.trim() : '';
		const error = messageText + (fileText ? ' File:' + fileText : '');

		window.parent.postMessage({
			type: 'horizons-vite-error',
			error,
		}, '*');
	}
}
`;

const configHorizonsRuntimeErrorHandler = `
window.onerror = (message, source, lineno, colno, errorObj) => {
	const errorDetails = errorObj ? JSON.stringify({
		name: errorObj.name,
		message: errorObj.message,
		stack: errorObj.stack,
		source,
		lineno,
		colno,
	}) : null;

	window.parent.postMessage({
		type: 'horizons-runtime-error',
		message,
		error: errorDetails
	}, '*');

	try {
		const msg = String(message || '');
		if (msg.includes('net::ERR_ABORTED') || msg.includes('ERR_ABORTED')) {
			return true;
		}
	} catch {}
};

window.onunhandledrejection = (event) => {
	try {
		const r = event && event.reason;
		const msg = String(r && (r.message || r) || '');
		if (msg.includes('Failed to fetch') || msg.includes('net::ERR_ABORTED') || msg.includes('ERR_ABORTED')) {
			try { event.preventDefault(); } catch {}
			return;
		}
		window.parent.postMessage({
			type: 'horizons-runtime-error',
			message: 'unhandledrejection',
			error: JSON.stringify({ message: msg, stack: r && r.stack })
		}, '*');
	} catch {}
};

window.addEventListener('error', (event) => {
	try {
		const t = event && event.target;
		const src = t && (t.src || t.href) ? String(t.src || t.href) : '';
		if (src && (src.startsWith('blob:') || /\\.(svg|png|jpe?g|webp)(\\?|#|$)/i.test(src))) {
			try { event.preventDefault(); } catch {}
			try { event.stopImmediatePropagation(); } catch {}
		}
	} catch {}
}, true);
`;

const configHorizonsConsoleErrroHandler = `
const originalConsoleError = console.error;
console.error = function(...args) {
	try {
		const msg = args.map(arg => {
			try {
				if (arg instanceof Error) return String(arg.message || arg.stack || arg);
				return typeof arg === 'string' ? arg : JSON.stringify(arg);
			} catch {
				return String(arg);
			}
		}).join(' ');
		if (msg.includes('net::ERR_ABORTED') || msg.includes('ERR_ABORTED')) {
			return;
		}
	} catch {}

	originalConsoleError.apply(console, args);

	let errorString = '';

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg instanceof Error) {
			errorString = arg.stack || \`\${arg.name}: \${arg.message}\`;
			break;
		}
	}

	if (!errorString) {
		errorString = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
	}

	window.parent.postMessage({
		type: 'horizons-console-error',
		error: errorString
	}, '*');
};
`;

const configWindowFetchMonkeyPatch = `
const originalFetch = window.fetch;

window.fetch = function(...args) {
    const url = args[0] instanceof Request ? args[0].url : args[0];
    const method = args[0] instanceof Request ? (args[0].method || 'GET') : ((args[1] && args[1].method) ? args[1].method : 'GET');

    // Skip WebSocket URLs
    if (url.startsWith('ws:') || url.startsWith('wss:')) {
        return originalFetch.apply(this, args);
    }

    // Helper: decide whether to log error for a given request
    function shouldLog(url, method) {
        try {
            const u = new URL(url, window.location.origin);
            const isSupabaseStorage = u.hostname.includes('supabase.co') && u.pathname.startsWith('/storage/v1');
            const targetsLogsBucket = u.href.includes('imagens-logs');
            const isBucketAdmin = u.pathname.includes('/bucket');
            // Mute noisy dev errors for imagens-logs storage operations
            if (isSupabaseStorage && (targetsLogsBucket || isBucketAdmin)) return false;
        } catch (_) {}
        return true;
    }

    return originalFetch.apply(this, args)
        .then(async response => {
            const contentType = response.headers.get('Content-Type') || '';

            // Exclude HTML document responses
            const isDocumentResponse =
                contentType.includes('text/html') ||
                contentType.includes('application/xhtml+xml');

            if (!response.ok && !isDocumentResponse && shouldLog(response.url, method)) {
                    const responseClone = response.clone();
                    const errorFromRes = await responseClone.text();
                    const requestUrl = response.url;
                    console.error(\`Fetch error from \${requestUrl}: \${errorFromRes}\`);
            }

            return response;
        })
        .catch(error => {
            try {
                const msg = String(error && (error.message || error) || '');
                const name = String(error && error.name || '');
                const u = String(url || '');
                const isAbort =
                    name === 'AbortError' ||
                    msg.includes('AbortError') ||
                    msg.includes('ERR_ABORTED') ||
                    msg.includes('net::ERR_ABORTED') ||
                    msg.includes('aborted');
                const isFailedFetch = msg.includes('Failed to fetch');
                const isSupabaseRest = (() => {
                    try {
                        const parsed = new URL(u, window.location.origin);
                        return parsed.hostname.includes('supabase.co') && parsed.pathname.startsWith('/rest/v1');
                    } catch (_) {
                        return false;
                    }
                })();
                const isAsset = /\\.(svg|png|jpe?g|webp)(\\?|#|$)/i.test(u);
                const noisy = isAbort || (isFailedFetch && method === 'GET' && (isSupabaseRest || isAsset));
                if (!noisy && !u.match(/\.html?$/i) && shouldLog(u, method)) {
                    console.error(error);
                }
            } catch (_) {}

            throw error;
        });
};
`;

const configNavigationHandler = `
if (window.navigation && window.self !== window.top) {
	window.navigation.addEventListener('navigate', (event) => {
		const url = event.destination.url;

		try {
			const destinationUrl = new URL(url);
			const destinationOrigin = destinationUrl.origin;
			const currentOrigin = window.location.origin;

			if (destinationOrigin === currentOrigin) {
				return;
			}
		} catch (error) {
			return;
		}

		window.parent.postMessage({
			type: 'horizons-navigation-error',
			url,
		}, '*');
	});
}
`;

const addTransformIndexHtml = {
	name: 'add-transform-index-html',
	transformIndexHtml(html) {
		const tags = [
			{
				tag: 'script',
				attrs: { type: 'module' },
				children: configHorizonsRuntimeErrorHandler,
				injectTo: 'head',
			},
			{
				tag: 'script',
				attrs: { type: 'module' },
				children: configHorizonsViteErrorHandler,
				injectTo: 'head',
			},
			{
				tag: 'script',
				attrs: {type: 'module'},
				children: configHorizonsConsoleErrroHandler,
				injectTo: 'head',
			},
			{
				tag: 'script',
				attrs: { type: 'module' },
				children: configNavigationHandler,
				injectTo: 'head',
			},
		];

		if (!isDev && process.env.TEMPLATE_BANNER_SCRIPT_URL && process.env.TEMPLATE_REDIRECT_URL) {
			tags.push(
				{
					tag: 'script',
					attrs: {
						src: process.env.TEMPLATE_BANNER_SCRIPT_URL,
						'template-redirect-url': process.env.TEMPLATE_REDIRECT_URL,
					},
					injectTo: 'head',
				}
			);
		}

		return {
			html,
			tags,
		};
	},
};

console.warn = () => {};

const logger = createLogger()
const loggerError = logger.error

logger.error = (msg, options) => {
	if (options?.error?.toString().includes('CssSyntaxError: [postcss]')) {
		return;
	}

	loggerError(msg, options);
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const gatewayUrl = (env.VITE_PLANS_GATEWAY_URL || '').trim();
    // Extract origin host (e.g., https://ggxcqewdcg.execute-api.sa-east-1.amazonaws.com)
    let gatewayTarget = undefined;
    let gatewayBasePath = '';
    try {
        const u = new URL(gatewayUrl);
        gatewayTarget = `${u.origin}`;
        gatewayBasePath = u.pathname; // e.g., /prod
    } catch (_) {}

    return {
        customLogger: logger,
        plugins: [
            ...(isDev ? [inlineEditPlugin(), editModeDevPlugin(), iframeRouteRestorationPlugin(), uploadProxyPlugin()] : []),
            react(),
            addTransformIndexHtml
        ],
        server: {
            cors: true,
            headers: {
                'Cross-Origin-Embedder-Policy': 'credentialless',
            },
            allowedHosts: true,
            proxy: gatewayTarget ? {
                '/plans-gateway': {
                    target: gatewayTarget,
                    changeOrigin: true,
                    secure: true,
                    rewrite: (path) => path.replace(/^\/plans-gateway/, gatewayBasePath || ''),
                    configure: (proxy) => {
                        proxy.on('proxyReq', (proxyReq, req) => {
                            const incomingAuth = req?.headers?.['authorization'] || req?.headers?.['Authorization'];
                            const incomingApiKey = req?.headers?.['x-api-key'];
                            // Preserve Authorization from the original request if provided; otherwise fallback to env
                            if (incomingAuth) {
                                proxyReq.setHeader('Authorization', incomingAuth);
                            } else if (env.VITE_PLANS_GATEWAY_AUTH) {
                                proxyReq.setHeader('Authorization', env.VITE_PLANS_GATEWAY_AUTH);
                            }
                            // Preserve x-api-key from the original request if provided; otherwise fallback to env
                            if (incomingApiKey) {
                                proxyReq.setHeader('x-api-key', incomingApiKey);
                            } else if (env.VITE_PLANS_GATEWAY_API_KEY) {
                                proxyReq.setHeader('x-api-key', env.VITE_PLANS_GATEWAY_API_KEY);
                            }
                            proxyReq.setHeader('Content-Type', 'application/json');
                        });
                    },
                }
            } : undefined,
        },
        resolve: {
            extensions: ['.jsx', '.js', '.tsx', '.ts', '.json', ],
            alias: {
                '@': path.resolve(__dirname, './src'),
            },
        },
        build: {
            rollupOptions: {
                external: [
                    '@babel/parser',
                    '@babel/traverse',
                    '@babel/generator',
                    '@babel/types'
                ]
            }
        }
    };
});
