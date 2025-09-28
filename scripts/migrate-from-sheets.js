#!/usr/bin/env node

require('dotenv').config();
const MigrationService = require('../backend/services/migrationService');

async function main() {
    console.log('🚀 Kira Migration Tool - Google Sheets to MySQL');
    console.log('==============================================');

    const migrationService = new MigrationService();

    try {
        // Step 1: Export from Google Sheets
        console.log('\n📤 Step 1: Exporting data from Google Sheets...');
        const exportData = await migrationService.exportFromSheets();

        // Step 2: Validate export data
        console.log('\n🔍 Step 2: Validating exported data...');
        const validation = await migrationService.validateExportData(exportData);

        // Check if validation passed
        const totalValid = validation.users.valid + validation.sprints.valid +
                         validation.tasks.valid + validation.comments.valid;
        const totalRecords = validation.users.count + validation.sprints.count +
                           validation.tasks.count + validation.comments.count;

        console.log(`\n✅ Validation Summary:`);
        console.log(`   Users: ${validation.users.valid}/${validation.users.count} valid`);
        console.log(`   Sprints: ${validation.sprints.valid}/${validation.sprints.count} valid`);
        console.log(`   Tasks: ${validation.tasks.valid}/${validation.tasks.count} valid`);
        console.log(`   Comments: ${validation.comments.valid}/${validation.comments.count} valid`);
        console.log(`   Total: ${totalValid}/${totalRecords} valid records`);

        if (totalValid === 0) {
            console.log('\n❌ No valid data to import. Migration aborted.');
            process.exit(1);
        }

        // Step 3: Confirm before import
        if (process.argv.includes('--dry-run')) {
            console.log('\n🔄 Dry run mode - no data will be imported');
            console.log('✅ Migration validation completed successfully');
            return;
        }

        if (!process.argv.includes('--yes')) {
            const readline = require('readline');
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            const answer = await new Promise(resolve => {
                rl.question('\n⚠️  Proceed with MySQL import? This will modify your database (y/N): ', resolve);
                rl.close();
            });

            if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
                console.log('❌ Migration cancelled by user');
                process.exit(0);
            }
        }

        // Step 4: Import to MySQL
        console.log('\n📥 Step 3: Importing data to MySQL...');
        const importResult = await migrationService.importToMySQL(exportData);

        // Step 5: Generate final report
        console.log('\n📊 Step 4: Generating migration report...');
        const report = await migrationService.generateReport();

        console.log('\n🎉 Migration completed successfully!');
        console.log('\n📈 Final Summary:');
        console.log(`   Users: ${report.summary.totalUsers} imported`);
        console.log(`   Sprints: ${report.summary.totalSprints} imported`);
        console.log(`   Tasks: ${report.summary.totalTasks} imported`);
        console.log(`   Comments: ${report.summary.totalComments} imported`);
        console.log(`   Assignments: ${report.summary.totalAssignments} imported`);

        console.log('\n📋 Report saved to: migration-report.json');
        console.log('📤 Export data saved to: migration-export.json');

    } catch (error) {
        console.error('\n💥 Migration failed:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Handle unhandled promises
process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
    process.exit(1);
});

// Run the migration
main();
