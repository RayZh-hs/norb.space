// tailwind.config.js (or .cjs, .mjs)
/** @type {import('tailwindcss').Config} */
export default {
    content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
    theme: {
        extend: {
            keyframes: {
                'fade-in': {
                    '0%': { opacity: '0', transform: 'translateY(5px)' }, // Start slightly down and invisible
                    '100%': { opacity: '1', transform: 'translateY(0)' }, // End at normal position and visible
                },
            },
            animation: {
                'fade-in': 'fade-in 0.5s ease-out forwards', // 'forwards' keeps the final state
            },
            // Add other theme customizations here
        },
    },
    plugins: [],
}