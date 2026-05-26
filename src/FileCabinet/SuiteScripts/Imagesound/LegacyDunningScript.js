/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/search', 'N/email', 'N/render', 'N/record'], (search, email, render, record) => {

    const DUNNING_LEVEL_TEXT = "Level 1: Standard Overdue Notice"; 

    const getInputData = () => {
        return search.load({ id: '5718' }); 
    };

    const map = (context) => {
        const result = JSON.parse(context.value);
        const customerId = result.values.entity.value; 
        
        // Grab the 'Fake' Invoice No (PIN logic) from 'formulatext'
        const displayInv = result.values.formulatext || result.values.tranid;

        // Grab the Currency ISO code and the FX amount
        const currencyCode = result.values.currency ? (typeof result.values.currency === 'object' ? result.values.currency.text : result.values.currency) : "";
        const rawFxAmount = result.values.fxamountremaining || result.values.amountremaining || "0.00";

        context.write({
            key: customerId,
            value: {
                invoiceId: result.id,
                recipientEmail: result.values['email.customerMain'] || result.values.cust_target_email || "",
                customerClass: result.values.class ? (typeof result.values.class === 'object' ? result.values.class.text : result.values.class) : "",
                displayInvoiceNo: displayInv,
                date: result.values.trandate,
                dueDate: result.values.duedate,
                daysOverdue: result.values.daysoverdue,
                amountRaw: rawFxAmount,
                currency: currencyCode 
            }
        });
    };

    const reduce = (context) => {
        const customerId = context.key;
        const invoiceList = context.values.map(v => JSON.parse(v));
        
        let targetEmail = "";
        for (let i = 0; i < invoiceList.length; i++) {
            if (invoiceList[i].recipientEmail && invoiceList[i].recipientEmail.includes('@')) {
                targetEmail = invoiceList[i].recipientEmail;
                break;
            }
        }

        // Determine Email Author based on Class
        let authorId = -5; 
        const customerClass = invoiceList[0].customerClass || "";
        if (customerClass.includes('Musicstyling')) { authorId = 136; } 
        else if (customerClass.includes('Imagesound')) { authorId = 135; }

        let tableHtml = '<table style="border-collapse: collapse; width: 100%; font-family: sans-serif; font-size: 13px; border: 1px solid #ddd;">';
        tableHtml += '<thead><tr style="background-color: #f2f2f2;">';
        tableHtml += '<th style="border: 1px solid #ddd; padding: 10px; text-align: left;">Inv No</th>';
        tableHtml += '<th style="border: 1px solid #ddd; padding: 10px; text-align: left;">Trans Date</th>';
        tableHtml += '<th style="border: 1px solid #ddd; padding: 10px; text-align: left;">Due Date</th>';
        tableHtml += '<th style="border: 1px solid #ddd; padding: 10px; text-align: left;">Days Overdue</th>';
        tableHtml += '<th style="border: 1px solid #ddd; padding: 10px; text-align: right;">Amount Remaining</th>';
        tableHtml += '</tr></thead><tbody>';

        invoiceList.forEach(inv => {
            // Formatting the number and adding the Currency ISO code
            let formattedNumber = parseFloat(inv.amountRaw).toLocaleString('en-GB', { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
            });
            let fullAmountDisplay = (inv.currency ? inv.currency + " " : "") + formattedNumber;

            tableHtml += '<tr>';
            tableHtml += '<td style="border: 1px solid #ddd; padding: 10px;">' + inv.displayInvoiceNo + '</td>';
            tableHtml += '<td style="border: 1px solid #ddd; padding: 10px;">' + inv.date + '</td>';
            tableHtml += '<td style="border: 1px solid #ddd; padding: 10px;">' + (inv.dueDate || "") + '</td>';
            tableHtml += '<td style="border: 1px solid #ddd; padding: 10px;">' + (inv.daysOverdue || "0") + '</td>';
            tableHtml += '<td style="border: 1px solid #ddd; padding: 10px; text-align: right;">' + fullAmountDisplay + '</td>';
            tableHtml += '</tr>';
        });
        tableHtml += '</tbody></table>';

        try {
            const mergeResult = render.mergeEmail({
                templateId: 50,
                entity: record.load({ type: record.Type.CUSTOMER, id: customerId })
            });

            email.send({
                author: authorId, 
                recipients: targetEmail ? targetEmail.trim() : customerId,
                subject: mergeResult.subject,
                body: mergeResult.body.replace("REPLACE_WITH_TABLE", tableHtml),
                relatedRecords: { entityId: customerId }
            });

            // Update legacy dunning fields on invoices
            invoiceList.forEach(inv => {
                record.submitFields({
                    type: record.Type.INVOICE,
                    id: inv.invoiceId,
                    values: {
                        'custbody_legacy_dunning_date': new Date(),
                        'custbody_legacy_dunning_level': DUNNING_LEVEL_TEXT
                    }
                });
            });

        } catch (e) {
            log.error('Script Error', e.message);
        }
    };

    return { getInputData, map, reduce };
});