/**
 *@NApiVersion 2.1
 *@NScriptType UserEventScript
 
 */
define(['N/log'], function(log) {

    function beforeLoad(context) {
        if (context.type !== context.UserEventType.VIEW) return;

        // CS file Id for Sandbox
        // const csScriptId = 554497;

        // CS file Id for Production
        const csScriptId = 925155;

        const form = context.form;

        // form.clientScriptFileId = csScriptId; 
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
        // More buttons can be added here in the future if needed, e.g. for other quote update actions or to open different Suitelets
    }

    return {
        beforeLoad: beforeLoad,
    }
});
