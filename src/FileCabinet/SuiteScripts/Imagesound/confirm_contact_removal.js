/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 */
define(['N/ui/dialog'], function(dialog) {
    function validateDelete(context) {
        var sublistId = context.sublistId;
        
        // Target the 'contacts' sublist specifically
        if (sublistId === 'contactroles') { 
            return confirm('Are you sure you want to remove this contact from this record?');
        }
        return true;
    }

    return {
        validateDelete: validateDelete
    };
});