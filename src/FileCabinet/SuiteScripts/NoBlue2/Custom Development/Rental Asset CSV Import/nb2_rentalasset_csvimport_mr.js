/*****************************************************************************************************************************************
 * * -------------------------------------------------------------------------------------------------------------------------------------
 * Date                 Author              Purpose
 * 30 July 2025         Pan Florentzos      Initial release
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
 * This Map/Reduce script processes one or more custom-formatted CSV files containing rental asset journal data.
 * Each row in the CSV represents a journal entry (JE) line linked to a specific NetSuite project.
 *
 * Key functional objectives:
 * - Group lines by Project ID and input file.
 * - Post CREDIT lines based on account columns in the CSV.
 * - Create a single balancing DEBIT line per CSV line using a fixed account (provided by script parameter).
 * - Link the created JE to the project and vice versa.
 *
 * Validation & error handling:
 * - Projects that already have a JE (via field custentity_nb2_rental_asset_je) are skipped.
 * - Lines are validated for:
 *    - Internal ID existence of Project, Subsidiary, Department, Class, and Location
 *    - Valid date format
 *    - Presence of at least one valid CREDIT account posting
 * - If any line for a project fails validation, the entire project is skipped and its rows are output to an error CSV.
 *
 * File-level logic:
 * - Multi-file support: all CSVs in the "To Be Processed" folder are parsed and processed.
 * - Processed files are renamed with timestamp and moved to the “Processed” folder.
 * - If a file with the same name already exists in the Processed folder, it is skipped and all rows are logged as errors.
 * - For each input file:
 *    - Success: no errors → success email sent.
 *    - Failure: at least one error → error CSV written and emailed.
 *
 *
 * DEVELOPMENT NOTES
 * ---------------------------------------------------------------------------------------------------------------------------------------
 * - Internal IDs for department and class are read from 'Department Internal Id' and 'Class Internal Id' columns
 *   to avoid NetSuite validation errors when JE balancing is enforced by Dept/Class/Location.
 * - All account columns in the CSV represent CREDIT postings; the script balances each JE with a DEBIT line
 *   to a debit account (taken from script param), which is looked up at runtime.
 * - Only numeric and positive values are posted to the journal. Zero or empty values are ignored (not posted).
 * - Account columns must be numeric, non-zero, and have a valid external ID that maps to a real NetSuite account.
 * - Journal Entries are posted in the project's base currency only (no FX logic).
 *
 * - Error handling:
 *     - Invalid internal IDs (for Subsidiary, Department, Class, Location) are caught via 'lookupFields'.
 *     - Each validation error writes the original input row and error message
 *     - All project rows (valid and invalid) are included in the error CSV if any row fails
 *
 * - The error reporting is handled by writing per-project errors in map() and aggregating in summarize().
 * - Errors from the map and reduce stages are passed to summarize.
 * - Summarize writes an Error CSV to the File Cabinet showing failed lines + error messages.
 * - The summarize stage creates a formatted Error CSV file in the same structure as the Input CSV with same headers plus additional
 *   Error Message column.
 * - The Error CSV is emailed to a list of email addresses (provided by a script param).
 * - Email recipient script parameter is a comma-separated list of email addresses, optionally with whitespace.
 * - Script uses a catch-all fallback error write for any unhandled map exceptions.
 * - mapContext.write() outputs either:
 *     - A valid JE success flag (key: "success")
 *     - An error entry per line (key: projectId)
 *     - A file-level error flag (key: "error") to trigger error CSV creation
 *
 * - JE line values include: Memo, Department, Class, Location.
 * - Date is taken from the 'Date' column and parsed into NetSuite format.
 * - One JE is created per project, provided all its lines are valid.
 * - Each JE is linked back to its project via custbody_nb2_rel_proj_rent_asset_je.
 * - Each project is linked to its JE via custentity_nb2_rental_asset_je.
 *
 *
 * - Account values are read from columns with external IDs as headers. Values must be numeric and > 0.
 * - One credit line is posted per valid account. A single balancing debit line is posted per CSV row.
 * - JE line fields include: Memo, Department Internal ID, Class Internal ID, Location Internal ID
 * - Journal is saved in the project’s base currency
 * - Project is linked to the JE using 'custentity_nb2_rental_asset_je'.
 * - JE is linked back to the project using 'custbody_nb2_rel_proj_rent_asset_je'.
 *
 *
 * - Summarize stage:
 *     - Aggregates map errors by input file name
 *     - Generates one timestamped error CSV per input file if errors exist
 *     - Sends success/failure emails per input file with attachments as appropriate
 *
 *
 * - Input CSV Format rules:
 *    - Account values must be numeric and > 0
 *    - Invalid account external IDs cause all rows in that file to be skipped
 *    - Duplicate filenames in Processed folder result in all lines being skipped with error message
 *
 *
 *
 * CONFIGURATION DEPENDENCIES
 * ---------------------------------------------------------------------------------------------------------------------------------------
 * - Custom Project field:     custentity_nb2_rental_asset_je           (links to JE)
 * - Custom JE field:          custbody_nb2_rel_proj_rent_asset_je      (links to Project)
 * - Script parameter:         custscript_ra_balancingdebitaccount      – internal ID of fixed DEBIT account
 * - Script parameter:         custscript_ra_email_recipients           – comma-separated list of recipient emails
 * - Constants file:           nb2_rentalasset_csvimport_constants.js   – contains folder IDs
 *
 * - Required File Cabinet folders:
 *     - Root:                 To Be Processed
 *     - Subfolder:            Processed
 *     - Subfolder:            Errors
 *
 * - CSV format:
 *   Required Fields:   Project, Project Internal Id, Date, Subsidiary, Subsidiary Internal Id, Department Internal Id,
 *                      Class Internal Id, Memo, and one or more account columns
 *   Optional Fields:   Created From, Document Number/ID, Item, Location, Site Number. (NB These are included in the CSV for user operational purposes).
 *   Account Columns:   Must appear last in the CSV; their headers must match account external IDs
 *
 *
 * SCRIPTS
 * ---------------------------------------------------------------------------------------------------------------------------------------
 *
 * THIS SCRIPT
 * -----------
 * Script Type:                 Map/Reduce
 * File Name:                   nb2_rentalasset_csvimport_mr.js
 * File Cabinet Location:       SuiteScripts > NoBlue2 > Custom Development > Rental Asset CSV Import
 * Script Record:               NB2 Rental Asset CSV Import MR
 *                              customscript_nb2_rentalassetcsvimport_mr
 * Deployment Record:           NB2 Rental Asset CSV Import MR
 *                              customdeploy_nb2_rentalassetcsvimport_mr
 *
 *
 * RELATED SCRIPTS
 * ---------------
 * Script Type:                 JS Module
 * File Name:                   nb2_rentalasset_csvimport_constants.js
 * File Cabinet Location:       SuiteScripts > NoBlue2 > Custom Development > Rental Asset CSV Import
 *
 *
 *
 * TEST CASES
 * ---------------------------------------------------------------------------------------------------------------------------------------
 * 1. Valid CSV with 1 project and 1 account                -> JE created, email sent
 * 2. Multiple projects                                     -> Each with valid rows creates JE; errors grouped and emailed
 * 3. Project already has JE                                -> Skipped, all lines logged with project-level error
 * 4. Invalid/missing account external ID                   -> All rows skipped with error message
 * 5. Duplicate filename in Processed folder                -> All rows skipped and logged as error
 * 6. Invalid date format                                   -> JE skipped, line written to error CSV
 * 7. Missing Department/Class/Location internal ID         -> Line error logged, JE skipped
 * 8. Zero/blank account values                             -> Skipped silently, no posting created
 * 9. Mixed valid/invalid projects across multiple files    -> Separate success/failure emails, one error CSV per file
 * 10. Missing script param (e.g. debit account or email)   -> Execution fails with logged error
 *
 ***************************************************************************************************************************************** */
/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/file', 'N/format', 'N/runtime', 'N/search', 'N/email', 'N/record', './nb2_rentalasset_csvimport_constants'],
    /**
     * @param{file} file
     * @param{format} format
     * @param{runtime} runtime
     * @param{search} search
     */
    (file, format, runtime, search, email, record, constants) => {

        /**
         * Defines the function that is executed at the beginning of the map/reduce process and generates the input data.
         * @param {Object} inputContext
         * @param {boolean} inputContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {Object} inputContext.ObjectRef - Object that references the input data
         * @typedef {Object} ObjectRef
         * @property {string|number} ObjectRef.id - Internal ID of the record instance that contains the input data
         * @property {string} ObjectRef.type - Type of the record instance that contains the input data
         * @returns {Array|Object|Search|ObjectRef|File|Query} The input data to use in the map/reduce process
         * @since 2015.2
         */

        /**
         * OVERVIEW:
         * getInputData stage loads all available CSV files from the 'To Be Processed' designated folder, processes each one by parsing,
         * validating, and grouping rows by Project Internal ID, and prepares the data for the Map stage. Each CSV file
         * is renamed with a timestamp and moved to the Processed folder after being read.
         *
         *
         * Step 1: Search for all .csv files in the 'To Be Processed' folder using a file search.
         * Step 2: For each file:
         *         2.1: Load and read the CSV file content.
         *         2.2: Parse and strip surrounding quotes from headers and cell values.
         *         2.3: Extract account column names (based on numeric header names after 'Site Number').
         *         2.4: Perform a search to map external account IDs to internal NetSuite account IDs.
         *         2.5: Loop through each row, filter out non-numeric/zero values, and build valid account postings.
         *         2.6: Group all valid rows by Project Internal ID.
         * Step 3: Rename each processed file using the format [filename]_[timestamp].csv and move it to the Processed folder.
         * Step 4: Return an array of project data structures, each containing:
         *         - projectId: the Project Internal ID
         *         - lines: all valid rows for that project
         *         - inputFileName: the original filename (before renaming) for use in map/summarize
         */

        const getInputData = (inputContext) => {
            const CSV_DELIMITER = ',';

            // **********************************************************************
            // STEP 1 – Search for all CSV files in the 'To Be Processed' folder
            // **********************************************************************
            const fileSearch = search.create({
                type: 'file',
                filters: [
                    ['folder', 'anyof', constants.FOLDERS.ROOT],
                    'AND',
                    ['filetype', 'is', 'CSV']
                ],
                columns: ['internalid', 'name']
            });

            // Load up to 100 files from the folder
            const results = fileSearch.run().getRange({ start: 0, end: 100 });
            if (!results.length) {
                throw new Error('No CSV files found in import folder.');
            }

            // Utility to strip leading/trailing quotes
            function stripQuotes(value) {
                return (typeof value === 'string')
                    ? value.replace(/^"(.*)"$/, '$1').trim()
                    : value;
            }

            // Array for collecting all valid project groups from all files
            const allProjectGroups = [];


            // **********************************************************************
            // STEP 2 – Loop over each CSV file and process its contents
            // **********************************************************************

            // Loop over each file
            for (const result of results) {

                // STEP 2.1 – Load and parse the CSV file
                const fileId = result.getValue('internalid');
                const targetFileName = result.getValue('name');
                const csvFile = file.load({ id: fileId });
                const csvText = csvFile.getContents();

                // STEP 2.2 – Extract headers and parse each line into an object
                // Split header + lines and strip quotes
                const [headerLine, ...lines] = csvText.split('\n').filter(Boolean);

                const headers = headerLine
                    .split(CSV_DELIMITER)
                    .map(cell => stripQuotes(cell));


                // The end result of the above (headers) will be a structure looking like this...
                // NB All column headers after 'Site Number' are treated as account External IDs.
                // [
                //     "Project",
                //     "Project Internal Id",
                //     "Date",
                //     "Subsidiary",
                //     "Subsidiary Internal Id",
                //     "Created From",
                //     "Document Number/ID",
                //     "Item",
                //     "Department",
                //     "Department Internal Id",
                //     "Class",
                //     "Class Internal Id",
                //     "Location",
                //     "Location Internal Id",
                //     "Memo",
                //     "Site Number",
                //     "5102",
                //     "5103",
                //     "6201",
                //     "1603",
                //     "1602"
                // ]


                const dataRows = lines.map(line => {
                    const cells = line
                        .split(CSV_DELIMITER)
                        .map(cell => stripQuotes(cell));
                    return Object.fromEntries(headers.map((header, i) => [header, cells[i] || '']));
                });

                // The end result of the above (dataRows) will be a structure looking like this...
                // NB This happens per file, so if there are multiple input CSVs, each file’s dataRows will follow this same structure, one after the other.

                // {
                //     "Project": "PRJ9",
                //     "Project Internal Id": "156",
                //     "Date": "30/06/2025",
                //     "Subsidiary": "Imagesound Ltd",
                //     "Subsidiary Internal Id": "14",
                //     "Created From": "Sales Order #SO000744",
                //     "Document Number/ID": "IF000784",
                //     "Item": "Sample Rental Player 1",
                //     "Department": "Operations : Engineers",
                //     "Department Internal Id": "17",
                //     "Class": "Imagesound",
                //     "Class Internal Id": "1",
                //     "Location": "Chesterfield",
                //     "Location Internal Id": "1",
                //     "Memo": "789012 - Sample Rental Player 1 - IF000",
                //     "Site Number": "789012",
                //     "5102": "3000",
                //     "5103": "50",
                //     "6201": "20",
                //     "1603": "120",
                //     "1602": "0"
                // }




                // STEP 2.3 – Identify account columns: assume all headers after 'Site Number'(numeric headers after 'Site Number')
                const fixedColumnsEnd = headers.findIndex(h => h.toLowerCase() === 'site number') + 1;
                const accountColumns = headers.slice(fixedColumnsEnd).filter(col => /^\d+$/.test(col));

                // STEP 2.4 – Map external account IDs to internal NetSuite account IDs
                const accountInternalIdMap = {};
                if (accountColumns.length > 0) {
                    const accountSearch = search.create({
                        type: 'account',
                        filters: [['externalid', 'anyof', accountColumns]],
                        columns: ['internalid', 'externalid']
                    });
                    accountSearch.run().each(result => {
                        const extId = result.getValue('externalid');
                        const intId = result.getValue('internalid');
                        accountInternalIdMap[extId] = intId;
                        return true;
                    });
                }

                // STEP 2.5 – Group each data row by Project Internal ID with valid postings
                const groupedByProject = {};

                for (const row of dataRows) {
                    const projectId = row['Project Internal Id'];
                    if (!projectId) continue;    // Skip rows without a project ID

                    const validAccountPostings = [];
                    for (const extId of accountColumns) {
                        const value = row[extId];

                        // Accept values that are numeric, non-zero, and map to an internal account ID
                        if (value && +value !== 0 && accountInternalIdMap[extId]) {
                            validAccountPostings.push({
                                externalId: extId,
                                internalId: accountInternalIdMap[extId],
                                amount: +value
                            });
                        }
                    }

                    // Add row to project grouping
                    if (!groupedByProject[projectId]) {
                        groupedByProject[projectId] = [];
                    }

                    groupedByProject[projectId].push({
                        raw: row,
                        validAccountPostings
                    });
                }

                // The end result of the above (groupedByProject) will be a structure looking like this...
                // groupedByProject = {
                //     "156": [
                //         {
                //             raw: {
                //                 "Project": "PRJ9",
                //                 "Project Internal Id": "156",
                //                 "Date": "30/06/2025",
                //                 "Subsidiary": "Imagesound Ltd",
                //                 "Subsidiary Internal Id": "14",
                //                 "Created From": "Sales Order #SO000744",
                //                 "Document Number/ID": "IF000784",
                //                 "Item": "Sample Rental Player 1",
                //                 "Department": "Operations : Engineers",
                //                 "Department Internal Id": "17",
                //                 "Class": "Imagesound",
                //                 "Class Internal Id": "1",
                //                 "Location": "Chesterfield",
                //                 "Location Internal Id": "1",
                //                 "Memo": "Memo A",
                //                 "Site Number": "789012",
                //                 "5102": "3000",
                //                 "5103": "0",
                //                 "6201": "",
                //                 "1603": "120",
                //                 "1602": "0"
                //             },
                //             validAccountPostings: [
                //                 { externalId: "5102", internalId: "1001", amount: 3000 },
                //                 { externalId: "1603", internalId: "1004", amount: 120 }
                //             ]
                //         },
                //         {
                //             raw: {
                //                 "Project": "PRJ9",
                //                 "Project Internal Id": "156",
                //                 "Date": "30/06/2025",
                //                 "Subsidiary": "Imagesound Ltd",
                //                 "Subsidiary Internal Id": "14",
                //                 "Created From": "Sales Order #SO000745",
                //                 "Document Number/ID": "IF000785",
                //                 "Item": "Sample Rental Player 2",
                //                 "Department": "Operations : Engineers",
                //                 "Department Internal Id": "17",
                //                 "Class": "Imagesound",
                //                 "Class Internal Id": "1",
                //                 "Location": "Chesterfield",
                //                 "Location Internal Id": "1",
                //                 "Memo": "Memo B",
                //                 "Site Number": "789013",
                //                 "5102": "500",
                //                 "5103": "200",
                //                 "6201": "",
                //                 "1603": "",
                //                 "1602": "0"
                //             },
                //             validAccountPostings: [
                //                 { externalId: "5102", internalId: "1001", amount: 500 },
                //                 { externalId: "5103", internalId: "1002", amount: 200 }
                //             ]
                //         }
                //     ],
                //     "200": [
                //         {
                //             raw: {
                //                 "Project": "PRJ10",
                //                 "Project Internal Id": "200",
                //                 "Date": "30/06/2025",
                //                 "Subsidiary": "Imagesound Ltd",
                //                 "Subsidiary Internal Id": "14",
                //                 "Created From": "Sales Order #SO000750",
                //                 "Document Number/ID": "IF000790",
                //                 "Item": "Sample Rental Player 3",
                //                 "Department": "Operations",
                //                 "Department Internal Id": "18",
                //                 "Class": "Imagesound",
                //                 "Class Internal Id": "1",
                //                 "Location": "Leeds",
                //                 "Location Internal Id": "2",
                //                 "Memo": "Memo C",
                //                 "Site Number": "789014",
                //                 "5102": "100",
                //                 "5103": "0",
                //                 "6201": "",
                //                 "1603": "",
                //                 "1602": "0"
                //             },
                //             validAccountPostings: [
                //                 { externalId: "5102", internalId: "1001", amount: 100 }
                //             ]
                //         }
                //     ]
                // };





                // **********************************************************************
                // STEP 3 – Move file to 'Processed' folder and rename with timestamp
                // **********************************************************************

                const timestamp = format.format({
                    value: new Date(),
                    type: format.Type.DATETIME
                }).replace(/[:\/\s]/g, '_');    // Format: 20250729_130405

                const baseName = targetFileName.replace(/\.csv$/i, '');
                csvFile.name = `${baseName}_${timestamp}.csv`;
                csvFile.folder = constants.FOLDERS.PROCESSED;
                csvFile.save();


                // **********************************************************************
                // STEP 4 – Add all grouped projects to master array with inputFileName
                // **********************************************************************
                for (const projectId of Object.keys(groupedByProject)) {
                    allProjectGroups.push({
                        projectId,
                        lines: groupedByProject[projectId],
                        inputFileName: targetFileName   // Original filename (without timestamp)
                    });
                }
            }

            // **********************************************************************
            // STEP 5 – Return full grouped project data to be passed into map stage
            // **********************************************************************
            return allProjectGroups;
        };


        // This is an example of the full output of getInputData(), including all metadata passed to the map() stage, wrapped in the
        // final return array of grouped project objects, each tagged with the original input file name.
        // This mirrors what getInputData() ultimately returns after processing all CSVs.
        // This structure is passed directly into the map() stage via context.value.
        // Each object in the array corresponds to a project group derived from a single CSV file.
        // inputFileName allows the summarize stage to re-group results and write per-file Error CSVs.
        // lines[] always contains the full raw row and the filtered validAccountPostings.

        // Explanation
        // -----------
        // projectId: Grouping key for each set of entries.
        //
        // lines[]: All CSV rows for that project.
        //      raw: The full original CSV row, key/value by column header.
        //      validAccountPostings[]: Filtered accounts that had a numeric value > 0, and matched to an internal ID via external ID.
        //
        // This is what gets stringified and passed into the map() stage. Each object becomes mapContext.value, and the key is the projectId.

        // [
        //     {
        //         projectId: "156",
        //         inputFileName: "RentalAssetData_July.csv",
        //         lines: [
        //             {
        //                 raw: {
        //                     "Project": "PRJ9",
        //                     "Project Internal Id": "156",
        //                     "Date": "30/06/2025",
        //                     "Subsidiary": "Imagesound Ltd",
        //                     "Subsidiary Internal Id": "14",
        //                     "Created From": "Sales Order #SO000744",
        //                     "Document Number/ID": "IF000784",
        //                     "Item": "Sample Rental Player 1",
        //                     "Department": "Operations : Engineers",
        //                     "Department Internal Id": "17",
        //                     "Class": "Imagesound",
        //                     "Class Internal Id": "1",
        //                     "Location": "Chesterfield",
        //                     "Location Internal Id": "1",
        //                     "Memo": "Memo A",
        //                     "Site Number": "789012",
        //                     "5102": "3000",
        //                     "5103": "0",
        //                     "6201": "",
        //                     "1603": "120",
        //                     "1602": "0"
        //                 },
        //                 validAccountPostings: [
        //                     { externalId: "5102", internalId: "1001", amount: 3000 },
        //                     { externalId: "1603", internalId: "1004", amount: 120 }
        //                 ]
        //             },
        //             {
        //                 raw: {
        //                     "Project": "PRJ9",
        //                     "Project Internal Id": "156",
        //                     "Date": "30/06/2025",
        //                     "Subsidiary": "Imagesound Ltd",
        //                     "Subsidiary Internal Id": "14",
        //                     "Created From": "Sales Order #SO000745",
        //                     "Document Number/ID": "IF000785",
        //                     "Item": "Sample Rental Player 2",
        //                     "Department": "Operations : Engineers",
        //                     "Department Internal Id": "17",
        //                     "Class": "Imagesound",
        //                     "Class Internal Id": "1",
        //                     "Location": "Chesterfield",
        //                     "Location Internal Id": "1",
        //                     "Memo": "Memo B",
        //                     "Site Number": "789013",
        //                     "5102": "500",
        //                     "5103": "200",
        //                     "6201": "",
        //                     "1603": "",
        //                     "1602": "0"
        //                 },
        //                 validAccountPostings: [
        //                     { externalId: "5102", internalId: "1001", amount: 500 },
        //                     { externalId: "5103", internalId: "1002", amount: 200 }
        //                 ]
        //             }
        //         ]
        //     },
        //     {
        //         projectId: "200",
        //         inputFileName: "RentalAssetData_July.csv",
        //         lines: [
        //             {
        //                 raw: {
        //                     "Project": "PRJ10",
        //                     "Project Internal Id": "200",
        //                     "Date": "30/06/2025",
        //                     "Subsidiary": "Imagesound Ltd",
        //                     "Subsidiary Internal Id": "14",
        //                     "Created From": "Sales Order #SO000750",
        //                     "Document Number/ID": "IF000790",
        //                     "Item": "Sample Rental Player 3",
        //                     "Department": "Operations",
        //                     "Department Internal Id": "18",
        //                     "Class": "Imagesound",
        //                     "Class Internal Id": "1",
        //                     "Location": "Leeds",
        //                     "Location Internal Id": "2",
        //                     "Memo": "Memo C",
        //                     "Site Number": "789014",
        //                     "5102": "100",
        //                     "5103": "0",
        //                     "6201": "",
        //                     "1603": "",
        //                     "1602": "0"
        //                 },
        //                 validAccountPostings: [
        //                     { externalId: "5102", internalId: "1001", amount: 100 }
        //                 ]
        //             }
        //         ]
        //     }
        // ]




        // Example: mapContext.key and mapContext.value in the map() stage
        // Let’s say we're processing this object from getInputData():

        // {
        //   projectId: "156",
        //   lines: [ 2 grouped lines from earlier ],
        //   inputFileName: "RentalAssetImport1.csv"
        // }

        // In the map(mapContext) function:
        //
        // The key is...
        // mapContext.key === "156"
        //
        // The value (as a JSON string) is...
        //
        // mapContext.value === JSON.stringify({
        //   projectId: "156",
        //   lines: [
        //     {
        //       raw: {
        //         "Project": "PRJ9",
        //         "Project Internal Id": "156",
        //         "Date": "30/06/2025",
        //         "Subsidiary": "Imagesound Ltd",
        //         "Subsidiary Internal Id": "14",
        //         "Created From": "Sales Order #SO000744",
        //         "Document Number/ID": "IF000784",
        //         "Item": "Sample Rental Player 1",
        //         "Department": "Operations : Engineers",
        //         "Department Internal Id": "17",
        //         "Class": "Imagesound",
        //         "Class Internal Id": "1",
        //         "Location": "Chesterfield",
        //         "Location Internal Id": "1",
        //         "Memo": "Memo A",
        //         "Site Number": "789012",
        //         "5102": "3000",
        //         "5103": "0",
        //         "6201": "",
        //         "1603": "120",
        //         "1602": "0"
        //       },
        //       validAccountPostings: [
        //         { externalId: "5102", internalId: "1001", amount: 3000 },
        //         { externalId: "1603", internalId: "1004", amount: 120 }
        //       ]
        //     },
        //     {
        //       raw: {
        //         "Project": "PRJ9",
        //         "Project Internal Id": "156",
        //         "Date": "30/06/2025",
        //         "Subsidiary": "Imagesound Ltd",
        //         "Subsidiary Internal Id": "14",
        //         "Created From": "Sales Order #SO000745",
        //         "Document Number/ID": "IF000785",
        //         "Item": "Sample Rental Player 2",
        //         "Department": "Operations : Engineers",
        //         "Department Internal Id": "17",
        //         "Class": "Imagesound",
        //         "Class Internal Id": "1",
        //         "Location": "Chesterfield",
        //         "Location Internal Id": "1",
        //         "Memo": "Memo B",
        //         "Site Number": "789013",
        //         "5102": "500",
        //         "5103": "200",
        //         "6201": "",
        //         "1603": "",
        //         "1602": "0"
        //       },
        //       validAccountPostings: [
        //         { externalId: "5102", internalId: "1001", amount: 500 },
        //         { externalId: "5103", internalId: "1002", amount: 200 }
        //       ]
        //     }
        //   ],
        //   inputFileName: "RentalAssetImport1.csv"
        // });






        /**
         * Defines the function that is executed when the map entry point is triggered. This entry point is triggered automatically
         * when the associated getInputData stage is complete. This function is applied to each key-value pair in the provided
         * context.
         * @param {Object} mapContext - Data collection containing the key-value pairs to process in the map stage. This parameter
         *     is provided automatically based on the results of the getInputData stage.
         * @param {Iterator} mapContext.errors - Serialized errors that were thrown during previous attempts to execute the map
         *     function on the current key-value pair
         * @param {number} mapContext.executionNo - Number of times the map function has been executed on the current key-value
         *     pair
         * @param {boolean} mapContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {string} mapContext.key - Key to be processed during the map stage
         * @param {string} mapContext.value - Value to be processed during the map stage
         *              {
         *                  projectId: string,
         *                  lines: Array<{ raw: Object, validAccountPostings: Array<{ internalId: number, amount: number }> }>
         *              }
         *
         * @since 2015.2
         *
         * @description Processes a group of validated CSV lines for a single project, constructing and submitting
         * a Journal Entry (JE) with one credit line per account posting and a single balancing debit line.
         * Errors are logged per-row and returned via mapContext.write() for downstream reduce/summarize processing.
         *
         */

        /**
         * OVERVIEW:
         * The map() stage processes grouped rows by Project from the getInputData() output. Each entry represents
         * a batch of lines for a single project from one CSV file. The map stage performs validation, builds Journal Entries (JEs)
         * where possible, outputs any errors per line, and links the JE back to the project.
         *
         *
         * Step 1: Parse the input to extract the project ID, line data, and originating file name.
         * Step 2: Load the Project record and check whether a JE already exists (if so, output error lines and skip).
         * Step 3: Retrieve the subsidiary and currency of the project to apply to the JE.
         * Step 4: Loop through all lines and validate:
         *         - Date format
         *         - Presence of valid account postings
         *         - Validity of Department, Class, Location, Subsidiary internal IDs
         * Step 5: Output all lines to the error CSV if any validation errors are found.
         * Step 6: If all lines are valid, create the Journal Entry:
         *         - Create credit lines for valid postings
         *         - Create a single balancing debit line per CSV row
         *         - Populate line-level metadata and memo
         * Step 7: Save the JE, link it to the project, and outputs a 'success' signal for summarize().
         * Step 8: Catch any unexpected runtime errors and output at least one row with the error context.
         */

        const map = (mapContext) => {

            const logPrefix = 'MAP';
            let parsedInput, projectId, lines;

            // *********************************************************************
            // STEP 1 – Parse input and extract projectId, lines, and inputFileName
            // *********************************************************************

            parsedInput = JSON.parse(mapContext.value);
            projectId = parsedInput.projectId;
            lines = parsedInput.lines;
            const inputFileName = parsedInput.inputFileName || 'UnknownFile';

            try {

                // Initial declarations for tracking JE lines and validation
                const jeLines = [];
                const lineErrors = [];
                let journalDate;
                let hasError = false;


                // ************************************************************************************************
                // STEP 2 – Load project record and check if a JE already exists (if so, output error lines and skip)
                // ************************************************************************************************

                const project = record.load({ type: 'job', id: projectId });
                // Check if JE already exists for this project
                const projectHasJE = project.getValue({
                    fieldId: 'custentity_nb2_rental_asset_je'
                });


                if (projectHasJE) {

                    // Push all lines for this project into the error output
                    const errorLines = lines.map((line) => {
                        return {
                            ...line,
                            error: 'Journal Entry already exists for this project'
                        };
                    });

                    // Write each line for this project with the duplicate JE error
                    errorLines.forEach((errorLine) => {
                        mapContext.write({
                            key: projectId,
                            value: JSON.stringify({
                                row: errorLine.raw,
                                message: 'Journal Entry already exists for this project',
                                inputFileName
                            })
                        });
                    });

                    return; // Skip further processing
                }


                // *********************************************************************
                // STEP 3 – Get subsidiary and base currency for the project
                // *********************************************************************

                const subsidiaryId = project.getValue({ fieldId: 'subsidiary' });

                const baseCurrency = search.lookupFields({
                    type: search.Type.SUBSIDIARY,
                    id: subsidiaryId,
                    columns: ['currency']
                }).currency[0].value;

                const script = runtime.getCurrentScript();
                const debitAccountId = script.getParameter({ name: 'custscript_ra_balancingdebitaccount' });
                if (!debitAccountId) throw new Error('Missing balancing debit account script parameter.');

                // *********************************************************************
                // STEP 4 – Loop through each line to validate and prepare for JE
                // *********************************************************************

                // First pass: validate each line and track errors
                for (const lineEntry of lines) {
                    const raw = lineEntry.raw;
                    const validPostings = lineEntry.validAccountPostings || [];
                    const memo = raw['Memo'] || '';
                    const department = raw['Department Internal Id'] || '';
                    const classId = raw['Class Internal Id'] || '';
                    const location = raw['Location Internal Id'] || '';
                    const date = raw['Date'];
                    const lineKey = raw['Document Number/ID'] + '|' + memo;

                    let lineHasError = false;
                    let parsedDate;

                    // STEP 4.1 – Validate date format
                    try {
                        parsedDate = new Date(format.parse({ value: date, type: format.Type.DATE }));
                        if (isNaN(parsedDate.getTime())) throw new Error();
                    } catch (e) {
                        lineHasError = true;
                        hasError = true;
                        lineErrors.push({ row: raw, message: `Invalid date: ${date}`, lineKey });
                    }

                    // STEP 4.2 – Ensure at least one valid account posting exists
                    if (validPostings.length === 0) {
                        lineHasError = true;
                        hasError = true;
                        lineErrors.push({ row: raw, message: `No valid account postings for line`, lineKey });
                    }


                    // STEP 4.3 – Helper function for validating internal IDs
                    function isValidInternalId(type, id) {
                        try {
                            if (!id || isNaN(parseInt(id))) return false;
                            const fields = search.lookupFields({ type, id, columns: ['internalid'] });
                            return !!fields.internalid;
                        } catch (e) {
                            return false;
                        }
                    }


                    // STEP 4.4 – Validate department/class/location/subsidiary internal IDs

                    // Validate department
                    if (department && !isValidInternalId(search.Type.DEPARTMENT, department)) {
                        lineHasError = true;
                        hasError = true;
                        lineErrors.push({ row: raw, message: `Invalid Department ID: ${department}`, lineKey });
                    }

                    // Validate class
                    if (classId && !isValidInternalId(search.Type.CLASSIFICATION, classId)) {
                        lineHasError = true;
                        hasError = true;
                        lineErrors.push({ row: raw, message: `Invalid Class ID: ${classId}`, lineKey });
                    }

                    // Validate location
                    if (location && !isValidInternalId(search.Type.LOCATION, location)) {
                        lineHasError = true;
                        hasError = true;
                        lineErrors.push({ row: raw, message: `Invalid Location ID: ${location}`, lineKey });
                    }

                    // Validate subsidiary
                    const subsidiaryId = raw['Subsidiary Internal Id'];
                    if (subsidiaryId && !isValidInternalId(search.Type.SUBSIDIARY, subsidiaryId)) {
                        lineHasError = true;
                        hasError = true;
                        lineErrors.push({ row: raw, message: `Invalid Subsidiary ID: ${subsidiaryId}`, lineKey });
                    }


                    // STEP 4.5 –  Validate project (already handled earlier, but optionally refactor it here)
                    const projectId = parsedInput.projectId;
                    if (!isValidInternalId('job', projectId)) {
                        throw new Error(`Invalid Project ID: ${projectId}`);
                    }


                    // STEP 4.6 – Store all line info (even invalid) for downstream use

                    // Prepare lines even if there's an error — in case JE is skipped
                    jeLines.push({
                        raw,
                        lineKey,
                        valid: !lineHasError,
                        date: parsedDate,
                        postings: validPostings,
                        memo,
                        department,
                        class: classId,
                        location
                    });
                }


                // **********************************************************************************************************************
                // STEP 5 – Output all lines to the error CSV if any validation errors are found and skip JE creation if any lines failed
                // **********************************************************************************************************************

                if (hasError) {
                    // Output all lines to the error file (both valid and invalid)
                    for (const line of jeLines) {

                        const matchingError = lineErrors.find(e => e.lineKey === line.lineKey);

                        mapContext.write({
                            key: projectId,
                            value: JSON.stringify({
                                row: line.raw,
                                message: matchingError?.message || '',
                                inputFileName
                            })
                        });

                        // Example output of the above mapContext.write...
                        // key: "156",
                        // value: JSON.stringify({
                        //   row: {
                        //     "Project": "PRJ9",
                        //     "Project Internal Id": "156",
                        //     "Date": "30/06/2025",
                        //     "Subsidiary": "Imagesound Ltd",
                        //     "Subsidiary Internal Id": "14",
                        //     ...
                        //     "5102": "3000",
                        //     "5103": "0"
                        //   },
                        //   message: "Invalid Department ID", // only present on failing rows
                        //   inputFileName: "RentalAssetImport1.csv"
                        // })

                    }

                    // Output one special 'error' key entry for this file
                    mapContext.write({
                        key: 'error',
                        value: JSON.stringify({
                            inputFileName: inputFileName
                        })
                    });

                    log.audit(`${logPrefix}: JE aborted for ${projectId}`, 'Validation errors found.');
                    return;
                }

                // *********************************************************************
                // STEP 6 – If all lines are valid, create the Journal Entry
                // *********************************************************************

                // No errors, create Journal Entry
                const je = record.create({ type: record.Type.JOURNAL_ENTRY, isDynamic: true });
                je.setValue({ fieldId: 'subsidiary', value: subsidiaryId });
                je.setValue({ fieldId: 'currency', value: baseCurrency });

                const firstValidLine = jeLines.find(l => l.valid);
                if (firstValidLine?.date) {
                    je.setValue({ fieldId: 'trandate', value: firstValidLine.date });
                }

                je.setValue({ fieldId: 'memo', value: `Rental asset import for Project ${projectId}` });
                je.setValue({ fieldId: 'custbody_nb2_rel_proj_rent_asset_je', value: projectId });

                // STEP 6.1 – Create JE lines for each valid posting (credit and debit)
                for (const line of jeLines.filter(l => l.valid)) {
                    let creditSubtotal = 0;
                    for (const posting of line.postings) {
                        je.selectNewLine({ sublistId: 'line' });
                        je.setCurrentSublistValue({ sublistId: 'line', fieldId: 'account', value: posting.internalId });
                        je.setCurrentSublistValue({ sublistId: 'line', fieldId: 'credit', value: posting.amount });
                        if (line.memo) je.setCurrentSublistValue({ sublistId: 'line', fieldId: 'memo', value: line.memo });
                        if (line.department) je.setCurrentSublistValue({ sublistId: 'line', fieldId: 'department', value: line.department });
                        if (line.class) je.setCurrentSublistValue({ sublistId: 'line', fieldId: 'class', value: line.class });
                        if (line.location) je.setCurrentSublistValue({ sublistId: 'line', fieldId: 'location', value: line.location });
                        je.commitLine({ sublistId: 'line' });

                        creditSubtotal += posting.amount;
                    }

                    // STEP 6.2 – Create corresponding debit line
                    if (creditSubtotal > 0) {
                        je.selectNewLine({ sublistId: 'line' });
                        je.setCurrentSublistValue({ sublistId: 'line', fieldId: 'account', value: debitAccountId });
                        je.setCurrentSublistValue({ sublistId: 'line', fieldId: 'debit', value: creditSubtotal });
                        if (line.memo) je.setCurrentSublistValue({ sublistId: 'line', fieldId: 'memo', value: line.memo });
                        if (line.department) je.setCurrentSublistValue({ sublistId: 'line', fieldId: 'department', value: line.department });
                        if (line.class) je.setCurrentSublistValue({ sublistId: 'line', fieldId: 'class', value: line.class });
                        if (line.location) je.setCurrentSublistValue({ sublistId: 'line', fieldId: 'location', value: line.location });
                        je.commitLine({ sublistId: 'line' });
                    }
                }

                // *********************************************************************************************
                // STEP 7 - Save the JE, link it to the project, and outputs a 'success' signal for summarize().
                // *********************************************************************************************
                const jeId = je.save({ enableSourcing: true, ignoreMandatoryFields: false });

                mapContext.write({
                    key: 'success',
                    value: JSON.stringify({
                        inputFileName: inputFileName
                    })
                });

                // Example of the above mapContext.write...
                // key: "success",
                // value: JSON.stringify({
                //   projectId: "156",
                //   inputFileName: "RentalAssetImport1.csv"
                // })



                // Update project with created JE ID
                try {
                    log.audit('Linking JE to project', { projectId, jeId });

                    record.submitFields({
                        type: 'job',
                        id: projectId,
                        enableSourcing: false,
                        ignoreMandatoryFields : true,
                        values: { custentity_nb2_rental_asset_je: jeId }
                    });
                } catch (e) {
                    log.error('Failed to update project with JE ID', e);
                }

            } catch (outerErr) {
                // ***********************************************************************************************************************
                // STEP 8 – Catch-all error handler: Catch any unexpected runtime errors and output at least one row with the error context.
                // ***********************************************************************************************************************

                log.error(`${logPrefix}: Unhandled Error`, outerErr);
                const fallbackRow = parsedInput?.lines?.[0]?.raw || {};
                mapContext.write({
                    key: projectId || 'unknown',
                    value: JSON.stringify({
                        message: outerErr.message,
                        stack: outerErr.stack,
                        row: fallbackRow,
                        inputFileName
                    })
                });
            }
        };




        /**
         * Defines the function that is executed when the summarize entry point is triggered. This entry point is triggered
         * automatically when the associated reduce stage is complete. This function is applied to the entire result set.
         * @param {Object} summaryContext - Statistics about the execution of a map/reduce script
         * @param {number} summaryContext.concurrency - Maximum concurrency number when executing parallel tasks for the map/reduce
         *     script
         * @param {Date} summaryContext.dateCreated - The date and time when the map/reduce script began running
         * @param {boolean} summaryContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {Iterator} summaryContext.output - Serialized keys and values that were saved as output during the reduce stage
         * @param {number} summaryContext.seconds - Total seconds elapsed when running the map/reduce script
         * @param {number} summaryContext.usage - Total number of governance usage units consumed when running the map/reduce
         *     script
         * @param {number} summaryContext.yields - Total number of yields when running the map/reduce script
         * @param {Object} summaryContext.inputSummary - Statistics about the input stage
         * @param {Object} summaryContext.mapSummary - Statistics about the map stage
         * @param {Object} summaryContext.reduceSummary - Statistics about the reduce stage
         * @since 2015.2
         *
         * @description This function collects all project-level error outputs from the reduce stage, compiles them into a
         *              CSV file, saves it to the File Cabinet (Errors folder), and emails it to the configured recipients.
         *
         */

        /**
         * OVERVIEW:
         * The `summarize()` stage collects the results outputted from all map() executions. It separates successful imports
         * from failed ones by tracking outputted keys. It generates a per-file error CSV for failures and sends success or error
         * emails based on the presence of issues in each input file.
         *
         * Step 1: Get the list of email recipients from the script parameter.
         * Step 2: Iterate through map outputs:
         *         - Track which files had at least one error (key === 'error')
         *         - Collect actual failed rows (key !== 'success') by input file
         *         - Track successful files (key === 'success')
         * Step 3: For each file with validation errors:
         *         - Construct error CSV with original row data and error messages
         *         - Save to the File Cabinet (Errors folder) with timestamped filename
         *         - Send email to recipients with the error file attached
         * Step 4: For all files that had no errors:
         *         - Send a success email to recipients
         * Step 5: Log a final summary of how many files were processed and notify the audit trail.
         */
        const summarize = (summaryContext) => {
            const logPrefix = 'SUMMARIZE';
            const ERROR_FOLDER_ID = constants.FOLDERS.ERRORS;
            const filesWithErrors = new Set();
            const allFileNames = new Set(); // Track every input file seen

            // ***************************************************************
            // STEP 1 – Retrieve list of notification recipients from parameter
            // ***************************************************************
            const recipients = (runtime.getCurrentScript()
                .getParameter({ name: 'custscript_ra_email_recipients' }) || '')
                .split(',')
                .map(email => email.trim())
                .filter(Boolean); // removes blanks

            const errorsByFile = {};

            // ***************************************************************
            // STEP 2 – Group map output rows by base file name (no .csv extension)
            // ***************************************************************

            // Group errors by inputFileName
            summaryContext.output.iterator().each((key, value) => {
                try {
                    const parsed = JSON.parse(value);
                    const inputFileName = parsed.inputFileName || 'UnknownFile.csv';
                    const baseName = inputFileName.replace(/\.csv$/i, '');

                    // Track every base filename encountered in the Map output — whether or not errors were found
                    allFileNames.add(baseName);

                    if (key === 'error') {
                        const inputFileName = parsed.inputFileName || 'UnknownFile.csv';
                        const baseName = inputFileName.replace(/\.csv$/i, '');
                        filesWithErrors.add(baseName);
                        return true;
                    }

                    if (key === 'success') {
                        const parsed = JSON.parse(value);
                        const baseName = (parsed.inputFileName || 'UnknownFile.csv').replace(/\.csv$/i, '');
                        allFileNames.add(baseName);
                        return true;
                    }

                    // Normal error row (with row + message)
                    if (!errorsByFile[baseName]) errorsByFile[baseName] = [];
                    if (parsed.row || parsed.message) {
                        errorsByFile[baseName].push(parsed);
                    }


                } catch (e) {
                    log.error(`${logPrefix}: Error parsing map output`, {
                        error: e.message,
                        stack: e.stack,
                        rawValue: value
                    });
                }
                return true;
            });


            // Example of what summaryContext.output.iterator() would output across multiple projects and multiple input CSV files,
            // assuming the following scenarios:

            // - Two CSV files were processed:
            //      RentalAssetImport1.csv
            //      RentalAssetImport2.csv
            //
            // - File 1 had:
            //      One successful project (156)
            //      One failed project (157)
            //
            // - File 2 had:
            //      One successful project (200)

            // key: '156' - Error-free project but no error written under this key
            // key: '157' - Validation errors (2 rows written)
            // key: '200' - No errors written under this key
            //
            // Output from map() for failed project 157...

            // [
            //   {
            //     key: '157',
            //     value: JSON.stringify({
            //       row: {
            //         "Project": "PRJ10",
            //         "Project Internal Id": "157",
            //         "Date": "01/07/2025",
            //         [Other fields here]
            //         "5102": "0",
            //         "5103": "0"
            //       },
            //       message: "No valid account postings found",
            //       inputFileName: "RentalAssetImport1.csv"
            //     })
            //   },
            //   {
            //     key: '157',
            //     value: JSON.stringify({
            //       row: {
            //         "Project": "PRJ10",
            //         "Project Internal Id": "157",
            //         "Date": "01/07/2025",
            //         [Other fields heer]
            //         "5102": "0",
            //         "5103": "150"
            //       },
            //       message: "",  // No error, but included to preserve CSV row
            //       inputFileName: "RentalAssetImport1.csv"
            //     })
            //   },
            //
            //   Output from map() as a success flag for project 156
            //   {
            //     key: 'success',
            //     value: JSON.stringify({
            //       projectId: '156',
            //       inputFileName: 'RentalAssetImport1.csv'
            //     })
            //   },
            //
            //   // Output from map() as a success flag for project 200
            //   {
            //     key: 'success',
            //     value: JSON.stringify({
            //       projectId: '200',
            //       inputFileName: 'RentalAssetImport2.csv'
            //     })
            //   }
            // ]


            // How summarize() will handle the above:
            //
            // In summarize():
            // Groups all key !== 'success' entries by their inputFileName (used for error CSVs and error emails)
            // Collects key === 'success' entries and tracks inputFileName (used for success emails)
            // Build allFileNames from both sources (success and error lines)
            // Detect files that had only successes (no error CSV outputted) and trigger a success email

            // Resulting Actions will be:
            // RentalAssetImport1.csv has errors, so...
            //      Error CSV created
            //      Error email sent
            //
            // RentalAssetImport2.csv has no errors, only success entries, so...
            //      Success email sent
            //      No error CSV generated




            // ***************************************************************
            // STEP 3 – For each file, build and send a CSV with failed rows
            // ***************************************************************

            // Loop through each input file's errors and generate a CSV + email
            for (const baseName in errorsByFile) {
                const errors = errorsByFile[baseName];
                if (!errors.length) continue;

                // ***************************************************************
                // STEP 3.1 – Define fixed and dynamic CSV headers
                // ***************************************************************

                // Get headers from the first row, fallback to empty
                const fixedHeaders = [
                    'Project',
                    'Project Internal Id',
                    'Date',
                    'Subsidiary',
                    'Subsidiary Internal Id',
                    'Created From',
                    'Document Number/ID',
                    'Item',
                    'Department',
                    'Department Internal Id',
                    'Class',
                    'Class Internal Id',
                    'Location',
                    'Location Internal Id',
                    'Memo',
                    'Site Number'
                ];

                // Any additional keys found in first row (e.g. user-defined columns)
                const dynamicHeaders = Object.keys(errors[0].row || {}).filter(
                    h => !fixedHeaders.includes(h)
                );

                const headers = [...fixedHeaders, ...dynamicHeaders, 'Error Message'];
                const csvLines = [headers.join(',')];

                // *******************************************************************
                // STEP 3.2 – Build CSV rows, escaping all values and adding error msg
                // *******************************************************************
                for (const err of errors) {
                    const row = err.row || {};
                    const message = err.message || '';
                    const line = headers.map(h => {
                        if (h === 'Error Message') {
                            return `"${message.replace(/"/g, '""')}"`;
                        }
                        const val = row[h] !== undefined ? row[h] : '';
                        return `"${String(val).replace(/"/g, '""')}"`;
                    });
                    csvLines.push(line.join(','));
                }

                // ***************************************************************
                // STEP 3.3 – Generate timestamped filename
                // ***************************************************************

                // Generate timestamp
                const timestamp = format.format({
                    value: new Date(),
                    type: format.Type.DATETIME
                }).replace(/[:\/\s]/g, '_');    // e.g. 20250722_153045


                const filename = `${baseName}_Errors_${timestamp}.csv`;

                // ***************************************************************
                // STEP 3.4 – Write CSV file to File Cabinet and send email
                // ***************************************************************
                try {
                    const fileObj = file.create({
                        name: filename,
                        fileType: file.Type.CSV,
                        contents: csvLines.join('\n'),
                        folder: ERROR_FOLDER_ID
                    });

                    const fileId = fileObj.save();
                    const fileRef = file.load({ id: fileId });

                    log.audit(`${logPrefix}: Error CSV Created`, {
                        filename,
                        fileId,
                        url: fileRef.url
                    });


                    // Send notification email with error CSV attached
                    if (recipients.length > 0) {
                        try {
                            email.send({
                                author: -5, // -5 = default user
                                recipients,
                                subject: `Rental Asset Import Errors – ${baseName}`,
                                body: `Some rows failed to import from file ${baseName}.csv. See attached error report.`,
                                attachments: [fileRef]
                            });
                            log.audit(`${logPrefix}: Error email sent`, {
                                recipients,
                                filename
                            });

                        } catch (e) {
                            log.error('Failed to send email', e);
                        }

                    }


                } catch (fileErr) {
                    log.error(`${logPrefix}: Failed to write/send error CSV for ${baseName}`, fileErr);
                }
            }


            // ***************************************************************
            // STEP 4 – Send SUCCESS notification email
            // ***************************************************************

            for (const baseName of allFileNames) {

                if (!errorsByFile[baseName]) {

                    try {
                        if (recipients.length > 0) {
                            email.send({
                                author: -5,
                                recipients,
                                subject: `Rental Asset Import Successful – ${baseName}`,
                                body: `The rental asset import for file ${baseName}.csv completed successfully with no errors.`
                            });
                            log.audit(`${logPrefix}: Success email sent`, {
                                recipients,
                                filename: `${baseName}.csv`
                            });
                        }

                    } catch (e) {
                        log.error('Failed to send email', e);
                    }

                }
            }


            // ***************************************************************
            // STEP 5 – Final log to summarize processing
            // ***************************************************************
            log.audit(`${logPrefix}: Summarize complete`, {
                filesProcessed: Object.keys(errorsByFile).length,
                recipients
            });
        };


        return {getInputData, map, summarize}

    });
