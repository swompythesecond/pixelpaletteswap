import { state } from './state.js';
import { colorDistanceLab, rgbToLab } from './utils.js';

/**
 * Compute color groups using agglomerative clustering
 * Threshold is on 0-100 scale, mapped to Delta-E range
 */
export function computeColorGroups() {
    if (!state.colorGroupingEnabled || state.colorPalette.size === 0) {
        state.colorGroups = [];
        state.colorKeyToGroupIndex.clear();
        return;
    }

    // Map threshold 0-100 to Delta-E range 0-50
    const threshold = state.colorGroupingThreshold * 0.5;
    const colors = [...state.colorPalette.entries()];

    // Initialize: each color is its own group
    let groups = colors.map(([key, data]) => ({
        keys: [key],
        colors: [{ key, ...data }]
    }));

    // Agglomerative clustering: merge closest groups until none are within threshold
    while (groups.length > 1) {
        let minDist = Infinity;
        let mergeI = -1, mergeJ = -1;

        // Find closest pair of groups (single-linkage: minimum distance between any members)
        for (let i = 0; i < groups.length; i++) {
            for (let j = i + 1; j < groups.length; j++) {
                const dist = groupDistance(groups[i], groups[j]);
                if (dist < minDist) {
                    minDist = dist;
                    mergeI = i;
                    mergeJ = j;
                }
            }
        }

        // Stop if closest groups are too far apart
        if (minDist > threshold) break;

        // Merge groups
        groups[mergeI].keys.push(...groups[mergeJ].keys);
        groups[mergeI].colors.push(...groups[mergeJ].colors);
        groups.splice(mergeJ, 1);
    }

    // Sort colors within each group by lightness for consistent gradient ordering
    groups.forEach(group => {
        group.colors.sort((a, b) => {
            const labA = rgbToLab(a.r, a.g, a.b);
            const labB = rgbToLab(b.r, b.g, b.b);
            return labA.L - labB.L; // Dark to light
        });
        group.keys = group.colors.map(c => c.key);
    });

    // Sort groups by the lightness of their first (darkest) color for consistent display
    groups.sort((a, b) => {
        const labA = rgbToLab(a.colors[0].r, a.colors[0].g, a.colors[0].b);
        const labB = rgbToLab(b.colors[0].r, b.colors[0].g, b.colors[0].b);
        return labA.L - labB.L;
    });

    // Store results
    state.colorGroups = groups.map(g => g.keys);
    state.colorKeyToGroupIndex.clear();
    groups.forEach((group, index) => {
        group.keys.forEach(key => state.colorKeyToGroupIndex.set(key, index));
    });
}

/**
 * Calculate distance between two groups (single-linkage / nearest neighbor)
 */
function groupDistance(groupA, groupB) {
    let minDist = Infinity;
    for (const colorA of groupA.colors) {
        for (const colorB of groupB.colors) {
            const dist = colorDistanceLab(
                colorA.r, colorA.g, colorA.b,
                colorB.r, colorB.g, colorB.b
            );
            minDist = Math.min(minDist, dist);
        }
    }
    return minDist;
}

/**
 * Get the group index for a given color key
 */
export function getGroupForColor(colorKey) {
    return state.colorKeyToGroupIndex.get(colorKey) ?? -1;
}

/**
 * Get all color keys in a group
 */
export function getColorsInGroup(groupIndex) {
    return state.colorGroups[groupIndex] || [];
}
