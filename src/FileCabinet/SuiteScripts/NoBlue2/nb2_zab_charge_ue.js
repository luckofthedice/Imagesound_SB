/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/search', 'N/format'],
    /**
 * @param{record} record
 * @param{search} search
 */
    (record, search, format) => {
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
            const FLD_ZC_SPZ = 'custrecord_nb2_c_spz';
            const newRec = scriptContext.newRecord;
            const oldRec = scriptContext.oldRecord;

            log.debug('1', {oldRecId: oldRec.id, newRecId: newRec.id, eventType: scriptContext.type});
            if (!!oldRec && !!newRec) {
                let eventTypes = [scriptContext.UserEventType.CREATE, scriptContext.UserEventType.EDIT];
                if (eventTypes.includes(scriptContext.type)) {
                    if (oldRec.getValue({fieldId: 'custrecordzab_c_last_rating_timestamp'}) != newRec.getValue({fieldId: 'custrecordzab_c_last_rating_timestamp'})) {
                        let spzRecId = newRec.getValue({fieldId: FLD_ZC_SPZ});
                        let spzRecExists = !!spzRecId;
                        let spzRec = null;
                        let oldRecQty = oldRec.getValue({fieldId: 'custrecordzab_c_quantity'});
                        let newRecQty = newRec.getValue({fieldId: 'custrecordzab_c_quantity'});
                        log.debug('1', {oldRecId: oldRec.id, newRecId: newRec.id, eventType: scriptContext.type, oldRecQty: oldRecQty, newRecQty: newRecQty});
                        // log.debug('Charge ' + newRec.id, {spzRecExists:spzRecExists, spzRecId: spzRecId, oldRecQty:oldRecQty, newRecQty:newRecQty});
                        if (!spzRecExists || oldRecQty != newRecQty) {
                            let customerId = newRec.getValue({fieldId: 'custrecordzab_c_customer'});
                            let zsId = newRec.getValue({fieldId: 'custrecordzab_c_subscription'});
                            let itemId = newRec.getValue({fieldId: 'custrecordzab_c_charge_item'});
                            let chargeDescription = newRec.getValue({fieldId: 'custrecordzab_c_description'});
                            let chargeAmount  = newRec.getValue({fieldId: 'custrecordzab_c_rate'});
                            let serviceStart = newRec.getValue({fieldId: 'custrecordzab_c_charge_period_start_date'});
                            let serviceEnd = newRec.getValue({fieldId: 'custrecordzab_c_charge_period_end_date'});
                            // log.debug('Charge ' + newRec.id, {customerId:customerId, itemId: itemId, chargeAmount:chargeAmount, serviceStart:serviceStart, serviceEnd:serviceEnd});
                            if (!spzRecExists) {
                                let zsiId = newRec.getValue({fieldId: 'custrecordzab_c_subscription_item'});
                                spzRec = record.create({type: 'customrecord_nb2_spz_impact'});
                                spzRec.setValue({fieldId: 'custrecord_nb2_spz_source_zc', value: newRec.id});
                                spzRec.setValue({fieldId: 'custrecord_nb2_spz_sourcesub', value: zsId});
                                spzRec.setValue({fieldId: 'custrecord_nbs2_source_subitem', value: zsiId});
                            } else {
                                spzRec = record.load({type: 'customrecord_nb2_spz_impact', id: spzRecId});
                            }

                            let zoneDataArr = getZonesFromRatingData(zsId, itemId, serviceStart, serviceEnd, chargeAmount, chargeDescription);

                            // log.debug('Charge ' + newRec.id, {zoneDataArr:zoneDataArr});

                            for (let i = 0; i < zoneDataArr.length; i++) {
                                let zoneObj = zoneDataArr[i];
                                spzRec.setSublistValue({sublistId: 'recmachcustrecord_nb2_spzz_parent', fieldId: 'custrecord_nb2_spzz_customer', line: i, value: zoneObj.customer});
                                spzRec.setSublistValue({sublistId: 'recmachcustrecord_nb2_spzz_parent', fieldId: 'custrecord_nb2_spzz_site', line: i, value: zoneObj.site});
                                spzRec.setSublistValue({sublistId: 'recmachcustrecord_nb2_spzz_parent', fieldId: 'custrecord_nb2_spzz_player', line: i, value: zoneObj.player});
                                spzRec.setSublistValue({sublistId: 'recmachcustrecord_nb2_spzz_parent', fieldId: 'custrecord_nb2_spzz_zone', line: i, value: zoneObj.zone});
                                spzRec.setSublistValue({sublistId: 'recmachcustrecord_nb2_spzz_parent', fieldId: 'custrecord_nb2_spzz_amount', line: i, value: chargeAmount});
                                spzRec.setSublistValue({sublistId: 'recmachcustrecord_nb2_spzz_parent', fieldId: 'custrecord_nb2_spzz_startdate', line: i, value: serviceStart});
                                spzRec.setSublistValue({sublistId: 'recmachcustrecord_nb2_spzz_parent', fieldId: 'custrecord_nb2_spzz_enddate', line: i, value: serviceEnd});
                                spzRec.setSublistValue({sublistId: 'recmachcustrecord_nb2_spzz_parent', fieldId: 'custrecord_nb2_spzz_item', line: i, value: itemId});
                                spzRec.setSublistValue({sublistId: 'recmachcustrecord_nb2_spzz_parent', fieldId: 'custrecord_nb2_spzz_clienttype', line: i, value: zoneObj.clienttype});
                                spzRec.setSublistValue({sublistId: 'recmachcustrecord_nb2_spzz_parent', fieldId: 'custrecord_nb2_spzz_audiopackage', line: i, value: zoneObj.audiopackage});
                                spzRec.setSublistValue({sublistId: 'recmachcustrecord_nb2_spzz_parent', fieldId: 'custrecord_nb2_spzz_musiccontenttype', line: i, value: zoneObj.musiccontenttype});
                                spzRec.setSublistValue({sublistId: 'recmachcustrecord_nb2_spzz_parent', fieldId: 'custrecord_nb2_spzz_rentsold', line: i, value: zoneObj.rentsold});
                                spzRec.setSublistValue({sublistId: 'recmachcustrecord_nb2_spzz_parent', fieldId: 'custrecord_nb2_spzz_physicalonline', line: i, value: zoneObj.physicalonline});
                                spzRec.setSublistValue({sublistId: 'recmachcustrecord_nb2_spzz_parent', fieldId: 'custrecord_nb2_spzz_videopackage', line: i, value: zoneObj.videopackage});
                                spzRec.setSublistValue({sublistId: 'recmachcustrecord_nb2_spzz_parent', fieldId: 'custrecord_nb2_spzz_salesdesc', line: i, value: zoneObj.memo});
                            }

                            let sublistCount = spzRec.getLineCount({sublistId: 'recmachcustrecord_nb2_spzz_parent'});
                            while (sublistCount > zoneDataArr.length) {
                                spzRec.removeLine({sublistId: 'recmachcustrecord_nb2_spzz_parent', line: sublistCount - 1, ignoreRecalc: true});
                                sublistCount = spzRec.getLineCount({sublistId: 'recmachcustrecord_nb2_spzz_parent'});
                            }

                            let newRecId = spzRec.save();
                            if (!spzRecExists) {
                                newRec.setValue({fieldId: FLD_ZC_SPZ, value: newRecId});
                            }
                        }
                    }
                }
            }

            // let eventTypes = [scriptContext.UserEventType.EDIT];
            // if (eventTypes.includes(scriptContext.type)) {
            //     let rec = scriptContext.newRecord;
            //     let tranId = rec.getValue({fieldId: 'custrecordzab_c_transaction'});
            //     if (!!tranId) {
            //         let customerId = rec.getValue({fieldId: 'custrecordzab_c_customer'});
            //         let itemId = rec.getValue({fieldId: 'custrecordzab_c_charge_item'});
            //         let serviceStart = rec.getValue({fieldId: 'custrecordzab_c_start_date'});
            //         let serviceEnd = rec.getValue({fieldId: 'custrecordzab_c_end_date'});
            //
            //         if (!!customerId && !!itemId) {
            //             let zoneIds = getZonesFromRatingData(customerId, itemId, serviceStart, serviceEnd);
            //             rec.setValue({fieldId: 'custrecord_nb2_c_zones', value: zoneIds});
            //         }
            //
            //     }
            // }
        }

        const getZonesFromRatingData = (subId, itemId, startDate, endDate, rate, chargeDescription) => {
            /** @NApiVersion 2.1 */
            const transactionSearchObj = search.create({
                type: "transaction",
                settings:[{"name":"consolidationtype","value":"ACCTTYPE"}],
                filters:
                    [
                        ["type","anyof","Estimate","Opprtnty"],
                        "AND",
                        ["mainline","is","F"],
                        "AND",
                        ["custbody_nb2_quote_approval_status","anyof","2"],
                        "AND",
                        ["taxline","is","F"],
                        "AND",
                        ["cogs","is","F"],
                        "AND",
                        ["item.isinactive","is","F"],
                        "AND",
                        ["custbody_nb2_zab_subscription_link","anyof",subId],
                        "AND",
                        ["item","anyof",itemId],
                        "AND",
                        ["formulatext: LOWER({memo})","is",chargeDescription.toLowerCase()],
                        "AND",
                        ["fxamount","equalto",rate],
                        "AND",
                        ["custcol_nb2_contract_startdate","onorbefore",format.format({value: endDate, type: format.Type.DATE})],
                        "AND",
                        [["custcol_nb2_contract_enddate","onorafter",format.format({value: startDate, type: format.Type.DATE})],"OR",["custcol_nb2_contract_enddate","isempty",""]]
                    ],
                columns:
                    [
                        "custcol_nb2_zone",
                        "custcol_nb2_player",
                        "custcol_nb2_ch_sit_quo",
                        "name",
                        "custcol_nb2_cli_typ",
                        "custcol_nb2_aud_pac",
                        "custcol_nb2_mus_con",
                        "custcol_nb2_ren_sol",
                        "custcol_nb2_phy_onl",
                        "custcol_nb2_video_package",
                        "memo"
                    ]
            });

            return runSearchAndReturn(transactionSearchObj);

        }

        const runSearchAndReturn = (searchObj) => {
            let searchPageSize =  1000;
            let searchPageNumber = 0

            let savedSearchPageData = searchObj.runPaged({pageSize: searchPageSize});
            let savedSearchPageCount = savedSearchPageData.pageRanges.length;

            let zoneArr = [];

            while (savedSearchPageCount > searchPageNumber) {
                let savedSearchPage = savedSearchPageData.fetch({index: searchPageNumber});

                savedSearchPage.data.forEach(function (result) {
                    let zoneObj = {
                        zone:result.getValue({name: 'custcol_nb2_zone'}),
                        player:result.getValue({name: 'custcol_nb2_player'}),
                        site:result.getValue({name: 'custcol_nb2_ch_sit_quo'}),
                        customer:result.getValue({name: 'name'}),
                        clienttype:result.getValue({name: 'custcol_nb2_cli_typ'}),
                        audiopackage:result.getValue({name: 'custcol_nb2_aud_pac'}),
                        musiccontenttype:result.getValue({name: 'custcol_nb2_mus_con'}),
                        rentsold:result.getValue({name: 'custcol_nb2_ren_sol'}),
                        physicalonline:result.getValue({name: 'custcol_nb2_phy_onl'}),
                        videopackage:result.getValue({name: 'custcol_nb2_video_package'}),
                        memo:result.getValue({name: 'memo'})
                    }
                    zoneArr.push(zoneObj);
                })

                searchPageNumber += 1;
            }

            return zoneArr;
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

        }

        return {beforeLoad, beforeSubmit, afterSubmit}

    });
