/**
 *
 * @summary     : Main Hub for all Estimate PDF Details
 *
 * @description :
 *
 * @name        : nb2ims_estimate_pdf_details_lib.js
 * @copyright   : NoBlue2
 * @author      : JMT
 * @created     : 14/08/2025
 *
 *
 * Version          Date                Author          Details
 * 1.0              14/08/2025          NB2(JT)         IS1026-396 - Advanced PDF Template for Estimate/Quote
 *
 */

 /**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 */


define(['N/runtime'],
    (runtime) => {

        let exports = {};

        /**
         * Creates a cleaned and consolidated table section object from a NetSuite record.
         *
         * This function processes line items from the `item` sublist of the provided `newRecord`,
         * grouping them by their estimated table section name. It consolidates item quantities
         * by category and stores the resulting data across multiple custom fields if necessary.
         *
         * @param {Object} newRecord - A NetSuite record object containing item sublist data.
         * The record is expected to support methods like `getLineCount`, `getSublistValue`,
         * `getSublistText`, and `setValue`.
         *
         * @returns {Object} - A cleaned and consolidated object where each key is a section name,
         * and each value is an array of item objects with `itemId`, `description`, `itemName` (category),
         * and `quantity`.
         */
        exports.createTableSectionObject    = function (newRecord){
            let lineCount = newRecord.getLineCount({sublistId: 'item'});
            let estimateTableSection = this.estimatePDFConstants({runtime: true});
            let serviceSectionName = estimateTableSection.serviceSectionName;
            let latePOInstructionName = estimateTableSection.latePOInstruction.name;
            let cleanedTableSectionObj = {};
            if(lineCount > 0){
                let tableSectionObj = {}
                //CREATE THE INITIAL OBJECT DATA
                for(let x=0; x<lineCount; x++) {
                    let itemSection = newRecord.getSublistValue({sublistId: 'item', fieldId: 'custcol_nb2_est_table_section', line: x});
                    let itemType = newRecord.getSublistValue({sublistId: 'item', fieldId: 'itemtype', line: x});
                    let itemId = Number(newRecord.getSublistValue({sublistId: 'item', fieldId: 'item', line: x}));
                    let itemName = '';
                    try{
                        itemName = newRecord.getSublistText({sublistId: 'item', fieldId: 'item', line: x});
                    }
                    catch(e){
                        itemName = itemId;
                    }
                    let description = newRecord.getSublistValue({sublistId: 'item', fieldId: 'description', line: x});
                    if(!description){
                        description = itemName;
                    }
                    let category = newRecord.getSublistText({sublistId: 'item', fieldId: 'custcol_nb2_itm_cat', line: x});
                    let quantity = Number(newRecord.getSublistValue({sublistId: 'item', fieldId: 'quantity', line: x}));

                    let latePOInstructionId = estimateTableSection.latePOInstruction.id;
                    let sectionName = '';
                    if(itemId !== latePOInstructionId){
                        sectionName = itemSection;
                    }
                    else{
                        sectionName = latePOInstructionName;
                    }

                    sectionName = sectionName.toString().toUpperCase();
                    if(!tableSectionObj[sectionName]){
                        tableSectionObj[sectionName] = new Array();
                    }

                    tableSectionObj[sectionName].push({
                        itemId: itemId,
                        description: description,
                        itemName: category,
                        quantity: quantity
                    });
                }
                log.audit('tableSectionObj',tableSectionObj);

                //REMOVE NULL OBJECT KEYS
                let cleanedData = Object.fromEntries(
                    Object.entries(tableSectionObj).filter(([key]) => key.trim() !== "")
                );
                log.audit('cleanedData',cleanedData);

                //CONSOLIDATE THE OBJECT ARRAY PER ITEM CATEGORY, QUANTITY WILL BE TOTALED.
                cleanedTableSectionObj = this.consolidatePerItemDescription(cleanedData);
                // log.audit('Object.keys(cleanedTableSectionObj)',Object.keys(cleanedTableSectionObj));
            }

            let tableDetailsObjFieldCount = this.countTableDetailsObjectField({newRecord:newRecord});
            if(tableDetailsObjFieldCount > 0){
                let cleanedTableSectionStr = JSON.stringify(cleanedTableSectionObj);
                let splittedData = this.splitStringByFieldCount(cleanedTableSectionStr, tableDetailsObjFieldCount);

                // log.audit('splittedData',splittedData);

                for(let x=0; x<tableDetailsObjFieldCount; x++){
                    newRecord.setValue({fieldId: this.estimatePDFConstants().tableDetailsObject+x, value: splittedData[x]});
                }
            }
            return cleanedTableSectionObj;
        }

        /**
         * Consolidates item quantities by category within each group of a table section object.
         *
         * @param {Object} tableSectionObj - An object where each key represents a group and its value is an array of items.
         * Each item is expected to have a `category` (string) and `quantity` (number).
         *
         * @returns {Object} - An object with the same group keys, where each value is an array of objects.
         * Each object contains a `category` and the total `quantity` for that category within the group.
         */
        exports.consolidatePerItemCategory = function(tableSectionObj){
            const consolidated = {};

            for (const [groupKey, items] of Object.entries(tableSectionObj)) {
                const categoryMap = {};

                items.forEach(item => {
                    if (!item.category) return; // skip empty categories
                    if (!categoryMap[item.category]) {
                        categoryMap[item.category] = 0;
                    }
                    categoryMap[item.category] += item.quantity;
                });

                // Convert categoryMap to array of objects
                consolidated[groupKey] = Object.entries(categoryMap).map(([category, quantity]) => ({
                    category,
                    quantity
                }));
            }
            return consolidated;
        }

        /**
         * Consolidates item quantities by their description within each group of a table section.
         *
         * This function takes an object where each key represents a group (e.g., a section of a table),
         * and the value is an array of item objects. Each item object should have a `description` and `quantity`.
         * It aggregates the quantities of items with the same description within each group.
         *
         * @param {Object} tableSectionObj - An object where keys are group identifiers and values are arrays of item objects.
         * @param {string} tableSectionObj[].description - The description of the item.
         * @param {number} tableSectionObj[].quantity - The quantity of the item.
         *
         * @returns {Object} - A new object with the same group keys, where each value is an array of objects
         *                     containing `description` and the total `quantity` for that description.
         */
        exports.consolidatePerItemDescription = function(tableSectionObj){
            const consolidated = {};

            for (const [groupKey, items] of Object.entries(tableSectionObj)) {
                const categoryMap = {};

                items.forEach(item => {
                    if (!item.description) return; // skip empty categories
                    if (!categoryMap[item.description]) {
                        categoryMap[item.description] = 0;
                    }
                    categoryMap[item.description] += item.quantity;
                });

                // Convert categoryMap to array of objects
                consolidated[groupKey] = Object.entries(categoryMap).map(([description, quantity]) => ({
                    description,
                    quantity
                }));
            }
            return consolidated;
        }

        /**
         * Sorts the table section keys by excluding specific sections and appending the service section last.
         *
         * This function filters out empty strings, the "Services" section, and the "Late PO Instruction" section
         * from the provided `tableSectionObj` keys. It then appends the "Services" section at the end of the list.
         * The comparison is case-insensitive by converting section names to uppercase.
         *
         * @param {Object} tableSectionObj - An object whose keys represent table section names.
         * @returns {string[]} A sorted array of section names, with "Services" placed at the end.
         */
        exports.sortTableSection = function(tableSectionObj) {
            let estimateTableSection = this.estimatePDFConstants();
            let serviceSectionName = estimateTableSection.serviceSectionName.toUpperCase();
            let latePOInstructionName = estimateTableSection.latePOInstruction.name.toUpperCase();
            let tableSection = Object.keys(tableSectionObj)
            let cleaned = tableSection.filter(item => item && item.trim() !== serviceSectionName && item.trim() !== latePOInstructionName && item.trim() !== "");
            let services = tableSection.filter(item => item === serviceSectionName);
            return cleaned.concat(services);
        }

        /**
         * Returns a set of constants used for generating the Estimate Advanced PDF.
         *
         * This includes static labels, field IDs, and optionally retrieves the internal ID of the
         * "Late PO Instruction" item from a script parameter if `context.runtime` is available.
         *
         * @param {Object} context - The script context object.
         * @param {Object} [context.runtime] - Optional runtime object, typically available in Map/Reduce or scheduled scripts.
         * @returns {Object} An object containing constants used in the Estimate PDF generation.
         * @property {string} serviceSectionName - The label used for the services section.
         * @property {Object} latePOInstruction - Contains the name and internal ID of the Late PO Instruction item.
         * @property {string} latePOInstruction.name - The label for the Late PO Instruction section.
         * @property {number} latePOInstruction.id - The internal ID retrieved from the script parameter, or -1 if not available.
         * @property {string} tableDetailsObject - The field ID prefix used for table detail fields.
         * @property {string} CUSTOMFORM_IMS_Quote - The name of the custom form used for IMS Quotes.
         */
        exports.estimatePDFConstants = function (context){
            let latePOInstructionId = -1;
            if(context?.runtime){
                latePOInstructionId = Number(runtime.getCurrentScript().getParameter({name: 'custscript_nb2_latepoinstruction_item'}));
            }
            return{
                serviceSectionName : 'Services',
                latePOInstruction : {
                    name: 'Late PO Instruction',
                    id: latePOInstructionId
                },
                tableDetailsObject : 'custbody_nb2_table_details_object',
                CUSTOMFORM_IMS_Quote : 'IMS - Quote'
            }
        }

        /**
         * Sets the section sorting value on the estimate record by joining table section identifiers.
         *
         * This function takes the `tableSection` array from the context and joins its elements using a semicolon (`;`),
         * then sets the resulting string to the custom field `custbody_nb2_est_section_sorting` on the record.
         * The semicolon is used as a delimiter for parsing in the Estimate Advanced PDF.
         *
         * @param {Object} context - The script context object.
         * @param {Record} context.newRecord - The NetSuite record object being modified.
         * @param {string[]} context.tableSection - An array of section identifiers to be joined and stored.
         *
         * @returns {void}
         */
        exports.setSectionSortingValue = function(context){
            //THE SEMICOLON IN "tableSection.join(';')" IS BEING USED AS A SPLIT VALUE IN ESTIMATE ADVANCED PDF
            context.newRecord.setValue({fieldId: 'custbody_nb2_est_section_sorting', value: context.tableSection.join(';')});
        }

        /**
         * Updates the display type of sequentially named table detail fields on a form.
         *
         * This function loops through fields named using the pattern defined in `estimatePDFConstants().tableDetailsObject`
         * followed by an incrementing index (e.g., tableDetailsObject0, tableDetailsObject1, ...), and applies the specified
         * display type to each field (e.g., hidden, inline, disabled).
         *
         * @param {Object} context - The script context object.
         * @param {Form} context.form - The NetSuite form object where fields are being modified.
         * @param {string} context.fieldDisplayType - The display type to apply (e.g., 'hidden', 'inline', 'disabled').
         *
         * @returns {void}
         */
        exports.hideTableDetailsObjectField = function(context){
            let tableDetailsObjectField = '';
            let fieldCounter = 0;
            do{
                tableDetailsObjectField = context.form.getField({id: this.estimatePDFConstants().tableDetailsObject+fieldCounter});
                if(tableDetailsObjectField){
                    tableDetailsObjectField.updateDisplayType({
                        displayType: context.fieldDisplayType
                    });
                }
                fieldCounter++;
            }
            while(tableDetailsObjectField)
        }

        /**
         * Counts the number of sequentially named table detail fields present in the record or form context.
         *
         * This function checks for fields named using the pattern defined in `estimatePDFConstants().tableDetailsObject`
         * followed by an incrementing index (e.g., tableDetailsObject0, tableDetailsObject1, ...), and returns the count
         * of how many such fields exist.
         *
         * @param {Object} context - The script context object, which may contain either `newRecord` or `form`.
         * @param {Record} [context.newRecord] - The record being processed (e.g., in User Event or Client Script).
         * @param {Form} [context.form] - The form object (e.g., in Suitelet or beforeLoad).
         * @returns {number} The number of table detail fields found.
         */
        exports.countTableDetailsObjectField = function(context){
            let tableDetailsObjectField = '';
            let fieldCounter = 0;
            do{
                if(context.newRecord){
                    tableDetailsObjectField = context.newRecord.getField({fieldId: this.estimatePDFConstants().tableDetailsObject+fieldCounter});
                }
                else if(context.form){
                    tableDetailsObjectField = context.form.getField({id: this.estimatePDFConstants().tableDetailsObject+fieldCounter});
                }
                // log.audit('fieldCounter',fieldCounter);
                if(tableDetailsObjectField){
                    // log.audit('tableDetailsObjectField',tableDetailsObjectField);
                }
                fieldCounter++;
            }
            while(tableDetailsObjectField)
            return fieldCounter-1;
        }

        /**
         * Splits a string into approximately equal-sized chunks based on the specified field count.
         *
         * @param {string} str - The input string to be split.
         * @param {number} fieldCount - The number of chunks to divide the string into.
         * @returns {string[]} An array of string chunks, each representing a portion of the original string.
         */
        exports.splitStringByFieldCount = function(str, fieldCount) {
            const totalLength = str.length;
            const approxChunkSize = Math.ceil(totalLength / fieldCount);
            const groups = [];

            for (let i = 0; i < totalLength; i += approxChunkSize) {
                groups.push(str.slice(i, i + approxChunkSize));
            }

            return groups;
        }


        /*
            EXPORT FUNCTIONS    -- Available outside of this script to call
         */
        return exports;
    });
