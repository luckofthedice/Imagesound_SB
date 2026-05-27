/**
 *@NApiVersion 2.1
 *@NScriptType UserEventScript
 
 */
define(['N/log'], function(log) {

    function beforeLoad(context) {
        if (context.type !== context.UserEventType.VIEW) return;

        const form = context.form;

        form.clientScriptModulePath = 'SuiteScripts/Imagesound/Quote Update/quote_update_cs.js';
        // Add button to open Quote Update popup
        form.addButton({
            id: 'custpage_update_quote',
            label: 'Update Quote',
            functionName: 'updateQuote'
        });
        // Add button to copy and update Quote Items
        form.addButton({
            id: 'custpage_update_quote_items',
            label: 'Update Quote Items',
            functionName: 'updateQuoteItems'
        });
        // Add button to remove Zones that are status 'Lost Customer'
        form.addButton({
            id: 'custpage_tidy_quote',
            label: 'Remove Closed Zone Lines',
            functionName: 'tidyQuote'
         });
        // More buttons can be added here in the future if needed, e.g. for other quote update actions or to open different Suitelets
    }

    return {
        beforeLoad: beforeLoad,
    }
});
