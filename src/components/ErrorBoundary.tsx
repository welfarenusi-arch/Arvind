import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorDetails = null;
      try {
        if (this.state.error?.message) {
          errorDetails = JSON.parse(this.state.error.message);
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#141414] border border-[#141414] rounded-2xl p-8 text-center">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-4">Something went wrong</h2>
            <p className="text-gray-400 mb-8">
              {errorDetails ? (
                <span>
                  A Firestore error occurred during a <strong>{errorDetails.operationType}</strong> operation.
                  <br />
                  <span className="text-xs mt-2 block opacity-50">{errorDetails.error}</span>
                </span>
              ) : (
                this.state.error?.message || 'An unexpected error occurred.'
              )}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full flex items-center justify-center gap-2 bg-white text-black py-3 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
            >
              <RefreshCcw className="w-4 h-4" />
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
