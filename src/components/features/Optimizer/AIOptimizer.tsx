import React from 'react';
import OptimizerLayout from './OptimizerLayout';
import { Customer } from '../../../types';

interface AIOptimizerProps {
    customers: Customer[]; // Kept for prop compatibility, though now we fetch data internally
    focusedSuggestionId?: string | null;
    onBack: () => void;
    isDarkMode: boolean;
    language: 'en' | 'ar';
    onToggleTheme: () => void;
    onToggleLang: () => void;
    hideHeader?: boolean;
    companyId?: string;
    userBranchIds?: string[];
    userRole?: string;
}

const AIOptimizer: React.FC<AIOptimizerProps> = ({ onBack, companyId, userBranchIds, userRole }) => {
    return (
        <OptimizerLayout onBack={onBack} companyId={companyId} userBranchIds={userBranchIds} userRole={userRole} />
    );
};

export default AIOptimizer;
