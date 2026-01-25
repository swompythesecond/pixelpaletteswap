import { state } from './state.js';
import { elements } from './dom.js';
import { extractPalette } from './palette.js';
import { renderCurrentFrame } from './animation.js';

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
    if (state.colorSwapHistory.length === 0) {
        alert('No color swaps to export! Make some color changes first.');
        return;
    }

    const preset = {
        name: 'Color Swap Preset',
        created: new Date().toISOString(),
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

        if (!preset.swaps || !Array.isArray(preset.swaps)) {
            alert('Invalid preset file format');
            return;
        }

        for (let i = 0; i < state.originalFrames.length; i++) {
            state.currentFrames[i] = new Uint8ClampedArray(state.originalFrames[i]);
        }
        state.colorSwapHistory = [];

        let appliedCount = 0;
        let skippedCount = 0;

        for (const swap of preset.swaps) {
            const { from, to } = swap;
            let found = false;
            const selectedSet = swap.selectedIndices ? new Set(swap.selectedIndices) : null;

            for (const frameData of state.currentFrames) {
                for (let i = 0; i < frameData.length; i += 4) {
                    const pixelIndex = i / 4;
                    if (selectedSet && !selectedSet.has(pixelIndex)) continue;
                    if (frameData[i] === from.r && frameData[i + 1] === from.g && frameData[i + 2] === from.b) {
                        found = true;
                        break;
                    }
                }
                if (found) break;
            }

            if (found) {
                for (const frameData of state.currentFrames) {
                    for (let i = 0; i < frameData.length; i += 4) {
                        const pixelIndex = i / 4;
                        if (selectedSet && !selectedSet.has(pixelIndex)) continue;
                        if (frameData[i] === from.r && frameData[i + 1] === from.g && frameData[i + 2] === from.b) {
                            frameData[i] = to.r;
                            frameData[i + 1] = to.g;
                            frameData[i + 2] = to.b;
                        }
                    }
                }
                state.colorSwapHistory.push(swap);
                appliedCount++;
            } else {
                skippedCount++;
            }
        }

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
