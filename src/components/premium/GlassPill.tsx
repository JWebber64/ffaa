import React from 'react';
import { cn } from '../../ui/cn';

interface GlassPillProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export const GlassPill: React.FC<GlassPillProps> = ({ 
  children, 
  className,
  ...props 
}) => {
  return (
    <div 
      className={cn('glass-pill', className)}
      {...props}
    >
      {children}
    </div>
  );
};
