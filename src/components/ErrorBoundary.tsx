import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(_: Error): State {
        return { hasError: true };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center p-6 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 text-center h-full min-h-[200px]">
                    <AlertTriangle className="w-10 h-10 text-red-500 mb-3" />
                    <h3 className="text-lg font-bold text-red-700 dark:text-red-400">Widget Unavailable</h3>
                    <p className="text-sm text-red-600/80 dark:text-red-400/70">A rendering error occurred.</p>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
