import React from 'react';
import { cn } from '../../ui/cn';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export const GlassCard: React.FC<GlassCardProps> = ({ 
  children, 
  className,
  ...props 
}) => {
  return (
    <div 
      className={cn('glass-card', className)}
      {...props}
    >
      {children}
    </div>
  );
};
