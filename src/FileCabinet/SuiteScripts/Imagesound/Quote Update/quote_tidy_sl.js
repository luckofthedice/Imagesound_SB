/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @author David Kelly
 * @version 1.0
 * @since 26/05/2026
 * @description Suitelet to tidy a quote by displaying and removing lines associated with closed zones,
 *              capturing an End Date for the old quote and a Start Date for the new quote.
 */

define(['N/log', 'N/record', 'N/search', 'N/ui/serverWidget', 'N/format'], (log, record, search, serverWidget, format) => {
    const scriptId = 'customscript_quote_tidy_sl';
    const deploymentId = 'customdeploy_quote_tidy_sl';

    const onRequest = (context) => {
        log.debug('Tidy Quote Suitelet', 'Tidy Quote Suitelet executed');

        if (context.request.method === 'GET') {
            handleGet(context);
        } else {
            handlePost(context);
        }
    }

    // Returns an array of closed zone internal IDs for the given quote
    const getClosedZoneIds = (quoteId) => {
        const closedZoneSearch = search.create({
            type: 'estimate',
            settings: [{ name: 'consolidationtype', value: 'ACCTTYPE' }],
            filters: [
                ['type', 'anyof', 'Estimate'],
                'AND',
                ['custcol_nb2_zone.status', 'anyof', '16'],
                'AND',
                ['mainline', 'is', 'F'],
                'AND',
                ['internalid', 'anyof', quoteId]
            ],
            columns: [
                search.createColumn({ name: 'internalid', join: 'CUSTCOL_NB2_ZONE', label: 'Internal ID' })
            ]
        });

        const closedZoneIds = [];
        closedZoneSearch.run().each(function (result) {
            const zoneId = result.getValue({ name: 'internalid', join: 'CUSTCOL_NB2_ZONE' });
            if (zoneId) closedZoneIds.push(String(zoneId));
            return true;
        });
        log.debug('Closed Zone IDs', closedZoneIds);
        return closedZoneIds;
    }

    // Get Action — build the serverWidget form
    const handleGet = (context) => {
        log.debug('Tidy Quote Suitelet', 'Handling GET request');
        const oldQuoteId = context.request.parameters.quoteId;

        const oldQuoteRecord = record.load({
            type: record.Type.ESTIMATE,
            id: oldQuoteId,
            isDynamic: true
        });

        const lineCount = oldQuoteRecord.getLineCount({ sublistId: 'item' });
        log.debug('Old Quote Line Count', lineCount);

        const closedZoneIds = getClosedZoneIds(oldQuoteId);

        // Find lines where custcol_nb2_zone matches a closed zone
        const linesToProcess = [];
        for (let i = 0; i < lineCount; i++) {
            const lineZone = oldQuoteRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_nb2_zone', line: i });
            if (closedZoneIds.includes(String(lineZone))) {
                const itemId   = oldQuoteRecord.getSublistValue({ sublistId: 'item', fieldId: 'item',              line: i });
                const itemText = oldQuoteRecord.getSublistText({ sublistId: 'item',  fieldId: 'item',              line: i });
                const zoneText = oldQuoteRecord.getSublistText({ sublistId: 'item',  fieldId: 'custcol_nb2_zone',  line: i });
                const rate     = oldQuoteRecord.getSublistValue({ sublistId: 'item', fieldId: 'rate',              line: i });
                const quantity = oldQuoteRecord.getSublistValue({ sublistId: 'item', fieldId: 'quantity',          line: i });
                linesToProcess.push({ line: i, itemId, itemText, zoneId: String(lineZone), zoneText, rate: rate || 0, quantity: quantity || 0 });
            }
        }
        log.debug('Lines to process', linesToProcess);

        // Build the serverWidget form
        const form = serverWidget.createForm({ title: 'Tidy Quote — Remove Closed Zone Lines' });
        form.clientScriptModulePath = '/SuiteScripts/Imagesound/Quote Update/quote_update_cs.js';

        // Hidden fields to carry state through the POST
        const quoteIdField = form.addField({ id: 'custpage_quote_id', type: serverWidget.FieldType.TEXT, label: 'Quote ID' });
        quoteIdField.defaultValue = oldQuoteId;
        quoteIdField.updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });

        // Date fields
        const endDateField = form.addField({
            id: 'custpage_end_date',
            type: serverWidget.FieldType.DATE,
            label: 'End Date (Old Quote)'
        });
        endDateField.isMandatory = true;

        const startDateField = form.addField({
            id: 'custpage_start_date',
            type: serverWidget.FieldType.DATE,
            label: 'Start Date (New Quote)'
        });
        startDateField.isMandatory = true;

        // Sublist showing which lines will be removed
        const sublist = form.addSublist({
            id: 'custpage_lines_to_remove',
            type: serverWidget.SublistType.LIST,
            label: 'Lines to be Removed'
        });

        sublist.addField({ id: 'custpage_line_num',  type: serverWidget.FieldType.INTEGER,  label: 'Line #' });
        sublist.addField({ id: 'custpage_item',      type: serverWidget.FieldType.TEXT,      label: 'Item' });
        sublist.addField({ id: 'custpage_zone',      type: serverWidget.FieldType.TEXT,      label: 'Zone' });
        sublist.addField({ id: 'custpage_rate',      type: serverWidget.FieldType.CURRENCY,  label: 'Rate' });
        sublist.addField({ id: 'custpage_quantity',  type: serverWidget.FieldType.FLOAT,     label: 'Quantity' });

        linesToProcess.forEach(function (line, idx) {
            sublist.setSublistValue({ id: 'custpage_line_num', line: idx, value: line.line + 1 });
            sublist.setSublistValue({ id: 'custpage_item',     line: idx, value: line.itemText || String(line.itemId) });
            sublist.setSublistValue({ id: 'custpage_zone',     line: idx, value: line.zoneText || line.zoneId });
            sublist.setSublistValue({ id: 'custpage_rate',     line: idx, value: line.rate });
            sublist.setSublistValue({ id: 'custpage_quantity', line: idx, value: line.quantity });
        });

        form.addSubmitButton({ label: 'Process' });
        form.addButton({ id: 'custpage_cancel', label: 'Cancel', functionName: 'window.close()' });

        context.response.writePage(form);
    }

    // Post Action
    const handlePost = (context) => {
        log.debug('Tidy Quote Suitelet', 'Handling POST request');
        const params      = context.request.parameters;
        const oldQuoteId  = params.custpage_quote_id;
        const endDateStr  = params.custpage_end_date;
        const startDateStr = params.custpage_start_date;
        log.debug('Form submission', { oldQuoteId, endDateStr, startDateStr });

        const closedZoneIds = getClosedZoneIds(oldQuoteId);

        // Load the old quote to set the end date and capture line indices to remove
        const oldQuote = record.load({
            type: record.Type.ESTIMATE,
            id: oldQuoteId,
            isDynamic: true
        });

        const lineCount = oldQuote.getLineCount({ sublistId: 'item' });
        const lineIndicesToRemove = [];
        for (let i = 0; i < lineCount; i++) {
            const lineZone = oldQuote.getSublistValue({ sublistId: 'item', fieldId: 'custcol_nb2_zone', line: i });
            if (closedZoneIds.includes(String(lineZone))) {
                lineIndicesToRemove.push(i);
            }
        }
        log.debug('Line indices to remove', lineIndicesToRemove);

        // Set the end date on the old quote body and all lines, then save
        const endDate = format.parse({ value: endDateStr, type: format.Type.DATE });
        const existingCancelDate = oldQuote.getValue({ fieldId: 'custbody_nb2_quote_cancel_date' });
        if (!existingCancelDate) {
            oldQuote.setValue({ fieldId: 'custbody_nb2_quote_cancel_date', value: endDate });
        }
        for (let l = 0; l < lineCount; l++) {
            oldQuote.selectLine({ sublistId: 'item', line: l });
            const existingLineEndDate = oldQuote.getCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_nb2_contract_enddate' });
            if (!existingLineEndDate) {
                oldQuote.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_nb2_contract_enddate', value: endDate });
            }
            oldQuote.commitLine({ sublistId: 'item' });
        }
        oldQuote.save();
        log.debug('Old quote end date saved', { oldQuoteId, endDateStr });

        // Copy the old quote to create the new quote
        const newQuote = record.copy({
            type: record.Type.ESTIMATE,
            id: oldQuoteId,
            isDynamic: true
        });
        // Clear the cancelation date field on the new quote in case it was copied from the old quote.
        newQuote.setValue({
            fieldId: 'custbody_nb2_quote_cancel_date',
            value: ''
        });
        // Remove closed-zone lines in reverse order to keep indices stable
        lineIndicesToRemove.sort((a, b) => b - a).forEach(function (lineIdx) {
            newQuote.removeLine({ sublistId: 'item', line: lineIdx });
            log.debug('Removed line', lineIdx);
        });

        // Set the start date on every remaining line and clear any inherited end date
        const startDate = format.parse({ value: startDateStr, type: format.Type.DATE });
        const newLineCount = newQuote.getLineCount({ sublistId: 'item' });
        for (let n = 0; n < newLineCount; n++) {
            newQuote.selectLine({ sublistId: 'item', line: n });
            newQuote.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_nb2_contract_startdate', value: startDate });
            newQuote.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_nb2_contract_enddate', value: '' });
            newQuote.commitLine({ sublistId: 'item' });
        }

        newQuote.setValue({ fieldId: 'custbody_replacement_quote', value: oldQuoteId });
        const newQuoteId = newQuote.save();
        log.audit('Tidy Quote — new quote created', { oldQuoteId, newQuoteId });

        // Link the new quote ID back onto the old quote
        try {
            record.submitFields({
                type: record.Type.ESTIMATE,
                id: oldQuoteId,
                values: { custbody_updated_quote: newQuoteId }
            });
        } catch (e) {
            log.error('Error linking new quote to old quote', e);
        }

        context.response.write(buildSuccessHtml(oldQuoteId, newQuoteId));
    }

    // Success page shown after processing.  Refreshes the original quote to show the updates
    const buildSuccessHtml = (oldQuoteId, newQuoteId) => {
        //Ensur Ids are integers.
        const safeOldId = parseInt(oldQuoteId, 10);
        const safeNewId = parseInt(newQuoteId, 10);
        return '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Tidy Quote</title></head>' +
            '<body style="font-family:Arial,sans-serif;padding:20px;font-size:14px;color:#333">' +
            '<h2 style="color:#1770c2">Quote Tidied Successfully</h2>' +
            '<p>Closed-zone lines have been removed.</p>' +
            '<p><strong>Original Quote ID:</strong> ' + safeOldId + '</p>' +
            '<p><strong>New Quote ID:</strong> ' + safeNewId + '</p>' +
            '<script>' +
            'var origUrl = "/app/accounting/transactions/estimate.nl?id=' + safeOldId + '";' +
            'if (window.opener && !window.opener.closed) { window.opener.location.href = origUrl; }' +
            'setTimeout(function() { window.close(); }, 1500);' +
            '</script>' +
            '</body></html>';
    }

    return {
        onRequest: onRequest
    };
});