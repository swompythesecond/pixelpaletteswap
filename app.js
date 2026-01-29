import { state } from './js/state.js';
import { elements } from './js/dom.js';
import { rgbToHex, rgbToLab, labToRgb } from './js/utils.js';
import { 
    selectTool, 
    updateSelectionInfo, 
    clearSelection, 
    invertSelection, 
    renderSelectionOverlay, 
    startMarchingAnts,
    applyRectangleSelection,
    applyPolygonSelection
} from './js/selection.js';
import {
    extractPalette,
    renderPalette,
    selectColor,
    handlePaletteSourceUpload,
    clearPaletteSource
} from './js/palette.js';
import { 
    showFrame, 
    renderCurrentFrame, 
    startAnimation, 
    stopAnimation, 
    togglePlayPause,
    updateCanvasSize 
} from './js/animation.js';
import { handleFiles } from './js/file-handler.js';
import { 
    exportCurrentFrame, 
    exportPngSequence, 
    exportPreset, 
    importPreset 
} from './js/export.js';

// Initialization
startMarchingAnts();

// Event Listeners
elements.projectNameInput.addEventListener('input', (e) => {
    state.projectName = e.target.value.trim() || 'palette-swapped';
});

elements.newColorPicker.addEventListener('input', (e) => {
    elements.newColorHex.value = e.target.value.toUpperCase();
});

elements.newColorHex.addEventListener('input', (e) => {
    let val = e.target.value;
    if (val && !val.startsWith('#')) {
        val = '#' + val;
        e.target.value = val;
    }
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
        elements.newColorPicker.value = val.toLowerCase();
        e.target.style.borderColor = '#555';
    } else if (val.length > 1) {
        e.target.style.borderColor = '#e94560';
    }
});

elements.newColorHex.addEventListener('blur', (e) => {
    let val = e.target.value;
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
        e.target.value = val.toUpperCase();
        e.target.style.borderColor = '#555';
    } else {
        e.target.value = elements.newColorPicker.value.toUpperCase();
        e.target.style.borderColor = '#555';
    }
});

elements.toolNoneBtn.addEventListener('click', () => selectTool('none'));
elements.toolRectBtn.addEventListener('click', () => selectTool('rect'));
elements.toolPolyBtn.addEventListener('click', () => selectTool('poly'));
elements.invertSelectionBtn.addEventListener('click', invertSelection);
elements.clearSelectionBtn.addEventListener('click', clearSelection);

elements.uploadArea.addEventListener('click', () => elements.fileInput.click());
elements.uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    elements.uploadArea.style.borderColor = '#ff6b6b';
});
elements.uploadArea.addEventListener('dragleave', () => {
    elements.uploadArea.style.borderColor = '#e94560';
});
elements.uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    elements.uploadArea.style.borderColor = '#e94560';
    handleFiles(Array.from(e.dataTransfer.files), updateSwapHistoryDisplay);
});
elements.fileInput.addEventListener('change', (e) => {
    handleFiles(Array.from(e.target.files), updateSwapHistoryDisplay);
});

elements.playPauseBtn.addEventListener('click', togglePlayPause);
elements.prevFrameBtn.addEventListener('click', () => { stopAnimation(); showFrame(state.currentFrameIndex - 1); });
elements.nextFrameBtn.addEventListener('click', () => { stopAnimation(); showFrame(state.currentFrameIndex + 1); });
elements.exportBtn.addEventListener('click', exportCurrentFrame);
elements.exportPngBtn.addEventListener('click', exportPngSequence);
elements.applySwapBtn.addEventListener('click', applyColorSwap);
elements.resetBtn.addEventListener('click', resetChanges);
elements.exportPresetBtn.addEventListener('click', exportPreset);
elements.importPresetBtn.addEventListener('click', () => elements.importPresetInput.click());
elements.importPresetInput.addEventListener('change', (e) => importPreset(e, updateSwapHistoryDisplay));

elements.zoomSlider.addEventListener('input', (e) => {
    state.zoom = parseInt(e.target.value);
    elements.zoomValue.textContent = state.zoom;
    updateCanvasSize();
    renderCurrentFrame();
});

elements.speedSlider.addEventListener('input', (e) => {
    const fps = parseInt(e.target.value);
    state.customFrameDelay = Math.round(1000 / fps);
    elements.speedValue.textContent = fps;
    state.frameDelays = state.frameDelays.map(() => state.customFrameDelay);
});

// Color grouping controls
elements.groupingToggle.addEventListener('change', (e) => {
    state.colorGroupingEnabled = e.target.checked;
    elements.groupingThresholdContainer.classList.toggle('hidden', !e.target.checked);

    // Clear selections when toggling
    state.selectedColor = null;
    state.selectedGroup = null;
    elements.applySwapBtn.disabled = true;
    elements.originalColorEl.style.background = '#888';

    renderPalette();
});

elements.groupingThreshold.addEventListener('input', (e) => {
    state.colorGroupingThreshold = parseInt(e.target.value);
    elements.thresholdValue.textContent = e.target.value;

    // Clear selection and re-render
    state.selectedGroup = null;
    elements.applySwapBtn.disabled = true;
    elements.originalColorEl.style.background = '#888';

    renderPalette();
});

// Ctrl+scroll zoom functionality
elements.previewContainer.addEventListener('wheel', (e) => {
    if (e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -1 : 1;
        const oldZoom = state.zoom;
        state.zoom = Math.max(1, Math.min(50, state.zoom + delta));

        if (state.zoom !== oldZoom) {
            elements.zoomSlider.value = state.zoom;
            elements.zoomValue.textContent = state.zoom;

            const scrollXRatio = elements.previewContainer.scrollWidth > elements.previewContainer.clientWidth
                ? elements.previewContainer.scrollLeft / (elements.previewContainer.scrollWidth - elements.previewContainer.clientWidth)
                : 0.5;
            const scrollYRatio = elements.previewContainer.scrollHeight > elements.previewContainer.clientHeight
                ? elements.previewContainer.scrollTop / (elements.previewContainer.scrollHeight - elements.previewContainer.clientHeight)
                : 0.5;

            updateCanvasSize();
            renderCurrentFrame();

            requestAnimationFrame(() => {
                if (elements.previewContainer.scrollWidth > elements.previewContainer.clientWidth) {
                    elements.previewContainer.scrollLeft = scrollXRatio * (elements.previewContainer.scrollWidth - elements.previewContainer.clientWidth);
                }
                if (elements.previewContainer.scrollHeight > elements.previewContainer.clientHeight) {
                    elements.previewContainer.scrollTop = scrollYRatio * (elements.previewContainer.scrollHeight - elements.previewContainer.clientHeight);
                }
            });
        }
    }
}, { passive: false });

// Ctrl+drag pan functionality
let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let panScrollStartX = 0;
let panScrollStartY = 0;

elements.previewContainer.addEventListener('mousedown', (e) => {
    if (e.ctrlKey && e.button === 0) {
        isPanning = true;
        panStartX = e.clientX;
        panStartY = e.clientY;
        panScrollStartX = elements.previewContainer.scrollLeft;
        panScrollStartY = elements.previewContainer.scrollTop;
        elements.previewContainer.style.cursor = 'grabbing';
        e.preventDefault();
    }
});

document.addEventListener('mousemove', (e) => {
    if (isPanning) {
        const dx = e.clientX - panStartX;
        const dy = e.clientY - panStartY;
        elements.previewContainer.scrollLeft = panScrollStartX - dx;
        elements.previewContainer.scrollTop = panScrollStartY - dy;
    }
});

document.addEventListener('mouseup', () => {
    if (isPanning) {
        isPanning = false;
        elements.previewContainer.style.cursor = '';
    }
});

elements.paletteSourceUpload.addEventListener('click', () => elements.paletteSourceInput.click());
elements.paletteSourceInput.addEventListener('change', handlePaletteSourceUpload);
elements.clearPaletteSourceBtn.addEventListener('click', clearPaletteSource);

elements.paletteSourceUpload.addEventListener('dragover', (e) => {
    e.preventDefault();
    elements.paletteSourceUpload.style.borderColor = '#e94560';
});
elements.paletteSourceUpload.addEventListener('dragleave', () => {
    elements.paletteSourceUpload.style.borderColor = state.sourcePaletteColors.size > 0 ? '#4caf50' : '#555';
});
elements.paletteSourceUpload.addEventListener('drop', async (e) => {
    e.preventDefault();
    elements.paletteSourceUpload.style.borderColor = state.sourcePaletteColors.size > 0 ? '#4caf50' : '#555';
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        const { loadPaletteSourceImage } = await import('./js/palette.js');
        loadPaletteSourceImage(file);
    }
});

// Canvas mouse events
elements.previewCanvas.addEventListener('click', (e) => {
    if (state.currentFrames.length === 0) return;
    if (state.currentTool !== 'none') return;

    const rect = elements.previewCanvas.getBoundingClientRect();
    const imgX = Math.floor(((e.clientX - rect.left) / rect.width) * state.gifWidth);
    const imgY = Math.floor(((e.clientY - rect.top) / rect.height) * state.gifHeight);

    if (imgX < 0 || imgX >= state.gifWidth || imgY < 0 || imgY >= state.gifHeight) return;

    const frameData = state.currentFrames[state.currentFrameIndex];
    const pixelIndex = (imgY * state.gifWidth + imgX) * 4;
    const r = frameData[pixelIndex];
    const g = frameData[pixelIndex + 1];
    const b = frameData[pixelIndex + 2];
    const a = frameData[pixelIndex + 3];

    if (a === 0) return;

    const colorKey = `${r},${g},${b}`;
    const colorItem = document.querySelector(`.color-item[data-color="${colorKey}"]`);
    if (colorItem) {
        selectColor(colorKey, colorItem);
        colorItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
});

elements.previewCanvas.addEventListener('mousedown', (e) => {
    if (state.currentFrames.length === 0) return;

    const rect = elements.previewCanvas.getBoundingClientRect();
    const imgX = Math.floor(((e.clientX - rect.left) / rect.width) * state.gifWidth);
    const imgY = Math.floor(((e.clientY - rect.top) / rect.height) * state.gifHeight);

    if (imgX < 0 || imgX >= state.gifWidth || imgY < 0 || imgY >= state.gifHeight) return;

    if (state.currentTool === 'rect') {
        state.isDrawingSelection = true;
        state.selectionStart = { x: imgX, y: imgY };
        state.selectionEnd = { x: imgX, y: imgY };
        renderSelectionOverlay();
    } else if (state.currentTool === 'poly') {
        state.polygonPoints.push({ x: imgX, y: imgY });
        state.tempPolygonPoint = null;
        renderSelectionOverlay();
        updateSelectionInfo();
    }
});

elements.previewCanvas.addEventListener('mousemove', (e) => {
    if (state.currentFrames.length === 0) return;

    const rect = elements.previewCanvas.getBoundingClientRect();
    const imgX = Math.max(0, Math.min(state.gifWidth - 1, Math.floor(((e.clientX - rect.left) / rect.width) * state.gifWidth)));
    const imgY = Math.max(0, Math.min(state.gifHeight - 1, Math.floor(((e.clientY - rect.top) / rect.height) * state.gifHeight)));

    if (state.currentTool === 'rect' && state.isDrawingSelection) {
        state.selectionEnd = { x: imgX, y: imgY };
        renderSelectionOverlay();
    } else if (state.currentTool === 'poly' && state.polygonPoints.length > 0) {
        state.tempPolygonPoint = { x: imgX, y: imgY };
        renderSelectionOverlay();
    }
});

elements.previewCanvas.addEventListener('mouseup', (e) => {
    if (state.currentTool === 'rect' && state.isDrawingSelection) {
        state.isDrawingSelection = false;
        applyRectangleSelection(state.selectionStart.x, state.selectionStart.y, state.selectionEnd.x, state.selectionEnd.y);
        renderSelectionOverlay();
    }
});

elements.previewCanvas.addEventListener('mouseleave', () => {
    if (state.currentTool === 'rect' && state.isDrawingSelection) {
        state.isDrawingSelection = false;
        applyRectangleSelection(state.selectionStart.x, state.selectionStart.y, state.selectionEnd.x, state.selectionEnd.y);
        renderSelectionOverlay();
    }
});

elements.previewCanvas.addEventListener('dblclick', (e) => {
    if (state.currentTool === 'poly' && state.polygonPoints.length >= 3) {
        applyPolygonSelection(state.polygonPoints);
        state.polygonPoints = [];
        state.tempPolygonPoint = null;
        renderSelectionOverlay();
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && state.currentTool === 'poly' && state.polygonPoints.length >= 3) {
        applyPolygonSelection(state.polygonPoints);
        state.polygonPoints = [];
        state.tempPolygonPoint = null;
        renderSelectionOverlay();
    } else if (e.key === 'Escape') {
        if (state.currentTool === 'poly' && state.polygonPoints.length > 0) {
            state.polygonPoints = [];
            state.tempPolygonPoint = null;
            renderSelectionOverlay();
            updateSelectionInfo();
        } else if (state.isDrawingSelection) {
            state.isDrawingSelection = false;
            renderSelectionOverlay();
        }
    }
});

// Logic functions
function applyColorSwap() {
    // Handle group swap if in grouping mode with a selected group
    if (state.colorGroupingEnabled && state.selectedGroup !== null) {
        applyGroupSwap();
        return;
    }

    if (!state.selectedColor) return;

    const [oldR, oldG, oldB] = state.selectedColor.split(',').map(Number);
    const newHex = elements.newColorPicker.value;
    const newR = parseInt(newHex.slice(1, 3), 16);
    const newG = parseInt(newHex.slice(3, 5), 16);
    const newB = parseInt(newHex.slice(5, 7), 16);

    if (oldR === newR && oldG === newG && oldB === newB) return;

    const hasSelection = state.selectionMask && state.selectionMask.some(v => v === 1);
    const oldHex = rgbToHex(oldR, oldG, oldB);
    const swapEntry = {
        from: { r: oldR, g: oldG, b: oldB, hex: oldHex },
        to: { r: newR, g: newG, b: newB, hex: newHex },
        hasSelection: hasSelection
    };

    if (hasSelection) {
        const selectedIndices = [];
        for (let i = 0; i < state.selectionMask.length; i++) {
            if (state.selectionMask[i] === 1) selectedIndices.push(i);
        }
        swapEntry.selectedIndices = selectedIndices;
    }

    state.colorSwapHistory.push(swapEntry);

    for (const frameData of state.currentFrames) {
        for (let i = 0; i < frameData.length; i += 4) {
            const pixelIndex = i / 4;
            if (hasSelection && state.selectionMask[pixelIndex] === 0) continue;
            if (frameData[i] === oldR && frameData[i + 1] === oldG && frameData[i + 2] === oldB) {
                frameData[i] = newR;
                frameData[i + 1] = newG;
                frameData[i + 2] = newB;
            }
        }
    }

    extractPalette();
    renderCurrentFrame();
    updateSwapHistoryDisplay();
    state.selectedColor = null;
    elements.applySwapBtn.disabled = true;
    elements.originalColorEl.style.background = '#888';
}

function applyGroupSwap() {
    const groupIndex = state.selectedGroup;
    const groupKeys = state.colorGroups[groupIndex];

    if (!groupKeys || groupKeys.length === 0) return;

    // Get the target color from the picker
    const newHex = elements.newColorPicker.value;
    const targetR = parseInt(newHex.slice(1, 3), 16);
    const targetG = parseInt(newHex.slice(3, 5), 16);
    const targetB = parseInt(newHex.slice(5, 7), 16);

    // Calculate the color mapping for each color in the group
    const colorMappings = calculateGradientMapping(groupKeys, targetR, targetG, targetB);

    const hasSelection = state.selectionMask && state.selectionMask.some(v => v === 1);

    // Record each individual color swap in history (for undo compatibility)
    for (const [oldKey, newColor] of colorMappings) {
        const [oldR, oldG, oldB] = oldKey.split(',').map(Number);

        // Skip if color didn't change
        if (oldR === newColor.r && oldG === newColor.g && oldB === newColor.b) continue;

        const swapEntry = {
            from: { r: oldR, g: oldG, b: oldB, hex: rgbToHex(oldR, oldG, oldB) },
            to: { r: newColor.r, g: newColor.g, b: newColor.b, hex: rgbToHex(newColor.r, newColor.g, newColor.b) },
            hasSelection: hasSelection
        };

        if (hasSelection) {
            const selectedIndices = [];
            for (let i = 0; i < state.selectionMask.length; i++) {
                if (state.selectionMask[i] === 1) selectedIndices.push(i);
            }
            swapEntry.selectedIndices = selectedIndices;
        }

        state.colorSwapHistory.push(swapEntry);
    }

    // Apply the mappings to all frames
    for (const frameData of state.currentFrames) {
        for (let i = 0; i < frameData.length; i += 4) {
            const pixelIndex = i / 4;
            if (hasSelection && state.selectionMask[pixelIndex] === 0) continue;

            const colorKey = `${frameData[i]},${frameData[i + 1]},${frameData[i + 2]}`;
            const mapping = colorMappings.get(colorKey);

            if (mapping) {
                frameData[i] = mapping.r;
                frameData[i + 1] = mapping.g;
                frameData[i + 2] = mapping.b;
            }
        }
    }

    extractPalette();
    renderCurrentFrame();
    updateSwapHistoryDisplay();
    state.selectedGroup = null;
    elements.applySwapBtn.disabled = true;
    elements.originalColorEl.style.background = '#888';
}

/**
 * Calculate how to map each color in a gradient group to preserve the gradient structure
 * Strategy: Calculate the LAB-space offset from the anchor color to target,
 * then apply that offset to all colors in the group
 */
function calculateGradientMapping(groupKeys, targetR, targetG, targetB) {
    const mappings = new Map();

    // Get the original colors with their LAB values
    const originalColors = groupKeys.map(key => {
        const [r, g, b] = key.split(',').map(Number);
        const lab = rgbToLab(r, g, b);
        return { key, r, g, b, lab };
    });

    // Find the middle color (our "anchor" - the one displayed in the UI)
    const middleIndex = Math.floor(originalColors.length / 2);
    const anchorColor = originalColors[middleIndex];

    // Calculate the shift in LAB space
    const targetLab = rgbToLab(targetR, targetG, targetB);
    const deltaL = targetLab.L - anchorColor.lab.L;
    const deltaA = targetLab.a - anchorColor.lab.a;
    const deltaB = targetLab.b - anchorColor.lab.b;

    // Apply the shift to all colors in the group
    for (const color of originalColors) {
        const newL = Math.max(0, Math.min(100, color.lab.L + deltaL));
        const newA = color.lab.a + deltaA;
        const newB = color.lab.b + deltaB;

        const newRgb = labToRgb(newL, newA, newB);

        mappings.set(color.key, {
            r: newRgb.r,
            g: newRgb.g,
            b: newRgb.b
        });
    }

    return mappings;
}

function resetChanges() {
    for (let i = 0; i < state.originalFrames.length; i++) {
        state.currentFrames[i] = new Uint8ClampedArray(state.originalFrames[i]);
    }
    state.colorSwapHistory = [];
    state.selectionMask = null;
    state.polygonPoints = [];
    state.tempPolygonPoint = null;
    extractPalette();
    renderCurrentFrame();
    renderSelectionOverlay();
    updateSwapHistoryDisplay();
    updateSelectionInfo();
    state.selectedColor = null;
    state.selectedGroup = null;
    elements.applySwapBtn.disabled = true;
    elements.originalColorEl.style.background = '#888';
}

function updateSwapHistoryDisplay() {
    if (state.colorSwapHistory.length === 0) {
        elements.swapHistoryEl.innerHTML = '<em>No swaps yet</em>';
        return;
    }

    elements.swapHistoryEl.innerHTML = state.colorSwapHistory.map((swap, i) =>
        `<div style="display: flex; align-items: center; gap: 5px; margin: 3px 0;">
            <span style="width: 14px; height: 14px; background: ${swap.from.hex}; border: 1px solid #555; border-radius: 2px;"></span>
            →
            <span style="width: 14px; height: 14px; background: ${swap.to.hex}; border: 1px solid #555; border-radius: 2px;"></span>
            <span style="color: #666; flex: 1;">${swap.from.hex} → ${swap.to.hex}</span>
            <button onclick="undoSingleSwap(${i})" style="padding: 2px 6px; font-size: 10px; background: #555; border-radius: 3px; cursor: pointer;" title="Undo this swap">✕</button>
        </div>`
    ).join('');
}

function undoSingleSwap(index) {
    if (index < 0 || index >= state.colorSwapHistory.length) return;

    state.colorSwapHistory.splice(index, 1);

    for (let i = 0; i < state.originalFrames.length; i++) {
        state.currentFrames[i] = new Uint8ClampedArray(state.originalFrames[i]);
    }

    for (const swap of state.colorSwapHistory) {
        const oldR = swap.from.r;
        const oldG = swap.from.g;
        const oldB = swap.from.b;
        const newR = swap.to.r;
        const newG = swap.to.g;
        const newB = swap.to.b;

        const selectedSet = swap.selectedIndices ? new Set(swap.selectedIndices) : null;

        for (const frameData of state.currentFrames) {
            for (let i = 0; i < frameData.length; i += 4) {
                if (selectedSet && !selectedSet.has(i / 4)) continue;
                if (frameData[i] === oldR && frameData[i + 1] === oldG && frameData[i + 2] === oldB) {
                    frameData[i] = newR;
                    frameData[i + 1] = newG;
                    frameData[i + 2] = newB;
                }
            }
        }
    }

    extractPalette();
    renderCurrentFrame();
    updateSwapHistoryDisplay();
    state.selectedColor = null;
    state.selectedGroup = null;
    elements.applySwapBtn.disabled = true;
    elements.originalColorEl.style.background = '#888';
}

window.undoSingleSwap = undoSingleSwap;
