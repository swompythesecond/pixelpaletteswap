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
    editHistory: [],      // Track all edit operations (swaps + reductions) for undo UI
    redoHistory: [],      // Track undone edit operations for redo
    customFrameDelay: 100, // Default delay for image sequences (10 FPS)
    projectName: 'palette-swapped', // Default project name for exports
    reduceEnabled: false,
    reduceColorTarget: 16,
    reduceColorMin: 2,
    reduceColorMax: 256,

    // Selection tool state
    currentTool: 'none', // 'none', 'rect', 'poly', 'pencil', 'eraser'
    selectionMask: null, // Uint8Array matching image pixels, 1 = selected, 0 = not
    isDrawingSelection: false,
    selectionStart: { x: 0, y: 0 },
    selectionEnd: { x: 0, y: 0 },
    polygonPoints: [],
    tempPolygonPoint: null,
    isPainting: false,
    activePaintTool: null,
    strokeSelectionSet: null,
    strokePixelMap: new Map(),

    // Palette source state
    sourcePaletteColors: new Map(),

    // Color grouping state
    colorGroupingEnabled: false,
    colorGroupingThreshold: 30,      // 0-100 scale, higher = more aggressive grouping
    colorGroups: [],                 // Array of arrays of colorKeys
    colorKeyToGroupIndex: new Map(), // colorKey -> group index lookup
    selectedGroup: null,             // Currently selected group index
    selectedAnchorColor: null        // The specific color clicked in a group (used as anchor for shift)
};
