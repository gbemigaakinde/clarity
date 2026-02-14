/**
 * Image URL utilities for handling various image sources
 */

/**
 * Extract direct image URL from Unsplash photo page URL
 * @param {string} url - Unsplash photo page URL
 * @returns {string|null} Direct image URL or null
 */
function getUnsplashImageUrl(url) {
    try {
        // Match Unsplash photo URLs like:
        // https://unsplash.com/photos/xyz
        // https://unsplash.com/photos/some-description-xyz
        const unsplashPhotoMatch = url.match(/unsplash\.com\/photos\/([^\/\?]+)/);
        
        if (unsplashPhotoMatch) {
            const photoId = unsplashPhotoMatch[1];
            // Extract the actual photo ID (last part after hyphens)
            const actualId = photoId.split('-').pop();
            // Return Unsplash's direct image URL with reasonable defaults
            // Using source.unsplash.com which provides direct image access
            return `https://source.unsplash.com/${actualId}/800x450`;
        }
        
        return null;
    } catch (error) {
        console.error('Error parsing Unsplash URL:', error);
        return null;
    }
}

/**
 * Validate if URL is a direct image URL
 * @param {string} url - URL to validate
 * @returns {boolean}
 */
function isDirectImageUrl(url) {
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname.toLowerCase();
        
        // Check for common image extensions
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
        const hasImageExtension = imageExtensions.some(ext => pathname.endsWith(ext));
        
        if (hasImageExtension) {
            return true;
        }
        
        // Check for known direct image domains
        const directImageDomains = [
            'i.imgur.com',
            'source.unsplash.com',
            'images.unsplash.com',
            'cdn.pixabay.com',
            'firebasestorage.googleapis.com'
        ];
        
        return directImageDomains.some(domain => urlObj.hostname.includes(domain));
    } catch (error) {
        return false;
    }
}

/**
 * Transform various image URLs into usable direct image URLs
 * @param {string} url - Original URL
 * @returns {string} Transformed URL or original if already valid
 */
export function transformImageUrl(url) {
    if (!url) {
        return 'https://via.placeholder.com/800x450?text=No+Image';
    }
    
    // Check if it's already a direct image URL
    if (isDirectImageUrl(url)) {
        return url;
    }
    
    // Try to extract Unsplash direct URL
    const unsplashUrl = getUnsplashImageUrl(url);
    if (unsplashUrl) {
        return unsplashUrl;
    }
    
    // If it's a placeholder URL, return as is
    if (url.includes('placeholder.com') || url.includes('placehold')) {
        return url;
    }
    
    // Return original URL (it might still work)
    return url;
}

/**
 * Validate if a URL is usable as an image source
 * @param {string} url - URL to validate
 * @returns {Promise<boolean>}
 */
export async function validateImageUrl(url) {
    if (!url) {
        return false;
    }
    
    try {
        // Transform URL first
        const transformedUrl = transformImageUrl(url);
        
        // Try to load the image
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            img.src = transformedUrl;
            
            // Timeout after 5 seconds
            setTimeout(() => resolve(false), 5000);
        });
    } catch (error) {
        console.error('Error validating image URL:', error);
        return false;
    }
}

/**
 * Get a fallback image URL
 * @param {string} title - Title to display in placeholder
 * @returns {string}
 */
export function getFallbackImageUrl(title = 'Course') {
    const encodedTitle = encodeURIComponent(title);
    return `https://via.placeholder.com/800x450/4F46E5/FFFFFF?text=${encodedTitle}`;
}

/**
 * Handle image error by setting fallback
 * @param {HTMLImageElement} img - Image element
 * @param {string} fallbackText - Text for fallback
 */
export function handleImageError(img, fallbackText = 'Course') {
    if (img && !img.dataset.fallbackApplied) {
        img.dataset.fallbackApplied = 'true';
        img.src = getFallbackImageUrl(fallbackText);
        img.style.opacity = '0.7';
    }
}