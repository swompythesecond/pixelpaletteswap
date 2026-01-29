import { state } from './state.js';
import { colorDistanceLab, rgbToLab } from './utils.js';

// Minimum pixel count - colors appearing fewer times are excluded from grouping
// This filters out anti-aliasing artifacts and noise
const MIN_PIXEL_COUNT = 2;

/**
 * Compute color groups using spatial bucketing + Union-Find
 * Much faster than agglomerative clustering for large palettes
 * O(n) instead of O(n²)
 */
export function computeColorGroups() {
    if (!state.colorGroupingEnabled || state.colorPalette.size === 0) {
        state.colorGroups = [];
        state.colorKeyToGroupIndex.clear();
        return;
    }

    // Map threshold 0-100 to Delta-E range 0-50
    const threshold = state.colorGroupingThreshold * 0.5;

    // Special case: threshold 100 means merge ALL colors into one group
    if (state.colorGroupingThreshold >= 100) {
        const allColors = [];
        for (const [key, data] of state.colorPalette.entries()) {
            const lab = rgbToLab(data.r, data.g, data.b);
            allColors.push({ key, r: data.r, g: data.g, b: data.b, lab, count: data.count });
        }
        // Sort by lightness
        allColors.sort((a, b) => a.lab.L - b.lab.L);

        state.colorGroups = [allColors.map(c => c.key)];
        state.colorKeyToGroupIndex.clear();
        allColors.forEach(c => state.colorKeyToGroupIndex.set(c.key, 0));
        return;
    }

    // Get colors and convert to LAB, filtering out rare colors
    const colors = [];
    const rareColors = []; // Colors below MIN_PIXEL_COUNT threshold

    for (const [key, data] of state.colorPalette.entries()) {
        const lab = rgbToLab(data.r, data.g, data.b);
        const colorObj = { key, r: data.r, g: data.g, b: data.b, lab, count: data.count };

        if (data.count >= MIN_PIXEL_COUNT) {
            colors.push(colorObj);
        } else {
            rareColors.push(colorObj);
        }
    }

    // If very few colors remain after filtering, include rare colors too
    if (colors.length < 10 && rareColors.length > 0) {
        colors.push(...rareColors);
        rareColors.length = 0;
    }

    if (colors.length === 0) {
        state.colorGroups = [];
        state.colorKeyToGroupIndex.clear();
        return;
    }

    // Use Union-Find with spatial bucketing for efficient grouping
    const parent = new Map();
    const rank = new Map();

    // Initialize Union-Find
    for (const color of colors) {
        parent.set(color.key, color.key);
        rank.set(color.key, 0);
    }

    function find(x) {
        if (parent.get(x) !== x) {
            parent.set(x, find(parent.get(x))); // Path compression
        }
        return parent.get(x);
    }

    function union(x, y) {
        const rootX = find(x);
        const rootY = find(y);
        if (rootX === rootY) return;

        // Union by rank
        if (rank.get(rootX) < rank.get(rootY)) {
            parent.set(rootX, rootY);
        } else if (rank.get(rootX) > rank.get(rootY)) {
            parent.set(rootY, rootX);
        } else {
            parent.set(rootY, rootX);
            rank.set(rootX, rank.get(rootX) + 1);
        }
    }

    // Spatial bucketing in LAB space
    // Bucket size slightly larger than threshold for efficiency
    const bucketSize = Math.max(threshold * 1.5, 10);
    const buckets = new Map();

    function getBucketKey(lab) {
        const bL = Math.floor(lab.L / bucketSize);
        const bA = Math.floor((lab.a + 128) / bucketSize); // a ranges roughly -128 to 128
        const bB = Math.floor((lab.b + 128) / bucketSize); // b ranges roughly -128 to 128
        return `${bL},${bA},${bB}`;
    }

    // Place colors into buckets
    for (const color of colors) {
        const bucketKey = getBucketKey(color.lab);
        if (!buckets.has(bucketKey)) {
            buckets.set(bucketKey, []);
        }
        buckets.get(bucketKey).push(color);
    }

    // For each bucket, check colors against same bucket and adjacent buckets
    const checkedPairs = new Set();

    for (const [bucketKey, bucketColors] of buckets) {
        const [bL, bA, bB] = bucketKey.split(',').map(Number);

        // Get adjacent bucket keys (27 neighbors including self in 3D)
        const neighborKeys = [];
        for (let dL = -1; dL <= 1; dL++) {
            for (let dA = -1; dA <= 1; dA++) {
                for (let dB = -1; dB <= 1; dB++) {
                    neighborKeys.push(`${bL + dL},${bA + dA},${bB + dB}`);
                }
            }
        }

        // Check pairs within this bucket and with neighbors
        for (const neighborKey of neighborKeys) {
            const neighborColors = buckets.get(neighborKey);
            if (!neighborColors) continue;

            for (const colorA of bucketColors) {
                for (const colorB of neighborColors) {
                    if (colorA.key === colorB.key) continue;

                    // Avoid checking same pair twice
                    const pairKey = colorA.key < colorB.key
                        ? `${colorA.key}|${colorB.key}`
                        : `${colorB.key}|${colorA.key}`;

                    if (checkedPairs.has(pairKey)) continue;
                    checkedPairs.add(pairKey);

                    // Calculate distance and union if within threshold
                    const dist = colorDistanceLab(
                        colorA.r, colorA.g, colorA.b,
                        colorB.r, colorB.g, colorB.b
                    );

                    if (dist <= threshold) {
                        union(colorA.key, colorB.key);
                    }
                }
            }
        }
    }

    // Collect groups from Union-Find
    const groupMap = new Map();
    for (const color of colors) {
        const root = find(color.key);
        if (!groupMap.has(root)) {
            groupMap.set(root, []);
        }
        groupMap.get(root).push(color);
    }

    // Convert to array and sort within groups by lightness
    let groups = [...groupMap.values()];

    groups.forEach(group => {
        group.sort((a, b) => a.lab.L - b.lab.L); // Dark to light
    });

    // Sort groups by average lightness for consistent display
    groups.sort((a, b) => {
        const avgA = a.reduce((sum, c) => sum + c.lab.L, 0) / a.length;
        const avgB = b.reduce((sum, c) => sum + c.lab.L, 0) / b.length;
        return avgA - avgB;
    });

    // Handle rare colors: assign each to the nearest group
    // Use only representative colors (first, middle, last) from each group to speed up
    if (rareColors.length > 0 && groups.length > 0) {
        // Build representative colors for each group (max 3 per group for speed)
        const groupReps = groups.map((group, idx) => {
            const reps = [group[0]]; // First (darkest)
            if (group.length > 2) reps.push(group[Math.floor(group.length / 2)]); // Middle
            if (group.length > 1) reps.push(group[group.length - 1]); // Last (lightest)
            return { idx, reps };
        });

        for (const rareColor of rareColors) {
            let nearestGroup = null;
            let nearestDist = Infinity;

            for (const { idx, reps } of groupReps) {
                for (const rep of reps) {
                    const dist = colorDistanceLab(
                        rareColor.r, rareColor.g, rareColor.b,
                        rep.r, rep.g, rep.b
                    );
                    if (dist < nearestDist) {
                        nearestDist = dist;
                        nearestGroup = idx;
                    }
                }
            }

            if (nearestGroup !== null && nearestDist <= threshold * 2) {
                groups[nearestGroup].push(rareColor);
            } else {
                groups.push([rareColor]);
            }
        }
    } else if (rareColors.length > 0) {
        // No groups yet, each rare color becomes its own group
        for (const rareColor of rareColors) {
            groups.push([rareColor]);
        }
    }

    // Re-sort groups that had rare colors added
    groups.forEach(group => {
        if (!group[0].lab) {
            // Compute LAB for rare colors that don't have it cached
            group.forEach(c => {
                if (!c.lab) c.lab = rgbToLab(c.r, c.g, c.b);
            });
        }
        group.sort((a, b) => a.lab.L - b.lab.L);
    });

    // Store results
    state.colorGroups = groups.map(g => g.map(c => c.key));
    state.colorKeyToGroupIndex.clear();
    groups.forEach((group, index) => {
        group.forEach(c => state.colorKeyToGroupIndex.set(c.key, index));
    });
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
