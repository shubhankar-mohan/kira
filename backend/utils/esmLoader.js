/**
 * ESM Compatibility Loader
 * 
 * Provides a unified way to load both CommonJS and ESM modules
 * with proper error handling and fallbacks.
 */

class ESMLoader {
    constructor() {
        this.moduleCache = new Map();
        this.loadAttempts = new Map();
    }

    /**
     * Dynamically load a module with ESM/CommonJS compatibility
     * @param {string} moduleName - Name of the module to load
     * @param {Object} options - Loading options
     * @returns {Promise<any>} - The loaded module
     */
    async loadModule(moduleName, options = {}) {
        const {
            exportName = null,
            fallbackVersion = null,
            maxRetries = 3,
            timeout = 10000
        } = options;

        const cacheKey = `${moduleName}:${exportName || 'default'}`;
        
        // Return cached module if available
        if (this.moduleCache.has(cacheKey)) {
            return this.moduleCache.get(cacheKey);
        }

        const attempts = this.loadAttempts.get(cacheKey) || 0;
        if (attempts >= maxRetries) {
            throw new Error(`Max retries (${maxRetries}) exceeded for module: ${moduleName}`);
        }

        this.loadAttempts.set(cacheKey, attempts + 1);

        try {
            // Try dynamic import first (handles ESM)
            const module = await Promise.race([
                import(moduleName),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Import timeout')), timeout)
                )
            ]);

            let result;
            if (exportName) {
                result = module[exportName];
                if (!result) {
                    throw new Error(`Export '${exportName}' not found in module '${moduleName}'`);
                }
            } else {
                result = module.default || module;
            }

            // Cache successful load
            this.moduleCache.set(cacheKey, result);
            this.loadAttempts.delete(cacheKey);
            
            return result;

        } catch (importError) {
            console.warn(`ESM import failed for ${moduleName}:`, importError.message);

            // Try CommonJS require as fallback
            try {
                const module = require(moduleName);
                const result = exportName ? module[exportName] : module;
                
                if (!result && exportName) {
                    throw new Error(`Export '${exportName}' not found in CommonJS module '${moduleName}'`);
                }

                // Cache successful load
                this.moduleCache.set(cacheKey, result);
                this.loadAttempts.delete(cacheKey);
                
                return result;

            } catch (requireError) {
                console.error(`Both ESM and CommonJS loading failed for ${moduleName}`);
                console.error('ESM Error:', importError.message);
                console.error('CommonJS Error:', requireError.message);

                // Try fallback version if specified
                if (fallbackVersion) {
                    try {
                        console.warn(`Attempting fallback version: ${moduleName}@${fallbackVersion}`);
                        // Note: In a real scenario, you'd need package management here
                        throw new Error(`Fallback version loading not implemented`);
                    } catch (fallbackError) {
                        console.error('Fallback version loading failed:', fallbackError.message);
                    }
                }

                throw new Error(
                    `Failed to load module '${moduleName}': ` +
                    `ESM (${importError.message}), CommonJS (${requireError.message})`
                );
            }
        }
    }

    /**
     * Preload modules that are known to have compatibility issues
     */
    async preloadProblematicModules() {
        const problematicModules = [
            { name: 'google-spreadsheet', export: 'GoogleSpreadsheet' },
            { name: 'ky', export: null },
            // Add other known problematic modules here
        ];

        const results = await Promise.allSettled(
            problematicModules.map(async ({ name, export: exportName }) => {
                try {
                    await this.loadModule(name, { exportName });
                    console.log(`✅ Pre-loaded ${name}${exportName ? `.${exportName}` : ''}`);
                    return { module: name, success: true };
                } catch (error) {
                    console.warn(`⚠️  Failed to pre-load ${name}: ${error.message}`);
                    return { module: name, success: false, error: error.message };
                }
            })
        );

        return results.map(result => result.value);
    }

    /**
     * Clear module cache (useful for testing or development)
     */
    clearCache() {
        this.moduleCache.clear();
        this.loadAttempts.clear();
    }

    /**
     * Get information about cached modules
     */
    getCacheInfo() {
        return {
            cached: Array.from(this.moduleCache.keys()),
            attempts: Array.from(this.loadAttempts.entries())
        };
    }
}

// Export singleton instance
module.exports = new ESMLoader();