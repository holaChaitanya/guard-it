interface BuilderState {
    isEnabled: boolean;
    policy: string;
}

chrome.webRequest.onHeadersReceived.addListener(
    (details: chrome.webRequest.WebResponseHeadersDetails): chrome.webRequest.BlockingResponse => {
        // if (details.type !== 'main_frame') {
        //     return { responseHeaders: details.responseHeaders };
        // }

        // console.log({ details });

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

        setHeader('Content-Security-Policy',  "default-src 'self'; script-src 'self' 'report-sample'; style-src 'self' 'report-sample'; base-uri 'self'; object-src 'none'; connect-src 'self'; font-src 'self'; frame-src 'self'; img-src 'self'; manifest-src 'self'; media-src 'self'; worker-src 'none';");

        // Add Content-Security-Policy-Report-Only header
        setHeader('Content-Security-Policy-Report-Only', "default-src 'none'; report-uri /csp-report");

        // setHeader('Content-Security-Policy-Report-Only', "hello world 123;");

        setHeader('X-Frame-Options', 'hello world');
        setHeader('X-Custom-Header', 'read');

        // console.log({ responseHeaders });

        return { responseHeaders: responseHeaders };
    },
    { urls: ['<all_urls>'] },
    ['blocking', 'responseHeaders']
);

// Add custom request header
chrome.webRequest.onBeforeSendHeaders.addListener(
    (details: chrome.webRequest.WebRequestHeadersDetails) => {
        if (details.requestHeaders) {
            const customHeader = { name: 'X-Custom-Header', value: 'MyCustomValue' };
            details.requestHeaders.push(customHeader);
            // console.log('Modified request headers:', JSON.stringify(details.requestHeaders, null, 2));
            return { requestHeaders: details.requestHeaders };
        }
        return { requestHeaders: details.requestHeaders };
    },
    { urls: ['<all_urls>'] },
    ['blocking', 'requestHeaders']
);

// Function to generate CSP from violations
function generateCSPFromViolations(): Promise<string> {
    return new Promise((resolve) => {
        chrome.storage.local.get('cspViolations', (result) => {
            const violations = result.cspViolations || [];
            const directives = new Map<string, Set<string>>();

            violations.forEach((v: any) => {
                const violation = v['csp-report'];
                if (violation && typeof violation === 'object') {
                    const violatedDirective = violation['violated-directive'];
                    const blockedUri = violation['blocked-uri'];

                    if (typeof violatedDirective === 'string' && typeof blockedUri === 'string') {
                        const directive = violatedDirective.split(' ')[0];

                        if (!directives.has(directive)) {
                            directives.set(directive, new Set());
                        }
                        directives.get(directive)?.add(blockedUri);
                    }
                }
            });

            console.log({ violations, directives });

            let csp = '';
            directives.forEach((uris, directive) => {
                csp += `${directive} ${Array.from(uris).join(' ')} 'self'; `;
            });

            resolve(csp.trim());
        });
    });
}

// Function to update CSP
async function updateCSP() {
    const newCSP = await generateCSPFromViolations();
    console.log('Generated CSP: ', newCSP);
    // Here you would typically update your extension's CSP settings
    // For example, you might use chrome.storage.local.set() to save the new CSP
}

// Set up storage change listener
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.cspViolations) {
        updateCSP();
    }
});

// Initial CSP generation
updateCSP();

// Modify the existing listener to use chrome.storage.local instead of localStorage
chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
        if (details.url.endsWith('/csp-report') && details.method === 'POST' && details.requestBody?.raw?.[0]?.bytes) {
            let postedString = decodeURIComponent(String.fromCharCode.apply(null, Array.from(new Uint8Array(details.requestBody.raw[0].bytes))));
            let payload = JSON.parse(postedString);

            console.log('CSP Violation:', payload);

            chrome.storage.local.get('cspViolations', (result) => {
                let violations = result.cspViolations || [];
                violations.push(payload);
                chrome.storage.local.set({ cspViolations: violations });
            });

            return { cancel: true };
        }
    },
    { urls: ['<all_urls>'] },
    ['blocking', 'requestBody']
);

// chrome.webRequest.onCompleted.addListener(
//     (details) => {
//         // console.log('Completed request headers:', JSON.stringify(details.responseHeaders, null, 2));
//     },
//     { urls: ['<all_urls>'] },
//     ['responseHeaders']
// );

console.log('Background script initialized');
