/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 *
 * @author David Kelly
 * @version 1.0
 * @since 21/05/2026
 * @description Suitelet for updating quote items. Renders a native NetSuite serverWidget form
 *              allowing users to update the item, rate, frequency, music content type, and
 *              contract dates. On submit, sets the end date on the original quote and creates
 *              a new quote copy with the updated values.
 *
 */

define(['N/record', 'N/url', 'N/ui/serverWidget', 'N/format', 'N/log'],
    function (record, url, serverWidget, format, log) {

    const SCRIPT_ID     = 'customscript_quote_item_update_sl';
    const DEPLOYMENT_ID = 'customdeploy_quote_item_update_sl';

    // ─── Entry point ──────────────────────────────────────────────────────────────

    function onRequest(context) {
        if (context.request.method === 'GET') {
            handleGet(context);
        } else {
            handlePost(context);
        }
    }

    // ─── GET: render serverWidget form ────────────────────────────────────────────

    function handleGet(context) {
        const quoteId = context.request.parameters.quoteId;
        log.debug('Item Update Quote ID', quoteId);

        const rec = record.load({
            type: record.Type.ESTIMATE,
            id: quoteId,
            isDynamic: true
        });

        // Build unique line combinations (item + rate + frequency + music content type)
        const lineCount   = rec.getLineCount({ sublistId: 'item' });
        const seen        = new Map();
        const uniqueLines = [];

        for (let i = 0; i < lineCount; i++) {
            const item      = rec.getSublistValue({ sublistId: 'item', fieldId: 'item',                  line: i });
            const itemText  = rec.getSublistText ({ sublistId: 'item', fieldId: 'item',                  line: i });
            const rate      = rec.getSublistValue({ sublistId: 'item', fieldId: 'rate',                  line: i });
            const frequency = rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_nb2_frequency', line: i });
            const musicContent = rec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_nb2_mus_con',   line: i });

            const key = item + '||' + rate + '||' + frequency + '||' + musicContent;
            if (!seen.has(key)) {
                seen.set(key, true);
                uniqueLines.push({ item, itemText, rate, frequency, musicContent});
            }
        }

        log.debug('Unique Lines', uniqueLines);

        // ── Create form ──────────────────────────────────────────────────────────

        const form = serverWidget.createForm({ title: 'Update Quote Items' });
        form.clientScriptModulePath = '/SuiteScripts/Imagesound/Quote Update/quote_update_cs.js';

        // Hidden: original quote ID
        const quoteIdFld = form.addField({
            id:    'custpage_quote_id',
            type:  serverWidget.FieldType.TEXT,
            label: 'Quote ID'
        });
        quoteIdFld.defaultValue = quoteId;
        quoteIdFld.updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });

        // Contract date fields
        const endDateFld = form.addField({
            id:    'custpage_end_date',
            type:  serverWidget.FieldType.DATE,
            label: 'End Date (current quote)'
        });
        endDateFld.isMandatory = true;

        const startDateFld = form.addField({
            id:    'custpage_start_date',
            type:  serverWidget.FieldType.DATE,
            label: 'Start Date (new quote)'
        });
        startDateFld.isMandatory = true;

        // ── Sublist ──────────────────────────────────────────────────────────────

        const sublist = form.addSublist({
            id:    'custpage_lines',
            type:  serverWidget.SublistType.LIST,
            label: 'Quote Lines'
        });

        // New item — SELECT sourced from the NetSuite item list (typeahead)
        sublist.addField({
            id:     'custpage_item',
            type:   serverWidget.FieldType.SELECT,
            label:  'Item',
            source: 'item'
        });

        // Original item label (read-only reference column)
        const origItemLabelFld = sublist.addField({
            id:    'custpage_orig_item_label',
            type:  serverWidget.FieldType.TEXT,
            label: 'Original Item'
        });
        origItemLabelFld.updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });

        // Hidden: original item internal ID (used for key matching in POST)
        const origItemFld = sublist.addField({
            id:    'custpage_orig_item',
            type:  serverWidget.FieldType.TEXT,
            label: 'Orig Item ID'
        });
        origItemFld.updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });

        // Current rate (read-only)
        const currentRateFld = sublist.addField({
            id:    'custpage_current_rate',
            type:  serverWidget.FieldType.TEXT,
            label: 'Current Rate'
        });
        currentRateFld.updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });

        // New rate
        const newRateFld = sublist.addField({
            id:    'custpage_new_rate',
            type:  serverWidget.FieldType.FLOAT,
            label: 'New Rate'
        });
        newRateFld.updateDisplayType({ displayType: serverWidget.FieldDisplayType.ENTRY });

        // Hidden: original rate (used for key matching in POST)
        const origRateFld = sublist.addField({
            id:    'custpage_orig_rate',
            type:  serverWidget.FieldType.TEXT,
            label: 'Orig Rate'
        });
        origRateFld.updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });

        // Frequency
        const freqFld = sublist.addField({
            id:    'custpage_frequency',
            type:  serverWidget.FieldType.SELECT,
            label: 'Frequency',
            source: 'customrecordzab_charge_schedules'
        });


        // Hidden: original frequency
        const origFreqFld = sublist.addField({
            id:    'custpage_orig_frequency',
            type:  serverWidget.FieldType.TEXT,
            label: 'Orig Frequency'
        });
        origFreqFld.updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });

        // Music content type
        const musContentFld = sublist.addField({
            id:    'custpage_mus_conan',
            type:  serverWidget.FieldType.SELECT,
            label: 'Music Content Type',
            source: 'customlist_nb2_mus_con_lis'
        });


        // Hidden: original music content type
        const origMusFld = sublist.addField({
            id:    'custpage_orig_mus_conan',
            type:  serverWidget.FieldType.TEXT,
            label: 'Orig Music Content'
        });
        origMusFld.updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });

        // ── Populate rows ────────────────────────────────────────────────────────

        uniqueLines.forEach(function (line, i) {
            sublist.setSublistValue({ id: 'custpage_item',            line: i, value: String(line.item) });
            sublist.setSublistValue({ id: 'custpage_orig_item_label', line: i, value: String(line.itemText || line.item) });
            sublist.setSublistValue({ id: 'custpage_orig_item',       line: i, value: String(line.item) });
            sublist.setSublistValue({ id: 'custpage_current_rate',    line: i, value: Number(line.rate).toFixed(2) });
            sublist.setSublistValue({ id: 'custpage_new_rate',        line: i, value: String(line.rate) });
            sublist.setSublistValue({ id: 'custpage_orig_rate',       line: i, value: String(line.rate) });

            if (line.frequency) {
                sublist.setSublistValue({ id: 'custpage_frequency',      line: i, value: String(line.frequency) });
                sublist.setSublistValue({ id: 'custpage_orig_frequency', line: i, value: String(line.frequency) });
            }
            if (line.musicContent) {
                sublist.setSublistValue({ id: 'custpage_mus_conan',      line: i, value: String(line.musicContent) });
                sublist.setSublistValue({ id: 'custpage_orig_mus_conan', line: i, value: String(line.musicContent) });
            }
        });

        // ── Buttons ──────────────────────────────────────────────────────────────

        form.addSubmitButton({ label: 'Save' });
        form.addButton({
            id:           'custpage_cancel',
            label:        'Cancel',
            functionName: 'window.close()'
        });

        context.response.writePage(form);
    }

    // ─── POST: process form submission ────────────────────────────────────────────

    function handlePost(context) {
        const params    = context.request.parameters;
        const quoteId   = params.custpage_quote_id;
        const endDate   = params.custpage_end_date;
        const startDate = params.custpage_start_date;

        const lineCount = context.request.getLineCount({ group: 'custpage_lines' });
        log.debug('POST Data', { quoteId, endDate, startDate, lineCount });

        // Build update map: originalKey → { newItem, newRate, newFrequency, newMusicContent}
        const updateMap = new Map();
        for (let i = 0; i < lineCount; i++) {
            const origItem = context.request.getSublistValue({ group: 'custpage_lines', name: 'custpage_orig_item',      line: i });
            const origRate = context.request.getSublistValue({ group: 'custpage_lines', name: 'custpage_orig_rate',      line: i });
            const origFreq = context.request.getSublistValue({ group: 'custpage_lines', name: 'custpage_orig_frequency', line: i });
            const origMus  = context.request.getSublistValue({ group: 'custpage_lines', name: 'custpage_orig_mus_conan', line: i });

            const newItem  = context.request.getSublistValue({ group: 'custpage_lines', name: 'custpage_item',           line: i });
            const newRate  = context.request.getSublistValue({ group: 'custpage_lines', name: 'custpage_new_rate',       line: i });
            const newFreq  = context.request.getSublistValue({ group: 'custpage_lines', name: 'custpage_frequency',      line: i });
            const newMus   = context.request.getSublistValue({ group: 'custpage_lines', name: 'custpage_mus_conan',      line: i });

            const key = origItem + '||' + origRate + '||' + origFreq + '||' + origMus;
            updateMap.set(key, {
                newItem:      newItem,
                newRate:      parseFloat(newRate),
                newFrequency: newFreq,
                newmusicContent:  newMus
            });
            log.debug('Update Map Entry', { key, newItem, newRate, newFreq, newMus });
        }

        // ── Set end date on all lines of the original quote ───────────────────────

        const oldQuote     = record.load({ type: record.Type.ESTIMATE, id: quoteId, isDynamic: true });
        const oldLineCount = oldQuote.getLineCount({ sublistId: 'item' });

        for (let l = 0; l < oldLineCount; l++) {
            oldQuote.selectLine({ sublistId: 'item', line: l });
            oldQuote.setCurrentSublistValue({
                sublistId: 'item',
                fieldId:   'custcol_nb2_contract_enddate',
                value:     parseLocalDate(endDate)
            });
            oldQuote.commitLine({ sublistId: 'item' });
        }

        // The nb2_quote_ue afterSubmit fires after the commit, so the record is always
        // saved even if the UE throws. Catch UE errors and fall back to the original ID.
        let oldQuoteId;
        try {
            oldQuoteId = oldQuote.save();
        } catch (ueError) {
            log.error('UE error on old quote save (record was committed)', ueError.message || String(ueError));
            oldQuoteId = parseInt(quoteId, 10);
        }

        // ── Copy quote and apply updates ──────────────────────────────────────────

        const newQuote     = record.copy({ type: record.Type.ESTIMATE, id: oldQuoteId, isDynamic: true });
        // Clear the cancelation date on the new quote in case it was copied from the old quote.
        newQuote.setValue({
            fieldId: 'custbody_nb2_quote_cancel_date',
            value: ''
        })
        const newLineCount = newQuote.getLineCount({ sublistId: 'item' });

        for (let n = 0; n < newLineCount; n++) {
            const itemId   = newQuote.getSublistValue({ sublistId: 'item', fieldId: 'item',                  line: n });
            const rate     = newQuote.getSublistValue({ sublistId: 'item', fieldId: 'rate',                  line: n });
            const freq     = newQuote.getSublistValue({ sublistId: 'item', fieldId: 'custcol_nb2_frequency', line: n });
            const musicContent= newQuote.getSublistValue({ sublistId: 'item', fieldId: 'custcol_nb2_mus_con',   line: n });

            const key   = itemId + '||' + rate + '||' + freq + '||' + musicContent;
            const entry = updateMap.get(key);

            newQuote.selectLine({ sublistId: 'item', line: n });

            if (entry) {
                // Change item if the user selected a different one
                if (entry.newItem && String(entry.newItem) !== String(itemId)) {
                    newQuote.setCurrentSublistValue({ sublistId: 'item', fieldId: 'item', value: entry.newItem });
                }
                // Update rate if changed
                if (!isNaN(entry.newRate) && entry.newRate !== rate) {
                    newQuote.setCurrentSublistValue({ sublistId: 'item', fieldId: 'rate', value: entry.newRate });
                }
                // Update frequency
                if (entry.newFrequency !== undefined) {
                    newQuote.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_nb2_frequency', value: entry.newFrequency });
                }
                // Update music content type
                if (entry.newMusicContent!== undefined) {
                    newQuote.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_nb2_mus_con', value: entry.newMusicContent});
                }
            }

            // Clear inherited end date and set new start date
            newQuote.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_nb2_contract_enddate',   value: '' });
            newQuote.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_nb2_contract_startdate', value: parseLocalDate(startDate) });

            newQuote.commitLine({ sublistId: 'item' });
        }

        newQuote.setValue({ fieldId: 'custbody_original_quote', value: oldQuoteId });
        const newQuoteId = newQuote.save();
        log.debug('New Quote Created', 'ID: ' + newQuoteId);

        try {
            record.submitFields({
                type:   record.Type.ESTIMATE,
                id:     oldQuoteId,
                values: { 
                    'custbody_updated_quote': newQuoteId,
                    'custbody_nb2_quote_cancel_date': parseLocalDate(endDate)
                 }
            });
        } catch (e) {
            log.error('Error updating original quote', e);
        }

        log.audit('Quotes Updated', 'Original ID: ' + oldQuoteId + ', New ID: ' + newQuoteId);
        context.response.write(buildSuccessHtml(quoteId, newQuoteId));
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────────

    // Parse a date string submitted from a serverWidget DATE field using the account's
    // date format via N/format, which handles locale differences automatically.
    function parseLocalDate(dateStr) {
        if (!dateStr) return null;
        return format.parse({ value: dateStr, type: format.Type.DATE });
    }

    function buildSuccessHtml(originalQuoteId, newQuoteId) {
        const safeOrigId = parseInt(originalQuoteId, 10);
        const safeNewId  = parseInt(newQuoteId, 10);
        return '<!DOCTYPE html>\n' +
            '<html><head><meta charset="UTF-8"><title>Quote Updated</title></head>\n' +
            '<body style="font-family:Arial,sans-serif;padding:20px">\n' +
            '  <p style="color:green;font-weight:bold">&#10003; Quote updated successfully.</p>\n' +
            '  <p>New quote ID: <strong>' + safeNewId + '</strong></p>\n' +
            '  <script>\n' +
            '    var origUrl = "/app/accounting/transactions/estimate.nl?id=' + safeOrigId + '";\n' +
            '    var newUrl  = "/app/accounting/transactions/estimate.nl?id=' + safeNewId  + '";\n' +
            '    if (window.opener && !window.opener.closed) {\n' +
            '      window.opener.location.href = origUrl;\n' +
            '      window.opener.open(newUrl, "_blank");\n' +
            '    } else {\n' +
            '      window.open(newUrl, "_blank");\n' +
            '    }\n' +
            '    setTimeout(function() { window.close(); }, 1500);\n' +
            '  </script>\n' +
            '</body></html>';
    }

    return { onRequest: onRequest };
});
