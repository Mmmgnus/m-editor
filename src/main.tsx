import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app/app';
import { setupPWA } from './modules/pwa/register-sw';

setupPWA();

ReactDOM.createRoot(document.getElementById('root')!).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>
);

