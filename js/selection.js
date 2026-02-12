import { state } from './state.js';
import { elements } from './dom.js';

export function selectTool(tool) {
    state.currentTool = tool;
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    if (tool === 'none') {
        elements.toolNoneBtn.classList.add('active');
        elements.previewCanvas.style.cursor = 'crosshair';
    } else if (tool === 'rect') {
        elements.toolRectBtn.classList.add('active');
        elements.previewCanvas.style.cursor = 'crosshair';
    } else if (tool === 'poly') {
        elements.toolPolyBtn.classList.add('active');
        elements.previewCanvas.style.cursor = 'crosshair';
    } else if (tool === 'pencil') {
        elements.toolPencilBtn.classList.add('active');
        elements.previewCanvas.style.cursor = 'crosshair';
    } else if (tool === 'eraser') {
        elements.toolEraserBtn.classList.add('active');
        elements.previewCanvas.style.cursor = 'crosshair';
    }

    state.isPainting = false;
    state.activePaintTool = null;
    state.strokeSelectionSet = null;
    state.strokePixelMap.clear();

    // Reset polygon points when switching tools
    if (tool !== 'poly') {
        state.polygonPoints = [];
        state.tempPolygonPoint = null;
    }
    renderSelectionOverlay();
    updateSelectionInfo();
}

export function updateSelectionInfo() {
    const hasSelection = state.selectionMask && state.selectionMask.some(v => v === 1);
    elements.invertSelectionBtn.disabled = !hasSelection;
    elements.clearSelectionBtn.disabled = !hasSelection;

    if (!hasSelection) {
        if (state.currentTool === 'none') {
            elements.selectionInfo.textContent = 'No selection - color swaps will apply to entire image';
        } else if (state.currentTool === 'rect') {
            elements.selectionInfo.textContent = 'Click and drag to create a rectangle selection';
        } else if (state.currentTool === 'poly') {
            elements.selectionInfo.textContent = 'Click to add points, double-click or press Enter to close polygon';
        } else if (state.currentTool === 'pencil') {
            elements.selectionInfo.textContent = 'Click and drag to draw 1x1 pixels with the selected color';
        } else if (state.currentTool === 'eraser') {
            elements.selectionInfo.textContent = 'Click and drag to erase 1x1 pixels to transparency';
        }
    } else {
        const selectedCount = state.selectionMask.filter(v => v === 1).length;
        const totalPixels = state.gifWidth * state.gifHeight;
        const percent = ((selectedCount / totalPixels) * 100).toFixed(1);
        elements.selectionInfo.textContent = `${selectedCount} pixels selected (${percent}% of image)`;
    }
}

export function clearSelection() {
    state.selectionMask = null;
    state.polygonPoints = [];
    state.tempPolygonPoint = null;
    renderSelectionOverlay();
    updateSelectionInfo();
}

export function invertSelection() {
    if (!state.selectionMask) return;
    for (let i = 0; i < state.selectionMask.length; i++) {
        state.selectionMask[i] = state.selectionMask[i] === 1 ? 0 : 1;
    }
    renderSelectionOverlay();
    updateSelectionInfo();
}

export function createSelectionMask() {
    if (!state.selectionMask || state.selectionMask.length !== state.gifWidth * state.gifHeight) {
        state.selectionMask = new Uint8Array(state.gifWidth * state.gifHeight);
    }
    state.selectionMask.fill(0);
}

export function applyRectangleSelection(x1, y1, x2, y2) {
    createSelectionMask();
    const minX = Math.max(0, Math.min(x1, x2));
    const maxX = Math.min(state.gifWidth - 1, Math.max(x1, x2));
    const minY = Math.max(0, Math.min(y1, y2));
    const maxY = Math.min(state.gifHeight - 1, Math.max(y1, y2));

    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            state.selectionMask[y * state.gifWidth + x] = 1;
        }
    }
    updateSelectionInfo();
}

export function applyPolygonSelection(points) {
    if (points.length < 3) return;
    createSelectionMask();

    // Point-in-polygon test using ray casting
    for (let y = 0; y < state.gifHeight; y++) {
        for (let x = 0; x < state.gifWidth; x++) {
            if (isPointInPolygon(x + 0.5, y + 0.5, points)) {
                state.selectionMask[y * state.gifWidth + x] = 1;
            }
        }
    }
    updateSelectionInfo();
}

function isPointInPolygon(x, y, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;

        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
            inside = !inside;
        }
    }
    return inside;
}

export function renderSelectionOverlay() {
    elements.selectionCanvas.width = elements.previewCanvas.width;
    elements.selectionCanvas.height = elements.previewCanvas.height;
    elements.selectionCtx.clearRect(0, 0, elements.selectionCanvas.width, elements.selectionCanvas.height);

    // Draw the selection mask with marching ants effect
    if (state.selectionMask && state.selectionMask.some(v => v === 1)) {
        // Create a semi-transparent overlay for non-selected areas
        elements.selectionCtx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        for (let y = 0; y < state.gifHeight; y++) {
            for (let x = 0; x < state.gifWidth; x++) {
                if (state.selectionMask[y * state.gifWidth + x] === 0) {
                    elements.selectionCtx.fillRect(x * state.zoom, y * state.zoom, state.zoom, state.zoom);
                }
            }
        }

        // Draw selection border (marching ants style)
        elements.selectionCtx.strokeStyle = '#fff';
        elements.selectionCtx.lineWidth = 1;
        elements.selectionCtx.setLineDash([4, 4]);
        elements.selectionCtx.lineDashOffset = -(Date.now() / 50) % 8;

        // Find and draw selection edges
        for (let y = 0; y < state.gifHeight; y++) {
            for (let x = 0; x < state.gifWidth; x++) {
                if (state.selectionMask[y * state.gifWidth + x] === 1) {
                    const px = x * state.zoom;
                    const py = y * state.zoom;
                    // Check if edge pixel
                    if (x === 0 || state.selectionMask[y * state.gifWidth + (x - 1)] === 0) {
                        elements.selectionCtx.beginPath();
                        elements.selectionCtx.moveTo(px, py);
                        elements.selectionCtx.lineTo(px, py + state.zoom);
                        elements.selectionCtx.stroke();
                    }
                    if (x === state.gifWidth - 1 || state.selectionMask[y * state.gifWidth + (x + 1)] === 0) {
                        elements.selectionCtx.beginPath();
                        elements.selectionCtx.moveTo(px + state.zoom, py);
                        elements.selectionCtx.lineTo(px + state.zoom, py + state.zoom);
                        elements.selectionCtx.stroke();
                    }
                    if (y === 0 || state.selectionMask[(y - 1) * state.gifWidth + x] === 0) {
                        elements.selectionCtx.beginPath();
                        elements.selectionCtx.moveTo(px, py);
                        elements.selectionCtx.lineTo(px + state.zoom, py);
                        elements.selectionCtx.stroke();
                    }
                    if (y === state.gifHeight - 1 || state.selectionMask[(y + 1) * state.gifWidth + x] === 0) {
                        elements.selectionCtx.beginPath();
                        elements.selectionCtx.moveTo(px, py + state.zoom);
                        elements.selectionCtx.lineTo(px + state.zoom, py + state.zoom);
                        elements.selectionCtx.stroke();
                    }
                }
            }
        }
    }

    // Draw rectangle preview while dragging
    if (state.currentTool === 'rect' && state.isDrawingSelection) {
        const minX = Math.min(state.selectionStart.x, state.selectionEnd.x) * state.zoom;
        const minY = Math.min(state.selectionStart.y, state.selectionEnd.y) * state.zoom;
        const width = (Math.abs(state.selectionEnd.x - state.selectionStart.x) + 1) * state.zoom;
        const height = (Math.abs(state.selectionEnd.y - state.selectionStart.y) + 1) * state.zoom;

        elements.selectionCtx.strokeStyle = '#e94560';
        elements.selectionCtx.lineWidth = 2;
        elements.selectionCtx.setLineDash([5, 5]);
        elements.selectionCtx.strokeRect(minX, minY, width, height);

        elements.selectionCtx.fillStyle = 'rgba(233, 69, 96, 0.2)';
        elements.selectionCtx.fillRect(minX, minY, width, height);
    }

    // Draw polygon preview
    if (state.currentTool === 'poly' && state.polygonPoints.length > 0) {
        elements.selectionCtx.strokeStyle = '#e94560';
        elements.selectionCtx.lineWidth = 2;
        elements.selectionCtx.setLineDash([]);
        elements.selectionCtx.fillStyle = 'rgba(233, 69, 96, 0.2)';

        elements.selectionCtx.beginPath();
        elements.selectionCtx.moveTo((state.polygonPoints[0].x + 0.5) * state.zoom, (state.polygonPoints[0].y + 0.5) * state.zoom);

        for (let i = 1; i < state.polygonPoints.length; i++) {
            elements.selectionCtx.lineTo((state.polygonPoints[i].x + 0.5) * state.zoom, (state.polygonPoints[i].y + 0.5) * state.zoom);
        }

        if (state.tempPolygonPoint) {
            elements.selectionCtx.lineTo((state.tempPolygonPoint.x + 0.5) * state.zoom, (state.tempPolygonPoint.y + 0.5) * state.zoom);
        }

        if (state.polygonPoints.length >= 3) {
            elements.selectionCtx.closePath();
            elements.selectionCtx.fill();
        }
        elements.selectionCtx.stroke();

        // Draw points
        for (const pt of state.polygonPoints) {
            elements.selectionCtx.fillStyle = '#e94560';
            elements.selectionCtx.beginPath();
            elements.selectionCtx.arc((pt.x + 0.5) * state.zoom, (pt.y + 0.5) * state.zoom, 4, 0, Math.PI * 2);
            elements.selectionCtx.fill();
            elements.selectionCtx.strokeStyle = '#fff';
            elements.selectionCtx.lineWidth = 1;
            elements.selectionCtx.stroke();
        }
    }
}

export function startMarchingAnts() {
    setInterval(() => {
        if (state.selectionMask && state.selectionMask.some(v => v === 1)) {
            renderSelectionOverlay();
        }
    }, 100);
}
