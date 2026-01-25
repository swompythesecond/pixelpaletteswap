// State
export const state = {
    originalFrames: [],
    currentFrames: [],
    frameDelays: [],
    gifWidth: 0,
    gifHeight: 0,
    currentFrameIndex: 0,
    isPlaying: true,
    animationInterval: null,
    selectedColor: null,
    colorPalette: new Map(),
    zoom: 4,
    colorSwapHistory: [], // Track all color swaps made
    customFrameDelay: 100, // Default delay for image sequences (10 FPS)
    projectName: 'palette-swapped', // Default project name for exports

    // Selection tool state
    currentTool: 'none', // 'none', 'rect', 'poly'
    selectionMask: null, // Uint8Array matching image pixels, 1 = selected, 0 = not
    isDrawingSelection: false,
    selectionStart: { x: 0, y: 0 },
    selectionEnd: { x: 0, y: 0 },
    polygonPoints: [],
    tempPolygonPoint: null,

    // Palette source state
    sourcePaletteColors: new Map()
};
