/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/search', 'N/format', 'N/ui/serverWidget'],
    /**
 * @param{record} record
 * @param{search} search
 */
    (record, search, format, serverWidget) => {
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
            const form = scriptContext.form;
            const rec = scriptContext.newRecord;

            if (scriptContext.type == scriptContext.UserEventType.PRINT) {

                form.addField({id:'custpage_zones0fld',label:'zones0', type:serverWidget.FieldType.LONGTEXT});
                form.addField({id:'custpage_zones1fld',label:'zones1', type:serverWidget.FieldType.LONGTEXT});
                form.addField({id:'custpage_zones2fld',label:'zones2', type:serverWidget.FieldType.LONGTEXT});
                form.addField({id:'custpage_zones3fld',label:'zones3', type:serverWidget.FieldType.LONGTEXT});
                form.addField({id:'custpage_zones4fld',label:'zones4', type:serverWidget.FieldType.LONGTEXT});
                form.addField({id:'custpage_zones5fld',label:'zones5', type:serverWidget.FieldType.LONGTEXT});
                form.addField({id:'custpage_zones6fld',label:'zones6', type:serverWidget.FieldType.LONGTEXT});
                form.addField({id:'custpage_zones7fld',label:'zones7', type:serverWidget.FieldType.LONGTEXT});
                form.addField({id:'custpage_zones8fld',label:'zones8', type:serverWidget.FieldType.LONGTEXT});
                form.addField({id:'custpage_zones9fld',label:'zones9', type:serverWidget.FieldType.LONGTEXT});

                let spzFound = false;

                for (let i = 0; i < rec.getLineCount({sublistId: 'item'}); i++) {
                    let spzId = rec.getSublistValue({sublistId: 'item', fieldId: 'custcol_nb2_spz', line: i});
                    if (!!spzId) {
                        spzFound = true;
                    }
                }

                // for (let i = 0; i < rec.getLineCount({sublistId: 'item'}); i++) {
                //     let spzId = rec.getSublistValue({sublistId: 'item', fieldId: 'custcol_nb2_spz', line: i});
                //     log.debug('spzId', spzId);
                //     log.debug('sublist count', rec.getLineCount({sublistId: 'recmachcustrecord_nb2_spzz_invoice'}));
                //     if (!!spzId) {
                //         for (let j = 0; j < rec.getLineCount({sublistId: 'recmachcustrecord_nb2_spzz_invoice'}); j++) {
                //             let spzId = rec.getSublistValue({sublistId: 'recmachcustrecord_nb2_spzz_invoice', fieldId: 'custrecord_nb2_spzz_parent', line: j});
                //             let siteName = rec.getSublistText({sublistId: 'recmachcustrecord_nb2_spzz_invoice', fieldId: 'custrecord_nb2_spzz_site', line: j});
                //             let playerName = rec.getSublistText({sublistId: 'recmachcustrecord_nb2_spzz_invoice', fieldId: 'custrecord_nb2_spzz_player', line: j});
                //             let jsonObj = {a: siteName, b: playerName};
                //             jsonObj[spzId].push(jsonObj);
                //         }
                //     }
                // }

                if (spzFound) {
                    const customrecord_nb2_spz_impact_zoneSearchObj = search.create({
                        type: "customrecord_nb2_spz_impact_zone",
                        filters:
                            [
                                ["custrecord_nb2_spzz_invoice", "anyof", rec.id]
                            ],
                        columns:
                            [
                                "custrecord_nb2_spzz_parent",
                                "custrecord_nb2_spzz_site",
                                "custrecord_nb2_spzz_salesdesc",
                                "custrecord_nb2_spzz_zone",
                                "custrecord_nb2_spzz_amount",
                                "custrecord_nb2_spzz_startdate",
                                "custrecord_nb2_spzz_enddate"
                            ]
                    });

                    let jsonObj = runSearchAndReturn(customrecord_nb2_spz_impact_zoneSearchObj);

                    let jsonStr = JSON.stringify(jsonObj);
                    let chunkedJsonStr = jsonStr.match(/.{1,999999}/g);

                    log.debug('Lengths', {chunkedArrayLength:chunkedJsonStr.length, stringLength: jsonStr.length});


                    for (let i = 0; i < chunkedJsonStr.length; i++) {
                        rec.setValue({fieldId: 'custpage_zones' + i + 'fld', value: chunkedJsonStr[i]});
                    }
                }
            }
        }

        const runSearchAndReturn = (searchObj) => {
            let searchPageSize =  1000;
            let searchPageNumber = 0

            let savedSearchPageData = searchObj.runPaged({pageSize: searchPageSize});
            let savedSearchPageCount = savedSearchPageData.pageRanges.length;

            let jsonObj = {};

            while (savedSearchPageCount > searchPageNumber) {
                let savedSearchPage = savedSearchPageData.fetch({index: searchPageNumber});

                savedSearchPage.data.forEach(function (result) {
                    let jsonBit = {
                        a: removeBracketText(result.getText({name: 'custrecord_nb2_spzz_site'})),
                        b: result.getValue({name: 'custrecord_nb2_spzz_salesdesc'}),
                        c: result.getValue({name: 'custrecord_nb2_spzz_amount'}),
                        d: removeBracketText(result.getText({name: 'custrecord_nb2_spzz_zone'})),
                        e: result.getValue({name: 'custrecord_nb2_spzz_startdate'}),
                        f: result.getValue({name: 'custrecord_nb2_spzz_enddate'})
                    };
                    let spzId = result.getValue({name: 'custrecord_nb2_spzz_parent'});
                    if (!jsonObj.hasOwnProperty(spzId)) {
                        jsonObj[spzId] = [];
                    }
                    jsonObj[spzId].push(jsonBit);
                    return true;
                })

                searchPageNumber += 1;
            }

            return jsonObj;
        }

        const removeBracketText = (theText) => {
            // return theText.replaceAll(/\[.+?\]/, "");
            return theText;
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

        }


        /**
         * Defines the function definition that is executed after record is submitted.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const afterSubmit = (scriptContext) => {
            let eventTypes = [scriptContext.UserEventType.CREATE, scriptContext.UserEventType.EDIT];
            if (eventTypes.includes(scriptContext.type)) {
                let rec = scriptContext.newRecord;
                let invId = rec.id;

                for (let i = 0; i < rec.getLineCount({sublistId: 'item'}); i++) {
                    let spzId = rec.getSublistValue({sublistId: 'item', fieldId: 'custcol_nb2_spz', line: i});
                    if (!!spzId) {
                        let spzRec = record.load({type: 'customrecord_nb2_spz_impact', id: spzId});
                        for (let j = 0; j < spzRec.getLineCount({sublistId: 'recmachcustrecord_nb2_spzz_parent'}); j++) {
                            spzRec.setSublistValue({sublistId: 'recmachcustrecord_nb2_spzz_parent', fieldId: 'custrecord_nb2_spzz_invoice', line: j, value: invId});
                        }
                        spzRec.save();
                    }
                }

            }
        }

        return {beforeLoad, beforeSubmit, afterSubmit}

    });
