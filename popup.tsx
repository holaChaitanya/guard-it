import React from 'react';
import ReactDOM from 'react-dom/client';

function Popup() {
  return (
    <div className="w-64 p-4 bg-white">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Guard-it</h1>
      <p className="text-sm text-gray-600">This is the popup for the Guard-it extension.</p>
    </div>
  );
}

const root = ReactDOM.createRoot(
  document.getElementById('popup-root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
);
