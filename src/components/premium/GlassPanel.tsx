import React from 'react';
import { cn } from '../../ui/cn';

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export const GlassPanel: React.FC<GlassPanelProps> = ({ 
  children, 
  className,
  ...props 
}) => {
  return (
    <div 
      className={cn('glass-panel', className)}
      {...props}
    >
      {children}
    </div>
  );
};
