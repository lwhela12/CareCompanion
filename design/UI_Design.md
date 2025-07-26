CareCompanion UI Design System
Overview
This design system provides comprehensive guidelines for implementing CareCompanion's user interface. It prioritizes clarity, calmness, and ease of use for stressed caregivers managing their loved ones' care.
Reference Implementation: See design/mockups/dashboard.html for a working prototype.
Core Design Principles
1. Reduce Cognitive Load

Information hierarchy guides the eye naturally
Most important actions are immediately visible
Complex tasks broken into simple steps
Smart defaults minimize decision-making

2. Calm & Trustworthy

Soft, muted colors reduce visual stress
Gentle animations provide feedback without distraction
Consistent patterns build familiarity
Professional appearance inspires confidence

3. Accessibility First

Large touch targets (minimum 44px)
High contrast text (WCAG AA compliant)
Clear focus indicators
Screen reader friendly

4. Mobile-First Responsive

Core features work on all devices
Touch-optimized interactions
Progressive enhancement for larger screens
Offline-capable design patterns

Color System
Design Tokens
css:root {
  /* Primary Palette */
  --primary-50: #F0F2FC;
  --primary-100: #E8EBFA;
  --primary-200: #D3D9F4;
  --primary-300: #B0BAEC;
  --primary-400: #8B9AE3;
  --primary-500: #6B7FD7;  /* Main brand color */
  --primary-600: #4C5FC6;
  --primary-700: #3A4BB5;
  --primary-800: #2E3D99;
  --primary-900: #1F2A6B;

  /* Semantic Colors */
  --success: #52B788;      /* Sage green - positive actions */
  --success-light: #E8F5F0;
  --success-dark: #2D7A57;
  
  --warning: #F4A261;      /* Soft orange - attention needed */
  --warning-light: #FEF3E7;
  --warning-dark: #C17D3A;
  
  --error: #E76F51;        /* Muted coral - urgent/errors */
  --error-light: #FDEBE7;
  --error-dark: #B94A2F;
  
  --info: #4ECDC4;         /* Teal - informational */
  --info-light: #E7F9F8;
  --info-dark: #2B8B84;

  /* Neutral Palette */
  --gray-50: #FAFBFD;      /* Backgrounds */
  --gray-100: #F5F7FA;
  --gray-200: #E2E8F0;
  --gray-300: #CBD5E0;
  --gray-400: #A0AEC0;
  --gray-500: #718096;
  --gray-600: #4A5568;
  --gray-700: #2D3748;
  --gray-800: #1A202C;
  --gray-900: #0F1419;

  /* Semantic Assignments */
  --bg-primary: var(--gray-50);
  --bg-secondary: var(--gray-100);
  --bg-card: #FFFFFF;
  --bg-hover: var(--primary-50);
  
  --text-primary: var(--gray-700);
  --text-secondary: var(--gray-500);
  --text-light: var(--gray-400);
  --text-inverse: #FFFFFF;
  
  --border-light: var(--gray-200);
  --border-medium: var(--gray-300);
  
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 2px 8px rgba(0, 0, 0, 0.05);
  --shadow-lg: 0 4px 16px rgba(0, 0, 0, 0.08);
  --shadow-xl: 0 8px 32px rgba(0, 0, 0, 0.12);
}
Color Usage Guidelines

Primary: Main CTAs, active navigation, key interactions
Success: Completed tasks, positive trends, confirmations
Warning: Upcoming deadlines, mild concerns, cautions
Error: Missed medications, urgent alerts, critical issues
Info: Tips, help text, supplementary information
Grays: UI structure, text hierarchy, backgrounds

Typography
Font Stack
css--font-sans: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", 
             Roboto, Helvetica, Arial, sans-serif;
--font-mono: "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", 
             Consolas, "Courier New", monospace;
Type Scale
css--text-xs: 0.75rem;      /* 12px - Tiny labels */
--text-sm: 0.875rem;     /* 14px - Secondary text */
--text-base: 1rem;       /* 16px - Body text */
--text-lg: 1.125rem;     /* 18px - Emphasized body */
--text-xl: 1.25rem;      /* 20px - Section headers */
--text-2xl: 1.5rem;      /* 24px - Page headers */
--text-3xl: 2rem;        /* 32px - Major headers */
--text-4xl: 2.5rem;      /* 40px - Hero text */

/* Line Heights */
--leading-none: 1;
--leading-tight: 1.25;
--leading-normal: 1.6;
--leading-relaxed: 1.75;

/* Font Weights */
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
Typography Patterns
css/* Page Title */
.page-title {
  font-size: var(--text-3xl);
  font-weight: var(--font-semibold);
  line-height: var(--leading-tight);
  color: var(--text-primary);
}

/* Section Header */
.section-header {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  line-height: var(--leading-tight);
  color: var(--text-primary);
}

/* Body Text */
.body-text {
  font-size: var(--text-base);
  font-weight: var(--font-normal);
  line-height: var(--leading-normal);
  color: var(--text-secondary);
}

/* Small Text */
.small-text {
  font-size: var(--text-sm);
  font-weight: var(--font-normal);
  line-height: var(--leading-normal);
  color: var(--text-light);
}
Spacing System
Base Unit: 4px (0.25rem)
css--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
Common Spacing Patterns

Card padding: var(--space-6) desktop, var(--space-4) mobile
Section gaps: var(--space-8)
Element spacing: var(--space-4)
Inline gaps: var(--space-2)
Page margins: var(--space-8) desktop, var(--space-4) mobile

Component Library
Cards
css.card {
  background: var(--bg-card);
  border-radius: 16px;
  padding: var(--space-6);
  box-shadow: var(--shadow-md);
  transition: all 0.2s ease;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.card-compact {
  padding: var(--space-4);
  border-radius: 12px;
}

.card-bordered {
  border: 1px solid var(--border-light);
  box-shadow: var(--shadow-sm);
}
Buttons
css/* Base Button */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-3) var(--space-6);
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  border-radius: 8px;
  transition: all 0.2s ease;
  cursor: pointer;
  min-height: 44px;
  gap: var(--space-2);
}

/* Primary Button */
.btn-primary {
  background: var(--primary-500);
  color: var(--text-inverse);
  border: none;
}

.btn-primary:hover {
  background: var(--primary-600);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.btn-primary:active {
  transform: translateY(0);
}

/* Secondary Button */
.btn-secondary {
  background: transparent;
  color: var(--primary-600);
  border: 2px solid var(--primary-500);
}

.btn-secondary:hover {
  background: var(--primary-50);
}

/* Ghost Button */
.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
  border: none;
}

.btn-ghost:hover {
  background: var(--gray-100);
  color: var(--text-primary);
}

/* Button Sizes */
.btn-sm {
  padding: var(--space-2) var(--space-4);
  font-size: var(--text-sm);
  min-height: 36px;
}

.btn-lg {
  padding: var(--space-4) var(--space-8);
  font-size: var(--text-lg);
  min-height: 52px;
}
Form Elements
css/* Input Field */
.input {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  background: var(--bg-card);
  border: 2px solid var(--border-light);
  border-radius: 8px;
  font-size: var(--text-base);
  transition: all 0.2s ease;
}

.input:focus {
  outline: none;
  border-color: var(--primary-500);
  box-shadow: 0 0 0 3px var(--primary-100);
}

/* Label */
.label {
  display: block;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  margin-bottom: var(--space-2);
}

/* Helper Text */
.helper-text {
  font-size: var(--text-sm);
  color: var(--text-light);
  margin-top: var(--space-2);
}

/* Error State */
.input-error {
  border-color: var(--error);
}

.error-message {
  color: var(--error);
  font-size: var(--text-sm);
  margin-top: var(--space-2);
}
Status Indicators
css/* Status Badge */
.badge {
  display: inline-flex;
  align-items: center;
  padding: var(--space-1) var(--space-3);
  border-radius: 20px;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
}

.badge-success {
  background: var(--success-light);
  color: var(--success-dark);
}

.badge-warning {
  background: var(--warning-light);
  color: var(--warning-dark);
}

.badge-error {
  background: var(--error-light);
  color: var(--error-dark);
}

/* Status Dot */
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.status-dot-active {
  background: var(--success);
}

.status-dot-warning {
  background: var(--warning);
}

.status-dot-error {
  background: var(--error);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
Timeline
css.timeline {
  position: relative;
  padding-left: var(--space-12);
}

.timeline::before {
  content: '';
  position: absolute;
  left: 20px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--border-light);
}

.timeline-item {
  position: relative;
  padding-bottom: var(--space-6);
}

.timeline-marker {
  position: absolute;
  left: -28px;
  top: 6px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--bg-card);
  border: 3px solid var(--primary-500);
}

.timeline-time {
  font-size: var(--text-sm);
  color: var(--text-light);
  margin-bottom: var(--space-1);
}

.timeline-content {
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: var(--space-4);
}
Layout Patterns
Grid System
css/* Container */
.container {
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 var(--space-4);
}

@media (min-width: 768px) {
  .container {
    padding: 0 var(--space-8);
  }
}

/* Grid */
.grid {
  display: grid;
  gap: var(--space-6);
}

.grid-cols-1 { grid-template-columns: repeat(1, 1fr); }
.grid-cols-2 { grid-template-columns: repeat(2, 1fr); }
.grid-cols-3 { grid-template-columns: repeat(3, 1fr); }
.grid-cols-4 { grid-template-columns: repeat(4, 1fr); }

/* Responsive Grid */
@media (max-width: 768px) {
  .md\:grid-cols-1 { grid-template-columns: repeat(1, 1fr); }
}

@media (max-width: 1024px) {
  .lg\:grid-cols-2 { grid-template-columns: repeat(2, 1fr); }
}
Dashboard Layout
css/* Main Layout */
.dashboard-layout {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: var(--space-8);
}

@media (max-width: 1024px) {
  .dashboard-layout {
    grid-template-columns: 1fr;
  }
}

/* Quick Actions Grid */
.quick-actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-4);
}

/* Status Cards Grid */
.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-6);
}
Interactive States
Hover Effects
css/* Lift Effect */
.hover-lift {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.hover-lift:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

/* Glow Effect */
.hover-glow:hover {
  box-shadow: 0 0 20px var(--primary-100);
}

/* Scale Effect */
.hover-scale {
  transition: transform 0.2s ease;
}

.hover-scale:hover {
  transform: scale(1.02);
}
Focus States
css/* Focus Ring */
*:focus {
  outline: none;
}

*:focus-visible {
  box-shadow: 0 0 0 3px var(--primary-100);
  border-radius: inherit;
}

/* Skip Link */
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: var(--primary-500);
  color: white;
  padding: var(--space-2) var(--space-4);
  text-decoration: none;
  border-radius: 4px;
}

.skip-link:focus {
  top: 0;
}
Loading States
css/* Skeleton Loader */
.skeleton {
  background: linear-gradient(
    90deg,
    var(--gray-200) 25%,
    var(--gray-100) 50%,
    var(--gray-200) 75%
  );
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
}

@keyframes loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Spinner */
.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--gray-200);
  border-top-color: var(--primary-500);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
Animation Guidelines
Timing Functions
css--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
--ease-out: cubic-bezier(0, 0, 0.2, 1);
--ease-in: cubic-bezier(0.4, 0, 1, 1);
Duration Scale
css--duration-75: 75ms;
--duration-100: 100ms;
--duration-150: 150ms;
--duration-200: 200ms;
--duration-300: 300ms;
--duration-500: 500ms;
--duration-700: 700ms;
Animation Patterns

Micro-interactions: 150-200ms
Page transitions: 300-500ms
Loading animations: 1000ms+
Hover effects: 200ms
Focus transitions: 150ms

Responsive Design
Breakpoints
css--screen-sm: 640px;   /* Mobile landscape */
--screen-md: 768px;   /* Tablet portrait */
--screen-lg: 1024px;  /* Tablet landscape */
--screen-xl: 1280px;  /* Desktop */
--screen-2xl: 1536px; /* Large desktop */
Mobile Adaptations

Touch Targets: Minimum 44x44px
Font Sizes: Base 16px (prevents zoom)
Padding: Reduce by 25% on mobile
Navigation: Bottom tab bar on mobile
Forms: Full-width inputs, larger buttons

Responsive Utilities
css/* Hide/Show */
@media (max-width: 768px) {
  .hidden-mobile { display: none; }
  .visible-mobile { display: block; }
}

@media (min-width: 769px) {
  .hidden-desktop { display: none; }
  .visible-desktop { display: block; }
}

/* Stack on Mobile */
@media (max-width: 768px) {
  .stack-mobile {
    flex-direction: column;
    gap: var(--space-4);
  }
}
Special Components
Voice Input Button
css.voice-fab {
  position: fixed;
  bottom: var(--space-8);
  right: var(--space-8);
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--primary-500);
  color: white;
  border: none;
  cursor: pointer;
  box-shadow: var(--shadow-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  z-index: 1000;
}

.voice-fab:hover {
  transform: scale(1.1);
  box-shadow: var(--shadow-xl);
}

.voice-fab.recording {
  background: var(--error);
  animation: pulse-ring 1.5s infinite;
}

@keyframes pulse-ring {
  0% {
    box-shadow: 0 0 0 0 rgba(231, 111, 81, 0.7);
  }
  70% {
    box-shadow: 0 0 0 20px rgba(231, 111, 81, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(231, 111, 81, 0);
  }
}

@media (max-width: 768px) {
  .voice-fab {
    width: 56px;
    height: 56px;
    bottom: var(--space-6);
    right: var(--space-6);
  }
}
Medication Tracker
css.medication-item {
  display: flex;
  align-items: center;
  padding: var(--space-4);
  background: var(--bg-secondary);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  gap: var(--space-4);
}

.medication-item:hover {
  background: var(--primary-50);
  transform: translateX(4px);
}

.med-time {
  font-weight: var(--font-semibold);
  color: var(--primary-600);
  min-width: 80px;
}

.med-status {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.med-status.pending {
  background: var(--gray-200);
}

.med-status.given {
  background: var(--success);
  color: white;
  animation: check-in 0.3s ease;
}

@keyframes check-in {
  0% { transform: scale(0); }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); }
}
Empty States
css.empty-state {
  text-align: center;
  padding: var(--space-12) var(--space-8);
}

.empty-state-icon {
  width: 120px;
  height: 120px;
  margin: 0 auto var(--space-6);
  opacity: 0.3;
}

.empty-state-title {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin-bottom: var(--space-2);
}

.empty-state-description {
  color: var(--text-secondary);
  max-width: 400px;
  margin: 0 auto var(--space-6);
}
Accessibility Guidelines
Color Contrast

Normal text: 4.5:1 minimum ratio
Large text (18px+): 3:1 minimum ratio
Interactive elements: 3:1 minimum ratio
Never use color alone to convey information

Keyboard Navigation

All interactive elements reachable via Tab
Clear focus indicators on all elements
Logical tab order (top to bottom, left to right)
Skip links for repetitive content

Screen Reader Support
html<!-- Descriptive labels -->
<button aria-label="Record voice note">
  <svg aria-hidden="true">...</svg>
</button>

<!-- Live regions for updates -->
<div aria-live="polite" aria-atomic="true">
  Medication marked as given
</div>

<!-- Semantic HTML -->
<nav aria-label="Main navigation">...</nav>
<main>...</main>
<aside aria-label="Medication schedule">...</aside>
Motion Preferences
css@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
Implementation Notes
CSS Architecture

Use CSS Variables: All colors, spacing, and typography values should reference the design tokens
Component Scoping: Use CSS modules or styled-components to prevent style leakage
Utility Classes: Create utility classes for common patterns (margins, padding, text styles)
Mobile-First: Write base styles for mobile, then enhance for larger screens

Performance Considerations

Lazy Load Images: Use native lazy loading or Intersection Observer
Optimize Animations: Use transform and opacity for best performance
Reduce Paint Areas: Minimize box-shadow and border-radius on large elements
Font Loading: Use font-display: swap for custom fonts

React Component Patterns
tsx// Example component structure
const StatusCard: React.FC<StatusCardProps> = ({ 
  title, 
  value, 
  trend, 
  icon 
}) => {
  return (
    <div className="status-card">
      <div className="status-header">
        <span className="status-title">{title}</span>
        <Icon name={icon} className="status-icon" />
      </div>
      <div className="status-value">{value}</div>
      {trend && (
        <div className={`status-trend trend-${trend.direction}`}>
          <TrendIcon direction={trend.direction} />
          {trend.text}
        </div>
      )}
    </div>
  );
};
Tailwind Config (if using Tailwind)
jsmodule.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#F0F2FC',
          100: '#E8EBFA',
          // ... rest of primary scale
        },
        success: '#52B788',
        warning: '#F4A261',
        error: '#E76F51',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Inter', ...],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      borderRadius: {
        'xl': '16px',
      },
    },
  },
};
Design Checklist
Before implementing any new UI component or screen, verify:

 Colors are from the defined palette
 Spacing uses the 4px grid system
 Text sizes match the type scale
 Interactive elements have hover/focus states
 Touch targets are at least 44x44px
 Contrast ratios meet WCAG AA standards
 Component works on mobile screens
 Loading and error states are designed
 Animations respect prefers-reduced-motion
 Component is keyboard accessible