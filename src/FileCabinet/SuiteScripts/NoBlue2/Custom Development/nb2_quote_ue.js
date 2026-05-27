/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/search', 'N/format', 'N/url', 'N/record', 'N/https'],
    
    (search, format, url, record, https) => {
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
            if (scriptContext.type !== scriptContext.UserEventType.COPY) return;
            const {newRecord: newRec} = scriptContext;
            newRec.setValue({fieldId: 'custbody_nb2_zab_subscription_link', value: null});
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
            if (scriptContext.type !== scriptContext.UserEventType.EDIT) return;

            const {oldRecord: oldRec, newRecord: newRec} = scriptContext;
            const billingType = newRec.getValue({fieldId: 'custbody_nb2_order_billing_type'});
            const cancelDate = newRec.getValue({fieldId: 'custbody_nb2_quote_cancel_date'});

            if (billingType !== 2) return; // 2 - Recurring
            if (!oldRec || !cancelDate) return;
            if (oldRec.getValue({fieldId: 'custbody_nb2_quote_cancel_date'}) === cancelDate) return;

            const lineCount = newRec.getLineCount({sublistId: 'item'});
            for (let i = 0; i < lineCount; i++) {
                const lineEndDate = newRec.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_nb2_contract_enddate',
                    line: i
                });
                if (!lineEndDate) {
                    newRec.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_nb2_contract_enddate',
                        line: i,
                        value: cancelDate
                    });
                }
            }
        }

        /**
         * Defines the function definition that is executed after record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */

        const getNewlyEndedLines = (scriptContext) => {
            const {oldRecord, newRecord} = scriptContext;
            const newlyEndedLines = [];
            const lineCount = newRecord.getLineCount({ sublistId: 'item' });
            for (let i = 0; i < lineCount; i++) {
                const newEndDate = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_nb2_contract_enddate', line: i });
                const oldEndDate = oldRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_nb2_contract_enddate', line: i });

                if (!newEndDate || oldEndDate) continue;

                const item        = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'item',        line: i });
                const itemName        = newRecord.getSublistText({ sublistId: 'item', fieldId: 'item',        line: i });
                const description = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'description', line: i });
                const rate        = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'rate',        line: i });
                const chargeSchedule   = newRecord.getSublistValue({sublistId: 'item', fieldId: 'custcol_nb2_frequency', line: i });
                const endDate     = newRecord.getSublistValue({sublistId: 'item', fieldId: 'custcol_nb2_contract_enddate', line: i });
                const site        = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_nb2_ch_sit_quo',  line: i });
                const player      = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_nb2_player',      line: i });
                const zone        = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_nb2_zone',        line: i });

                const existing = newlyEndedLines.find(function(l) {
                    return l.item === item && l.description === description && l.rate === rate && l.endDate === endDate;
                });

                if (existing) {
                    if (!Array.isArray(existing.zones)) existing.zones = [];
                    existing.zones.push({ site, player, zone });
                } else {
                    newlyEndedLines.push({ item, itemName, description, rate, endDate, chargeSchedule, zones: [{ site, player, zone }] });
                }
            }
            log.debug('newlyEndedLines', newlyEndedLines);
            return newlyEndedLines;
        }

        const getNewlyAddedLines = (scriptContext) => {
            const {oldRecord, newRecord} = scriptContext;
            const lineCount = newRecord.getLineCount({ sublistId: 'item' });
            const newLineUniqueKeys = [];

            for (let i = 0; i < lineCount; i++) {
                const uniqueKey = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'lineuniquekey', line: i });
                if (uniqueKey) newLineUniqueKeys.push({ uniqueKey, line: i });
            }

            log.debug('newLineUniqueKeys', newLineUniqueKeys);


            const oldLineCount = oldRecord.getLineCount({ sublistId: 'item' });
            const oldLineUniqueKeys = [];

            for (let i = 0; i < oldLineCount; i++) {
                const uniqueKey = oldRecord.getSublistValue({ sublistId: 'item', fieldId: 'lineuniquekey', line: i });
                if (uniqueKey) oldLineUniqueKeys.push(uniqueKey);
            }

            log.debug('oldLineUniqueKeys', oldLineUniqueKeys);


            const addedLineUniqueKeys = newLineUniqueKeys.filter(function({ uniqueKey }) {
                return oldLineUniqueKeys.indexOf(uniqueKey) === -1;
            });

            log.debug('addedLineUniqueKeys', addedLineUniqueKeys);

            addedLineUniqueKeys.map(function({ uniqueKey, i }) {
                const item        = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'item',        line: i });
                const itemName    = newRecord.getSublistText({ sublistId: 'item', fieldId: 'item',        line: i });
                const description = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'description', line: i });
                const rate        = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'rate',        line: i });
                const startDate   = newRecord.getSublistValue({sublistId: 'item', fieldId: 'custcol_nb2_contract_startdate', line: i });
                const chargeSchedule   = newRecord.getSublistValue({sublistId: 'item', fieldId: 'custcol_nb2_frequency', line: i });
                const site        = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_nb2_ch_sit_quo',  line: i });
                const player      = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_nb2_player',      line: i });
                const zone        = newRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_nb2_zone',        line: i });

                const existing = newLineUniqueKeys.find(function(l) {
                    return l.item === item && l.description === description && l.rate === rate && l.startDate === startDate;
                });

                if (existing) {
                    if (existing.zones) {
                        existing.zones.push({ site, player, zone });
                    }
                    
                } else {
                    newLineUniqueKeys.push({ item, itemName, description, rate, startDate, chargeSchedule, zones: [{ site, player, zone }] });
                }
            });

            log.debug('mapped addedLineUniqueKeys', addedLineUniqueKeys);
            return addedLineUniqueKeys;

        }


        const afterSubmit = (scriptContext) => {
            if (scriptContext.type !== scriptContext.UserEventType.EDIT) return;
            const {newRecord} = scriptContext;
            const billingType = newRecord.getValue({fieldId: 'custbody_nb2_order_billing_type'});

            if (billingType != 2) return; // 2 - Recurring

            const newlyEndedLines = getNewlyEndedLines(scriptContext);
            const newlyAddedLines = getNewlyAddedLines(scriptContext);

            if (newlyEndedLines.length) {
                processNewlyEndedLines(scriptContext, newlyEndedLines);
            }

            if (newlyAddedLines.length) {

            }

        }

        const processNewlyEndedLines = (scriptContext, newlyEndedLines) => {
            const {newRecord} = scriptContext;
            const customerId = newRecord.getValue({ fieldId: 'entity' });
            const zsId = newRecord.getValue({ fieldId: 'custbody_nb2_zab_subscription_link' });
            log.debug('zsId', zsId);
            if (!zsId) return; // No ZAB subscription linked — skip invoice search to avoid SSS_INVALID_SRCH_OPERATOR
            const lineFilters = newlyEndedLines.reduce(function(acc, { item, description, rate, endDate }, i) {
                if (i > 0) acc.push('OR');
                acc.push([
                    ['item', 'anyof', item],
                    'AND',
                    ['memo', 'is', description],
                    'AND',
                    ['rate', 'equalto', rate],
                    'AND',
                    ['custcol_nb2_contract_enddate', 'after', format.format({type: format.Type.DATE, value:endDate})]
                ]);
                return acc;
            }, []);
            log.debug('lineFilters', lineFilters);
            const invoiceSearch = search.create({
                type: search.Type.INVOICE,
                filters: [
                    ['type', 'anyof', 'CustInvc'],
                    'AND',
                    ['custbody_nb2_zab_subscription_link', 'anyof', zsId],
                    'AND',
                    lineFilters
                ],
                columns: [
                    search.createColumn({ name: 'custcol_nb2_contract_enddate', summary: search.Summary.MAX }),
                    search.createColumn({ name: 'custcol_nb2_contract_startdate', summary: search.Summary.MIN }),
                ]
            });
            log.debug('search', 'executed');
            // --- Collect unique invoice IDs ---
            // const invoices = [];
            let invoicedToDate = null;
            let invoicedFromDate = null;
            invoiceSearch.run().each(function(result) {
                // const id     = result.getValue({ name: 'internalid', summary: search.Summary.GROUP });
                // const tranid = result.getValue({ name: 'tranid',     summary: search.Summary.GROUP });
                invoicedFromDate = result.getValue({ name: 'custcol_nb2_contract_startdate',     summary: search.Summary.MIN });
                invoicedToDate = result.getValue({ name: 'custcol_nb2_contract_enddate',     summary: search.Summary.MAX });
                // if (!invoices.some(function(inv) { return inv.id === id; })) {
                //     invoices.push({ id, tranid , startDate, endDate });
                // }

                return true;
            });

            log.debug('invoicedToDate', {invoicedFromDate:invoicedFromDate, invoicedToDate:invoicedToDate});
            //
            if (!invoicedToDate) return;

            // CREDIT needed from cancel date to invoicedtodate
            // CREATE SPZ
            // CREATE ZSI

            newlyEndedLines.forEach(line => {
                log.debug('line', line);
                if (toDate(line.endDate) < toDate(invoicedToDate)) {
                    const spzRec = record.create({type: 'customrecord_nb2_spz_impact'});
                    // spzRec.setValue({fieldId: 'custrecord_nb2_spz_source_zc', value: zcId});
                    spzRec.setValue({fieldId: 'custrecord_nb2_spz_sourcesub', value: zsId});
                    // spzRec.setValue({fieldId: 'custrecord_nb2_spz_invoice', value: invoiceId});

                    for (let i = 0; i < line.zones.length; i++) {
                        let zoneObj = line.zones[i];
                        const startDate = new Date(toDate(line.endDate));
                        startDate.setDate(startDate.getDate() + 1);
                        const setLine = (fieldId, value) => spzRec.setSublistValue({ sublistId: 'recmachcustrecord_nb2_spzz_parent', fieldId, line: i, value });

                        const daysBetween = (start, end) => {
                            const msPerDay = 1000 * 60 * 60 * 24;
                            const startDate = new Date(start);
                            const endDate = new Date(end);
                            return Math.round((endDate - startDate) / msPerDay) + 1; // +1 for inclusive
                        };

                        log.debug('spzAmount Calc', {daysToCredit: daysBetween(startDate, toDate(invoicedToDate)), daysInvoiced:daysBetween(toDate(invoicedFromDate), toDate(invoicedToDate)), theFraction: parseFloat(daysBetween(startDate, toDate(invoicedToDate)) / daysBetween(toDate(invoicedFromDate), toDate(invoicedToDate)))});

                        const spzAmount = line.rate * parseFloat(daysBetween(startDate, toDate(invoicedToDate)) / daysBetween(toDate(invoicedFromDate), toDate(invoicedToDate)));

                        setLine('custrecord_nb2_spzz_customer', customerId);
                        setLine('custrecord_nb2_spzz_site',     zoneObj.site);
                        setLine('custrecord_nb2_spzz_player',   zoneObj.player);
                        setLine('custrecord_nb2_spzz_zone',     zoneObj.zone);
                        setLine('custrecord_nb2_spzz_amount',   spzAmount.toFixed(2));
                        setLine('custrecord_nb2_spzz_startdate',      startDate);
                        setLine('custrecord_nb2_spzz_enddate',        toDate(invoicedToDate));
                        setLine('custrecord_nb2_spzz_item',           line.item);
                        // setLine('custrecord_nb2_spzz_clienttype',     zoneObj.clienttype);
                        // setLine('custrecord_nb2_spzz_audiopackage',   zoneObj.audiopackage);
                        // setLine('custrecord_nb2_spzz_musiccontenttype', zoneObj.musiccontenttype);
                        // setLine('custrecord_nb2_spzz_rentsold',       zoneObj.rentsold);
                        // setLine('custrecord_nb2_spzz_physicalonline', zoneObj.physicalonline);
                        // setLine('custrecord_nb2_spzz_videopackage',   zoneObj.videopackage);
                        setLine('custrecord_nb2_spzz_salesdesc',      line.description);
                        setLine('custrecord_nb2_spzz_sourcequote',    newRecord.id);
                        setLine('custrecord_nb2_spzz_quantity',       line.zones.length);
                    }
                    const spzId = spzRec.save();

                    const suiteletUrl = url.resolveScript({
                        scriptId:    'customscript_nb2_zsi_creator_sl',
                        deploymentId: 'customdeploy_nb2_zsi_creator_sl',
                        returnExternalUrl: true
                    });

                    log.debug('suiteletUrl', suiteletUrl);

                    const payload = {
                        zsId,
                        spzId,
                        invoicedToDate,
                        line: {
                            item:           line.item,
                            itemName:       line.itemName,
                            description:    line.description,
                            endDate:        line.endDate,
                            rate:           line.rate,
                            chargeSchedule: line.chargeSchedule,
                            zonesCount:     line.zones.length
                        }
                    };

                    const response = https.post({
                        url:     suiteletUrl,
                        body:    JSON.stringify(payload),
                        headers: { 'Content-Type': 'application/json' }
                    });

                    log.debug('suitelet response', response.body);
                }
            })





            // const quoteId  = newRecord.id;
            // const quoteNum = newRecord.getValue({ fieldId: 'tranid' });
            // const customerId = newRecord.getValue({ fieldId: 'entity' });

            //
            // // --- Build task message body ---
            // const itemLines = newlyEndedLines.map(function({ item, itemName, description, rate, endDate }) {
            //     return 'Item: ' + itemName + ' | Description: ' + description + ' | Rate: ' + rate + ' | New End Date: ' + format.format({type: format.Type.DATE, value:endDate});
            // }).join('\n');
            //
            // const invoiceLines = invoices.map(function({ id, tranid }) {
            //     // const invoiceUrl = url.resolveRecord({ recordType: record.Type.INVOICE, recordId: id, isEditMode: false });
            //     // return 'Invoice <a href="' + invoiceUrl + '">' + tranid + '</a>';
            //     return 'Invoice: ' + tranid;
            // }).join('\n');
            //
            // const messageBody = [
            //     'The following quote lines have had a contract end date added:',
            //     '',
            //     itemLines,
            //     '',
            //     'The following invoices may require a credit/rebill:',
            //     '',
            //     invoiceLines
            // ].join('\n');
            //
            // // --- Create Task record ---
            // const taskRec = record.create({ type: record.Type.TASK, isDynamic: true });
            //
            // taskRec.setValue({ fieldId: 'title',        value: 'Quote ' + quoteNum + ' amended - Create/Rebill required'});
            // taskRec.setValue({ fieldId: 'assigned',     value: 464690 });
            // taskRec.setValue({ fieldId: 'message',      value: messageBody });
            // taskRec.setValue({ fieldId: 'company',      value: customerId });
            // taskRec.setValue({ fieldId: 'transaction',  value: quoteId });
            // taskRec.setValue({ fieldId: 'status',       value: 'NOTSTART' });
            //
            // const taskId = taskRec.save();
            // log.debug('task created', { taskId, quoteId, quoteNum });
        }

        const toDate = (val) => val instanceof Date ? val : format.parse({ type: format.Type.DATE, value: val });

        return {beforeLoad, beforeSubmit, afterSubmit}

    });
