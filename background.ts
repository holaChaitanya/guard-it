interface BuilderState {
    isEnabled: boolean;
    policy: string;
}

chrome.webRequest.onHeadersReceived.addListener(
    (details: chrome.webRequest.WebResponseHeadersDetails): chrome.webRequest.BlockingResponse => {
        // if (details.type !== 'main_frame') {
        //     return { responseHeaders: details.responseHeaders };
        // }

        console.log({ details });

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

        setHeader('Content-Security-Policy-Report-Only', "hello world 123;");

        setHeader('X-Frame-Options', 'hello world');
        setHeader('X-Custom-Header', 'read');

        console.log({ responseHeaders });

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
            console.log('Modified request headers:', JSON.stringify(details.requestHeaders, null, 2));
            return { requestHeaders: details.requestHeaders };
        }
        return { requestHeaders: details.requestHeaders };
    },
    { urls: ['<all_urls>'] },
    ['blocking', 'requestHeaders']
);

chrome.webRequest.onCompleted.addListener(
    (details) => {
        console.log('Completed request headers:', JSON.stringify(details.responseHeaders, null, 2));
    },
    { urls: ['<all_urls>'] },
    ['responseHeaders']
);

console.log('Background script initialized');
