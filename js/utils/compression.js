// Compression utilities using built-in CompressionStream API
// Uses gzip for compression, with base64url encoding for URL safety

/**
 * Compress a string using gzip and encode for URL use
 * @param {string} str - The string to compress
 * @returns {Promise<string>} - Base64url encoded compressed string
 */
export async function compress(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    
    const cs = new CompressionStream('gzip');
    const writer = cs.writable.getWriter();
    writer.write(data);
    writer.close();
    
    const compressedChunks = [];
    const reader = cs.readable.getReader();
    
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        compressedChunks.push(value);
    }
    
    // Combine chunks into single Uint8Array
    const totalLength = compressedChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const compressed = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of compressedChunks) {
        compressed.set(chunk, offset);
        offset += chunk.length;
    }
    
    // Convert to base64url (URL-safe base64)
    return uint8ArrayToBase64url(compressed);
}

/**
 * Decompress a base64url encoded gzip string
 * @param {string} compressed - Base64url encoded compressed string
 * @returns {Promise<string>} - The decompressed string
 */
export async function decompress(compressed) {
    const data = base64urlToUint8Array(compressed);
    
    const ds = new DecompressionStream('gzip');
    const writer = ds.writable.getWriter();
    writer.write(data);
    writer.close();
    
    const decompressedChunks = [];
    const reader = ds.readable.getReader();
    
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        decompressedChunks.push(value);
    }
    
    // Combine chunks and decode as text
    const totalLength = decompressedChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const decompressed = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of decompressedChunks) {
        decompressed.set(chunk, offset);
        offset += chunk.length;
    }
    
    const decoder = new TextDecoder();
    return decoder.decode(decompressed);
}

/**
 * Convert Uint8Array to base64url string
 * Base64url is URL-safe: uses - instead of +, _ instead of /, no padding
 */
function uint8ArrayToBase64url(uint8Array) {
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
    }
    const base64 = btoa(binary);
    // Convert to base64url
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Convert base64url string to Uint8Array
 */
function base64urlToUint8Array(base64url) {
    // Convert from base64url to base64
    let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    // Add padding if needed
    while (base64.length % 4) {
        base64 += '=';
    }
    const binary = atob(base64);
    const uint8Array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        uint8Array[i] = binary.charCodeAt(i);
    }
    return uint8Array;
}

/**
 * Check if CompressionStream is supported
 */
export function isCompressionSupported() {
    return typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';
}

/**
 * Try to detect if a string is compressed (starts with gzip magic bytes when decoded)
 * or is old-style base64 encoded JSON
 */
export function isCompressed(str) {
    try {
        // Try to decode and check for gzip magic bytes (1f 8b)
        const data = base64urlToUint8Array(str);
        return data.length >= 2 && data[0] === 0x1f && data[1] === 0x8b;
    } catch {
        return false;
    }
}

/**
 * Legacy decode for old uncompressed URLs
 * Old format: btoa(encodeURIComponent(json))
 */
export function legacyDecode(encoded) {
    return decodeURIComponent(atob(encoded));
}

export default {
    compress,
    decompress,
    isCompressionSupported,
    isCompressed,
    legacyDecode
};
