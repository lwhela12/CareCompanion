import { cn } from '@/lib/utils';

interface CeeCeeAvatarProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * CeeCee - the friendly care companion AI assistant
 */
export function CeeCeeAvatar({ size = 'md', className }: CeeCeeAvatarProps) {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <img
      src="/ceecee-avatar.jpeg"
      alt="CeeCee"
      className={cn(
        'rounded-full object-cover',
        sizeClasses[size],
        className
      )}
    />
  );
}

export default CeeCeeAvatar;
