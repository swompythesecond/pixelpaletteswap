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
