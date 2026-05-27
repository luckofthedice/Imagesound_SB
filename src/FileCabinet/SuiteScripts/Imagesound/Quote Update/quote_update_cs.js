/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @description Attached to Quote record via quote_update_ue.js (button handlers) and to Suitelet
 *              popup forms that have End Date / Start Date fields (fieldChanged auto-population).
 */
define(['N/currentRecord', 'N/url'], function(currentRecord, url) {

    const pageInit = () => {
    }

    // Auto-populates Start Date as the day after End Date when End Date changes on a popup form
    const fieldChanged = (context) => {
        if (context.fieldId !== 'custpage_end_date') return;

        const rec = context.currentRecord;
        const endDate = rec.getValue({ fieldId: 'custpage_end_date' });

        if (endDate instanceof Date && !isNaN(endDate)) {
            const nextDay = new Date(endDate);
            nextDay.setDate(nextDay.getDate() + 1);
            rec.setValue({ fieldId: 'custpage_start_date', value: nextDay });
        }
    }

    // Update Quote button handler: opens the Quote Update Suitelet in a popup, passing the current quote's internal ID as a parameter
    const updateQuote = () => {
        console.log('Update Quote button clicked');
        const rec     = currentRecord.get();
        const quoteId = rec.id;
        // Suitelet script and deployment ids for Quote Update.  Ensure they match in prod and sandbox.
        const updateQuoteSlScriptId = 'customscript_quote_update_sl';
        const updateQuoteSlDeploymentId = 'customdeploy_quote_update_sl';


        const suiteletUrl = url.resolveScript({
            scriptId:          updateQuoteSlScriptId,
            deploymentId:      updateQuoteSlDeploymentId,
            params:            { quoteId: quoteId },
            returnExternalUrl: false
        });

        window.open(
            suiteletUrl,
            'updateQuotePopup',
            'width=720,height=600,resizable=yes,scrollbars=yes,toolbar=no,menubar=no,location=no,status=no'
        );
    }
    const updateQuoteItems = () => {
        console.log('Update Quote Items button clicked');
        const rec     = currentRecord.get();
        const quoteId = rec.id;
        // Suitelet script and deployment id's for Quote Item Update.  Ensure they match in prod and sandbox.
        const updateQuoteItemsSlScriptId     = 'customscript_quote_item_update_sl';
        const updateQuoteItemsSlDeploymentId = 'customdeploy_quote_item_update_sl';

        const suiteletUrl = url.resolveScript({
            scriptId:          updateQuoteItemsSlScriptId,
            deploymentId:      updateQuoteItemsSlDeploymentId,
            params:            { quoteId: quoteId },
            returnExternalUrl: false
        });

        window.open(
            suiteletUrl,
            'updateQuoteItemsPopup',
            'width=900,height=700,resizable=yes,scrollbars=yes,toolbar=no,menubar=no,location=no,status=no'
        );
    }

    const tidyQuote = () => {
        console.log('Tidy Quote button clicked');
        const rec     = currentRecord.get();
        const quoteId = rec.id;
        // Suitelet script and deployment id's for Quote Tidy.  Ensure they match in prod and sandbox.
        const quoteTidySlScriptId     = 'customscript_quote_tidy_sl';
        const quoteTidySlDeploymentId = 'customdeploy_quote_tidy_sl';

        const suiteletUrl = url.resolveScript({
            scriptId:          quoteTidySlScriptId,
            deploymentId:      quoteTidySlDeploymentId,
            params:            { quoteId: quoteId },
            returnExternalUrl: false
        });

        window.open(
            suiteletUrl,
            'tidyQuotePopup',
            'width=900,height=700,resizable=yes,scrollbars=yes,toolbar=no,menubar=no,location=no,status=no'
        );
    }
    // If more buttons are added in the future, their functions can be defined here and linked in quote_update_ue.js

    return {
        pageInit:          pageInit,
        fieldChanged:      fieldChanged,
        updateQuote:       updateQuote,
        updateQuoteItems:  updateQuoteItems,
        tidyQuote:         tidyQuote
    };
});
