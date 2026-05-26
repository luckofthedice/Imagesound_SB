/**
 *@NApiVersion 2.1
 *@NScriptType ClientScript
 * Attached to Quote record via quote_update_ue.js. Provides the button handler that opens the Quote Update popup.
 */
define(['N/currentRecord', 'N/url'], function(currentRecord, url) {

    function pageInit() {
    }

    // Update Quote button handler: opens the Quote Update Suitelet in a popup, passing the current quote's internal ID as a parameter
    function updateQuote() {
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
    function updateQuoteItems() {
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
    // If more buttons are added in the future, their functions can be defined here and linked in quote_update_ue.js

    return {
        pageInit:          pageInit,
        updateQuote:       updateQuote,
        // updateQuoteItems:  updateQuoteItems
    };
});
