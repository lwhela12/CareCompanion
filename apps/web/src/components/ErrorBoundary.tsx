import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import * as Sentry from '@sentry/react';

interface Props {
  children: ReactNode;
  fallbackType?: 'fullPage' | 'inline';
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to console for debugging
    console.error('Error caught by boundary:', error, errorInfo);

    // Send to Sentry if configured
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
        },
      },
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      const { fallbackType = 'fullPage' } = this.props;

      if (fallbackType === 'fullPage') {
        return (
          <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full">
              <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="h-8 w-8 text-red-600" />
                </div>

                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  Something went wrong
                </h1>

                <p className="text-gray-600 mb-6">
                  We're sorry, but something unexpected happened. Don't worry - your data is safe.
                  Please try refreshing the page or going back to the home screen.
                </p>

                {import.meta.env.DEV && this.state.error && (
                  <div className="mb-6 p-4 bg-gray-100 rounded-lg text-left">
                    <p className="text-xs font-mono text-gray-700 break-all">
                      {this.state.error.toString()}
                    </p>
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  <button
                    onClick={this.handleReload}
                    className="btn btn-primary w-full"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Reload Page
                  </button>

                  <button
                    onClick={this.handleGoHome}
                    className="btn btn-secondary w-full"
                  >
                    <Home className="h-4 w-4" />
                    Go to Home
                  </button>
                </div>

                <p className="text-xs text-gray-500 mt-6">
                  If this problem persists, please contact support
                </p>
              </div>
            </div>
          </div>
        );
      }

      // Inline error (for layout/page-level boundaries)
      return (
        <div className="p-6">
          <div className="card bg-red-50 border-2 border-red-200">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>

              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Unable to load this section
                </h3>

                <p className="text-sm text-gray-600 mb-4">
                  Something went wrong while loading this content. Your other data is safe.
                </p>

                {import.meta.env.DEV && this.state.error && (
                  <div className="mb-4 p-3 bg-white rounded border border-red-200">
                    <p className="text-xs font-mono text-gray-700 break-all">
                      {this.state.error.toString()}
                    </p>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={this.handleReset}
                    className="btn btn-sm btn-primary"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Try Again
                  </button>

                  <button
                    onClick={this.handleGoHome}
                    className="btn btn-sm btn-secondary"
                  >
                    <Home className="h-4 w-4" />
                    Go Home
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
