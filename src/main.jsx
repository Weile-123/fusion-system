import { createRoot } from './dom-runtime.mjs';
import App, { startApplication } from './App.jsx';
import './styles.js';

createRoot(document.getElementById('root')).render(<App />);
startApplication();
