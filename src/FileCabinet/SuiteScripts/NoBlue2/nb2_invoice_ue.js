/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/search', 'N/format', 'N/ui/serverWidget', 'N/ui/message', 'N/runtime', './nb2_spz_lib', 'N/task'],
    /**
 * @param{record} record
 * @param{search} search
 */
    (record, search, format, serverWidget, message, runtime, spzLib, task) => {
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

            if (scriptContext.type === scriptContext.UserEventType.VIEW) {
                if (rec.getValue({fieldId: 'custbody_nb2_istocu'})) {
                    form.addPageInitMessage({
                        type: message.Type.WARNING,
                        message: 'This is a "take-on catch-up" invoice; it has been created as part of the data migration, and only exists to seed the take-on deferred revenue waterfall.  This invoice should NOT be presented to the customer!',
                        title: 'WARNING'
                    });

                    if (runtime.getCurrentUser().role === 3) return;

                    ['email', 'print', 'makecopy', 'makestandalonecopy', 'memorize', 'return', 'credit', 'renewal', 'edit', 'acceptpayment']
                        .forEach(id => form.removeButton({id}));
                }
                if (rec.getValue({fieldId: 'custbody_nb2_spz_retroupdate'})) {
                    form.addPageInitMessage({
                        type: message.Type.WARNING,
                        message: 'The SPZ records are not yet created for this invoice, (SPZ records provide invoice PDF details), try refreshing this page in a couple of minutes.',
                        title: 'WARNING'
                    });
                }
            }
            else if (scriptContext.type == scriptContext.UserEventType.PRINT) {

                Array.from({ length: 10 }, (_, i) =>
                    form.addField({ id: `custpage_zones${i}fld`, label: `zones${i}`, type: serverWidget.FieldType.LONGTEXT })
                );

                let spzFound = false;
                const consolidateSPZZ = rec.getValue({fieldId: 'custbody_nb2_consol_rentalitems_byprop'});
                const spzzToConsolidateArr = [];
                const spzzArr = [];
                const lineCount = rec.getLineCount({ sublistId: 'item' });

                for (let i = 0; i < lineCount; i++) {
                    let spzId = rec.getSublistValue({sublistId: 'item', fieldId: 'custcol_nb2_spz', line: i});
                    if (!!spzId) {
                        spzFound = true;
                        let consolidateLine = rec.getSublistValue({sublistId: 'item', fieldId: 'custcol_nb2_consol_byproperty', line: i});
                        if (!!consolidateSPZZ && !!consolidateLine) {
                            spzzToConsolidateArr.push(spzId);
                        } else {
                            spzzArr.push(spzId);
                        }
                    }
                }

                if (spzFound) {
                    let jsonObj = {}

                    if (spzzArr.length > 0) {
                        const customrecord_nb2_spz_impact_zoneSearchObj = search.create({
                            type: "customrecord_nb2_spz_impact_zone",
                            filters:
                                [
                                    ["custrecord_nb2_spzz_parent", "anyof", spzzArr]
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

                        runSearchAndReturn(customrecord_nb2_spz_impact_zoneSearchObj, jsonObj);
                    }

                    if (spzzToConsolidateArr.length > 0) {
                        const customrecord_nb2_spz_impact_zoneSearchObjSummary = search.create({
                            type: "customrecord_nb2_spz_impact_zone",
                            filters:
                                [
                                    ["custrecord_nb2_spzz_parent", "anyof", spzzToConsolidateArr]
                                ],
                            columns:
                                [
                                    search.createColumn({
                                        name: "custrecord_nb2_spzz_parent",
                                        summary: "MIN"
                                    }),
                                    search.createColumn({
                                        name: "custrecord_nb2_spzz_site",
                                        summary: "GROUP"
                                    }),
                                    search.createColumn({
                                        name: "custrecord_nb2_spzz_salesdesc",
                                        summary: "MIN"
                                    }),
                                    search.createColumn({
                                        name: "custrecord_nb2_spzz_zone",
                                        summary: "GROUP"
                                    }),
                                    search.createColumn({
                                        name: "custrecord_nb2_spzz_amount",
                                        summary: "SUM"
                                    }),
                                    search.createColumn({
                                        name: "custrecord_nb2_spzz_startdate",
                                        summary: "GROUP"
                                    }),
                                    search.createColumn({
                                        name: "custrecord_nb2_spzz_enddate",
                                        summary: "GROUP"
                                    })
                                ]
                        });

                        runSearchAndReturn(customrecord_nb2_spz_impact_zoneSearchObjSummary, jsonObj, true);
                    }

                    log.debug('jsonObj', jsonObj);

                    let jsonStr = JSON.stringify(jsonObj);
                    let chunkedJsonStr = jsonStr.match(/.{1,999999}/g);

                    log.debug('Lengths', {chunkedArrayLength:chunkedJsonStr.length, stringLength: jsonStr.length});


                    for (let i = 0; i < chunkedJsonStr.length; i++) {
                        rec.setValue({fieldId: 'custpage_zones' + i + 'fld', value: chunkedJsonStr[i]});
                    }
                }
            }
        }

        const runSearchAndReturn = (searchObj, jsonObj, isSummary) => {
            let searchPageSize =  1000;
            let searchPageNumber = 0

            let savedSearchPageData = searchObj.runPaged({pageSize: searchPageSize});
            let savedSearchPageCount = savedSearchPageData.pageRanges.length;

            // let jsonObj = {};

            const getValueGroupArgs = (name) => isSummary
                ? {name, summary: 'GROUP'}
                : {name};

            const getValueSumArgs = (name) => isSummary
                ? {name, summary: 'SUM'}
                : {name};

            const getValueMinArgs = (name) => isSummary
                ? {name, summary: 'MIN'}
                : {name};

            const getTextArgs = (name) => isSummary
                ? {name, summary: 'GROUP'}
                : {name};

            while (savedSearchPageCount > searchPageNumber) {
                let savedSearchPage = savedSearchPageData.fetch({index: searchPageNumber});

                savedSearchPage.data.forEach(function (result) {
                    let jsonBit = {
                        a: removeBracketText(result.getText(getTextArgs('custrecord_nb2_spzz_site'))),
                        b: result.getValue(getValueMinArgs('custrecord_nb2_spzz_salesdesc')),
                        c: result.getValue(getValueSumArgs('custrecord_nb2_spzz_amount')),
                        d: removeBracketText(result.getText(getTextArgs('custrecord_nb2_spzz_zone'))),
                        e: result.getValue(getValueGroupArgs('custrecord_nb2_spzz_startdate')),
                        f: result.getValue(getValueGroupArgs('custrecord_nb2_spzz_enddate'))
                    };
                    let spzId = result.getValue(getValueMinArgs('custrecord_nb2_spzz_parent'));
                    if (!jsonObj.hasOwnProperty(spzId)) {
                        jsonObj[spzId] = [];
                    }
                    jsonObj[spzId].push(jsonBit);
                    return true;
                });

                searchPageNumber += 1;
            }

            // return jsonObj;
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
            if (!scriptContext.newRecord.getValue({ fieldId: 'custbodyzab_created_by_zone_billing' }) == 'T') return;

            const rec = scriptContext.newRecord;
            const overrideSPZ = rec.getValue({ fieldId: 'custbody_nb2_rebuild_spz' });
            const lineCount = rec.getLineCount({ sublistId: 'item' });

            const getLine = (fieldId, line) => rec.getSublistValue({ sublistId: 'item', fieldId, line });

            log.debug('bs:0', { overrideSPZ:overrideSPZ, lineCount:lineCount });

            if (lineCount > 50) {
                const missingSPZ = Array.from({ length: lineCount }).some((_, i) =>
                    !!getLine('custcol_nb2_zab_charge', i) && !getLine('custcol_nb2_spz', i)
                );
                log.debug('bs:0a', { overrideSPZ:overrideSPZ, lineCount:lineCount, missingSPZ:missingSPZ });
                if (missingSPZ || overrideSPZ) {
                    rec.setValue({ fieldId: 'custbody_nb2_spz_retroupdate', value: true });
                }
            } else {
                const zsId = rec.getValue({ fieldId: 'custbody_nb2_zab_subscription_link' });
                log.debug('bs:1', { zsId, overrideSPZ });

                for (let i = 0; i < lineCount; i++) {
                    const zcId = getLine('custcol_nb2_zab_charge', i);
                    const oldSPZid = getLine('custcol_nb2_spz', i);
                    log.debug('bs:2', { zsId, overrideSPZ, i, zcId });

                    if (!zcId || (oldSPZid && !overrideSPZ)) continue;

                    const spzId = spzLib.createSPZ(
                        zcId, zsId,
                        getLine('item', i),
                        getLine('custcol_nb2_contract_startdate', i),
                        getLine('custcol_nb2_contract_enddate', i),
                        getLine('rate', i),
                        getLine('description', i)
                    );

                    log.debug('bs:3', { zsId, overrideSPZ, i, zcId, spzId });
                    rec.setSublistValue({ sublistId: 'item', fieldId: 'custcol_nb2_spz', line: i, value: spzId });
                }
            }
            rec.setValue({ fieldId: 'custbody_nb2_rebuild_spz', value: false });
        };


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
            const { newRecord, oldRecord, type } = scriptContext;
            const FIELD_ID = 'custcol_nb2_spz';

            const newValues = getColumnValues(newRecord, FIELD_ID);
            const oldValues = oldRecord
                ? new Set(getColumnValues(oldRecord, FIELD_ID))
                : new Set();

            const addedValues = newValues.filter(
                (value) => value !== '' && value !== null && value !== undefined && !oldValues.has(value)
            );

            log.debug({
                title: `afterSubmit [${type}] – new "${FIELD_ID}" values`,
                details: JSON.stringify(addedValues)
            });

            addedValues.forEach((impactZoneId) => {
                try {
                    record.submitFields({
                        type    : 'customrecord_nb2_spz_impact',
                        id      : impactZoneId,
                        values  : {
                            custrecord_nb2_spz_invoice: newRecord.id
                        },
                        options : {
                            enableSourcing   : false,
                            ignoreMandatoryFields: true
                        }
                    });

                    log.audit({
                        title  : 'submitFields success',
                        details: `customrecord_nb2_spz_impact_zone id=${impactZoneId} → custrecord_nb2_spzz_invoice=${newRecord.id}`
                    });
                } catch (e) {
                    log.error({
                        title  : `submitFields failed for impact zone id=${impactZoneId}`,
                        details: e.message
                    });
                }
            });

            if (!newRecord.getValue({ fieldId: 'custbody_nb2_spz_retroupdate' })) return;

            try {
                const mrTask = task.create({
                    taskType: task.TaskType.MAP_REDUCE,
                    scriptId: 'customscript_nb2_invoice_spz_mr',
                    deploymentId: 'customdeploy_nb2_invoice_spz_mr'
                });
                mrTask.submit();
            } catch (e) {
                // Script already queued — safe to ignore
            }
        }

        const getColumnValues = (record, fieldId) => {
            const SUBLISTS = ['item', 'expense', 'component', 'line'];
            const values   = [];

            for (const sublistId of SUBLISTS) {
                const lineCount = record.getLineCount({ sublistId });
                if (lineCount < 0) continue; // sublist does not exist on this record

                for (let i = 0; i < lineCount; i++) {
                    const val = record.getSublistValue({
                        sublistId,
                        fieldId,
                        line: i
                    });
                    values.push(val);
                }

                // Stop after the first matching sublist (avoid duplicates)
                if (lineCount >= 0) break;
            }

            return values;
        };

        return {beforeLoad, beforeSubmit, afterSubmit}

    });
