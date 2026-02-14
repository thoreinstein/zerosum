
const FULL_WIDTH = 4032; // Typical iPhone 12MP camera
const FULL_HEIGHT = 3024;
const MAX_DIMENSION = 1024;

const bytesPerPixel = 4; // RGBA

function calculateSize() {
    const fullResPixels = FULL_WIDTH * FULL_HEIGHT;
    const fullResRawSize = fullResPixels * bytesPerPixel;

    // PNG typically achieves 2:1 to 3:1 compression on photos
    const pngCompressionRatio = 2.5;
    const estimatedPngSize = fullResRawSize / pngCompressionRatio;

    const ratio = Math.min(MAX_DIMENSION / FULL_WIDTH, MAX_DIMENSION / FULL_HEIGHT);
    const targetWidth = Math.floor(FULL_WIDTH * ratio);
    const targetHeight = Math.floor(FULL_HEIGHT * ratio);
    const targetPixels = targetWidth * targetHeight;
    const targetRawSize = targetPixels * bytesPerPixel;

    // JPEG 0.8 typically achieves 10:1 to 20:1 compression relative to raw
    const jpegCompressionRatio = 15;
    const estimatedJpegSize = targetRawSize / jpegCompressionRatio;

    console.log(`Baseline (Full Res PNG):`);
    console.log(`- Dimensions: ${FULL_WIDTH}x${FULL_HEIGHT}`);
    console.log(`- Estimated File Size: ${(estimatedPngSize / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`- Base64 Size: ${(estimatedPngSize * 1.33 / (1024 * 1024)).toFixed(2)} MB`);

    console.log(`\nOptimized (1024px JPEG 0.8):`);
    console.log(`- Dimensions: ${targetWidth}x${targetHeight}`);
    console.log(`- Estimated File Size: ${(estimatedJpegSize / 1024).toFixed(2)} KB`);
    console.log(`- Base64 Size: ${(estimatedJpegSize * 1.33 / 1024).toFixed(2)} KB`);

    const reduction = (1 - (estimatedJpegSize / estimatedPngSize)) * 100;
    console.log(`\nEstimated Reduction: ${reduction.toFixed(2)}%`);
}

calculateSize();
