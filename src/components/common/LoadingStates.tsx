/**
 * Loading State Component
 * 
 * Reusable loading indicators for consistent UX
 */

import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    text?: string;
    fullScreen?: boolean;
    className?: string;
}

const sizeMap = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
};

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
    size = 'md',
    text,
    fullScreen = false,
    className = ''
}) => {
    const content = (
        <div
            className={`flex flex-col items-center justify-center gap-3 ${className}`}
            role="status"
            aria-live="polite"
            aria-busy="true"
        >
            <Loader2
                className={`${sizeMap[size]} animate-spin text-blue-600`}
                aria-hidden="true"
            />
            {text && (
                <span className="text-sm text-gray-600 dark:text-gray-300">
                    {text}
                </span>
            )}
            <span className="sr-only">{text || 'Loading...'}</span>
        </div>
    );

    if (fullScreen) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
                {content}
            </div>
        );
    }

    return content;
};

interface LoadingSkeletonProps {
    lines?: number;
    className?: string;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
    lines = 3,
    className = ''
}) => {
    return (
        <div className={`animate-pulse space-y-3 ${className}`} role="status" aria-busy="true">
            {Array.from({ length: lines }).map((_, i) => (
                <div
                    key={i}
                    className="h-4 bg-gray-200 dark:bg-gray-700 rounded"
                    style={{ width: `${100 - (i * 15)}%` }}
                />
            ))}
            <span className="sr-only">Loading content...</span>
        </div>
    );
};

interface LoadingCardProps {
    className?: string;
}

export const LoadingCard: React.FC<LoadingCardProps> = ({ className = '' }) => {
    return (
        <div
            className={`animate-pulse bg-white dark:bg-gray-800 rounded-xl p-6 shadow-md ${className}`}
            role="status"
            aria-busy="true"
        >
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4" />
            <div className="space-y-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/6" />
            </div>
            <span className="sr-only">Loading card content...</span>
        </div>
    );
};

interface LoadingButtonProps {
    loading: boolean;
    children: React.ReactNode;
    loadingText?: string;
    disabled?: boolean;
    className?: string;
    onClick?: () => void;
    type?: 'button' | 'submit';
}

export const LoadingButton: React.FC<LoadingButtonProps> = ({
    loading,
    children,
    loadingText = 'Loading...',
    disabled = false,
    className = '',
    onClick,
    type = 'button'
}) => {
    return (
        <button
            type={type}
            disabled={disabled || loading}
            onClick={onClick}
            className={`
        relative inline-flex items-center justify-center gap-2 
        px-4 py-2 rounded-lg font-medium
        transition-all duration-200
        disabled:opacity-60 disabled:cursor-not-allowed
        ${className}
      `}
            aria-busy={loading}
            aria-disabled={disabled || loading}
        >
            {loading && (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            )}
            <span>{loading ? loadingText : children}</span>
        </button>
    );
};

export default LoadingSpinner;
