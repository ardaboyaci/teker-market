// Utility functions will go here
export function cn(...inputs: any[]) {
    // Placeholder for tailwind-merge and clsx
    return inputs.filter(Boolean).join(' ')
}
