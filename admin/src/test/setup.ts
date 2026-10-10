import '@testing-library/jest-dom/vitest'

// jsdom has no layout; input-otp probes elementFromPoint to detect password-manager badges.
document.elementFromPoint = () => null
