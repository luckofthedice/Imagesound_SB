/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */
define(['N/currentRecord'], (currentRecord) => {

    function validateLine(context) {
        const record = context.currentRecord;

        if (context.sublistId === 'item') {
            const bodyLocation = record.getValue({ fieldId: 'location' });
            const lineLocation = record.getCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'location'
            });

            // Only overwrite if the line location is currently empty
            // This preserves the 'Default but Editable' requirement
            if (bodyLocation && !lineLocation) {
                record.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'location',
                    value: bodyLocation,
                    ignoreFieldChange: true
                });
            }
        }
        return true; // Mandatory for validateLine to allow the line to be added
    }

    return {
        validateLine: validateLine
    };
});