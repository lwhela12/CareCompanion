import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import * as Sentry from '@sentry/react';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ThemeProvider } from './providers/ThemeProvider';
import { TransitionOverlay } from './components/TransitionOverlay';
import './styles/globals.css';

// Initialize Sentry (optional - app works without it)
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
const environment = import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE;

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true, // Mask all text for privacy
        blockAllMedia: true, // Block all media for privacy
      }),
    ],
    // Performance Monitoring
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0, // 10% in prod, 100% in dev
    // Session Replay
    replaysSessionSampleRate: 0.1, // 10% of sessions
    replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors
    // Release tracking
    release: import.meta.env.VITE_APP_VERSION,
    // Don't send errors in development unless explicitly enabled
    enabled: environment === 'production' || import.meta.env.VITE_SENTRY_ENABLED === 'true',
  });
  console.log('Sentry initialized for environment:', environment);
}

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!clerkPubKey) {
  throw new Error('Missing Clerk Publishable Key');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary fallbackType="fullPage">
      <ThemeProvider>
        <TransitionOverlay />
        <ClerkProvider publishableKey={clerkPubKey}>
          <App />
        </ClerkProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
);