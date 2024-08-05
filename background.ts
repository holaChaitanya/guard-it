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

        setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; connect-src 'self'; img-src 'self'; style-src 'self'; base-uri 'self'; form-action 'self'");

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

// Intercept CSP violation reports
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.url.endsWith('/csp-report') && details.method === 'POST' && details.requestBody?.raw?.[0]?.bytes) {
      let postedString = decodeURIComponent(String.fromCharCode.apply(null, Array.from(new Uint8Array(details.requestBody.raw[0].bytes))));
      let payload = JSON.parse(postedString);
      
      console.log('CSP Violation:', payload);

      let violations = JSON.parse(localStorage.getItem('cspViolations') || '[]');
      violations.push(payload);
      localStorage.setItem('cspViolations', JSON.stringify(violations));

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
