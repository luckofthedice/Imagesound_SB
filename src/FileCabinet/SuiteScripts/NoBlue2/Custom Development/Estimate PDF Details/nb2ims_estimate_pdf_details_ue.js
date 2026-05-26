/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
/**
 *
 * @summary     : Creation of Object needed for Estimate PDF
 *
 * @description :
 *
 * @name        : NB2 Estimate PDF Details UE - nb2ims_estimate_pdf_details_ue.js
 * @copyright   : NoBlue2
 * @author      : JMT
 * @created     : 14/08/2025
 *
 *
 * Version          Date                Author          Details
 * 1.0              14/08/2025          NB2(JT)         IS1026-396 - Advanced PDF Template for Estimate/Quote
 *

 /* List any N/ modules needed for this script only */
define(['N/ui/serverWidget', 'N/record', 'N/runtime', 'N/search', './nb2ims_estimate_pdf_details_lib.js'],
    /**
 * @param{serverWidget} serverWidget
 * @param{record} record
 * @param{runtime} runtime
 * @param{search} search
 */
    (serverWidget, record, runtime, search, estimateLib) => {
        /**
         * Defines the function definition that is executed before record is loaded.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @param {Form} scriptContext.form - Current form
         * @param {ServletRequest} scriptContext.request - HTTP request information sent from the browser for a client action only.
         * @since 2015.2
         */
        const beforeLoad = (scriptContext) => {
            let form = scriptContext.form;
            //START - 1.0 - JT - IS1026-396 - Advanced PDF Template for Estimate/Quote
            try {
                if ([scriptContext.UserEventType.CREATE, scriptContext.UserEventType.EDIT, scriptContext.UserEventType.COPY, scriptContext.UserEventType.VIEW].includes(scriptContext.type)) {
                    estimateLib.hideTableDetailsObjectField({form:form, fieldDisplayType:serverWidget.FieldDisplayType.HIDDEN});
                }
            }
            catch (e) {
                    log.error({title: 'Advanced PDF Template for Estimate/Quote - beforeLoad error', details: e})
            }
            //END - 1.0 - JT - IS1026-396 - Advanced PDF Template for Estimate/Quote
        }

        /**
         * Defines the function definition that is executed before record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const beforeSubmit = (scriptContext) => {
            let newRecord = scriptContext.newRecord

            //START - 1.0 - JT - IS1026-396 - Advanced PDF Template for Estimate/Quote
            try {
                if ([scriptContext.UserEventType.CREATE, scriptContext.UserEventType.EDIT].includes(scriptContext.type)) {
                    if(![runtime.ContextType.USER_INTERFACE].includes(runtime.executionContext)){
                        let cleanedTableSectionObj = estimateLib.createTableSectionObject(newRecord);


                        if(!newRecord.getValue({fieldId: 'custbody_nb2_est_section_sorting_overr'})){
                            let tableSection = estimateLib.sortTableSection(cleanedTableSectionObj);
                            estimateLib.setSectionSortingValue({newRecord: newRecord, tableSection: tableSection});
                        }
                    }
                }
            }
            catch (e) {
                log.error({title: 'Advanced PDF Template for Estimate/Quote - beforeSubmit error', details: e})
            }
            //END - 1.0 - JT - IS1026-396 - Advanced PDF Template for Estimate/Quote
        }

        /**
         * Defines the function definition that is executed after record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const afterSubmit = (scriptContext) => {

        }

        return {beforeLoad, beforeSubmit, afterSubmit}

    });
