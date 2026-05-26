/*****************************************************************************************************************************************
 * * -------------------------------------------------------------------------------------------------------------------------------------
 * Date                 Author              Purpose
 * 10 April 2025        Pan Florentzos      Initial release
 *
 *
 * NB2 PROJECT
 * ---------------------------------------------------------------------------------------------------------------------------------------
 *
 * Project/SoW/Case:    Rental Asset Custom CSV Import
 * Client:              Imagesound
 * Task:                JIRA Task IS1026-207
 *
 *
 * OVERVIEW
 * ---------------------------------------------------------------------------------------------------------------------------------------
 * This script is a constants module used by the Rental Asset CSV Import Map/Reduce script.
 * It provides a centralised definition of fixed values, such as:
 *      File Cabinet folder IDs
 *      External Account IDs
 *      Column header labels used in the CSV import file
 *      Custom field IDs
 *
 * Storing these values in one place improves maintainability, avoids duplication, and reduces the risk of typos
 * or inconsistencies across related scripts. It also makes it easier to update configuration values
 * (e.g., changing folder IDs or field IDs) without modifying business logic.
 *
 *
 * Functionality of this Customisation
 * -----------------------------------
 * - Exports a set of constants used in the main Map/Reduce logic
 * - Folder and field IDs are clearly labeled with comments for context
 * - Keeps business logic clean and focused in the main processing script
 *
 *
 * DEVELOPMENT NOTES
 * ---------------------------------------------------------------------------------------------------------------------------------------
 * - Folder IDs refer to File Cabinet directories created manually or by SuiteScript.
 * - If folder or field IDs change in the environment, this module must be updated accordingly.
 * - This script is imported as a standard 'require()' module in the Map/Reduce script.
 *
 * CONFIGURATION DEPENDENCIES
 * ---------------------------------------------------------------------------------------------------------------------------------------
 * The following NetSuite elements must exist and match the external/internal IDs declared in this constants file:
 *
 *  1. File Cabinet Folders:
 *      - Root Folder:            'NoBlue2 - Rental Asset CSV Import' (ID: 2957)
 *      - Processed Folder:       'Processed'                         (ID: 2958)
 *      - Error Folder:           'Errors'                            (ID: 2959)
 *
 *  2. Chart of Accounts:
 *      - Balancing Account:      External ID: '0470'
 *
 * 3. Custom Field:
 *      - Project > JE Link Field: ID: 'custentity_nb2_rental_asset_je'
 *
 *
 *
 * SCRIPTS
 * ---------------------------------------------------------------------------------------------------------------------------------------
 *
 * THIS SCRIPT
 * -----------
 * Script Type:                 JS Module
 * File Name:                   nb2_rentalasset_csvimport_constants.js
 * File Cabinet Location:       SuiteScripts > NoBlue2 > Custom Development > Rental Asset CSV Import
 *

 *
 *
 * RELATED SCRIPTS
 * ---------------
 * Script Type:                 Map/Reduce
 * File Name:                   nb2_rentalasset_csvimport_mr.js
 * File Cabinet Location:       SuiteScripts > NoBlue2 > Custom Development > Rental Asset CSV Import
 * Script Record:               NB2 Rental Asset CSV Import MR
 *                              customscript_nb2_rentalassetcsvimport_mr
 * Deployment Record:           NB2 Rental Asset CSV Import MR
 *                              customdeploy_nb2_rentalassetcsvimport_mr
 *
 *
 *
 * TEST CASES
 * ---------------------------------------------------------------------------------------------------------------------------------------
 *
 *
 *
 *
 ***************************************************************************************************************************************** */


/**
 * @NApiVersion 2.1
 * @NModuleScope Public
 */

define([], () => {
    return {
        // Folder IDs
        FOLDERS: {
            ROOT: 3459,         // 'To Be Processed'
            PROCESSED: 3460,    // 'Processed'
            ERRORS: 3461        // 'Errors'
        },

        // Custom field for linking JE back to Project
        CUSTOM_FIELDS: {
            PROJECT_RENTAL_ASSET_JE: 'custentity_nb2_rental_asset_je'
        },

        // Script parameter: email recipients (Multi-select employee)
        SCRIPT_PARAMS: {
            EMAIL_RECIPIENTS: 'custscript_ra_email_recipients'
        }
    };
});
