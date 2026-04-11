import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'danger' | 'ghost' | 'soul';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({ variant = 'primary', size = 'md', className = '', children, ...props }: ButtonProps) {
  const variantClass = {
    primary: 'bg-fs-gold text-fs-dark hover:bg-fs-gold-light',
    danger: 'bg-fs-red text-fs-parchment hover:bg-red-700',
    ghost: 'bg-transparent text-fs-parchment border border-fs-gold/40 hover:border-fs-gold hover:bg-fs-gold/10',
    soul: 'bg-fs-soul text-white hover:bg-purple-700',
  }[variant];

  const sizeClass = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  }[size];

  return (
    <button
      className={`font-display font-semibold rounded transition-colors duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${variantClass} ${sizeClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
