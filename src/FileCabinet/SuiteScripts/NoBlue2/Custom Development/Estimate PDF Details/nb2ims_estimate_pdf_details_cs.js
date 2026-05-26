/**
 * Name         : nb2_cpl_quick_approval_screen_cs.js
 * Property of  : NoBlue
 * Comments     :
 *
 * Version          Date                Author          Details
 * 1.0              14/08/2025          NB2(JT)         IS1026-396 - Advanced PDF Template for Estimate/Quote
 *
 **/


define(["N/currentRecord","N/ui/dialog","N/search","N/record","N/log","N/query", "N/url", './nb2ims_estimate_pdf_details_lib.js'],
    (currentRecord, dialog, search, record, log, query, url, estimateLib) => {

        /**
         * Module Description...
         *
         * @NApiVersion 2.1
         * @NModuleScope SameAccount
         * @NScriptType ClientScript
         */
        let exports = {};



        /**
         * saveRecord event handler; executed after the submit button is pressed but before the form is
         * submitted.
         *
         * @gov XXX
         *
         * @param {Object} context
         * @param {CurrentRecord} context.currentRecord - The record in context
         *
         * @return {boolean} true if the record is valid; false to stop form submission.
         */

        function saveRecord(context)
        {
            let returnValue = true;
            let currentRecord             = context.currentRecord;
            //START - 1.0 - JT - IS1026-396 - Advanced PDF Template for Estimate/Quote
            try {
                let customFormText = currentRecord.getText({fieldId: 'customform'});
                if(customFormText === estimateLib.estimatePDFConstants().CUSTOMFORM_IMS_Quote){
                    let cleanedTableSectionObj = estimateLib.createTableSectionObject(currentRecord);

                    let tableSection = currentRecord.getValue({fieldId: 'custbody_nb2_est_section_sorting'});
                    //SETS THE TABLE SECTION SORTING VALUE
                    if(!currentRecord.getValue({fieldId: 'custbody_nb2_est_section_sorting_overr'})){
                        tableSection = estimateLib.sortTableSection(cleanedTableSectionObj);
                        estimateLib.setSectionSortingValue({newRecord: currentRecord, tableSection: tableSection});
                    }
                    else{
                        tableSection = tableSection.split(';');
                    }
                    if(tableSection.length > 0){
                      //  returnValue = window.confirm('Proceed with the current section sorting for PDF?\n'+tableSection.join(';'))
                    }
                }
            }
            catch (e) {
                log.error({title: 'Advanced PDF Template for Estimate/Quote - saveRecord error', details: e})
            }
            //END - 1.0 - JT - IS1026-396 - Advanced PDF Template for Estimate/Quote
            return returnValue;
        }



        exports.saveRecord      = saveRecord;

        return exports;
    });
