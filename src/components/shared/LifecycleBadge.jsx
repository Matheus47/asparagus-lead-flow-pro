import React from 'react';
import { Badge } from '@/components/ui/badge';

const lifecycleConfig = {
  'Lead': { color: 'bg-gray-100 text-gray-800 border-gray-200' },
  'Qualified Lead': { color: 'bg-green-100 text-green-800 border-green-200' },
  'Client': { color: 'bg-purple-100 text-purple-800 border-purple-200' },
  'Former Client': { color: 'bg-red-100 text-red-800 border-red-200' }
};

export default function LifecycleBadge({ stage, className = '' }) {
  const config = lifecycleConfig[stage] || lifecycleConfig['Lead'];
  
  return (
    <Badge variant="secondary" className={`${config.color} border ${className}`}>
      {stage}
    </Badge>
  );
}