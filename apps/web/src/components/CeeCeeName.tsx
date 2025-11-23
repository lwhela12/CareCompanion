import React from 'react';

interface CeeCeeNameProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Styled "CeeCee" brand name with glossy purple gradient effect
 */
export function CeeCeeName({ size = 'md', className = '' }: CeeCeeNameProps) {
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  return (
    <span
      className={`ceecee-name font-semibold ${sizeClasses[size]} ${className}`}
    >
      CeeCee
    </span>
  );
}

export default CeeCeeName;
