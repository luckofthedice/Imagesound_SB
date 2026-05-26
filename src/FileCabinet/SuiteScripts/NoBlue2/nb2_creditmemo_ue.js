/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/search','N/ui/serverWidget'],
    /**
 * @param{search} search
 */
    (search, serverWidget) => {
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
            if (scriptContext.type == scriptContext.UserEventType.PRINT) {
                const form = scriptContext.form;
                const rec = scriptContext.newRecord;

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
            if (scriptContext.type !==  scriptContext.UserEventType.CREATE) return;
            const { newRecord, oldRecord, type } = scriptContext;
            const chargeIDs = getColumnValues(newRecord, 'custcol_nb2_zab_charge');
            if (chargeIDs.length == 0) return;
            const invoiceLineUniqueKeys = getInvoiceLinesBeingCredited(chargeIDs);
            if (invoiceLineUniqueKeys.length == 0) return;
            getInvoiceLineSPZ(invoiceLineUniqueKeys);
            const lineCount = newRecord.getLineCount({ sublistId: 'item' });

            for (let i = 0; i < lineCount; i++) {
                const chargeId = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_nb2_zab_charge', line: i });
                const match = invoiceLineUniqueKeys.find(function(obj) { return obj.chargeId === chargeId; });
                if (match) {
                    newRecord.setSublistValue({ sublistId: 'item', fieldId: 'custcol_nb2_spz', line: i, value: match.spzID });
                }
            }
        }

        const getInvoiceLineSPZ = (lineUniqueKeys) => {
            const uniqueKeyFilters = lineUniqueKeys.reduce((acc, { uniqueKey }, i) => {
                if (i > 0) acc.push("OR");
                acc.push(["lineuniquekey", "equalto", uniqueKey]);
                return acc;
            }, []);

            const searchObj = search.create({
                type: "invoice",
                settings:[{"name":"consolidationtype","value":"ACCTTYPE"}],
                filters: [["type", "anyof", "CustInvc"], "AND"].concat(uniqueKeyFilters),
                columns:
                    [
                        "lineuniquekey",
                        "custcol_nb2_spz"
                    ]
            });
            return runInvoiceSearchAndReturn(searchObj, lineUniqueKeys);
        }

        const runInvoiceSearchAndReturn = (searchObj, arrayToAmend) => {
            let searchPageSize =  1000;
            let searchPageNumber = 0

            let savedSearchPageData = searchObj.runPaged({pageSize: searchPageSize});
            let savedSearchPageCount = savedSearchPageData.pageRanges.length;

            // let tranLineArr = [];

            while (savedSearchPageCount > searchPageNumber) {
                let savedSearchPage = savedSearchPageData.fetch({index: searchPageNumber});

                savedSearchPage.data.forEach(function (result) {
                    const lineuniqueKey = result.getValue({ name: 'lineuniquekey' });
                    const spzID = result.getValue({ name: 'custcol_nb2_spz' });

                    const match = arrayToAmend.find(function(obj) { return obj.uniqueKey === lineuniqueKey; });
                    if (match) match.spzID = spzID;
                    return true;
                });
                searchPageNumber += 1;
            }

        }

        const getInvoiceLinesBeingCredited = (creditCharges) => {
            const customrecordzab_chargeSearchObj = search.create({
                type: "customrecordzab_charge",
                filters:
                    [
                        ["internalid","anyof",creditCharges],
                        "AND",
                        ["custrecordzab_c_credited_from_t","noneof","@NONE@"]
                    ],
                columns:
                    [
                        "internalid",
                        "custrecordzab_c_credited_from_t",
                        "custrecordzab_c_credited_from_tl",
                        "custrecordzab_c_credited_from_tl_uniq"
                    ]
            });
            return runChargeSearchAndReturn(customrecordzab_chargeSearchObj);

        }

        const runChargeSearchAndReturn = (searchObj) => {
            let searchPageSize =  1000;
            let searchPageNumber = 0

            let savedSearchPageData = searchObj.runPaged({pageSize: searchPageSize});
            let savedSearchPageCount = savedSearchPageData.pageRanges.length;

            let tranLineArr = [];

            while (savedSearchPageCount > searchPageNumber) {
                let savedSearchPage = savedSearchPageData.fetch({index: searchPageNumber});

                savedSearchPage.data.forEach(function (result) {
                    let tranLine = {
                        chargeId: result.getValue({name: 'internalid'}),
                        uniqueKey: result.getValue({name:'custrecordzab_c_credited_from_tl_uniq'})
                    };
                    tranLineArr.push(tranLine);
                    return true;
                });
                searchPageNumber += 1;
            }

            return tranLineArr;
        }

        const getColumnValues = (record, fieldId) => {
            const SUBLISTS = ['item'];
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
                    if (!!val) {
                        values.push(val);
                    }
                }

                // Stop after the first matching sublist (avoid duplicates)
                if (lineCount >= 0) break;
            }

            return values;
        };

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
