import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { CeeCeeAvatar } from '@/components/CeeCeeAvatar';

export function TransitionOverlay() {
  const [isActive, setIsActive] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const handleStartTransition = () => {
      setIsActive(true);
      // Small delay to ensure overlay is painted before animation starts
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
    };

    window.addEventListener('start-dashboard-transition', handleStartTransition);
    return () => window.removeEventListener('start-dashboard-transition', handleStartTransition);
  }, []);

  // Remove overlay after animation completes
  useEffect(() => {
    if (isAnimating) {
      const timer = setTimeout(() => {
        setIsActive(false);
        setIsAnimating(false);
      }, 800); // Match animation duration (700ms + buffer)
      return () => clearTimeout(timer);
    }
  }, [isAnimating]);

  if (!isActive) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[9999] bg-gradient-to-br from-primary-50 to-white dark:from-slate-900 dark:to-slate-800 flex items-center justify-center",
        isAnimating && "animate-shrink-to-corner"
      )}
      style={{ transformOrigin: 'bottom right' }}
    >
      <div className={cn(
        "text-center transition-opacity duration-200",
        isAnimating && "opacity-0"
      )}>
        <CeeCeeAvatar size="lg" className="mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400">Setting up your dashboard...</p>
      </div>
    </div>
  );
}
