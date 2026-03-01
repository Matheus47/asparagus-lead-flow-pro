import React from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function KPICard({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  trendValue,
  subtitle,
  sparklineData = []
}) {
  const getTrendIcon = () => {
    if (!trend) return <Minus className="w-4 h-4 text-gray-400" />;
    if (trend === 'up') return <TrendingUp className="w-4 h-4 text-green-500" />;
    return <TrendingDown className="w-4 h-4 text-red-500" />;
  };

  const getTrendColor = () => {
    if (!trend) return 'text-gray-600';
    return trend === 'up' ? 'text-green-600' : 'text-red-600';
  };

  return (
    <Card className="card-shadow hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className="flex items-baseline gap-2 mt-2">
              <h3 className="text-3xl font-bold">{value}</h3>
              {subtitle && (
                <span className="text-sm text-muted-foreground">{subtitle}</span>
              )}
            </div>
          </div>
          {Icon && (
            <div className="p-3 rounded-xl bg-[#2E86AB]/10">
              <Icon className="w-5 h-5 text-[#2E86AB]" />
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        {trendValue !== undefined && (
          <div className="flex items-center gap-2 mt-2">
            {getTrendIcon()}
            <span className={`text-sm font-medium ${getTrendColor()}`}>
              {trendValue > 0 ? '+' : ''}{trendValue}%
            </span>
            <span className="text-xs text-muted-foreground">vs período anterior</span>
          </div>
        )}
        
        {sparklineData.length > 0 && (
          <div className="mt-3 h-8">
            <svg className="w-full h-full" viewBox="0 0 100 30" preserveAspectRatio="none">
              <polyline
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-[#2E86AB]"
                points={sparklineData.map((val, i) => 
                  `${(i / (sparklineData.length - 1)) * 100},${30 - (val / Math.max(...sparklineData)) * 30}`
                ).join(' ')}
              />
            </svg>
          </div>
        )}
      </CardContent>
    </Card>
  );
}