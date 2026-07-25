import '@testing-library/jest-dom'

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
    constructor(cb) {
        this.cb = cb
    }
    observe() {
        this.cb([{ borderBoxSize: { inlineSize: 0, blockSize: 0 } }], this)
    }
    unobserve() { }
    disconnect() { }
}

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
    constructor() { }
    disconnect() { }
    observe() { }
    unobserve() { }
}
