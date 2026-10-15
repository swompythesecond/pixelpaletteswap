export function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

export function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0; // achromatic (gray)
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }

    return { h, s, l };
}

export function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(img.src);
            resolve(img);
        };
        img.onerror = () => {
            URL.revokeObjectURL(img.src);
            reject(new Error(`Failed to load image: ${file.name}`));
        };
        img.src = URL.createObjectURL(file);
    });
}

// LAB color space functions for perceptual color distance

export function rgbToLab(r, g, b) {
    // RGB to XYZ
    let rr = r / 255, gg = g / 255, bb = b / 255;

    rr = rr > 0.04045 ? Math.pow((rr + 0.055) / 1.055, 2.4) : rr / 12.92;
    gg = gg > 0.04045 ? Math.pow((gg + 0.055) / 1.055, 2.4) : gg / 12.92;
    bb = bb > 0.04045 ? Math.pow((bb + 0.055) / 1.055, 2.4) : bb / 12.92;

    rr *= 100; gg *= 100; bb *= 100;

    // Observer = 2 degrees, Illuminant = D65
    const x = rr * 0.4124 + gg * 0.3576 + bb * 0.1805;
    const y = rr * 0.2126 + gg * 0.7152 + bb * 0.0722;
    const z = rr * 0.0193 + gg * 0.1192 + bb * 0.9505;

    // XYZ to LAB
    let xx = x / 95.047, yy = y / 100.000, zz = z / 108.883;

    xx = xx > 0.008856 ? Math.pow(xx, 1/3) : (7.787 * xx) + 16/116;
    yy = yy > 0.008856 ? Math.pow(yy, 1/3) : (7.787 * yy) + 16/116;
    zz = zz > 0.008856 ? Math.pow(zz, 1/3) : (7.787 * zz) + 16/116;

    return {
        L: (116 * yy) - 16,
        a: 500 * (xx - yy),
        b: 200 * (yy - zz)
    };
}

export function labToRgb(L, a, b) {
    // LAB to XYZ
    let y = (L + 16) / 116;
    let x = a / 500 + y;
    let z = y - b / 200;

    const y3 = Math.pow(y, 3);
    const x3 = Math.pow(x, 3);
    const z3 = Math.pow(z, 3);

    y = y3 > 0.008856 ? y3 : (y - 16/116) / 7.787;
    x = x3 > 0.008856 ? x3 : (x - 16/116) / 7.787;
    z = z3 > 0.008856 ? z3 : (z - 16/116) / 7.787;

    x *= 95.047;
    y *= 100.000;
    z *= 108.883;

    // XYZ to RGB
    x /= 100; y /= 100; z /= 100;

    let rr = x *  3.2406 + y * -1.5372 + z * -0.4986;
    let gg = x * -0.9689 + y *  1.8758 + z *  0.0415;
    let bb = x *  0.0557 + y * -0.2040 + z *  1.0570;

    rr = rr > 0.0031308 ? 1.055 * Math.pow(rr, 1/2.4) - 0.055 : 12.92 * rr;
    gg = gg > 0.0031308 ? 1.055 * Math.pow(gg, 1/2.4) - 0.055 : 12.92 * gg;
    bb = bb > 0.0031308 ? 1.055 * Math.pow(bb, 1/2.4) - 0.055 : 12.92 * bb;

    return {
        r: Math.max(0, Math.min(255, Math.round(rr * 255))),
        g: Math.max(0, Math.min(255, Math.round(gg * 255))),
        b: Math.max(0, Math.min(255, Math.round(bb * 255)))
    };
}

export function colorDistanceLab(r1, g1, b1, r2, g2, b2) {
    const lab1 = rgbToLab(r1, g1, b1);
    const lab2 = rgbToLab(r2, g2, b2);

    return Math.sqrt(
        Math.pow(lab1.L - lab2.L, 2) +
        Math.pow(lab1.a - lab2.a, 2) +
        Math.pow(lab1.b - lab2.b, 2)
    );
}

function labDistanceSq(c1, c2) {
    const dL = c1.L - c2.L;
    const dA = c1.a - c2.a;
    const dB = c1.b - c2.b;
    return dL * dL + dA * dA + dB * dB;
}

export function buildColorMapToCentroids(colors, centroidLabs) {
    const colorMap = new Map();
    const centroidRgb = centroidLabs.map(c => labToRgb(c.L, c.a, c.b));

    for (const color of colors) {
        let bestIndex = 0;
        let bestDist = Infinity;

        for (let i = 0; i < centroidLabs.length; i++) {
            const dist = labDistanceSq(color.lab, centroidLabs[i]);
            if (dist < bestDist) {
                bestDist = dist;
                bestIndex = i;
            }
        }

        colorMap.set(color.key, centroidRgb[bestIndex]);
    }

    return colorMap;
}

export function quantizeColorsLabWeighted(colorCounts, targetCount, maxIterations = 20) {
    const colors = [...colorCounts.entries()].map(([key, data]) => ({
        key,
        r: data.r,
        g: data.g,
        b: data.b,
        count: data.count,
        lab: rgbToLab(data.r, data.g, data.b)
    }));

    if (colors.length === 0) {
        return new Map();
    }

    const clampedTarget = Math.max(1, Math.min(targetCount, colors.length));
    if (clampedTarget >= colors.length) {
        const identityMap = new Map();
        for (const color of colors) {
            identityMap.set(color.key, { r: color.r, g: color.g, b: color.b });
        }
        return identityMap;
    }

    // Deterministic seeding: highest-frequency color first, then farthest-point by weighted LAB distance.
    const sortedByCount = [...colors].sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.key.localeCompare(b.key);
    });

    const centroids = [{ ...sortedByCount[0].lab }];
    const chosen = new Set([sortedByCount[0].key]);

    while (centroids.length < clampedTarget) {
        let bestColor = null;
        let bestScore = -1;

        for (const color of colors) {
            if (chosen.has(color.key)) continue;

            let minDist = Infinity;
            for (const centroid of centroids) {
                const dist = labDistanceSq(color.lab, centroid);
                if (dist < minDist) minDist = dist;
            }

            const score = minDist * color.count;
            if (score > bestScore) {
                bestScore = score;
                bestColor = color;
            }
        }

        if (!bestColor) break;

        centroids.push({ ...bestColor.lab });
        chosen.add(bestColor.key);
    }

    const assignments = new Array(colors.length).fill(-1);

    for (let iter = 0; iter < maxIterations; iter++) {
        const sums = centroids.map(() => ({ L: 0, a: 0, b: 0, w: 0 }));
        let changed = false;

        for (let i = 0; i < colors.length; i++) {
            const color = colors[i];
            let bestIndex = 0;
            let bestDist = Infinity;

            for (let j = 0; j < centroids.length; j++) {
                const dist = labDistanceSq(color.lab, centroids[j]);
                if (dist < bestDist) {
                    bestDist = dist;
                    bestIndex = j;
                }
            }

            if (assignments[i] !== bestIndex) {
                assignments[i] = bestIndex;
                changed = true;
            }

            const weight = color.count;
            sums[bestIndex].L += color.lab.L * weight;
            sums[bestIndex].a += color.lab.a * weight;
            sums[bestIndex].b += color.lab.b * weight;
            sums[bestIndex].w += weight;
        }

        for (let j = 0; j < centroids.length; j++) {
            if (sums[j].w > 0) {
                centroids[j] = {
                    L: sums[j].L / sums[j].w,
                    a: sums[j].a / sums[j].w,
                    b: sums[j].b / sums[j].w
                };
                continue;
            }

            // Empty cluster fallback: pull centroid to the current highest-error color.
            let worstColor = colors[0];
            let worstScore = -1;

            for (let i = 0; i < colors.length; i++) {
                const assigned = assignments[i];
                const dist = labDistanceSq(colors[i].lab, centroids[assigned]);
                const score = dist * colors[i].count;
                if (score > worstScore) {
                    worstScore = score;
                    worstColor = colors[i];
                }
            }

            centroids[j] = { ...worstColor.lab };
        }

        if (!changed) break;
    }

    return buildColorMapToCentroids(colors, centroids);
}

export function resizeFramesNearestNeighbor(frames, fromWidth, fromHeight, toWidth, toHeight) {
    if (!Array.isArray(frames) || frames.length === 0) return [];

    const inputCanvas = document.createElement('canvas');
    inputCanvas.width = fromWidth;
    inputCanvas.height = fromHeight;
    const inputCtx = inputCanvas.getContext('2d');

    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = toWidth;
    outputCanvas.height = toHeight;
    const outputCtx = outputCanvas.getContext('2d');
    outputCtx.imageSmoothingEnabled = false;

    const resizedFrames = [];

    for (const frameData of frames) {
        const imageData = new ImageData(new Uint8ClampedArray(frameData), fromWidth, fromHeight);
        inputCtx.putImageData(imageData, 0, 0);
        outputCtx.clearRect(0, 0, toWidth, toHeight);
        outputCtx.drawImage(inputCanvas, 0, 0, fromWidth, fromHeight, 0, 0, toWidth, toHeight);
        const resizedImageData = outputCtx.getImageData(0, 0, toWidth, toHeight);
        resizedFrames.push(new Uint8ClampedArray(resizedImageData.data));
    }

    return resizedFrames;
}

export function getOpaqueBoundsAcrossFrames(frames, width, height) {
    if (!Array.isArray(frames) || frames.length === 0 || width < 1 || height < 1) {
        return null;
    }

    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (const frameData of frames) {
        if (!frameData || frameData.length !== width * height * 4) continue;

        for (let i = 3; i < frameData.length; i += 4) {
            if (frameData[i] === 0) continue;

            const pixelIndex = (i - 3) / 4;
            const x = pixelIndex % width;
            const y = Math.floor(pixelIndex / width);

            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
        }
    }

    if (maxX < 0 || maxY < 0) {
        return null;
    }

    return {
        minX,
        minY,
        maxX,
        maxY,
        width: maxX - minX + 1,
        height: maxY - minY + 1
    };
}

export function cropFramesToBounds(frames, fromWidth, fromHeight, bounds) {
    if (!Array.isArray(frames) || frames.length === 0) return [];
    if (!bounds) return frames.map((frame) => new Uint8ClampedArray(frame));

    const minX = bounds.minX ?? 0;
    const minY = bounds.minY ?? 0;
    const toWidth = bounds.width;
    const toHeight = bounds.height;

    if (
        !Number.isInteger(minX) || !Number.isInteger(minY) ||
        !Number.isInteger(toWidth) || !Number.isInteger(toHeight) ||
        toWidth < 1 || toHeight < 1 ||
        minX < 0 || minY < 0 ||
        minX + toWidth > fromWidth ||
        minY + toHeight > fromHeight
    ) {
        return frames.map((frame) => new Uint8ClampedArray(frame));
    }

    const croppedFrames = [];
    const rowByteLength = toWidth * 4;

    for (const frameData of frames) {
        const cropped = new Uint8ClampedArray(toWidth * toHeight * 4);

        for (let y = 0; y < toHeight; y++) {
            const srcStart = ((minY + y) * fromWidth + minX) * 4;
            const dstStart = y * rowByteLength;
            const srcEnd = srcStart + rowByteLength;
            cropped.set(frameData.subarray(srcStart, srcEnd), dstStart);
        }

        croppedFrames.push(cropped);
    }

    return croppedFrames;
}

// --- Pixel grid detection (for upscaled / AI-generated pixel art) ---

// Edge strength between neighbouring columns (profileX[x] = edges between x-1 and x) and rows.
export function computeEdgeProfiles(frameData, width, height) {
    const profileX = new Float64Array(width);
    const profileY = new Float64Array(height);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            if (x > 0) {
                const j = i - 4;
                profileX[x] += Math.abs(frameData[i] - frameData[j]) +
                    Math.abs(frameData[i + 1] - frameData[j + 1]) +
                    Math.abs(frameData[i + 2] - frameData[j + 2]) +
                    Math.abs(frameData[i + 3] - frameData[j + 3]);
            }
            if (y > 0) {
                const j = i - width * 4;
                profileY[y] += Math.abs(frameData[i] - frameData[j]) +
                    Math.abs(frameData[i + 1] - frameData[j + 1]) +
                    Math.abs(frameData[i + 2] - frameData[j + 2]) +
                    Math.abs(frameData[i + 3] - frameData[j + 3]);
            }
        }
    }

    return { profileX: centerProfile(profileX), profileY: centerProfile(profileY) };
}

function centerProfile(profile) {
    // profile[0] has no left/top neighbour, so it is excluded from the signal.
    const n = profile.length - 1;
    const values = new Float64Array(profile.length);
    if (n < 1) return { values, norm: 0 };

    let mean = 0;
    for (let x = 1; x < profile.length; x++) mean += profile[x];
    mean /= n;

    let norm = 0;
    for (let x = 1; x < profile.length; x++) {
        values[x] = profile[x] - mean;
        norm += Math.abs(values[x]);
    }
    return { values, norm };
}

// Fourier component of the edge profile at the given period: strength (0-1) says how strongly
// edges repeat every `period` px, offset says where the grid lines sit.
function profileFourier(profile, period, from = 1, to = profile.values.length) {
    const { values, norm } = profile;
    if (norm === 0) return { strength: 0, offset: 0 };
    const w = (2 * Math.PI) / period;
    let re = 0;
    let im = 0;
    for (let x = Math.max(1, from); x < to; x++) {
        re += values[x] * Math.cos(w * x);
        im -= values[x] * Math.sin(w * x);
    }
    const strength = Math.sqrt(re * re + im * im) / norm;
    let offset = (-Math.atan2(im, re) / w) % period;
    if (offset < 0) offset += period;
    return { strength, offset };
}

// A slightly wrong period makes the grid drift: compare where the grid lines sit in the left
// and right half of the image and correct the period by that drift.
function refinePeriod(profile, period) {
    const length = profile.values.length;
    if (length < period * 8) return null;
    const half = Math.floor(length / 2);
    const left = profileFourier(profile, period, 1, half);
    const right = profileFourier(profile, period, half, length);
    let drift = right.offset - left.offset;
    drift -= Math.round(drift / period) * period;
    const slope = drift / (length / 2);
    if (!Number.isFinite(slope) || Math.abs(slope) > 0.2) return null;
    return { period: period / (1 - slope), weight: Math.min(left.strength, right.strength) };
}

export function getGridOffset(profile, cellSize) {
    return profileFourier(profile, cellSize).offset;
}

// Guesses the size of one "real" pixel in an upscaled pixel-art image. Handles non-integer
// scales and a shifted grid. Returns { cellSize, offsetX, offsetY, confidence } or null.
export function detectPixelGrid(frameData, width, height, profiles = computeEdgeProfiles(frameData, width, height)) {
    const minSize = 2;
    const maxSize = Math.min(256, Math.floor(Math.min(width, height) / 4));
    if (maxSize < minSize) return null;

    const { profileX, profileY } = profiles;
    const score = (period) => {
        const sx = profileFourier(profileX, period).strength;
        const sy = profileFourier(profileY, period).strength;
        return (sx + sy) / 2;
    };

    // Coarse scan in frequency space so long periods are not over-sampled.
    const length = Math.max(width, height);
    const freqStep = 0.25 / length;
    const samples = [];
    for (let f = 1 / maxSize; f <= 1 / minSize + 1e-12; f += freqStep) {
        samples.push({ period: 1 / f, score: score(1 / f) });
    }
    if (samples.length === 0) return null;

    // Refine every local peak with a golden-section search on the period.
    const peaks = [];
    for (let i = 0; i < samples.length; i++) {
        const prev = i > 0 ? samples[i - 1].score : -Infinity;
        const next = i < samples.length - 1 ? samples[i + 1].score : -Infinity;
        if (samples[i].score < prev || samples[i].score < next) continue;

        const f = 1 / samples[i].period;
        let lo = 1 / Math.min(1 / minSize, f + freqStep);
        let hi = 1 / Math.max(1 / maxSize, f - freqStep);
        const g = (Math.sqrt(5) - 1) / 2;
        let a = hi - g * (hi - lo);
        let b = lo + g * (hi - lo);
        let fa = score(a);
        let fb = score(b);
        for (let iter = 0; iter < 30; iter++) {
            if (fa > fb) {
                lo = b; b = a; fb = fa;
                a = hi - g * (hi - lo); fa = score(a);
            } else {
                hi = a; a = b; fa = fb;
                b = lo + g * (hi - lo); fb = score(b);
            }
        }
        const period = (lo + hi) / 2;
        peaks.push({ period, score: score(period) });
    }

    const best = Math.max(...peaks.map((p) => p.score));
    if (!(best > 0)) return null;

    // Half the real pixel size also lines up with every edge (a harmonic), but double the size
    // does not, so the true size is the largest period that scores close to the best one.
    const candidates = peaks.filter((p) => p.score >= best * 0.8);
    candidates.sort((p, q) => q.period - p.period);
    const chosen = candidates[0];

    let cellSize = chosen.period;
    for (let iter = 0; iter < 3; iter++) {
        const rx = refinePeriod(profileX, cellSize);
        const ry = refinePeriod(profileY, cellSize);
        const parts = [rx, ry].filter((r) => r && r.weight > 0);
        if (parts.length === 0) break;
        const totalWeight = parts.reduce((sum, r) => sum + r.weight, 0);
        const refined = parts.reduce((sum, r) => sum + r.period * r.weight, 0) / totalWeight;
        if (Math.abs(refined - cellSize) > cellSize * 0.05) break;
        cellSize = refined;
    }

    // Snap to a whole number when the image was upscaled by an exact integer factor.
    const rounded = Math.round(cellSize);
    if (Math.abs(cellSize - rounded) < 0.05 && score(rounded) >= score(cellSize) * 0.98) {
        cellSize = rounded;
    }

    return {
        cellSize,
        offsetX: getGridOffset(profileX, cellSize),
        offsetY: getGridOffset(profileY, cellSize),
        confidence: chosen.score
    };
}

// Turns a grid line offset into the first cell start (negative for a partial first cell) and
// the number of cells; partial cells at the edges are kept when mostly inside the image.
export function getPixelGridLayout(width, height, cellSize, offsetX, offsetY) {
    const axis = (length, offset) => {
        let start = ((offset % cellSize) + cellSize) % cellSize;
        if (start >= cellSize * 0.6) start -= cellSize;
        const count = Math.max(1, Math.floor((length - start) / cellSize + 0.4));
        return { start, count };
    };
    const x = axis(width, offsetX);
    const y = axis(height, offsetY);
    return { startX: x.start, startY: y.start, toWidth: x.count, toHeight: y.count };
}

// Downscales by taking the per-channel median of the centre of every grid cell, which ignores
// the blurry/noisy borders AI generators leave between "pixels".
export function downscaleFramesByGrid(frames, fromWidth, fromHeight, cellSize, startX, startY, toWidth, toHeight) {
    if (!Array.isArray(frames) || frames.length === 0) return [];

    const inset = cellSize * 0.25;
    const ranges = (start, count, length) => {
        const result = [];
        for (let i = 0; i < count; i++) {
            const cellStart = start + i * cellSize;
            const center = Math.min(length - 1, Math.max(0, Math.floor(cellStart + cellSize / 2)));
            let lo = Math.max(0, Math.ceil(cellStart + inset));
            let hi = Math.min(length - 1, Math.floor(cellStart + cellSize - inset - 1e-9));
            if (hi < lo) {
                lo = center;
                hi = center;
            }
            result.push([lo, hi]);
        }
        return result;
    };
    const xRanges = ranges(startX, toWidth, fromWidth);
    const yRanges = ranges(startY, toHeight, fromHeight);

    const channels = [[], [], [], []];
    const median = (list) => {
        list.sort((a, b) => a - b);
        return list[list.length >> 1];
    };

    return frames.map((frameData) => {
        const output = new Uint8ClampedArray(toWidth * toHeight * 4);
        for (let oy = 0; oy < toHeight; oy++) {
            const [y0, y1] = yRanges[oy];
            for (let ox = 0; ox < toWidth; ox++) {
                const [x0, x1] = xRanges[ox];
                for (const list of channels) list.length = 0;
                for (let y = y0; y <= y1; y++) {
                    for (let x = x0; x <= x1; x++) {
                        const i = (y * fromWidth + x) * 4;
                        channels[0].push(frameData[i]);
                        channels[1].push(frameData[i + 1]);
                        channels[2].push(frameData[i + 2]);
                        channels[3].push(frameData[i + 3]);
                    }
                }
                const o = (oy * toWidth + ox) * 4;
                output[o] = median(channels[0]);
                output[o + 1] = median(channels[1]);
                output[o + 2] = median(channels[2]);
                output[o + 3] = median(channels[3]);
            }
        }
        return output;
    });
}
