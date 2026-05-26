/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */
define(['N/ui/dialog', 'N/currentRecord'], (dialog, currentRecord) => {

    const saveRecord = (scriptContext) => {
        const rec = scriptContext.currentRecord;
        
        // Retrieve field values
        const isPortalCase = rec.getValue({ fieldId: 'custeventims_portal_customer_case' });
        const status = rec.getValue({ fieldId: 'status' });
        
        // Check if Portal Checkbox is true AND Status is 'Closed' 
        // Note: Replace '5' with the internal ID of your "Closed" status
        if (isPortalCase === true && status === '5') {
            
            // Using a simple alert or confirm
            // If you want to force them to acknowledge, use dialog.alert
            alert('REMINDER: This case is marked as a Portal Case. Please ensure the status is also updated on the external Customer Portal.');
            
            return true; // Allows the record to save after the alert is dismissed
        }

        return true;
    };

    return {
        saveRecord: saveRecord
    };
});