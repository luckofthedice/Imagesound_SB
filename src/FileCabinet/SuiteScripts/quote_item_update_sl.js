/**
* @NApiVersion 2.1
 * @NScriptType Suitelet
 *
 * 
 * @author David Kelly
 * @version 1.0
 * @since 13/05/2026
 * @description This Suitelet is responsible for rendering the Update Quote popup form and processing the form submission to update the quote record. It retrieves the quote details, displays them in a user-friendly format, and allows users to make necessary changes before saving the updates back to NetSuite.    
*/

define(['N/record', 'N/url', 'N/log'], function(record, url, log) {

    // Suitelet script and deployment ID's.  Ensure ID are the same in prod and sandbox
    const scriptId = 'customscript_quote_update_sl';
    const deploymentId = 'customdeploy_quote_update_sl';


    function onRequest(context) {
        if (context.request.method === 'GET') {
            handleGet(context);
        } else {
            handlePost(context);
        }
    }

    // Handle GET requests to display the form with current quote details. This includes retrieving the quote record, extracting unique item/rate combinations
    function handleGet(context) {
        // Implement the logic for handling GET requests
        const quoteId = context.request.parameters.quoteId;
        const rec = record.load({
            type: record.Type.ESTIMATE,
            id: quoteId,
            isDynamic: true
        });
        const lineCount = rec.getLineCount({
            sublistId: 'item'
        });
        const seen = new Map();
        const uniqueLines = [];
        // go through each line and create a unique key based on item and rate. If the key has not been seen before, add it to the uniqueLines array.
        for (let i = 0; i < lineCount; i++) {
            const item = rec.getSublistValue({
                sublistId: 'item',
                fieldId: 'item',
                line: i
            });
            const itemText = rec.getSublistText({
                sublistId: 'item',
                fieldId: 'item',
                line: i
            });
            const rate = rec.getSublistValue({
                sublistId: 'item',
                fieldId: 'rate',
                line: i
            });
            const frequency = rec.getSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_nb2_frequency',
                line: i
            });
            const musicContentType = rec.getSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_nb2_mus_con',
                line: i
            });
            log.debug('Field Values', { line: i, item: item, rate: rate, frequency: frequency, frequencyType: typeof frequency, musicContentType: musicContentType, musicContentTypeType: typeof musicContentType });
            const key = item + '||' + rate + '||' + frequency + '||' + musicContentType;
            log.debug('Item Key', key);
            if (!seen.has(key)) {
                seen.set(key, true);

                uniqueLines.push({
                    item: item,
                    itemText: itemText,
                    rate: rate,
                    frequency: frequency,
                    musConan: musicContentType
                });
            }
            
        }
        log.debug('Unique Lines', uniqueLines);
        const actionUrl = url.resolveScript({
            scriptId: scriptId,
            deploymentId: deploymentId,
        })
        context.response.write(buildFormHtml(quoteId, uniqueLines, actionUrl));
    }

    // Handle POST requests to process the form submission, updates the original quote with the contract end dateand creates a new quote with the updated rates and start date and saving both records back to NetSuite. Finally, it returns a success message to the user.
    function handlePost(context) {
        // Implement the logic for handling POST requests
        const params = context.request.parameters
        const quoteId = params.quoteId;
        const endDate = params.endDate;
        const startDate = params.startDate;
        const lineCount = parseInt(params.lineCount, 10);
        log.debug('Form Data', { quoteId, endDate, startDate, lineCount });
        // Map the new rates from the form submission
        const rateMap = new Map();
        for (let i = 0; i < lineCount; i++) {
            const key = params['item_' + i] + '||' + params['origRate_' + i] + '||' + params['origFrequency_' + i] + '||' + params['origMusConan_' + i];
            rateMap.set(key, {
                newRate: parseFloat(params['newRate_' + i]),
                frequency: params['frequency_' + i],
                musConan: params['musConan_' + i]
            });
            log.debug('Rate Map Entry', { key, newRate: params['newRate_' + i] });
        }

        // Update the old quote with the Contract End Date
        const oldQuote = record.load({
            type: record.Type.ESTIMATE,
            id: quoteId,
            isDynamic: true
        })
        const oldLines = oldQuote.getLineCount({
            sublistId: 'item'
        });
        
        for (let l = 0; l < oldLines; l++) {
            oldQuote.selectLine({
                sublistId: 'item',
                line: l
            });
            oldQuote.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_nb2_contract_enddate',
                value: parseLocalDate(endDate)
            });
            oldQuote.commitLine({
                sublistId: 'item'
            });
        }

        const oldQuoteId = oldQuote.save();

        // Copy the old quote and update the Contract Start Date and rates based on the form submission
        const newQuote = record.copy({
            type: record.Type.ESTIMATE,
            id: oldQuoteId,
            isDynamic: true
        });
        const newLines = newQuote.getLineCount({
            sublistId: 'item'
        });
        for (let n = 0; n < newLines; n++) {
            const itemText = newQuote.getSublistValue({
                sublistId: 'item',
                fieldId: 'item',
                line: n
            });
            const oldRate = newQuote.getSublistValue({
                sublistId: 'item',
                fieldId: 'rate',
                line: n
            });
            const oldFrequency = newQuote.getSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_nb2_frequency',
                line: n
            });
            const oldMusConan = newQuote.getSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_nb2_mus_con',
                line: n
            });
            const key = itemText + '||' + oldRate + '||' + oldFrequency + '||' + oldMusConan;
            const entry = rateMap.get(key);
            newQuote.selectLine({
                sublistId: 'item',
                line: n
            });
            // check that the new rate is different from the old rate before setting it to avoid unnecessary updates
            if (entry && entry.newRate !== undefined && entry.newRate !== oldRate) {
                newQuote.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'rate',
                    value: entry.newRate
                });
            }
            if (entry && entry.frequency !== undefined) {
                newQuote.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_nb2_frequency',
                    value: entry.frequency
                });
            }
            if (entry && entry.musConan !== undefined) {
                newQuote.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_nb2_mus_con',
                    value: entry.musConan
                });
            }
            // Clear the inherated end date
            newQuote.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_nb2_contract_enddate',
                value: ''
            })
            // set the new start date
            newQuote.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_nb2_contract_startdate',
                value: parseLocalDate(startDate)
            })
            newQuote.commitLine({
                sublistId: 'item'
            });

        }
        newQuote.setValue ({
            fieldId: 'custbody_original_quote',
            value: oldQuoteId
        })
        const newQuoteId = newQuote.save();
        log.debug('New Quote Created', 'ID: ' + newQuoteId);
        try {
            const parsedEndDate = parseLocalDate(endDate);
            record.submitFields({
            type: record.Type.ESTIMATE,
            id: oldQuoteId,
            values: {
                'custbody_updated_quote' : newQuoteId,
                'custbody_nb2_quote_cancel_date' : parsedEndDate
            }
        })
        } catch (e) {
            log.error('Error updating original quote', e);
        }
        
        log.audit('Quotes Updated', 'Original ID: ' + oldQuoteId + ', New ID: ' + newQuoteId);
        context.response.write(buildSuccessHtml(quoteId, newQuoteId));

    }

    // Format Date from "YYYY-MM-DD" string to Date object without timezone shift
    function parseLocalDate(dateStr) {
        var parts = dateStr.split('-');
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    }

    // Build the HTML form for the Update Quote Popup. This will include the Contract End Date, Contract Start date and a list of the unique item/rate combinations with the option to update the rate for each combination

    function buildFormHtml(quoteId, uniqueLines, actionUrl) {
        // Created the table for the 
        let rows = uniqueLines.map(function (line, i) {
            const safeItem = String(line.item).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
            const safeItemText = String(line.itemText || line.item).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
            const freqVal = String(line.frequency || '');
            const freqSelect = '<select name="frequency_' + i + '" style="padding:4px;border:1px solid #ccc;border-radius:3px;font-size:14px">' +
                '<option value="">-- Select --</option>' +
                '<option value="1"'  + (freqVal === '1'  ? ' selected' : '') + '>1a</option>' +
                '<option value="2"'  + (freqVal === '2'  ? ' selected' : '') + '>2a</option>' +
                '<option value="3"'  + (freqVal === '3'  ? ' selected' : '') + '>3a</option>' +
                '<option value="4"'  + (freqVal === '4'  ? ' selected' : '') + '>4a</option>' +
                '<option value="5"'  + (freqVal === '5'  ? ' selected' : '') + '>5a</option>' +
                '<option value="6"'  + (freqVal === '6'  ? ' selected' : '') + '>6a</option>' +
                '<option value="7"'  + (freqVal === '7'  ? ' selected' : '') + '>7a</option>' +
                '<option value="8"'  + (freqVal === '8'  ? ' selected' : '') + '>8a</option>' +
                '<option value="9"'  + (freqVal === '9'  ? ' selected' : '') + '>9a</option>' +
                '<option value="10"' + (freqVal === '10' ? ' selected' : '') + '>10a</option>' +
                '<option value="11"' + (freqVal === '11' ? ' selected' : '') + '>11a</option>' +
                '<option value="12"' + (freqVal === '12' ? ' selected' : '') + '>12a</option>' +
                '<option value="13"' + (freqVal === '13' ? ' selected' : '') + '>1r</option>' +
                '</select>';
            const musConanVal = String(line.musConan || '');
            const musConanSelect = '<select name="musConan_' + i + '" style="padding:4px;border:1px solid #ccc;border-radius:3px;font-size:14px">' +
                '<option value="">-- Select --</option>' +
                '<option value="1"' + (musConanVal === '1' ? ' selected' : '') + '>Copyright</option>' +
                '<option value="2"' + (musConanVal === '2' ? ' selected' : '') + '>Rights Free</option>' +
                '<option value="3"' + (musConanVal === '3' ? ' selected' : '') + '>Covers</option>' +
                '<option value="4"' + (musConanVal === '4' ? ' selected' : '') + '>Advertising Only</option>' +
                '</select>';
            return [
                '<tr>',
                '  <td>' + safeItemText + '</td>',
                '  <td style="text-align:right">' + line.rate.toFixed(2) + '</td>',
                '  <td><input type="number" step="0.01" min="0" name="newRate_' + i + '" value="' + line.rate.toFixed(2) + '" style="width:110px;padding:4px;border:1px solid #ccc;border-radius:3px"></td>',
                '  <td>' + freqSelect + '</td>',
                '  <td>' + musConanSelect + '</td>',
                '  <input type="hidden" name="item_' + i + '" value="' + safeItem + '">',
                '  <input type="hidden" name="origRate_' + i + '" value="' + line.rate + '">',
                '  <input type="hidden" name="origFrequency_' + i + '" value="' + freqVal + '">',
                '  <input type="hidden" name="origMusConan_' + i + '" value="' + musConanVal + '">',
                '</tr>'
            ].join('\n');
        }).join('\n');

        let html = '<!DOCTYPE html>\n' +
            '<html><head>\n' +
            '<meta charset="UTF-8">\n' +
            '<title>Update Quote</title>\n' +
            '<style>\n' +
            '  body { font-family: Arial, sans-serif; padding: 20px; font-size: 14px; color: #333; }\n' +
            '  h2 { margin-top: 0; color: #1770c2; }\n' +
            '  .date-row { display: flex; gap: 24px; margin-bottom: 20px; }\n' +
            '  .date-group label { display: block; font-weight: bold; margin-bottom: 4px; }\n' +
            '  .date-group input { padding: 6px 8px; border: 1px solid #ccc; border-radius: 3px; font-size: 14px; }\n' +
            '  table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }\n' +
            '  th { background: #f0f0f0; font-weight: bold; text-align: left; padding: 8px 10px; border: 1px solid #ccc; }\n' +
            '  td { padding: 7px 10px; border: 1px solid #e0e0e0; }\n' +
            '  tr:nth-child(even) { background: #fafafa; }\n' +
            '  .actions { display: flex; gap: 10px; }\n' +
            '  .btn-save { padding: 9px 22px; background: #1770c2; color: #fff; border: none; cursor: pointer; border-radius: 3px; font-size: 14px; }\n' +
            '  .btn-save:hover { background: #145fa0; }\n' +
            '  .btn-cancel { padding: 9px 22px; background: #888; color: #fff; border: none; cursor: pointer; border-radius: 3px; font-size: 14px; }\n' +
            '</style>\n' +
            '</head><body>\n' +
            '<h2>Update Quote</h2>\n' +
            '<form method="POST" action="' + actionUrl + '">\n' +
            '  <input type="hidden" name="quoteId" value="' + quoteId + '">\n' +
            '  <input type="hidden" name="lineCount" value="' + uniqueLines.length + '">\n' +
            '  <div class="date-row">\n' +
            '    <div class="date-group">\n' +
            '      <label>End Date <small>(current quote)</small></label>\n' +
            '      <input type="date" id="endDate" name="endDate" required>\n' +
            '    </div>\n' +
            '    <div class="date-group">\n' +
            '      <label>Start Date <small>(new quote)</small></label>\n' +
            '      <input type="date" id="startDate" name="startDate" required>\n' +
            '    </div>\n' +
            '  </div>\n' +
            '  <script>\n' +
            '    document.getElementById("endDate").addEventListener("change", function() {\n' +
            '      if (!this.value) return;\n' +
            '      var next = new Date(this.value);\n' +
            '      next.setDate(next.getDate() + 1);\n' +
            '      document.getElementById("startDate").value = next.toISOString().split("T")[0];\n' +
            '    });\n' +
            '  </script>\n' +
            '  <table>\n' +
            '    <thead><tr><th>Item</th><th>Current Rate</th><th>New Rate</th><th>Frequency</th><th>Music Content Type</th></tr></thead>\n' +
            '    <tbody>\n' + rows + '\n    </tbody>\n' +
            '  </table>\n' +
            '  <div class="actions">\n' +
            '    <button type="submit" class="btn-save">Save</button>\n' +
            '    <button type="button" class="btn-cancel" onclick="window.close()">Cancel</button>\n' +
            '  </div>\n' +
            '</form>\n' +
            '</body></html>';

            return html;
    }
    // Build the HTML for the success message after the quote has been updated. This will include a confirmation message and the new quote ID, as well as a script to refresh the parent window and close the popup after a short delay.
    function buildSuccessHtml(quoteId, newQuoteId) {
        const safeOrigId = parseInt(quoteId, 10);
        const safeNewId  = parseInt(newQuoteId, 10);
        const html = '<!DOCTYPE html>\n' +
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
        return html;
    }
    return {
        onRequest: onRequest
    }
})