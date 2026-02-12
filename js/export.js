import { state } from './state.js';
import { elements } from './dom.js';
import { extractPalette } from './palette.js';
import { renderCurrentFrame, updateCanvasSize } from './animation.js';
import { resizeFramesNearestNeighbor } from './utils.js';

function applySwapEntryToFrames(swapEntry) {
    const oldR = swapEntry.from.r;
    const oldG = swapEntry.from.g;
    const oldB = swapEntry.from.b;
    const newR = swapEntry.to.r;
    const newG = swapEntry.to.g;
    const newB = swapEntry.to.b;
    const selectedSet = swapEntry.hasSelection && swapEntry.selectedIndices
        ? new Set(swapEntry.selectedIndices)
        : null;

    let changed = false;

    for (const frameData of state.currentFrames) {
        for (let i = 0; i < frameData.length; i += 4) {
            const pixelIndex = i / 4;
            if (selectedSet && !selectedSet.has(pixelIndex)) continue;
            if (frameData[i] === oldR && frameData[i + 1] === oldG && frameData[i + 2] === oldB) {
                frameData[i] = newR;
                frameData[i + 1] = newG;
                frameData[i + 2] = newB;
                changed = true;
            }
        }
    }

    return changed;
}

function applyReductionEntryToFrames(reductionEntry) {
    const selectedSet = reductionEntry.hasSelection && reductionEntry.selectedIndices
        ? new Set(reductionEntry.selectedIndices)
        : null;

    let changed = false;

    for (const frameData of state.currentFrames) {
        for (let i = 0; i < frameData.length; i += 4) {
            const pixelIndex = i / 4;
            if (selectedSet && !selectedSet.has(pixelIndex)) continue;
            if (frameData[i + 3] === 0) continue;

            const colorKey = `${frameData[i]},${frameData[i + 1]},${frameData[i + 2]}`;
            const mappedColor = reductionEntry.colorMap?.[colorKey];
            if (!mappedColor) continue;

            if (frameData[i] !== mappedColor.r || frameData[i + 1] !== mappedColor.g || frameData[i + 2] !== mappedColor.b) {
                frameData[i] = mappedColor.r;
                frameData[i + 1] = mappedColor.g;
                frameData[i + 2] = mappedColor.b;
                changed = true;
            }
        }
    }

    return changed;
}

function applyPaintEntryToFrames(paintEntry) {
    const frameData = state.currentFrames[paintEntry.frameIndex];
    if (!frameData || !Array.isArray(paintEntry.pixels)) return false;

    let changed = false;

    for (const change of paintEntry.pixels) {
        const dataIndex = change.pixelIndex * 4;
        if (dataIndex < 0 || dataIndex + 3 >= frameData.length) continue;

        const to = change.to;
        if (!to) continue;

        if (frameData[dataIndex] !== to.r || frameData[dataIndex + 1] !== to.g || frameData[dataIndex + 2] !== to.b || frameData[dataIndex + 3] !== to.a) {
            frameData[dataIndex] = to.r;
            frameData[dataIndex + 1] = to.g;
            frameData[dataIndex + 2] = to.b;
            frameData[dataIndex + 3] = to.a;
            changed = true;
        }
    }

    return changed;
}

function applyResizeEntryToFrames(resizeEntry) {
    const fromWidth = resizeEntry.fromWidth || state.gifWidth;
    const fromHeight = resizeEntry.fromHeight || state.gifHeight;
    const toWidth = resizeEntry.toWidth;
    const toHeight = resizeEntry.toHeight;

    if (!toWidth || !toHeight || toWidth < 1 || toHeight < 1) return false;

    state.currentFrames = resizeFramesNearestNeighbor(
        state.currentFrames,
        fromWidth,
        fromHeight,
        toWidth,
        toHeight
    );
    state.gifWidth = toWidth;
    state.gifHeight = toHeight;
    return true;
}

function applyTransparencyCleanupEntryToFrames(cleanupEntry) {
    const selectedSet = cleanupEntry.hasSelection && cleanupEntry.selectedIndices
        ? new Set(cleanupEntry.selectedIndices)
        : null;
    const thresholdAlpha = cleanupEntry.thresholdAlpha ?? Math.round((cleanupEntry.thresholdPercent / 100) * 255);

    let changed = false;

    for (const frameData of state.currentFrames) {
        for (let i = 0; i < frameData.length; i += 4) {
            const pixelIndex = i / 4;
            if (selectedSet && !selectedSet.has(pixelIndex)) continue;

            const alpha = frameData[i + 3];
            if (alpha > 0 && alpha < thresholdAlpha) {
                frameData[i] = 0;
                frameData[i + 1] = 0;
                frameData[i + 2] = 0;
                frameData[i + 3] = 0;
                changed = true;
            }
        }
    }

    return changed;
}

function applyEditEntry(entry) {
    if (entry.type === 'swap' && entry.swap?.from && entry.swap?.to) {
        return applySwapEntryToFrames(entry.swap);
    }

    if (entry.type === 'reduction' && entry.colorMap) {
        return applyReductionEntryToFrames(entry);
    }

    if (entry.type === 'paint') {
        return applyPaintEntryToFrames(entry);
    }

    if (entry.type === 'resize') {
        return applyResizeEntryToFrames(entry);
    }

    if (entry.type === 'transparency_cleanup') {
        return applyTransparencyCleanupEntryToFrames(entry);
    }

    return false;
}

export function exportCurrentFrame() {
    if (state.currentFrames.length === 0) {
        alert('No image loaded!');
        return;
    }

    const frameData = state.currentFrames[state.currentFrameIndex];
    const imageData = new ImageData(new Uint8ClampedArray(frameData), state.gifWidth, state.gifHeight);

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = state.gifWidth;
    tempCanvas.height = state.gifHeight;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.imageSmoothingEnabled = false;
    tempCtx.putImageData(imageData, 0, 0);

    const url = tempCanvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    const frameNum = state.currentFrames.length > 1 ? `-frame${state.currentFrameIndex + 1}` : '';
    const fileName = state.projectName || 'palette-swapped';
    a.download = `${fileName}${frameNum}.png`;
    a.click();
}

export async function exportPngSequence() {
    elements.exportPngBtn.disabled = true;
    elements.exportPngBtn.textContent = '⏳ Exporting...';

    try {
        if (state.currentFrames.length === 1) {
            const frameData = state.currentFrames[0];
            const imageData = new ImageData(new Uint8ClampedArray(frameData), state.gifWidth, state.gifHeight);
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = state.gifWidth;
            tempCanvas.height = state.gifHeight;
            tempCanvas.getContext('2d').putImageData(imageData, 0, 0);
            const url = tempCanvas.toDataURL('image/png');
            const a = document.createElement('a');
            a.href = url;
            const fileName = state.projectName || 'palette-swapped';
            a.download = `${fileName}.png`;
            a.click();
        } else {
            const zip = new JSZip();
            const folder = zip.folder('frames');

            for (let i = 0; i < state.currentFrames.length; i++) {
                const frameData = state.currentFrames[i];
                const imageData = new ImageData(new Uint8ClampedArray(frameData), state.gifWidth, state.gifHeight);
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = state.gifWidth;
                tempCanvas.height = state.gifHeight;
                tempCanvas.getContext('2d').putImageData(imageData, 0, 0);
                const dataUrl = tempCanvas.toDataURL('image/png');
                const base64Data = dataUrl.split(',')[1];
                folder.file(`frame-${String(i + 1).padStart(4, '0')}.png`, base64Data, { base64: true });
            }

            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(zipBlob);
            const a = document.createElement('a');
            a.href = url;
            const fileName = state.projectName || 'palette-swapped';
            a.download = `${fileName}-frames.zip`;
            a.click();
            URL.revokeObjectURL(url);
        }
    } catch (error) {
        console.error('Export error:', error);
        alert('Error exporting PNGs: ' + error.message);
    } finally {
        elements.exportPngBtn.disabled = false;
        elements.exportPngBtn.textContent = '🖼️ Export PNGs';
    }
}

export function exportPreset() {
    const exportedEdits = state.editHistory.filter((entry) => (
        entry.type === 'swap' ||
        entry.type === 'reduction' ||
        entry.type === 'paint' ||
        entry.type === 'resize' ||
        entry.type === 'transparency_cleanup'
    ));

    if (exportedEdits.length === 0) {
        alert('No edits to export! Make some changes first.');
        return;
    }

    const preset = {
        name: 'Edit Preset',
        created: new Date().toISOString(),
        version: 4,
        edits: exportedEdits,
        swaps: state.colorSwapHistory
    };

    const blob = new Blob([JSON.stringify(preset, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const fileName = state.projectName || 'color-swap-preset';
    a.download = `${fileName}-preset.json`;
    a.click();
    URL.revokeObjectURL(url);
}

export async function importPreset(e, updateSwapHistoryDisplay) {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        const preset = JSON.parse(text);

        const hasEdits = Array.isArray(preset.edits);
        const hasSwaps = Array.isArray(preset.swaps);

        if (!hasEdits && !hasSwaps) {
            alert('Invalid preset file format');
            return;
        }

        state.gifWidth = state.originalWidth;
        state.gifHeight = state.originalHeight;
        state.currentFrames = state.originalFrames.map((frame) => new Uint8ClampedArray(frame));
        state.colorSwapHistory = [];
        state.editHistory = [];
        state.redoHistory = [];
        state.selectionMask = null;
        state.polygonPoints = [];
        state.tempPolygonPoint = null;
        state.isDrawingSelection = false;
        state.isPainting = false;
        state.activePaintTool = null;
        state.strokeSelectionSet = null;
        state.strokePixelMap.clear();

        let appliedEditCount = 0;
        let skippedEditCount = 0;

        if (hasEdits) {
            for (const entry of preset.edits) {
                const changed = applyEditEntry(entry);
                if (changed) {
                    state.editHistory.push(entry);
                    if (entry.type === 'swap' && entry.swap) {
                        state.colorSwapHistory.push(entry.swap);
                    }
                    appliedEditCount++;
                } else {
                    skippedEditCount++;
                }
            }

            updateCanvasSize();
            extractPalette();
            renderCurrentFrame();
            updateSwapHistoryDisplay();
            alert(`Preset applied!\n✅ ${appliedEditCount} edits applied\n⏭️ ${skippedEditCount} edits skipped`);
            e.target.value = '';
            return;
        }

        let appliedCount = 0;
        let skippedCount = 0;

        for (const swap of preset.swaps) {
            const changed = applySwapEntryToFrames(swap);
            if (changed) {
                state.colorSwapHistory.push(swap);
                state.editHistory.push({ type: 'swap', swap });
                appliedCount++;
            } else {
                skippedCount++;
            }
        }

        updateCanvasSize();
        extractPalette();
        renderCurrentFrame();
        updateSwapHistoryDisplay();
        alert(`Preset applied!\n✅ ${appliedCount} color swaps applied\n⏭️ ${skippedCount} colors not found (skipped)`);
    } catch (error) {
        console.error('Error importing preset:', error);
        alert('Error reading preset file: ' + error.message);
    }
    e.target.value = '';
}
