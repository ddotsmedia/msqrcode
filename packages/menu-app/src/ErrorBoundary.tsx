import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

// Shows a readable message instead of a blank page if the menu crashes while rendering.
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Menu render error:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen bg-brand-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <p className="text-red-600 mb-4">Something went wrong while showing the menu.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
