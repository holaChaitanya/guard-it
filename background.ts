chrome.webRequest.onHeadersReceived.addListener(
    (details: chrome.webRequest.WebResponseHeadersDetails): chrome.webRequest.BlockingResponse => {
        let responseHeaders = details.responseHeaders || [];

        const removeHeader = (name: string) => {
            responseHeaders = responseHeaders.filter(header =>
                header.name.toLowerCase() !== name.toLowerCase()
            );
        };

        const setHeader = (name: string, value: string) => {
            removeHeader(name);
            responseHeaders.push({ name, value });
        };

        removeHeader('content-security-policy');
        removeHeader('content-security-policy-report-only');

        setHeader('Content-Security-Policy-Report-Only', "default-src 'self'; script-src 'self' 'report-sample'; style-src 'self' 'report-sample'; base-uri 'self'; object-src 'none'; connect-src 'self'; font-src 'self'; frame-src 'self'; img-src 'self'; manifest-src 'self'; media-src 'self'; worker-src 'none'; report-uri /csp-report");

        return { responseHeaders: responseHeaders };
    },
    { urls: ['<all_urls>'] },
    ['blocking', 'responseHeaders']
);

chrome.webRequest.onBeforeSendHeaders.addListener(
    (details: chrome.webRequest.WebRequestHeadersDetails) => {
        if (details.requestHeaders) {
            const customHeader = { name: 'X-Custom-Header', value: 'MyCustomValue' };
            details.requestHeaders.push(customHeader);
            return { requestHeaders: details.requestHeaders };
        }
        return { requestHeaders: details.requestHeaders };
    },
    { urls: ['<all_urls>'] },
    ['blocking', 'requestHeaders']
);

function generateCSPFromViolations(): Promise<string> {
    return new Promise((resolve) => {
        chrome.storage.local.get('cspViolations', (result) => {
            const violations = result.cspViolations || [];
            console.log('Stored violations:', violations);

            const directives = new Map<string, Set<string>>();

            // Initialize default directives
            const defaultDirectives = [
                'default-src', 'script-src', 'style-src', 'object-src', 'base-uri',
                'connect-src', 'font-src', 'frame-src', 'img-src', 'manifest-src',
                'media-src', 'worker-src'
            ];
            defaultDirectives.forEach(directive => directives.set(directive, new Set(['\'self\''])));

            violations.forEach((v: any) => {
                const violation = v['csp-report'];
                if (violation && typeof violation === 'object') {
                    const violatedDirective = violation['violated-directive'];
                    const blockedUri = violation['blocked-uri'];

                    console.log('Processing violation:', { violatedDirective, blockedUri });

                    if (typeof violatedDirective === 'string' && typeof blockedUri === 'string') {
                        let directive = violatedDirective.split(' ')[0];

                        // Map 'script-src-elem' to 'script-src'
                        if (directive === 'script-src-elem') directive = 'script-src';
                        // Map 'style-src-elem' and 'style-src-attr' to 'style-src'
                        if (directive === 'style-src-elem' || directive === 'style-src-attr') directive = 'style-src';

                        if (!directives.has(directive)) {
                            directives.set(directive, new Set(['\'self\'']));
                        }
                        if (blockedUri !== '') {
                            if (blockedUri === 'data' || blockedUri.startsWith('data:')) {
                                directives.get(directive)?.add('data:');
                            } else {
                                try {
                                    const url = new URL(blockedUri);
                                    directives.get(directive)?.add(url.origin);
                                } catch (e) {
                                    // If it's not a valid URL, add it as is
                                    directives.get(directive)?.add(blockedUri);
                                }
                            }
                        }
                    }
                }
            });

            if (directives.has('script-src')) {
                directives.get('script-src')?.add('\'report-sample\'');
            }
            if (directives.has('style-src')) {
                directives.get('style-src')?.add('\'report-sample\'');
            }

            console.log('Processed directives:', Array.from(directives.entries()));

            let csp = '';
            directives.forEach((uris, directive) => {
                csp += `${directive} ${Array.from(uris).join(' ')}; `;
            });

            console.log('Generated CSP:', csp);
            resolve(csp.trim());
        });
    });
}

async function updateCSP() {
    const newCSP = await generateCSPFromViolations();
    console.log('Generated CSP: ', newCSP);
}

updateCSP();

chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
        if (details.url.endsWith('/csp-report') && details.method === 'POST' && details.requestBody?.raw?.[0]?.bytes) {
            let postedString = decodeURIComponent(String.fromCharCode.apply(null, Array.from(new Uint8Array(details.requestBody.raw[0].bytes))));
            let payload = JSON.parse(postedString);

            console.log('New CSP Violation:', payload);

            chrome.storage.local.get('cspViolations', (result) => {
                let violations = result.cspViolations || [];
                violations.push(payload);
                chrome.storage.local.set({ cspViolations: violations }, () => {
                    console.log('Updated violations in storage:', violations);
                    updateCSP();
                });
            });

            return { cancel: true };
        }
    },
    { urls: ['<all_urls>'] },
    ['blocking', 'requestBody']
);

console.log('Background script initialized');