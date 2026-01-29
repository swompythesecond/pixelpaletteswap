import { state } from './state.js';
import { elements } from './dom.js';
import { rgbToHex, rgbToHsl, loadImageFromFile } from './utils.js';
import { computeColorGroups } from './grouping.js';

export function extractPalette() {
    state.colorPalette.clear();

    for (const frameData of state.currentFrames) {
        for (let i = 0; i < frameData.length; i += 4) {
            const r = frameData[i];
            const g = frameData[i + 1];
            const b = frameData[i + 2];
            const a = frameData[i + 3];

            if (a > 0) { // Only non-transparent pixels
                const colorKey = `${r},${g},${b}`;
                if (!state.colorPalette.has(colorKey)) {
                    state.colorPalette.set(colorKey, { r, g, b, count: 1 });
                } else {
                    state.colorPalette.get(colorKey).count++;
                }
            }
        }
    }

    renderPalette();
}

export function renderPalette() {
    elements.paletteGrid.innerHTML = '';

    if (state.colorGroupingEnabled) {
        // Compute groups and render in grouped mode
        computeColorGroups();

        elements.colorCount.textContent = state.colorGroups.length;
        elements.colorCountLabel.textContent = `groups (${state.colorPalette.size} colors)`;
        elements.paletteGrid.classList.add('grouped-mode');

        // Render each group
        state.colorGroups.forEach((groupKeys, groupIndex) => {
            const groupContainer = document.createElement('div');
            groupContainer.className = 'color-group-container';
            groupContainer.dataset.groupIndex = groupIndex;

            // Group label
            const label = document.createElement('div');
            label.className = 'group-label';
            label.textContent = `Group ${groupIndex + 1} (${groupKeys.length} color${groupKeys.length > 1 ? 's' : ''})`;
            groupContainer.appendChild(label);

            // Render colors in group (already sorted by lightness)
            groupKeys.forEach(colorKey => {
                const colorData = state.colorPalette.get(colorKey);
                const div = createColorElement(colorKey, colorData);
                div.addEventListener('click', (e) => {
                    e.stopPropagation();
                    selectGroup(groupIndex);
                });
                groupContainer.appendChild(div);
            });

            // Click handler for entire group container
            groupContainer.addEventListener('click', () => selectGroup(groupIndex));

            elements.paletteGrid.appendChild(groupContainer);
        });
    } else {
        // Original non-grouped behavior
        elements.colorCount.textContent = state.colorPalette.size;
        elements.colorCountLabel.textContent = 'colors';
        elements.paletteGrid.classList.remove('grouped-mode');
        state.selectedGroup = null;

        // Sort by color similarity using HSL
        const sortedColors = [...state.colorPalette.entries()].sort((a, b) => {
            const hslA = rgbToHsl(a[1].r, a[1].g, a[1].b);
            const hslB = rgbToHsl(b[1].r, b[1].g, b[1].b);

            if (Math.abs(hslA.h - hslB.h) > 0.02) return hslA.h - hslB.h;
            if (Math.abs(hslA.s - hslB.s) > 0.1) return hslB.s - hslA.s;
            return hslB.l - hslA.l;
        });

        for (const [colorKey, colorData] of sortedColors) {
            const div = createColorElement(colorKey, colorData);
            div.addEventListener('click', () => selectColor(colorKey, div));
            elements.paletteGrid.appendChild(div);
        }
    }
}

function createColorElement(colorKey, colorData) {
    const div = document.createElement('div');
    div.className = 'color-item';
    div.style.background = `rgb(${colorData.r}, ${colorData.g}, ${colorData.b})`;
    div.dataset.color = colorKey;

    const codeSpan = document.createElement('span');
    codeSpan.className = 'color-code';
    codeSpan.textContent = rgbToHex(colorData.r, colorData.g, colorData.b);
    div.appendChild(codeSpan);

    return div;
}

export function selectColor(colorKey, element) {
    // In grouping mode, clicking a color selects its group
    if (state.colorGroupingEnabled) {
        const groupIndex = state.colorKeyToGroupIndex.get(colorKey);
        if (groupIndex !== undefined) {
            selectGroup(groupIndex);
        }
        return;
    }

    // Original non-grouped behavior
    document.querySelectorAll('.color-item.selected').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
    state.selectedColor = colorKey;
    state.selectedGroup = null;

    const [r, g, b] = colorKey.split(',').map(Number);
    elements.originalColorEl.style.background = `rgb(${r}, ${g}, ${b})`;
    const hexColor = rgbToHex(r, g, b);
    elements.originalColorHex.value = hexColor.toUpperCase();
    elements.newColorPicker.value = hexColor;
    elements.newColorHex.value = hexColor.toUpperCase();

    elements.applySwapBtn.disabled = false;
}

export function selectGroup(groupIndex) {
    // Clear previous selections
    document.querySelectorAll('.color-group-container.selected').forEach(el => el.classList.remove('selected'));
    document.querySelectorAll('.color-item.group-selected').forEach(el => el.classList.remove('group-selected'));
    document.querySelectorAll('.color-item.selected').forEach(el => el.classList.remove('selected'));

    // Select new group
    const groupContainer = document.querySelector(`.color-group-container[data-group-index="${groupIndex}"]`);
    if (groupContainer) {
        groupContainer.classList.add('selected');
        groupContainer.querySelectorAll('.color-item').forEach(el => el.classList.add('group-selected'));
    }

    state.selectedGroup = groupIndex;
    state.selectedColor = null;

    // Show the "representative" color (middle of gradient) in the original color display
    const groupKeys = state.colorGroups[groupIndex];
    const middleIndex = Math.floor(groupKeys.length / 2);
    const middleKey = groupKeys[middleIndex];
    const [r, g, b] = middleKey.split(',').map(Number);

    elements.originalColorEl.style.background = `rgb(${r}, ${g}, ${b})`;
    const hexColor = rgbToHex(r, g, b);
    elements.originalColorHex.value = hexColor.toUpperCase();
    elements.newColorPicker.value = hexColor;
    elements.newColorHex.value = hexColor.toUpperCase();

    elements.applySwapBtn.disabled = false;
}

export async function handlePaletteSourceUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    await loadPaletteSourceImage(file);
    e.target.value = '';
}

export async function loadPaletteSourceImage(file) {
    try {
        const img = await loadImageFromFile(file);
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(img, 0, 0);

        const imageData = tempCtx.getImageData(0, 0, img.width, img.height);
        const data = imageData.data;

        state.sourcePaletteColors.clear();
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            if (a > 0) {
                const colorKey = `${r},${g},${b}`;
                if (!state.sourcePaletteColors.has(colorKey)) {
                    state.sourcePaletteColors.set(colorKey, { r, g, b, count: 1 });
                } else {
                    state.sourcePaletteColors.get(colorKey).count++;
                }
            }
        }

        updatePaletteSourceUI(img, file.name);
        renderSourcePalette();
    } catch (error) {
        console.error('Error loading palette source:', error);
        alert('Error loading image: ' + error.message);
    }
}

function updatePaletteSourceUI(img, fileName) {
    elements.paletteSourceContent.innerHTML = `
        <img src="${img.src}" class="palette-source-preview" alt="Palette source">
        <p style="margin: 0; font-size: 11px; color: #4caf50;">✓ ${fileName}</p>
        <p style="margin: 2px 0 0; font-size: 10px; color: #888;">${state.sourcePaletteColors.size} colors extracted</p>
    `;
    elements.paletteSourceUpload.classList.add('has-image');
    elements.sourcePaletteContainer.classList.remove('hidden');
}

export function renderSourcePalette() {
    elements.sourcePaletteGrid.innerHTML = '';
    const sortedColors = [...state.sourcePaletteColors.entries()].sort((a, b) => b[1].count - a[1].count);

    for (const [colorKey, colorData] of sortedColors) {
        const div = document.createElement('div');
        div.className = 'source-color-item';
        div.style.background = `rgb(${colorData.r}, ${colorData.g}, ${colorData.b})`;
        div.dataset.color = colorKey;
        div.title = rgbToHex(colorData.r, colorData.g, colorData.b);

        div.addEventListener('click', () => selectSourceColor(colorKey, div));
        elements.sourcePaletteGrid.appendChild(div);
    }
}

function selectSourceColor(colorKey, element) {
    document.querySelectorAll('.source-color-item.selected').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');

    const [r, g, b] = colorKey.split(',').map(Number);
    const hexColor = rgbToHex(r, g, b);
    elements.newColorPicker.value = hexColor;
    elements.newColorHex.value = hexColor.toUpperCase();
}

export function clearPaletteSource() {
    state.sourcePaletteColors.clear();
    elements.sourcePaletteGrid.innerHTML = '';
    elements.sourcePaletteContainer.classList.add('hidden');
    elements.paletteSourceUpload.classList.remove('has-image');
    elements.paletteSourceContent.innerHTML = `
        <div style="font-size: 24px;">🎨</div>
        <p style="margin: 5px 0 0; font-size: 12px; color: #888;">Click to upload palette image</p>
    `;
}
