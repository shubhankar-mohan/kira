#!/usr/bin/env node

/**
 * Startup Validation Script
 * 
 * Validates the system state before starting the application
 * and fixes common issues automatically.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class StartupValidator {
    constructor() {
        this.errors = [];
        this.warnings = [];
        this.fixes = [];
    }

    /**
     * Run all validation checks
     */
    async validate() {
        console.log('🔍 Running startup validation...\n');

        await this.checkNodeVersion();
        await this.checkDependencies();
        await this.checkPermissions();
        await this.checkESMCompatibility();
        await this.checkEnvironmentFiles();
        await this.validatePrismaSetup();

        this.printResults();
        return this.errors.length === 0;
    }

    /**
     * Check Node.js version compatibility
     */
    async checkNodeVersion() {
        try {
            const version = process.version;
            const majorVersion = parseInt(version.slice(1).split('.')[0]);
            
            if (majorVersion < 18) {
                this.errors.push(`Node.js ${majorVersion} is too old. Requires Node.js 18+`);
            } else {
                console.log(`✅ Node.js version: ${version}`);
            }
        } catch (error) {
            this.errors.push(`Could not determine Node.js version: ${error.message}`);
        }
    }

    /**
     * Check if dependencies are properly installed
     */
    async checkDependencies() {
        const packageJsonPath = path.join(process.cwd(), 'package.json');
        const nodeModulesPath = path.join(process.cwd(), 'node_modules');

        if (!fs.existsSync(packageJsonPath)) {
            this.errors.push('package.json not found');
            return;
        }

        if (!fs.existsSync(nodeModulesPath)) {
            this.warnings.push('node_modules not found - will install dependencies');
            this.fixes.push('Run: npm install');
            return;
        }

        try {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
            
            let missingDeps = [];
            for (const dep of Object.keys(dependencies)) {
                const depPath = path.join(nodeModulesPath, dep);
                if (!fs.existsSync(depPath)) {
                    missingDeps.push(dep);
                }
            }

            if (missingDeps.length > 0) {
                this.warnings.push(`Missing dependencies: ${missingDeps.join(', ')}`);
                this.fixes.push('Run: npm install');
            } else {
                console.log('✅ Dependencies are installed');
            }
        } catch (error) {
            this.errors.push(`Could not validate dependencies: ${error.message}`);
        }
    }

    /**
     * Check file permissions
     */
    async checkPermissions() {
        const nodeModulesPath = path.join(process.cwd(), 'node_modules');
        
        if (!fs.existsSync(nodeModulesPath)) {
            return; // Will be handled by dependency check
        }

        try {
            const stats = fs.statSync(nodeModulesPath);
            const uid = process.getuid ? process.getuid() : null;
            
            if (uid !== null && stats.uid !== uid) {
                this.warnings.push('node_modules has incorrect ownership (owned by root)');
                this.fixes.push(`Run: sudo chown -R $(id -u):$(id -g) node_modules`);
            } else {
                console.log('✅ File permissions are correct');
            }
        } catch (error) {
            this.warnings.push(`Could not check file permissions: ${error.message}`);
        }
    }

    /**
     * Check for ESM compatibility issues
     */
    async checkESMCompatibility() {
        try {
            // Check if ESM loader utility exists
            const esmLoaderPath = path.join(process.cwd(), 'backend/utils/esmLoader.js');
            if (fs.existsSync(esmLoaderPath)) {
                console.log('✅ ESM loader utility is present');
            } else {
                this.warnings.push('ESM loader utility missing');
                this.fixes.push('ESM loader utility should be created');
            }

            // Test loading problematic modules
            const esmLoader = require('../backend/utils/esmLoader');
            const preloadResults = await esmLoader.preloadProblematicModules();
            
            const failed = preloadResults.filter(r => !r.success);
            if (failed.length > 0) {
                this.warnings.push(`ESM modules failed to preload: ${failed.map(f => f.module).join(', ')}`);
            } else {
                console.log('✅ ESM modules preloaded successfully');
            }
        } catch (error) {
            this.warnings.push(`ESM compatibility check failed: ${error.message}`);
        }
    }

    /**
     * Check environment configuration
     */
    async checkEnvironmentFiles() {
        const envFiles = ['.env', 'backend/.env'];
        let foundEnv = false;

        for (const envFile of envFiles) {
            if (fs.existsSync(envFile)) {
                console.log(`✅ Environment file found: ${envFile}`);
                foundEnv = true;

                // Check for required variables
                const envContent = fs.readFileSync(envFile, 'utf8');
                const requiredVars = [
                    'NODE_ENV',
                    'PORT',
                    'DATABASE_URL',
                    'JWT_SECRET'
                ];

                const missingVars = requiredVars.filter(varName => 
                    !envContent.includes(`${varName}=`)
                );

                if (missingVars.length > 0) {
                    this.warnings.push(`Missing environment variables in ${envFile}: ${missingVars.join(', ')}`);
                }
                break;
            }
        }

        if (!foundEnv) {
            this.warnings.push('No environment file found');
            this.fixes.push('Environment file will be created by start.sh');
        }
    }

    /**
     * Validate Prisma setup
     */
    async validatePrismaSetup() {
        const schemaPath = path.join(process.cwd(), 'backend/prisma/schema.prisma');
        const clientPath = path.join(process.cwd(), 'node_modules/.prisma/client');

        if (!fs.existsSync(schemaPath)) {
            this.errors.push('Prisma schema not found at backend/prisma/schema.prisma');
            return;
        }

        console.log('✅ Prisma schema found');

        // Check if Prisma client exists and is not corrupted
        if (fs.existsSync(clientPath)) {
            try {
                const stats = fs.statSync(clientPath);
                if (stats.uid !== process.getuid?.()) {
                    this.warnings.push('Prisma client has incorrect ownership');
                    this.fixes.push('Prisma client will be regenerated with correct permissions');
                }
            } catch (error) {
                this.warnings.push(`Could not check Prisma client: ${error.message}`);
            }
        }
    }

    /**
     * Print validation results
     */
    printResults() {
        console.log('\n' + '='.repeat(60));
        console.log('STARTUP VALIDATION RESULTS');
        console.log('='.repeat(60));

        if (this.errors.length > 0) {
            console.log('\n❌ ERRORS (must be fixed):');
            this.errors.forEach(error => console.log(`   • ${error}`));
        }

        if (this.warnings.length > 0) {
            console.log('\n⚠️  WARNINGS (will be auto-fixed):');
            this.warnings.forEach(warning => console.log(`   • ${warning}`));
        }

        if (this.fixes.length > 0) {
            console.log('\n🔧 FIXES THAT WILL BE APPLIED:');
            this.fixes.forEach(fix => console.log(`   • ${fix}`));
        }

        if (this.errors.length === 0 && this.warnings.length === 0) {
            console.log('\n✅ All checks passed! System is ready to start.');
        }

        console.log('\n' + '='.repeat(60));
    }
}

// Run validation if called directly
if (require.main === module) {
    const validator = new StartupValidator();
    validator.validate().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('Validation failed:', error);
        process.exit(1);
    });
}

module.exports = StartupValidator;