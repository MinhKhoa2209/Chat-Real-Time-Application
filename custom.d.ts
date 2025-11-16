// This file tells TypeScript how to handle CSS file imports.
// It declares that any file ending in .css is a valid module,
// which resolves the "Cannot find module" error you're seeing
// for side-effect imports like './globals.css'.

declare module '*.css';