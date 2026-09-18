import { Component, type ReactNode } from 'react';

type Props = { children: ReactNode; onError?: (error: Error) => void };
type State = { hasError: boolean; error: Error | null };

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error('ErrorBoundary caught:', error);
    this.props.onError?.(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
          <p className="text-slate-400 text-sm mb-2">Something went wrong loading this page.</p>
          <p className="text-red-400/70 text-xs mb-4 font-mono max-w-md break-words">
            {this.state.error?.message || 'Unknown error'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 rounded-lg bg-blue-500 text-white text-xs font-bold"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
